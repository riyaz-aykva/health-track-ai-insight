/**
 * HTML-to-PDF report generation using Puppeteer.
 * Builds an HTML report and converts it to PDF.
 */
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer");

// Fallback paths for system Chrome/Chromium when Puppeteer's bundled browser isn't installed
const CHROME_PATHS = [
    process.platform === "darwin" && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    process.platform === "darwin" && "/Applications/Chromium.app/Contents/MacOS/Chromium",
    process.platform === "win32" && "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    process.platform === "win32" && "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.platform === "linux" && "/usr/bin/google-chrome",
    process.platform === "linux" && "/usr/bin/chromium",
    process.platform === "linux" && "/usr/bin/chromium-browser"
].filter(Boolean);

function getChromeExecutablePath() {
    for (const p of CHROME_PATHS) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const escapeHtml = (str) => {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Normalize condition payload (supports both conditionName/conditionId and disease_title/condition_id)
function normalizeCondition(conditionData) {
    const name = conditionData.conditionName || conditionData.disease_title || 'N/A';
    const id = conditionData.conditionId || conditionData.condition_id || 'N/A';
    const status = conditionData.status ? String(conditionData.status).charAt(0).toUpperCase() + conditionData.status.slice(1) : 'N/A';
    const createdAt = conditionData.createdAt || (conditionData.date_range && conditionData.date_range.start_date);
    const onsetStr = createdAt ? new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : id;
    const isCured = conditionData.isCured != null ? conditionData.isCured : (conditionData.status === 'cured');
    const symptoms = (conditionData.symptoms || []).map(s => ({
        title: s.title || 'N/A',
        score: s.score != null ? s.score : (s.records && s.records.length ? s.records[s.records.length - 1].severity : null),
        baseline: s.baseline != null ? s.baseline : (s.baselines && s.baselines.patient_baseline != null ? s.baselines.patient_baseline : null)
    }));
    return { name, id, status, onsetStr, isCured, symptoms, patientId: conditionData.patientId };
}

/**
 * Build full HTML string for the health report (Patient Module Dashboard style).
 */
function buildReportHTML(result, patientData, conditionData, vitalsData = []) {
    const cond = normalizeCondition(conditionData);
    const now = new Date();
    const day = now.getDate();
    const reportDateStr = `${getOrdinal(day)} ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    const reportTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const sections = [];

    // Header + patient quick info
    sections.push(`
    <header class="report-header">
      <div class="header-top">
        <span>support@mdht.com</span>
        <span>+91-90000 00000</span>
      </div>
      <div class="header-subtitle">AI-Generated Medical Analysis</div>
      <div class="header-date">Report Generated On: ${escapeHtml(reportDateStr)} | Time: ${escapeHtml(reportTime)}</div>
      <div class="patient-quick-info">
        <div>Patient Name: ${escapeHtml(patientData.name)}</div>
        <div>Age: ${escapeHtml(patientData.age)}</div>
        <div>Gender: ${escapeHtml(patientData.gender)}</div>
        <div>Primary Condition: ${escapeHtml(cond.name)}</div>
        <div>Condition Status: ${escapeHtml(cond.status)}</div>
        <div>Condition Onset: ${escapeHtml(cond.onsetStr)}</div>
        <div>Is Cured: ${cond.isCured ? 'Yes' : 'No'}</div>
      </div>
      <div class="header-website">www.mdht.com</div>
    </header>`);

    // Patient Demographics
    sections.push(`
    <section class="section">
      <h2 class="section-title">PATIENT DEMOGRAPHICS</h2>
      <table class="info-table">
        <tr><td class="label">Patient Name:</td><td>${escapeHtml(patientData.name)}</td></tr>
        <tr><td class="label">Gender:</td><td>${escapeHtml(patientData.gender)}</td></tr>
        <tr><td class="label">Age:</td><td>${escapeHtml(patientData.age)} years</td></tr>
        <tr><td class="label">Patient ID:</td><td>${escapeHtml(cond.patientId || 'N/A')}</td></tr>
      </table>
    </section>`);

    // Clinical Information
    sections.push(`
    <section class="section">
      <h2 class="section-title">CLINICAL INFORMATION</h2>
      <table class="info-table">
        <tr><td class="label">Primary Condition:</td><td>${escapeHtml(cond.name)}</td></tr>
        <tr><td class="label">Condition ID:</td><td>${escapeHtml(cond.id)}</td></tr>
        <tr><td class="label">Condition Status:</td><td>${escapeHtml(cond.status)}</td></tr>
        <tr><td class="label">Condition Onset:</td><td>${escapeHtml(cond.onsetStr)}</td></tr>
        <tr><td class="label">Is Cured:</td><td>${cond.isCured ? 'Yes' : 'No'}</td></tr>
      </table>
    </section>`);

    // Symptoms Assessment
    if (cond.symptoms && cond.symptoms.length > 0) {
        const symptomRows = cond.symptoms.map(s => `
          <tr>
            <td>${escapeHtml(s.title || 'N/A')}</td>
            <td class="center">${s.score != null ? escapeHtml(String(s.score)) : 'N/A'}</td>
            <td class="center">${s.baseline != null ? escapeHtml(String(s.baseline)) : 'N/A'}</td>
          </tr>`).join('');
        sections.push(`
    <section class="section">
      <h2 class="section-title">SYMPTOMS ASSESSMENT</h2>
      <table class="data-table">
        <thead><tr><th>Symptom</th><th>Score</th><th>Baseline</th></tr></thead>
        <tbody>${symptomRows}</tbody>
      </table>
    </section>`);
    }

    // Vital Signs table
    if (vitalsData && vitalsData.length > 0) {
        const vitalRows = vitalsData.map(v => {
            const dateTime = v.dateTime || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            return `<tr>
              <td>${escapeHtml(dateTime)}</td>
              <td class="center">${escapeHtml(v.blood_pressure || 'N/A')}</td>
              <td class="center">${escapeHtml(v.heart_rate || 'N/A')}</td>
              <td class="center">${escapeHtml(v.oxygen_level || 'N/A')}</td>
              <td class="center">${escapeHtml(v.body_temp || 'N/A')}</td>
              <td class="center">${escapeHtml(v.blood_sugar || 'N/A')}</td>
            </tr>`;
        }).join('');
        sections.push(`
    <section class="section">
      <h2 class="section-title">VITAL SIGNS</h2>
      <table class="data-table vitals-table">
        <thead><tr><th>Date/Time</th><th>BP (mmHg)</th><th>HR (bpm)</th><th>SpO₂ (%)</th><th>Temp (°F)</th><th>Glucose (mg/dL)</th></tr></thead>
        <tbody>${vitalRows}</tbody>
      </table>
    </section>`);
    }

    // Condition Assessment
    sections.push(`
    <section class="section">
      <h2 class="section-title">CONDITION ASSESSMENT</h2>
      <p class="summary">${escapeHtml(result.data.overallSummary || '')}</p>
    </section>`);

    // Health Alerts
    if (result.data.healthAlerts && result.data.healthAlerts.length > 0) {
        const alertBoxes = result.data.healthAlerts.map(alert => {
            let cls = 'alert-low';
            if (alert.level === 'HIGH') cls = 'alert-high';
            else if (alert.level === 'MEDIUM') cls = 'alert-medium';
            return `<div class="alert-box ${cls}"><strong>${escapeHtml(alert.level)} ALERT:</strong> ${escapeHtml(alert.message || 'No message provided')}</div>`;
        }).join('');
        sections.push(`
    <section class="section">
      <h2 class="section-title">HEALTH ALERTS</h2>
      <div class="alert-list">${alertBoxes}</div>
    </section>`);
    }

    // Vitals Summary, Daily Patterns, Smart Advices, Care Team Notes
    const listSections = [
        { key: 'vitalsSummary', title: 'VITALS SUMMARY' },
        { key: 'dailyPatterns', title: 'DAILY PATTERNS' },
        { key: 'smartAdvices', title: 'SMART ADVICES' },
        { key: 'careTeamNotes', title: 'CARE TEAM NOTES' }
    ];
    listSections.forEach(({ key, title }) => {
        const items = result.data[key];
        if (items && items.length > 0) {
            const listItems = items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
            sections.push(`
    <section class="section">
      <h2 class="section-title">${title}</h2>
      <ul class="report-list">${listItems}</ul>
    </section>`);
        }
    });

    // Next Steps (numbered)
    if (result.data.nextSteps && result.data.nextSteps.length > 0) {
        const nextStepsItems = result.data.nextSteps.map((step, i) => `<li><span class="step-num">${i + 1}.</span> ${escapeHtml(step || 'N/A')}</li>`).join('');
        sections.push(`
    <section class="section">
      <h2 class="section-title">NEXT STEPS</h2>
      <ul class="report-list next-steps">${nextStepsItems}</ul>
    </section>`);
    }

    // Report Metadata
    const reportGenerated = new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const tokenStr = `${result.tokenUsage.total_tokens} (${result.tokenUsage.prompt_tokens} prompt + ${result.tokenUsage.completion_tokens} completion)`;
    sections.push(`
    <section class="section">
      <h2 class="section-title">REPORT METADATA</h2>
      <table class="info-table">
        <tr><td class="label">Report Generated:</td><td>${escapeHtml(reportGenerated)}</td></tr>
        <tr><td class="label">AI Model Tokens Used:</td><td>${escapeHtml(tokenStr)}</td></tr>
        <tr><td class="label">Report Type:</td><td>AI-Generated Health Insight Analysis</td></tr>
      </table>
    </section>`);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Health Insight Report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #333; line-height: 1.4; margin: 0; padding: 50px; }
    .report-header { border-bottom: 2px solid #2c5aa0; padding-bottom: 12px; margin-bottom: 20px; }
    .header-top { display: flex; justify-content: space-between; font-size: 8px; color: #666; margin-bottom: 6px; }
    .header-subtitle { text-align: center; font-size: 9px; color: #666; margin-bottom: 4px; }
    .header-date { text-align: center; font-size: 8px; color: #666; margin-bottom: 12px; }
    .patient-quick-info { font-size: 8px; margin-bottom: 8px; }
    .patient-quick-info div { margin-bottom: 2px; }
    .header-website { font-size: 8px; color: #666; }
    .section { margin-bottom: 18px; break-inside: avoid; }
    .section-title { font-size: 12px; font-weight: bold; color: #2c5aa0; background: #e8f0f8; margin: 0 0 10px 0; padding: 6px 10px; }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table td { padding: 4px 8px 4px 0; vertical-align: top; }
    .info-table .label { font-weight: bold; color: #555; width: 180px; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 9px; }
    .data-table th { background: #2c5aa0; color: #fff; font-weight: bold; }
    .data-table tbody tr:nth-child(even) { background: #f5f5f5; }
    .data-table .center { text-align: center; }
    .vitals-table th, .vitals-table td { font-size: 8px; }
    .summary { margin: 0; line-height: 1.5; }
    .alert-list { display: flex; flex-direction: column; gap: 8px; }
    .alert-box { padding: 8px 10px; border-radius: 4px; border-left: 4px solid; font-size: 10px; }
    .alert-high { background: #ffe6e6; border-color: #cc0000; color: #cc0000; }
    .alert-medium { background: #fff4e6; border-color: #ff9900; color: #cc6600; }
    .alert-low { background: #e6f0ff; border-color: #0066cc; color: #0066cc; }
    .report-list { margin: 0 0 0 20px; padding-left: 8px; }
    .report-list li { margin-bottom: 4px; }
    .next-steps .step-num { font-weight: bold; color: #2c5aa0; margin-right: 4px; }
    @media print { body { padding: 40px; } .section { break-inside: avoid; } }
  </style>
</head>
<body>
  ${sections.join('\n')}
</body>
</html>`;
}

/**
 * Generate PDF from HTML using Puppeteer (HTML-to-PDF).
 * Returns the PDF file path. Must be awaited (async).
 */
async function generatePDFReport(result, patientData, conditionData, vitalsData = []) {
    const pdfFileName = `health_report_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfPath = path.resolve(process.cwd(), pdfFileName);
    const html = buildReportHTML(result, patientData, conditionData, vitalsData);

    const executablePath = getChromeExecutablePath();
    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    if (executablePath) {
        launchOptions.executablePath = executablePath;
    }

    let browser;
    try {
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: { top: '40px', right: '50px', bottom: '60px', left: '50px' },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: '<div style="font-size:7px;color:#999;width:100%;text-align:center;font-style:italic;">The information is AI generated. Consult a doctor for medical advice.</div><div style="font-size:8px;color:#666;width:100%;text-align:center;margin-top:4px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
        });
    } catch (err) {
        if (err.message && err.message.includes("Could not find Chrome") && !executablePath) {
            const hint = process.platform === "darwin"
                ? "Install Google Chrome from https://www.google.com/chrome/ or run: npx puppeteer browsers install chrome"
                : "Run: npx puppeteer browsers install chrome";
            throw new Error(`Chrome not found for PDF generation. ${hint}`);
        }
        throw err;
    } finally {
        if (browser) await browser.close();
    }

    console.log(`PDF report generated: ${pdfFileName}`);
    return pdfFileName;
}

module.exports = { generatePDFReport, buildReportHTML };
