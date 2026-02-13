const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Branding (match MDHealthTrak reference)
const BRAND = {
    email: "support@mdht.com",
    phone: "+91-90000 00000",
    website: "www.mdht.com",
};

// Brand colors: primary #0094ED, secondary #5CE7A0, bg #F4FFFF
// Alert backgrounds (33 = ~20% alpha; solid equivalents for PDF)
const COLORS = {
    primary: "#0094ED",
    secondary: "#5CE7A0",
    pageBg: "#F4FFFF",
    sectionBar: "#0094ED",
    sectionAccent: "#5CE7A0",
    contentBg: "#F4FFFF",
    alertHigh: "#FFE5E5",   // ~#FD000033
    alertMedium: "#FFF4CC", // ~#E0A80033
    alertLow: "#D1FAE5",   // ~#22C55E33
    white: "#ffffff",
    text: "#1f2937",
    textMuted: "#6b7280",
};

const MARGIN = 50;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const SECTION_BAR_HEIGHT = 22;
const SECTION_ACCENT_WIDTH = 8;

/** Logo path (project assets). SVG is rasterized to PNG for PDF. */
const LOGO_PATH = path.join(__dirname, "assets", "mdh-logo-with-name.svg");
const LOGO_DISPLAY_WIDTH = 140;

/** Open Sans font (from open-sans-all). Fallback to Helvetica if missing. */
const FONT_OPEN_SANS = path.join(__dirname, "node_modules", "open-sans-all", "fonts", "open-sans-regular.ttf");
const FONT_OPEN_SANS_BOLD = path.join(__dirname, "node_modules", "open-sans-all", "fonts", "open-sans-700.ttf");
const USE_OPEN_SANS = fs.existsSync(FONT_OPEN_SANS) && fs.existsSync(FONT_OPEN_SANS_BOLD);
const FONT_REGULAR = USE_OPEN_SANS ? "OpenSans" : "Helvetica";
const FONT_BOLD = USE_OPEN_SANS ? "OpenSans-Bold" : "Helvetica-Bold";

/**
 * Derive primary condition info from payload
 */
function getPrimaryConditionInfo(payload) {
    const conditions = payload?.conditions;
    if (!conditions || !conditions.length) {
        return {
            primaryCondition: "N/A",
            conditionStatus: "N/A",
            conditionOnset: "N/A",
            isCured: "No",
        };
    }
    const c = conditions[0];
    const title = c.disease_title || c.symptom_title || "N/A";
    const status = (c.status || "active").toLowerCase();
    const isCured = status === "cured" ? "Yes" : "No";
    const statusLabel =
        status === "cured"
            ? "Cured"
            : status === "suspected"
                ? "Suspected"
                : status === "active"
                    ? "Active"
                    : (c.status || "Active");
    return {
        primaryCondition: title,
        conditionStatus: statusLabel,
        conditionOnset: c.condition_onset || c.onset_date || "N/A",
        isCured,
    };
}

/**
 * Load logo as PNG buffer from SVG (for PDF embedding). Returns null if missing or invalid.
 */
async function loadLogoBuffer() {
    try {
        if (!fs.existsSync(LOGO_PATH)) return null;
        const svgBuffer = fs.readFileSync(LOGO_PATH);
        return await sharp(svgBuffer).png().toBuffer();
    } catch {
        return null;
    }
}

/**
 * Draw horizontal line
 */
function drawLine(doc, y, color = COLORS.primary) {
    doc.strokeColor(color).lineWidth(1);
    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
}

/**
 * Measure height for panel content (paragraph, bullets, or key-value lines)
 */
function measurePanelHeight(doc, type, data) {
    const pad = 16;
    if (type === "paragraph") {
        const text = (data && String(data).trim()) || "";
        return (text ? doc.heightOfString(text, { width: CONTENT_WIDTH - 16 }) : 14) + pad;
    }
    if (type === "bullets") {
        const lines = Array.isArray(data) ? data : [];
        let h = 0;
        lines.forEach((line) => {
            if (!String(line).trim()) return;
            h += doc.heightOfString(`• ${String(line).trim()}`, { width: CONTENT_WIDTH - 24 }) + 4;
        });
        return (h || 14) + pad;
    }
    if (type === "keyValue") {
        const pairs = Array.isArray(data) ? data : [];
        return pairs.length * 18 + pad;
    }
    if (type === "alerts") {
        const alerts = Array.isArray(data) ? data : [];
        return alerts.length * 30 + pad;
    }
    return 40;
}

/**
 * Add paragraph in panel (call after addSectionWithPanel, and draw panel yourself or use addSectionBlock)
 */
function addParagraph(doc, text, indent = 0) {
    if (!text) return;
    doc.fillColor(COLORS.text).fontSize(9);
    doc.text(String(text).trim(), { width: CONTENT_WIDTH - indent - 16, indent: indent + 8, lineGap: 4 });
    doc.moveDown(6);
}

/**
 * Add bullet list in panel
 */
function addBulletLines(doc, lines, bullet = "•") {
    if (!Array.isArray(lines) || !lines.length) return;
    const wrapWidth = CONTENT_WIDTH - 24;
    lines.forEach((line) => {
        const text = String(line).trim();
        if (!text) return;
        doc.text(`${bullet} ${text}`, { width: wrapWidth, indent: 16, lineGap: 1 });
        doc.moveDown(2);
    });
}

/**
 * Add key-value pairs (e.g. Patient Name: John Doe)
 */
function addKeyValueBlock(doc, pairs) {
    doc.fillColor(COLORS.text).fontSize(9);
    pairs.forEach(([key, value]) => {
        doc.text(`${key}: ${value != null && value !== "" ? value : "N/A"}`, { indent: 8 });
        doc.moveDown(1.5);
    });
}

function reportDateTime() {
    const d = new Date();
    const date = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
    const time = d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
    return `${date} | ${time}`;
}

/**
 * Draw header with logo (or text fallback), contact, blue line, report title
 * @param {PDFKitDocument} doc
 * @param {Buffer|null} logoPngBuffer - PNG buffer from loadLogoBuffer(), or null for text fallback
 */
function drawReportHeader(doc, logoPngBuffer) {
    const topY = 50;
    doc.fontSize(9).fillColor(COLORS.textMuted);
    doc.text(BRAND.email, PAGE_WIDTH - MARGIN - 150, topY, { width: 150, align: "right" });
    doc.text(BRAND.phone, PAGE_WIDTH - MARGIN - 150, topY + 12, { width: 150, align: "right" });
    doc.text(BRAND.website, PAGE_WIDTH - MARGIN - 150, topY + 24, { width: 150, align: "right" });

    if (logoPngBuffer && logoPngBuffer.length) {
        doc.image(logoPngBuffer, MARGIN, topY, { width: LOGO_DISPLAY_WIDTH });
    } else {
        doc.fontSize(18).font(FONT_BOLD).fillColor(COLORS.primary);
        doc.text("MD", MARGIN, topY);
        doc.fillColor(COLORS.primary);
        doc.text("Health", MARGIN + doc.widthOfString("MD"), topY);
        doc.fillColor(COLORS.secondary);
        doc.text("Trak", MARGIN + doc.widthOfString("MDHealth"), topY);
    }

    const headerBottomY = topY + (logoPngBuffer && logoPngBuffer.length ? (28 / 207) * LOGO_DISPLAY_WIDTH : 24);
    drawLine(doc, headerBottomY + 4);
    const titleY = headerBottomY + 14;

    doc.fontSize(16).font(FONT_BOLD).fillColor(COLORS.primary);
    doc.text("AI Overview Health Insights Report", MARGIN, titleY, { width: CONTENT_WIDTH, lineBreak: false });

    doc.fontSize(10).font(FONT_REGULAR).fillColor(COLORS.textMuted);
    doc.text("AI-Generated Medical Analysis", MARGIN, doc.y + 4, { width: CONTENT_WIDTH });
    doc.text(`Report Generated On: ${reportDateTime()}`, MARGIN, doc.y + 2, { width: CONTENT_WIDTH });
    doc.moveDown(6);
}

/**
 * Draw footer disclaimer with blue line and gray box
 */
function drawFooter(doc) {
    const footerY = doc.y + 8;
    drawLine(doc, footerY);
    doc.fillColor(COLORS.contentBg);
    doc.rect(MARGIN, footerY + 6, CONTENT_WIDTH, 28).fill();
    doc.fillColor(COLORS.textMuted).fontSize(8).font(FONT_REGULAR);
    doc.text("The information is AI generated. Consult a doctor for medical advice.", MARGIN, footerY + 14, {
        width: CONTENT_WIDTH,
        align: "center",
    });
    doc.y = footerY + 34;
}

/**
 * Draw section: blue bar + green accent, gray panel, then content (single render).
 * type: 'paragraph' | 'bullets' | 'keyValue' | 'alerts'
 * data: string (paragraph), array (bullets/keyValue pairs), or healthAlerts array (alerts)
 */
function drawSectionMeasured(doc, title, type, data, options = {}) {
    const { marginTop = 10 } = options;
    doc.moveDown(marginTop / 12);
    const barY = doc.y;
    doc.rect(MARGIN, barY, CONTENT_WIDTH - SECTION_ACCENT_WIDTH, SECTION_BAR_HEIGHT).fill(COLORS.sectionBar);
    doc.rect(PAGE_WIDTH - MARGIN - SECTION_ACCENT_WIDTH, barY, SECTION_ACCENT_WIDTH, SECTION_BAR_HEIGHT).fill(COLORS.sectionAccent);
    doc.fillColor(COLORS.white).font(FONT_BOLD).fontSize(10);
    doc.text(`>> ${title.toUpperCase()}`, MARGIN + 10, barY + 6, { width: CONTENT_WIDTH - 20 });
    doc.fillColor(COLORS.text).font(FONT_REGULAR).fontSize(9);
    doc.y = barY + SECTION_BAR_HEIGHT + 2;

    if (type === "paragraph") {
        addParagraph(doc, data || "No content.");
    } else if (type === "bullets") {
        const lines = Array.isArray(data) ? data : [];
        if (lines.length) addBulletLines(doc, lines);
        else doc.text("No items.", { indent: 16 });
    } else if (type === "keyValue") {
        const pairs = Array.isArray(data) ? data : [];
        addKeyValueBlock(doc, pairs);
    } else if (type === "alerts") {
        const alerts = Array.isArray(data) ? data : [];
        if (!alerts.length) {
            doc.text("No health alerts.", { indent: 16 });
        } else {
            alerts.forEach((a) => {
                const level = (a.level || "LOW").toUpperCase();
                doc.fillColor(COLORS.text).font(FONT_BOLD).fontSize(9);
                doc.text(`${level}:`, { continued: true });
                doc.font(FONT_REGULAR);
                doc.text(` ${a.message || ""}`, { width: CONTENT_WIDTH - 16 });
                doc.moveDown(1.5);
            });
        }
    }
    // Small spacing after section content
    doc.moveDown(2);
}

function generateReportPdf(aiResult, payload, outputPath) {
    return (async () => {
        const logoBuffer = await loadLogoBuffer();
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: MARGIN, size: "LETTER" });
            if (USE_OPEN_SANS) {
                doc.registerFont("OpenSans", FONT_OPEN_SANS);
                doc.registerFont("OpenSans-Bold", FONT_OPEN_SANS_BOLD);
            }
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.pageBg);

            const patient = payload?.patient || {};
            const info = getPrimaryConditionInfo(payload);
            const data = aiResult?.data || {};

            drawReportHeader(doc, logoBuffer);

            drawSectionMeasured(
                doc,
                "Patient Demographics",
                "keyValue",
                [
                    ["Patient Name", patient.name],
                    ["Age", patient.age],
                    ["Gender", patient.gender],
                ],
                { marginTop: 0 }
            );

            drawSectionMeasured(doc, "Clinical Information", "keyValue", [
                ["Primary Condition", info.primaryCondition],
                ["Condition Status", info.conditionStatus],
                ["Condition Onset", info.conditionOnset],
                ["Is Cured", info.isCured],
            ]);

            drawSectionMeasured(doc, "Condition Assessment", "paragraph", data.overallSummary || "No summary available.");

            drawSectionMeasured(doc, "Health Alerts", "alerts", data.healthAlerts || []);

            drawSectionMeasured(doc, "Vitals Summary", "bullets", data.vitalsSummary || []);

            drawSectionMeasured(doc, "Daily Patterns", "bullets", data.dailyPatterns || []);

            drawSectionMeasured(doc, "Smart Advices", "bullets", data.smartAdvices || []);

            drawSectionMeasured(doc, "Care Team Notes", "bullets", data.careTeamNotes || []);

            drawSectionMeasured(doc, "Next Steps", "bullets", data.nextSteps || []);

            doc.moveDown(6);
            drawFooter(doc);

            doc.end();

            stream.on("finish", () => resolve(outputPath));
            stream.on("error", reject);
            doc.on("error", reject);
        });
    })();
}

module.exports = { generateReportPdf, getPrimaryConditionInfo, reportDateTime };
