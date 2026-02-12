const fs = require("fs");
const ExcelJS = require("exceljs");

// Derive display name and id from a condition (disease or symptom type)
const getConditionDisplay = (conditionData) => ({
    conditionName: conditionData.conditionName || conditionData.disease_title || conditionData.symptom_title || 'N/A',
    conditionId: conditionData.conditionId || conditionData.condition_id || 'N/A',
});

// Convert ExcelJS worksheet to array of row objects (first row = headers)
function sheetToJson(worksheet) {
    const jsonData = [];
    const headerRow = worksheet.getRow(1);
    if (!headerRow || headerRow.cellCount === 0) return jsonData;
    const headers = headerRow.values.slice(1); // values[0] is empty (1-based index)

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const key = headers[colNumber - 1];
            if (key !== undefined && key !== null) rowData[key] = cell.value;
        });
        if (Object.keys(rowData).length) jsonData.push(rowData);
    });
    return jsonData;
}

// Function to save record to Excel sheet. conditionData can be a single condition or array of conditions.
const saveToExcel = async (result, patientData, conditionData, model, payload) => {
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

    const workbook = new ExcelJS.Workbook();
    let existingData = [];

    if (fs.existsSync(excelFileName)) {
        await workbook.xlsx.readFile(excelFileName);
        const worksheet = workbook.worksheets[0];
        if (worksheet) existingData = sheetToJson(worksheet);
    }

    existingData.push(...records);

    const sheetName = 'Health Records';
    const existingSheet = workbook.getWorksheet(sheetName);
    if (existingSheet) workbook.removeWorksheet(existingSheet.id);
    const worksheet = workbook.addWorksheet(sheetName);

    const headers = Object.keys(existingData[0]);
    worksheet.addRow(headers);
    existingData.forEach((row) => worksheet.addRow(headers.map((h) => row[h])));

    const colWidths = [25, 15, 12, 10, 20, 30, 50, 60, 60, 60, 60, 60, 60, 15, 18, 15];
    colWidths.forEach((wch, i) => {
        worksheet.getColumn(i + 1).width = wch;
    });

    await workbook.xlsx.writeFile(excelFileName);
    console.log(`Record saved to ${excelFileName}`);
};


module.exports = { saveToExcel };
