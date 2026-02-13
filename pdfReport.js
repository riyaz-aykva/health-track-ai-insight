const puppeteer = require("puppeteer");
// Branding
const BRAND = {
    email: "support@mdht.com",
    phone: "+91-90000 00000",
    website: "www.mdht.com",
};

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
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (text == null) return "";
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function logo() {
    return `<svg width="207" height="28" viewBox="0 0 207 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M62.9531 27.9954V5.71802H65.9451V14.7714H77.4036V5.71802H80.3956V27.9954H77.4036V17.5245H65.9451V27.9954H62.9531Z" fill="#0094ED" />
        <path d="M92.1546 27.9949C90.5005 27.9949 89.0375 27.6491 87.7701 26.9597C86.5028 26.2702 85.5153 25.3078 84.81 24.0723C84.1046 22.8368 83.752 21.3966 83.752 19.7515C83.752 18.5638 83.9545 17.4603 84.3572 16.441C84.7599 15.4217 85.3333 14.5411 86.075 13.7994C86.8168 13.0576 87.6837 12.4797 88.6757 12.0656C89.6677 11.6515 90.7462 11.4445 91.9135 11.4445C93.1763 11.4445 94.3025 11.6674 95.2946 12.1134C96.2866 12.5593 97.108 13.1828 97.761 13.9837C98.414 14.7846 98.8827 15.7243 99.1694 16.8005C99.4561 17.8767 99.513 19.0462 99.3446 20.309H86.6461C86.6143 21.3488 86.8259 22.2589 87.2832 23.0371C87.7383 23.8175 88.4004 24.425 89.265 24.8596C90.1296 25.2941 91.1558 25.5126 92.3435 25.5126C93.2127 25.5126 94.0613 25.3738 94.8896 25.0985C95.7178 24.8232 96.4481 24.4136 97.0852 23.8721L98.3275 26.0518C97.8179 26.4659 97.2172 26.8186 96.5209 27.1098C95.827 27.4011 95.1012 27.6218 94.348 27.7697C93.5949 27.9176 92.8623 27.9926 92.1524 27.9926L92.1546 27.9949ZM86.8077 18.0337H96.4186C96.3753 16.7186 95.968 15.6924 95.1922 14.9552C94.4186 14.218 93.3082 13.8494 91.8657 13.8494C90.4231 13.8494 89.3082 14.218 88.3958 14.9552C87.4834 15.6924 86.9533 16.7186 86.8054 18.0337H86.8077Z" fill="#0094ED" />
        <path d="M106.62 27.9954C105.528 27.9954 104.572 27.7929 103.756 27.3901C102.939 26.9874 102.304 26.4163 101.854 25.6791C101.403 24.9419 101.178 24.0705 101.178 23.0603C101.178 22.2321 101.392 21.4767 101.822 20.7918C102.252 20.1069 102.923 19.5404 103.835 19.0899C104.748 18.6394 105.931 18.3368 107.385 18.1821C108.839 18.0273 110.593 18.0569 112.652 18.2685L112.732 20.4164C111.141 20.2048 109.787 20.1229 108.675 20.1707C107.56 20.2184 106.659 20.3663 105.97 20.6166C105.28 20.8669 104.773 21.1945 104.45 21.6041C104.127 22.0136 103.965 22.471 103.965 22.9806C103.965 23.7975 104.258 24.4368 104.848 24.8987C105.437 25.3606 106.245 25.5904 107.276 25.5904C108.156 25.5904 108.943 25.4289 109.64 25.1058C110.334 24.7827 110.884 24.3322 111.287 23.7542C111.69 23.1763 111.892 22.5051 111.892 21.7406V17.3971C111.892 16.6553 111.733 16.0137 111.414 15.4722C111.096 14.9307 110.625 14.512 109.999 14.2139C109.373 13.9182 108.604 13.768 107.692 13.768C106.864 13.768 106.049 13.8931 105.248 14.1411C104.447 14.3914 103.676 14.785 102.932 15.3266L102.04 13.0672C103.005 12.4096 104.004 11.9478 105.032 11.6838C106.061 11.4199 107.048 11.2856 107.992 11.2856C109.423 11.2856 110.645 11.5109 111.653 11.9614C112.661 12.4119 113.43 13.0899 113.96 13.991C114.491 14.892 114.757 16.0182 114.757 17.3652V27.8884H112.051V25.6086C111.51 26.3822 110.764 26.9738 109.808 27.3833C108.852 27.7906 107.792 27.9954 106.625 27.9954H106.62Z" fill="#0094ED" />
        <path d="M118.791 27.9952V5.08075H121.719V27.9952H118.791Z" fill="#0094ED" />
        <path d="M124.025 14.4051V11.9227H128.034V14.4051H124.025ZM132.428 27.9954C130.974 27.9954 129.805 27.5699 128.92 26.7212C128.034 25.8725 127.591 24.562 127.591 22.7895V7.33801H130.519V11.9204H135.086V14.4028H130.519V22.0569C130.519 23.2446 130.733 24.0796 131.163 24.5642C131.593 25.0466 132.221 25.2878 133.049 25.2878C133.42 25.2878 133.773 25.2445 134.107 25.1604C134.442 25.0762 134.735 24.9647 134.99 24.8259L135.595 27.2286C135.161 27.463 134.667 27.6473 134.116 27.786C133.566 27.9248 133.001 27.9931 132.43 27.9931L132.428 27.9954Z" fill="#0094ED" />
        <path d="M138.65 27.9952V5.08075H141.579V15.472L140.973 14.8509C141.674 13.8429 142.518 13.1034 143.513 12.6302C144.505 12.1592 145.535 11.9226 146.607 11.9226C148.018 11.9226 149.194 12.207 150.132 12.7735C151.071 13.3401 151.772 14.0704 152.241 14.9623C152.707 15.8543 152.942 16.7712 152.942 17.7154V27.9952H150.013V18.5755C150.013 17.4083 149.642 16.4618 148.898 15.7359C148.157 15.0101 147.158 14.6461 145.906 14.6461C145.078 14.6461 144.339 14.8281 143.686 15.1944C143.033 15.5607 142.518 16.0772 142.143 16.7462C141.765 17.4151 141.579 18.1887 141.579 19.0692V27.9975H138.65V27.9952Z" fill="#0094ED" />
        <path d="M158.55 27.9954V7.43587H151.963V5.71802H166.984V7.43587H160.397V27.9954H158.552H158.55Z" fill="#5CE7A0" />
        <path d="M167.045 27.9953V12.719H168.826V15.1695C169.527 14.0546 170.321 13.2901 171.213 12.8692C172.105 12.4505 173.049 12.2412 174.046 12.2412C174.321 12.2412 174.606 12.2526 174.897 12.2731C175.188 12.2935 175.468 12.3368 175.732 12.4005L175.413 14.2776C175.147 14.2139 174.886 14.1661 174.626 14.1342C174.367 14.1024 174.11 14.0865 173.855 14.0865C172.392 14.0865 171.186 14.5506 170.242 15.4789C169.297 16.4073 168.826 17.62 168.826 19.1149V27.9953H167.045Z" fill="#5CE7A0" />
        <path d="M182.462 27.9955C181.347 27.9955 180.393 27.7975 179.597 27.3994C178.801 27.0012 178.193 26.4437 177.774 25.7293C177.356 25.0126 177.146 24.1775 177.146 23.2219C177.146 22.4369 177.351 21.7134 177.759 21.049C178.166 20.3869 178.821 19.8317 179.724 19.3858C180.625 18.9398 181.815 18.644 183.29 18.4939C184.764 18.346 186.569 18.3937 188.7 18.6372L188.796 20.2276C186.919 19.9933 185.344 19.9182 184.077 19.9978C182.81 20.0775 181.799 20.2686 181.046 20.5712C180.293 20.8738 179.752 21.2561 179.424 21.7179C179.094 22.1798 178.93 22.6804 178.93 23.2219C178.93 24.1775 179.265 24.9238 179.934 25.4654C180.603 26.0069 181.531 26.2776 182.719 26.2776C183.715 26.2776 184.609 26.0888 185.399 25.7134C186.189 25.3379 186.814 24.8214 187.276 24.1707C187.738 23.5177 187.968 22.7782 187.968 21.95V17.272C187.968 16.4552 187.788 15.7521 187.426 15.1628C187.065 14.5735 186.548 14.1208 185.875 13.8022C185.201 13.4837 184.391 13.3244 183.447 13.3244C182.641 13.3244 181.84 13.4473 181.044 13.6907C180.248 13.9342 179.458 14.3437 178.673 14.9171L178.02 13.3267C178.933 12.6691 179.861 12.2186 180.805 11.9751C181.749 11.7317 182.641 11.6088 183.479 11.6088C184.869 11.6088 186.027 11.8273 186.955 12.2618C187.884 12.6964 188.58 13.3358 189.049 14.1799C189.515 15.024 189.749 16.0547 189.749 17.2743V27.8931H187.968V25.5177C187.417 26.3231 186.653 26.9397 185.677 27.3629C184.7 27.7861 183.629 28 182.462 28V27.9955Z" fill="#5CE7A0" />
        <path d="M194.156 27.9952V5.08075H195.938V20.1341L203.449 12.7189H205.676L200.234 18.2251L206.823 27.9952H204.595L198.93 19.3696L195.938 22.3297V27.9952H194.156Z" fill="#5CE7A0" />
        <path d="M30.9282 0V27.8655H24.3025L24.4049 10.91L17.5562 22.6278H13.1558L5.94309 10.7621L6.05003 27.8655H0V0H6.35037L15.5972 15.3491L24.3821 0H30.9282Z" fill="#0094ED" />
        <path d="M35.6152 27.8632V0H45.1692C48.0611 0 50.5981 0.5893 52.7824 1.77018C54.9644 2.95105 56.6663 4.58699 57.8882 6.6757C59.1077 8.7667 59.7198 11.1831 59.7198 13.9293C59.7198 15.9998 59.3717 17.8906 58.6754 19.6016C57.9792 21.3126 56.9871 22.7825 55.6993 24.0089C54.4115 25.2352 52.8802 26.184 51.1009 26.8553C49.3239 27.5242 47.3467 27.8609 45.1692 27.8609H35.6152V27.8632ZM42.2182 21.7131H44.8279C46.0225 21.7131 47.1032 21.547 48.0725 21.2148C49.0418 20.8826 49.8791 20.3866 50.5913 19.7222C51.3012 19.0578 51.845 18.2433 52.2227 17.274C52.6004 16.3047 52.7892 15.1898 52.7892 13.9293C52.7892 12.2456 52.457 10.8258 51.7949 9.66998C51.1305 8.51641 50.1999 7.64042 48.9986 7.04202C47.7972 6.4459 46.407 6.14556 44.8302 6.14556H42.2227L42.2182 21.7086V21.7131Z" fill="#0094ED" />
        <path d="M41.3611 10.915V15.5998H35.6159V21.2767H30.9311V15.5998H25.2383L25.2701 10.9105L30.9311 10.9128V5.16992L35.6159 5.18584V10.9128L41.3611 10.915Z" fill="#5CE7A0" />
    </svg>`;

}


/**
 * Generate HTML content for the report
 */
function generateHtmlContent(aiResult, payload) {
    const patient = payload?.patient || {};
    const info = getPrimaryConditionInfo(payload);
    const data = aiResult?.data || {};
    const dateTime = reportDateTime();

    // Generate alerts HTML
    let alertsHtml = "";
    const alerts = data.healthAlerts || [];
    if (alerts.length === 0) {
        alertsHtml = "<p>No health alerts.</p>";
    } else {
        alerts.forEach((alert) => {
            const level = (alert.level || "LOW").toLowerCase();
            const levelUpper = level.toUpperCase();
            alertsHtml += `
            <div class="alert ${level}">
                <strong>${levelUpper}:</strong> ${escapeHtml(alert.message || "")}
            </div>`;
        });
    }

    // Generate bullet lists
    function generateBulletList(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return "<p>No items.</p>";
        }
        let html = "<ul>";
        items.forEach((item) => {
            html += `<li>${escapeHtml(item)}</li>`;
        });
        html += "</ul>";
        return html;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Overview Health Insights Report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        @page {
            size: Letter;
            margin: 0.5in;
        }

        body {
            font-family: 'Open Sans', sans-serif;
            background: #F4FFFF;
            color: #333;
            font-size: 10pt;
            line-height: 1.5;
        }

        .report-container {
            max-width: 7.5in;
            margin: 0 auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
        }

        .logo img {
            height: 45px;
            width: auto;
        }

        .contact {
            text-align: right;
            font-size: 9pt;
            color: #6b7280;
            line-height: 1.4;
        }

        hr {
            border: none;
            border-top: 2px solid #0094ED;
            margin: 15px 0;
        }

        h1 {
            font-size: 18pt;
            margin: 10px 0 5px 0;
            color: #0094ED;
            font-weight: 700;
        }

        .subtext {
            color: #6b7280;
            font-size: 9pt;
            margin-bottom: 15px;
        }

        .section-title {
            background: #1f8ed6;
            color: white;
            padding: 10px;
            font-weight: bold;
            border-radius: 4px;
            margin-top: 25px;
            position: relative;
        }

        .section-title::after {
            content: "";
            position: absolute;
            right: 0;
            top: 0;
            height: 100%;
            width: 60px;
            background: #47c27c;
            border-radius: 0 4px 4px 0;
        }
        .section-content {
            font-size: 9pt;
            color: #1f2937;
            margin-bottom: 10px;
            padding: 0 5px;
        }

        .section-content p {
            margin: 5px 0;
        }

        .section-content strong {
            font-weight: 600;
        }

        .alert {
            padding: 10px 12px;
            margin: 6px 0;
            border-radius: 4px;
            font-size: 9pt;
            border-left: 3px solid;
        }

        .high {
            background: #FFE5E5;
            border-left-color: #DC2626;
        }

        .medium {
            background: #FFF4CC;
            border-left-color: #F59E0B;
        }

        .low {
            background: #D1FAE5;
            border-left-color: #10B981;
        }

        ul {
            padding-left: 20px;
            margin: 5px 0;
        }

        ul li {
            margin: 3px 0;
        }

        .footer-note {
            background: #E5E7EB;
            padding: 10px;
            border-radius: 4px;
            text-align: center;
            margin-top: 20px;
            font-size: 8pt;
            color: #6b7280;
            border: 1px solid #D1D5DB;
        }

        /* Print optimization */
        @media print {
            body {
                background: white;
            }
            .section-title {
                break-after: avoid;
            }
            .section-content {
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="header">
            <div class="logo">
                ${logo()}
            </div>
            <div class="contact">
                ${escapeHtml(BRAND.email)}<br>
                ${escapeHtml(BRAND.phone)}<br>
                ${escapeHtml(BRAND.website)}
            </div>
        </div>

        <hr>

        <h1>AI Overview Health Insights Report</h1>
        <div class="subtext">
            AI-Generated Medical Analysis<br>
            Report Generated On: ${escapeHtml(dateTime)}
        </div>

        <div class="section-title">Patient Demographics</div>
        <div class="section-content">
            <p><strong>Patient Name:</strong> ${escapeHtml(patient.name || "N/A")}</p>
            <p><strong>Age:</strong> ${escapeHtml(patient.age || "N/A")}</p>
            <p><strong>Gender:</strong> ${escapeHtml(patient.gender || "N/A")}</p>
        </div>

        <div class="section-title">Clinical Information</div>
        <div class="section-content">
            <p><strong>Primary Condition:</strong> ${escapeHtml(info.primaryCondition)}</p>
            <p><strong>Condition Status:</strong> ${escapeHtml(info.conditionStatus)}</p>
            <p><strong>Condition Onset:</strong> ${escapeHtml(info.conditionOnset)}</p>
            <p><strong>Is Cured:</strong> ${escapeHtml(info.isCured)}</p>
        </div>

        <div class="section-title">Condition Assessment</div>
        <div class="section-content">
            <p>${escapeHtml(data.overallSummary || "No summary available.")}</p>
        </div>

        <div class="section-title">Health Alerts</div>
        <div class="section-content">
            ${alertsHtml}
        </div>

        <div class="section-title">Vitals Summary</div>
        <div class="section-content">
            ${generateBulletList(data.vitalsSummary)}
        </div>

        <div class="section-title">Daily Patterns</div>
        <div class="section-content">
            ${generateBulletList(data.dailyPatterns)}
        </div>

        <div class="section-title">Smart Advices</div>
        <div class="section-content">
            ${generateBulletList(data.smartAdvices)}
        </div>

        <div class="section-title">Care Team Notes</div>
        <div class="section-content">
            ${generateBulletList(data.careTeamNotes)}
        </div>

        <div class="section-title">Next Steps</div>
        <div class="section-content">
            ${generateBulletList(data.nextSteps)}
        </div>

        <div class="footer-note">
            The information is AI generated. Consult a doctor for medical advice.
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate PDF report using Puppeteer (HTML to PDF)
 */
async function generateReportPdf(aiResult, payload, outputPath) {
    const htmlContent = generateHtmlContent(aiResult, payload);

    // Launch browser with additional fallback options
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "networkidle0" });

        await page.pdf({
            path: outputPath,
            format: "Letter",
            printBackground: true,
            margin: {
                top: "0.5in",
                right: "0.5in",
                bottom: "0.5in",
                left: "0.5in",
            },
        });

        return outputPath;
    } finally {
        await browser.close();
    }
}

module.exports = { generateReportPdf, getPrimaryConditionInfo, reportDateTime };
