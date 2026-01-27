// Function to generate PDF report
const PDFDocument = require("pdfkit");
const fs = require("fs");
const XLSX = require("xlsx");

// Function to save record to Excel sheet
const saveToExcel = (result, patientData, conditionData, model) => {
    const excelFileName = 'health_records.xlsx';
    const timestamp = new Date().toISOString();

    // Prepare the record row
    const record = {
        'Timestamp': timestamp,
        'Patient Name': patientData.name,
        'Patient Gender': patientData.gender,
        'Patient Age': patientData.age,
        'Condition Name': conditionData.conditionName,
        'Condition ID': conditionData.conditionId,
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

    // Add new record to existing data
    existingData.push(record);

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

const generatePDFReport = (result, patientData, conditionData, vitalsData = []) => {
    const pdfFileName = `health_report_${new Date().toISOString().split('T')[0]}.pdf`;
    const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        info: {
            Title: 'Health Insight Report',
            Author: 'Health Track AI System',
            Subject: 'Medical Health Analysis Report',
            Creator: 'Health Track AI Insight'
        }
    });

    // Track page number
    let pageNumber = 1;

    // Helper function to add header on each page
    const addHeader = () => {
        const pageWidth = doc.page.width;
        const margin = 50;

        // Top border line
        doc.moveTo(margin, 50)
            .lineTo(pageWidth - margin, 50)
            .strokeColor('#2c5aa0')
            .lineWidth(2)
            .stroke();

        // Report title
        doc.fontSize(18)
            .font('Helvetica-Bold')
            .fillColor('#2c5aa0')
            .text('HEALTH INSIGHT REPORT', margin, 60, { width: pageWidth - 2 * margin, align: 'center' });

        // Subtitle
        doc.fontSize(9)
            .font('Helvetica')
            .fillColor('#666666')
            .text('AI-Generated Medical Analysis', margin, 85, { width: pageWidth - 2 * margin, align: 'center' });

        // Date and Report ID
        const reportDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const reportTime = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        doc.fontSize(8)
            .font('Helvetica')
            .fillColor('#666666')
            .text(`Report Date: ${reportDate} | Time: ${reportTime}`, margin, 105, { width: pageWidth - 2 * margin, align: 'center' });

        // Bottom border line
        doc.moveTo(margin, 125)
            .lineTo(pageWidth - margin, 125)
            .strokeColor('#2c5aa0')
            .lineWidth(1)
            .stroke();

        // Set Y position after header
        doc.y = 135;
    };

    // Helper function to add footer on each page
    const addFooter = () => {
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const margin = 50;

        // Footer border
        doc.moveTo(margin, pageHeight - 60)
            .lineTo(pageWidth - margin, pageHeight - 60)
            .strokeColor('#cccccc')
            .lineWidth(0.5)
            .stroke();

        // Disclaimer text
        doc.fontSize(7)
            .font('Helvetica-Oblique')
            .fillColor('#999999')
            .text('This report is AI-generated and for informational purposes only. Not a medical diagnosis.',
                margin, pageHeight - 55, { width: pageWidth - 2 * margin, align: 'center' });

        // Page number
        doc.fontSize(8)
            .font('Helvetica')
            .fillColor('#666666')
            .text(`Page ${pageNumber}`, margin, pageHeight - 40, { width: pageWidth - 2 * margin, align: 'center' });
    };

    // Helper function to check if new page needed
    const checkNewPage = (requiredSpace = 50) => {
        // Account for footer space (60px) and some margin (10px for safety)
        const footerSpace = 60;
        const margin = 10;
        const maxY = doc.page.height - footerSpace - margin;

        if (doc.y + requiredSpace > maxY) {
            addFooter();
            doc.addPage();
            pageNumber++;
            addHeader();
        }
    };

    // Helper function to add section title
    const addSectionTitle = (title, fontSize = 12) => {
        checkNewPage(30);
        // Only add spacing if we're not at the start of a new page
        if (doc.y > 135) {
            doc.moveDown(0.5);
        }
        const startY = doc.y;

        // Section background
        doc.rect(50, startY, 495, 20)
            .fillColor('#e8f0f8')
            .fill();

        doc.fontSize(fontSize)
            .font('Helvetica-Bold')
            .fillColor('#2c5aa0')
            .text(title.toUpperCase(), 55, startY + 5, { width: 485 });

        doc.y = startY + 25;
    };

    // Helper function to add text
    const addText = (text, fontSize = 10, color = '#333333', lineSpacing = 1.2) => {
        checkNewPage(20);
        if (!text) return;
        doc.fontSize(fontSize)
            .font('Helvetica')
            .fillColor(color)
            .text(text, {
                align: 'left',
                paragraphGap: 5,
                lineGap: lineSpacing,
                width: 495
            });
        doc.moveDown(0.3);
    };

    // Helper function to add list item
    const addListItem = (text, indent = 25) => {
        checkNewPage(15);
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#333333')
            .text(`• ${text}`, { indent: indent, paragraphGap: 3 });
        doc.moveDown(0.2);
    };

    // Helper function to add table row
    const addTableRow = (label, value, labelWidth = 200, valueWidth = 295) => {
        checkNewPage(15);
        const startX = 50;
        const startY = doc.y;

        doc.fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#555555')
            .text(label, startX, startY + 2, { width: labelWidth, align: 'left' });

        doc.font('Helvetica')
            .fillColor('#333333')
            .text(value || 'N/A', startX + labelWidth, startY + 2, { width: valueWidth, align: 'left' });

        doc.y = startY + 16;
    };

    // Helper function to create vitals table
    const addVitalsTable = (vitals) => {
        if (!vitals || vitals.length === 0) return;

        checkNewPage(100);
        // Only add spacing if we're not at the start of a new page
        if (doc.y > 135) {
            doc.moveDown(0.5);
        }
        const tableStartY = doc.y;
        const tableWidth = 495;
        const rowHeight = 20;
        const headerHeight = 25;

        // Column widths that add up to tableWidth (495)
        const colWidths = [110, 75, 70, 70, 70, 100]; // Date/Time, BP, HR, SpO2, Temp, Glucose
        const headerY = tableStartY;

        // Table headers
        const headers = ['Date/Time', 'BP (mmHg)', 'HR (bpm)', 'SpO₂ (%)', 'Temp (°F)', 'Glucose (mg/dL)'];
        const alignments = ['left', 'center', 'center', 'center', 'center', 'center'];

        // Header background
        doc.rect(50, headerY, tableWidth, headerHeight)
            .fillColor('#2c5aa0')
            .fill();

        // Header text
        doc.fontSize(9)
            .font('Helvetica-Bold')
            .fillColor('#ffffff');

        let currentX = 50;
        headers.forEach((header, index) => {
            doc.text(header, currentX + 5, headerY + 7, {
                width: colWidths[index] - 10,
                align: alignments[index]
            });
            currentX += colWidths[index];
        });

        // Table rows
        vitals.forEach((vital, index) => {
            const rowY = headerY + headerHeight + (index * rowHeight);
            const isEven = index % 2 === 0;

            // Row background
            if (isEven) {
                doc.rect(50, rowY, tableWidth, rowHeight)
                    .fillColor('#f5f5f5')
                    .fill();
            }

            // Row border
            doc.rect(50, rowY, tableWidth, rowHeight)
                .strokeColor('#dddddd')
                .lineWidth(0.5)
                .stroke();

            // Row data
            doc.fontSize(8)
                .font('Helvetica')
                .fillColor('#333333');

            const dateTime = vital.dateTime || new Date().toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const values = [
                dateTime,
                vital.blood_pressure || 'N/A',
                vital.heart_rate || 'N/A',
                vital.oxygen_level || 'N/A',
                vital.body_temp || 'N/A',
                vital.blood_sugar || 'N/A'
            ];

            currentX = 50;
            values.forEach((value, colIndex) => {
                doc.text(value, currentX + 5, rowY + 6, {
                    width: colWidths[colIndex] - 10,
                    align: alignments[colIndex]
                });
                currentX += colWidths[colIndex];
            });
        });

        doc.y = headerY + headerHeight + (vitals.length * rowHeight) + 10;
    };

    // Pipe PDF to file
    doc.pipe(fs.createWriteStream(pdfFileName));

    // Add first page header
    addHeader();

    // AI Disclaimer Box
    checkNewPage(100);
    // Only add spacing if we're not at the start of a new page
    if (doc.y > 135) {
        doc.moveDown(0.5);
    }
    const disclaimerY = doc.y;
    doc.rect(50, disclaimerY, 495, 75)
        .fillColor('#fff4e6')
        .fill()
        .strokeColor('#ff9900')
        .lineWidth(2)
        .stroke();

    doc.fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#cc6600')
        .text('⚠️ IMPORTANT DISCLAIMER', 55, disclaimerY + 8, { width: 485, align: 'center' });

    doc.fontSize(8)
        .font('Helvetica')
        .fillColor('#333333')
        .text('This report is generated by Artificial Intelligence (AI) and is for informational purposes only. ' +
            'This report is NOT a medical diagnosis, prescription, or professional medical advice. ' +
            'Always consult with qualified healthcare professionals for medical decisions, diagnosis, and treatment. ' +
            'The AI-generated insights should be reviewed and validated by licensed medical practitioners.',
            55, disclaimerY + 22, { width: 485, align: 'left', lineGap: 1.3 });

    doc.y = disclaimerY + 85;

    // Patient Demographics Section
    addSectionTitle('PATIENT DEMOGRAPHICS');
    addTableRow('Patient Name:', patientData.name);
    addTableRow('Gender:', patientData.gender);
    addTableRow('Age:', `${patientData.age} years`);
    addTableRow('Patient ID:', conditionData.patientId || 'N/A');

    // Clinical Information Section
    addSectionTitle('CLINICAL INFORMATION');
    addTableRow('Primary Condition:', conditionData.conditionName);
    addTableRow('Condition ID:', conditionData.conditionId);
    addTableRow('Condition Status:', conditionData.status.charAt(0).toUpperCase() + conditionData.status.slice(1));
    addTableRow('Condition Onset:', new Date(conditionData.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }));
    addTableRow('Is Cured:', conditionData.isCured ? 'Yes' : 'No');

    // Symptoms Assessment
    if (conditionData.symptoms && conditionData.symptoms.length > 0) {
        addSectionTitle('SYMPTOMS ASSESSMENT');
        checkNewPage(100);

        const symptomsTableY = doc.y;
        const symptomsTableWidth = 495;
        const symptomsHeaderHeight = 20;
        const symptomsRowHeight = 18;

        // Column widths: Symptom (60%), Score (20%), Baseline (20%)
        const symptomColWidth = symptomsTableWidth * 0.6;
        const scoreColWidth = symptomsTableWidth * 0.2;
        const baselineColWidth = symptomsTableWidth * 0.2;

        // Symptoms table header
        doc.rect(50, symptomsTableY, symptomsTableWidth, symptomsHeaderHeight)
            .fillColor('#2c5aa0')
            .fill();

        doc.fontSize(9)
            .font('Helvetica-Bold')
            .fillColor('#ffffff');

        doc.text('Symptom', 55, symptomsTableY + 6, { width: symptomColWidth - 10, align: 'left' });
        doc.text('Score', 50 + symptomColWidth, symptomsTableY + 6, { width: scoreColWidth - 10, align: 'center' });
        doc.text('Baseline', 50 + symptomColWidth + scoreColWidth, symptomsTableY + 6, { width: baselineColWidth - 10, align: 'center' });

        // Symptoms rows
        conditionData.symptoms.forEach((symptom, index) => {
            const rowY = symptomsTableY + symptomsHeaderHeight + (index * symptomsRowHeight);
            const isEven = index % 2 === 0;

            if (isEven) {
                doc.rect(50, rowY, symptomsTableWidth, symptomsRowHeight)
                    .fillColor('#f5f5f5')
                    .fill();
            }

            doc.rect(50, rowY, symptomsTableWidth, symptomsRowHeight)
                .strokeColor('#dddddd')
                .lineWidth(0.5)
                .stroke();

            doc.fontSize(8)
                .font('Helvetica')
                .fillColor('#333333')
                .text(symptom.title || 'N/A', 55, rowY + 5, { width: symptomColWidth - 10, align: 'left' });

            doc.text((symptom.score !== undefined ? symptom.score.toString() : 'N/A'), 50 + symptomColWidth, rowY + 5, {
                width: scoreColWidth - 10,
                align: 'center'
            });

            doc.text((symptom.baseline !== undefined ? symptom.baseline.toString() : 'N/A'), 50 + symptomColWidth + scoreColWidth, rowY + 5, {
                width: baselineColWidth - 10,
                align: 'center'
            });
        });

        doc.y = symptomsTableY + symptomsHeaderHeight + (conditionData.symptoms.length * symptomsRowHeight) + 10;
    }

    // Vital Signs Section
    if (vitalsData && vitalsData.length > 0) {
        addSectionTitle('VITAL SIGNS');
        addVitalsTable(vitalsData);
    }

    // Clinical Summary Section
    addSectionTitle('CLINICAL SUMMARY');
    addText(result.data.overallSummary, 10, '#333333', 1.3);

    // Critical Alerts Section
    if (result.data.healthAlerts && result.data.healthAlerts.length > 0) {
        addSectionTitle('CRITICAL ALERTS');
        result.data.healthAlerts.forEach(alert => {
            checkNewPage(30);
            let alertColor = '#666666';
            let bgColor = '#f5f5f5';
            if (alert.level === 'HIGH') {
                alertColor = '#cc0000';
                bgColor = '#ffe6e6';
            } else if (alert.level === 'MEDIUM') {
                alertColor = '#ff9900';
                bgColor = '#fff4e6';
            } else if (alert.level === 'LOW') {
                alertColor = '#0066cc';
                bgColor = '#e6f0ff';
            }

            const alertY = doc.y;
            const alertBoxHeight = 25;
            doc.rect(50, alertY, 495, alertBoxHeight)
                .fillColor(bgColor)
                .fill()
                .strokeColor(alertColor)
                .lineWidth(1)
                .stroke();

            doc.fontSize(10)
                .font('Helvetica-Bold')
                .fillColor(alertColor)
                .text(`${alert.level} ALERT:`, 55, alertY + 7, { width: 150, align: 'left' });

            doc.font('Helvetica')
                .fillColor('#333333')
                .text(alert.message || 'No message provided', 210, alertY + 7, { width: 330, align: 'left' });

            doc.y = alertY + alertBoxHeight + 5;
        });
    }

    // Vitals Analysis Section
    if (result.data.vitalsSummary && result.data.vitalsSummary.length > 0) {
        addSectionTitle('VITALS ANALYSIS');
        result.data.vitalsSummary.forEach(vital => {
            addListItem(vital);
        });
    }

    // Clinical Patterns Section
    if (result.data.dailyPatterns && result.data.dailyPatterns.length > 0) {
        addSectionTitle('CLINICAL PATTERNS & OBSERVATIONS');
        result.data.dailyPatterns.forEach(pattern => {
            addListItem(pattern);
        });
    }

    // Recommendations Section
    if (result.data.smartAdvices && result.data.smartAdvices.length > 0) {
        addSectionTitle('LIFESTYLE & HEALTH RECOMMENDATIONS');
        result.data.smartAdvices.forEach(advice => {
            addListItem(advice);
        });
    }

    // Clinical Notes Section
    if (result.data.careTeamNotes && result.data.careTeamNotes.length > 0) {
        addSectionTitle('CLINICAL NOTES');
        result.data.careTeamNotes.forEach(note => {
            addListItem(note);
        });
    }

    // Treatment Plan & Next Steps
    if (result.data.nextSteps && result.data.nextSteps.length > 0) {
        addSectionTitle('RECOMMENDED NEXT STEPS');
        result.data.nextSteps.forEach((step, index) => {
            checkNewPage(20);
            const stepY = doc.y;
            doc.fontSize(10)
                .font('Helvetica-Bold')
                .fillColor('#2c5aa0')
                .text(`${index + 1}.`, 55, stepY + 2, { width: 20, align: 'left' });
            doc.font('Helvetica')
                .fillColor('#333333')
                .text(step || 'N/A', 75, stepY + 2, { width: 470, align: 'left' });
            doc.y = stepY + 16;
        });
    }

    // Report Metadata
    checkNewPage(40);
    doc.moveDown(1);
    addSectionTitle('REPORT METADATA');
    addTableRow('Report Generated:', new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }));
    addTableRow('AI Model Tokens Used:', `${result.tokenUsage.total_tokens} (${result.tokenUsage.prompt_tokens} prompt + ${result.tokenUsage.completion_tokens} completion)`);
    addTableRow('Report Type:', 'AI-Generated Health Insight Analysis');

    // Add footer to last page
    addFooter();

    // Finalize PDF
    doc.end();
    console.log(`PDF report generated: ${pdfFileName}`);
    return pdfFileName;
};

module.exports = { saveToExcel, generatePDFReport };