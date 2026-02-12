const fs = require("fs");
const XLSX = require("xlsx");
const { generatePDFReport } = require("./report-pdf");

// Derive display name and id from a condition (disease or symptom type)
const getConditionDisplay = (conditionData) => ({
    conditionName: conditionData.conditionName || conditionData.disease_title || conditionData.symptom_title || 'N/A',
    conditionId: conditionData.conditionId || conditionData.condition_id || 'N/A',
});

// Function to save record to Excel sheet. conditionData can be a single condition or array of conditions.
const saveToExcel = (result, patientData, conditionData, model, payload) => {
    const excelFileName = 'health_records.xlsx';
    const timestamp = new Date().toISOString();
    const conditionsList = Array.isArray(conditionData) ? conditionData : [conditionData];

    const baseRecord = {
        'Timestamp': timestamp,
        'Payload Data': JSON.stringify(payload),
        'Patient Name': patientData.name,
        'Patient Gender': patientData.gender,
        'Patient Age': patientData.age,
        'Overall Summary': result.data.overallSummary,
        'Health Alerts': result.data.healthAlerts.map(alert => `${alert.level}: ${alert.message}`).join(' | '),
        'Vitals Summary': result.data.vitalsSummary.join(' | '),
        'Daily Patterns': result.data.dailyPatterns.join(' | '),
        'Smart Advices': result.data.smartAdvices.join(' | '),
        'Care Team Notes': result.data.careTeamNotes.join(' | '),
        'Next Steps': result.data.nextSteps.join(' | '),
        'Model': model,
        'Prompt Tokens': result.tokenUsage.prompt_tokens,
        'Completion Tokens': result.tokenUsage.completion_tokens,
        'Total Tokens': result.tokenUsage.total_tokens
    };

    const records = conditionsList.map((c) => {
        const { conditionName, conditionId } = getConditionDisplay(c);
        return { ...baseRecord, 'Condition Name': conditionName, 'Condition ID': conditionId };
    });

    let workbook;
    let worksheet;
    let existingData = [];

    // Check if Excel file exists
    if (fs.existsSync(excelFileName)) {
        // Read existing workbook
        workbook = XLSX.readFile(excelFileName);
        // Get the first sheet (or create one if it doesn't exist)
        const sheetName = workbook.SheetNames[0] || 'Health Records';
        worksheet = workbook.Sheets[sheetName];

        // Convert existing data to JSON
        existingData = XLSX.utils.sheet_to_json(worksheet);
    } else {
        // Create new workbook
        workbook = XLSX.utils.book_new();
    }

    // Add new record(s) to existing data (one row per condition)
    existingData.push(...records);

    // Create new worksheet from updated data
    worksheet = XLSX.utils.json_to_sheet(existingData);

    // Set column widths for better readability
    const colWidths = [
        { wch: 25 }, // Timestamp
        { wch: 15 }, // Patient Name
        { wch: 12 }, // Patient Gender
        { wch: 10 }, // Patient Age
        { wch: 20 }, // Condition Name
        { wch: 30 }, // Condition ID
        { wch: 50 }, // Overall Summary
        { wch: 60 }, // Health Alerts
        { wch: 60 }, // Vitals Summary
        { wch: 60 }, // Daily Patterns
        { wch: 60 }, // Smart Advices
        { wch: 60 }, // Care Team Notes
        { wch: 60 }, // Next Steps
        { wch: 15 }, // Prompt Tokens
        { wch: 18 }, // Completion Tokens
        { wch: 15 }  // Total Tokens
    ];
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    const sheetName = 'Health Records';
    if (workbook.SheetNames.includes(sheetName)) {
        workbook.Sheets[sheetName] = worksheet;
    } else {
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    // Write workbook to file
    XLSX.writeFile(workbook, excelFileName);
    console.log(`Record saved to ${excelFileName}`);
};

// generatePDFReport is provided by report-pdf.js (HTML-to-PDF via Puppeteer).
// Re-export for callers that require("./utils").

module.exports = { saveToExcel, generatePDFReport };