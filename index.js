// Load environment variables from .env file if dotenv is installed
let dotenvLoaded = false;
let dotenvError = null;
try {
    const dotenv = require("dotenv");
    const result = dotenv.config();
    if (result && !result.error) {
        dotenvLoaded = true;
    } else if (result && result.error) {
        dotenvError = result.error.message;
    }
} catch (e) {
    // dotenv not installed or other error
    dotenvError = e.message;
}

const OpenAI = require("openai");
const fs = require("fs");
const { saveToExcel } = require("./utils");
const { generateReportPdf } = require("./pdfReport");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Validate API key before creating client
if (!OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY is not set.");
    console.error("");
    if (dotenvLoaded) {
        console.error(
            "The .env file was loaded but OPENAI_API_KEY was not found in it.",
        );
        console.error("Please check your .env file format. It should look like:");
    } else {
        console.error("The .env file was not loaded. Please ensure:");
        console.error("1. The .env file exists in the project root directory");
        console.error("2. The dotenv package is installed (run: npm install)");
        if (dotenvError) {
            console.error(`3. Error loading .env: ${dotenvError}`);
        }
        console.error("");
        console.error("Your .env file should look like:");
    }
    console.error("  OPENAI_API_KEY=sk-your-actual-api-key-here");
    console.error("  OPENAI_MODEL=gpt-4o-mini  (optional)");
    console.error("");
    console.error("Note: No spaces around the = sign, and no quotes needed.");
    process.exit(1);
}


const crypto = require("crypto");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "cache");

function getPayloadHash(payload) {
    const str = JSON.stringify({
        conditions: payload.conditions,
        vitals: payload.vitals,
        activities: payload.activities,
        patientLookupId: payload.patient?.lookup_id ?? payload.patient?.lookupId,
    });
    return crypto.createHash("sha256").update(str).digest("hex");
}

function getCachePath(hash) {
    return path.join(CACHE_DIR, `${hash}.json`);
}

function readCache(hash) {
    try {
        const filePath = getCachePath(hash);
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, "utf8");
            return JSON.parse(raw);
        }
    } catch (_) {
        // ignore parse or read errors
    }
    return null;
}

function writeCache(hash, result) {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        fs.writeFileSync(getCachePath(hash), JSON.stringify(result, null, 2), "utf8");
    } catch (err) {
        console.warn("Cache write failed:", err.message);
    }
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Normalize conditions for payload:
 * - type "disease" → only one condition (single object); wrapped to [one] internally.
 * - type "symptom" → multiple conditions allowed (array).
 * Accepts: single condition, array of conditions, or API response { success, data }.
 * For symptom-type, symptom items without "title" get condition's symptom_title.
 */
function conditionsSortById(list) {
    return list.sort((a, b) => a.condition_id.localeCompare(b.condition_id));
}

// Disease: single object only. Symptom: array of conditions (multiple allowed).
// Example disease: conditionsInput = { type: "disease", disease_title: "...", condition_id: "...", symptoms: [...] };
const conditionsForSymptom = [
    {
        "condition_id": "698d82c7bb05e0b7c13a1f34",
        "type": "symptom",
        "symptom_title": "ADHD-is forgetful in daily activities.(0-4)",
        "symptoms": [
            {
                "records": [
                    [4, "2026-02-12 07:35:35"],
                    [4, "2026-02-11 07:35:35"],
                    [4, "2026-02-10 07:35:35"],
                    [9, "2026-02-09 07:35:35"],
                    [4, "2026-02-08 07:35:35"],
                    [4, "2026-02-07 07:35:35"],
                    [4, "2026-02-06 07:35:35"]
                ]
            }
        ]
    },
    {
        "condition_id": "6985cdf941eeb53a74254f5f",
        "type": "symptom",
        "symptom_title": "short of breath",
        "symptoms": [
            {
                "records": [
                    [6, "2026-02-12 11:22:02"],
                    [7, "2026-02-11 09:18:17"],
                    [8, "2026-02-10 08:18:17"],
                    [9, "2026-02-09 07:18:17"],
                    [5, "2026-02-08 11:18:17"],
                    [5, "2026-02-07 06:30:15"]
                ]
            }
        ]
    },

];

const conditionsForDisease = [
    {
        "condition_id": "6985cb0d41eeb53a74254efe",
        "type": "disease",
        "disease_title": "Alcohol Withdrawal",
        "symptoms": [
            {
                "title": "confusion",
                "records": [
                    [7, "2026-02-18 06:00:00"], [6, "2026-02-18 08:00:00"], [5, "2026-02-18 10:00:00"], [6, "2026-02-18 12:00:00"], [5, "2026-02-18 14:00:00"], [4, "2026-02-18 16:00:00"], [5, "2026-02-18 18:00:00"], [4, "2026-02-18 20:00:00"], [3, "2026-02-18 21:00:00"], [4, "2026-02-18 22:00:00"],
                    [6, "2026-02-19 06:00:00"], [5, "2026-02-19 08:00:00"], [5, "2026-02-19 10:00:00"], [4, "2026-02-19 12:00:00"], [5, "2026-02-19 14:00:00"], [4, "2026-02-19 16:00:00"], [4, "2026-02-19 18:00:00"], [3, "2026-02-19 20:00:00"], [4, "2026-02-19 21:00:00"], [3, "2026-02-19 22:00:00"],
                    [5, "2026-02-20 06:00:00"], [5, "2026-02-20 08:00:00"], [4, "2026-02-20 10:00:00"], [4, "2026-02-20 12:00:00"], [4, "2026-02-20 14:00:00"], [3, "2026-02-20 16:00:00"], [4, "2026-02-20 18:00:00"], [3, "2026-02-20 20:00:00"], [3, "2026-02-20 21:00:00"], [2, "2026-02-20 22:00:00"],
                    [5, "2026-02-21 06:00:00"], [4, "2026-02-21 08:00:00"], [4, "2026-02-21 10:00:00"], [4, "2026-02-21 12:00:00"], [3, "2026-02-21 14:00:00"], [4, "2026-02-21 16:00:00"], [3, "2026-02-21 18:00:00"], [3, "2026-02-21 20:00:00"], [2, "2026-02-21 21:00:00"], [3, "2026-02-21 22:00:00"],
                    [4, "2026-02-22 06:00:00"], [4, "2026-02-22 08:00:00"], [4, "2026-02-22 10:00:00"], [3, "2026-02-22 12:00:00"], [3, "2026-02-22 14:00:00"], [3, "2026-02-22 16:00:00"], [3, "2026-02-22 18:00:00"], [2, "2026-02-22 20:00:00"], [3, "2026-02-22 21:00:00"], [2, "2026-02-22 22:00:00"],
                    [4, "2026-02-23 06:00:00"], [3, "2026-02-23 08:00:00"], [3, "2026-02-23 10:00:00"], [3, "2026-02-23 12:00:00"], [3, "2026-02-23 14:00:00"], [2, "2026-02-23 16:00:00"], [3, "2026-02-23 18:00:00"], [2, "2026-02-23 20:00:00"], [2, "2026-02-23 21:00:00"], [2, "2026-02-23 22:00:00"],
                    [3, "2026-02-24 06:00:00"], [3, "2026-02-24 08:00:00"], [3, "2026-02-24 10:00:00"], [2, "2026-02-24 12:00:00"], [3, "2026-02-24 14:00:00"], [2, "2026-02-24 16:00:00"], [2, "2026-02-24 18:00:00"], [2, "2026-02-24 20:00:00"], [2, "2026-02-24 21:00:00"], [2, "2026-02-24 22:00:00"],
                ]
            },
            {
                "title": "sweating",
                "records": [
                    [6, "2026-02-18 06:00:00"], [6, "2026-02-18 08:00:00"], [5, "2026-02-18 10:00:00"], [5, "2026-02-18 12:00:00"], [5, "2026-02-18 14:00:00"], [4, "2026-02-18 16:00:00"], [4, "2026-02-18 18:00:00"], [4, "2026-02-18 20:00:00"], [3, "2026-02-18 21:00:00"], [4, "2026-02-18 22:00:00"],
                    [5, "2026-02-19 06:00:00"], [5, "2026-02-19 08:00:00"], [5, "2026-02-19 10:00:00"], [4, "2026-02-19 12:00:00"], [4, "2026-02-19 14:00:00"], [4, "2026-02-19 16:00:00"], [3, "2026-02-19 18:00:00"], [4, "2026-02-19 20:00:00"], [3, "2026-02-19 21:00:00"], [3, "2026-02-19 22:00:00"],
                    [5, "2026-02-20 06:00:00"], [4, "2026-02-20 08:00:00"], [4, "2026-02-20 10:00:00"], [4, "2026-02-20 12:00:00"], [4, "2026-02-20 14:00:00"], [3, "2026-02-20 16:00:00"], [3, "2026-02-20 18:00:00"], [3, "2026-02-20 20:00:00"], [3, "2026-02-20 21:00:00"], [2, "2026-02-20 22:00:00"],
                    [4, "2026-02-21 06:00:00"], [4, "2026-02-21 08:00:00"], [4, "2026-02-21 10:00:00"], [3, "2026-02-21 12:00:00"], [4, "2026-02-21 14:00:00"], [3, "2026-02-21 16:00:00"], [3, "2026-02-21 18:00:00"], [3, "2026-02-21 20:00:00"], [2, "2026-02-21 21:00:00"], [3, "2026-02-21 22:00:00"],
                    [4, "2026-02-22 06:00:00"], [4, "2026-02-22 08:00:00"], [3, "2026-02-22 10:00:00"], [3, "2026-02-22 12:00:00"], [3, "2026-02-22 14:00:00"], [3, "2026-02-22 16:00:00"], [3, "2026-02-22 18:00:00"], [2, "2026-02-22 20:00:00"], [3, "2026-02-22 21:00:00"], [2, "2026-02-22 22:00:00"],
                    [3, "2026-02-23 06:00:00"], [3, "2026-02-23 08:00:00"], [3, "2026-02-23 10:00:00"], [3, "2026-02-23 12:00:00"], [2, "2026-02-23 14:00:00"], [3, "2026-02-23 16:00:00"], [2, "2026-02-23 18:00:00"], [2, "2026-02-23 20:00:00"], [2, "2026-02-23 21:00:00"], [2, "2026-02-23 22:00:00"],
                    [3, "2026-02-24 06:00:00"], [3, "2026-02-24 08:00:00"], [2, "2026-02-24 10:00:00"], [2, "2026-02-24 12:00:00"], [2, "2026-02-24 14:00:00"], [2, "2026-02-24 16:00:00"], [2, "2026-02-24 18:00:00"], [2, "2026-02-24 20:00:00"], [2, "2026-02-24 21:00:00"], [2, "2026-02-24 22:00:00"],
                ]
            },
            {
                "title": "anxiety",
                "records": [
                    [6, "2026-02-18 06:00:00"], [6, "2026-02-18 08:00:00"], [5, "2026-02-18 10:00:00"], [5, "2026-02-18 12:00:00"], [5, "2026-02-18 14:00:00"], [4, "2026-02-18 16:00:00"], [4, "2026-02-18 18:00:00"], [4, "2026-02-18 20:00:00"], [3, "2026-02-18 21:00:00"], [4, "2026-02-18 22:00:00"],
                    [5, "2026-02-19 06:00:00"], [5, "2026-02-19 08:00:00"], [5, "2026-02-19 10:00:00"], [4, "2026-02-19 12:00:00"], [4, "2026-02-19 14:00:00"], [4, "2026-02-19 16:00:00"], [3, "2026-02-19 18:00:00"], [4, "2026-02-19 20:00:00"], [3, "2026-02-19 21:00:00"], [3, "2026-02-19 22:00:00"],
                    [5, "2026-02-20 06:00:00"], [4, "2026-02-20 08:00:00"], [4, "2026-02-20 10:00:00"], [4, "2026-02-20 12:00:00"], [4, "2026-02-20 14:00:00"], [3, "2026-02-20 16:00:00"], [3, "2026-02-20 18:00:00"], [3, "2026-02-20 20:00:00"], [3, "2026-02-20 21:00:00"], [2, "2026-02-20 22:00:00"],
                    [4, "2026-02-21 06:00:00"], [4, "2026-02-21 08:00:00"], [4, "2026-02-21 10:00:00"], [3, "2026-02-21 12:00:00"], [4, "2026-02-21 14:00:00"], [3, "2026-02-21 16:00:00"], [3, "2026-02-21 18:00:00"], [3, "2026-02-21 20:00:00"], [2, "2026-02-21 21:00:00"], [3, "2026-02-21 22:00:00"],
                    [4, "2026-02-22 06:00:00"], [4, "2026-02-22 08:00:00"], [3, "2026-02-22 10:00:00"], [3, "2026-02-22 12:00:00"], [3, "2026-02-22 14:00:00"], [3, "2026-02-22 16:00:00"], [3, "2026-02-22 18:00:00"], [2, "2026-02-22 20:00:00"], [3, "2026-02-22 21:00:00"], [2, "2026-02-22 22:00:00"],
                    [3, "2026-02-23 06:00:00"], [3, "2026-02-23 08:00:00"], [3, "2026-02-23 10:00:00"], [3, "2026-02-23 12:00:00"], [2, "2026-02-23 14:00:00"], [3, "2026-02-23 16:00:00"], [2, "2026-02-23 18:00:00"], [2, "2026-02-23 20:00:00"], [2, "2026-02-23 21:00:00"], [2, "2026-02-23 22:00:00"],
                    [3, "2026-02-24 06:00:00"], [3, "2026-02-24 08:00:00"], [2, "2026-02-24 10:00:00"], [2, "2026-02-24 12:00:00"], [2, "2026-02-24 14:00:00"], [2, "2026-02-24 16:00:00"], [2, "2026-02-24 18:00:00"], [2, "2026-02-24 20:00:00"], [2, "2026-02-24 21:00:00"], [2, "2026-02-24 22:00:00"],
                ]
            },
            {
                "title": "sleep",
                "records": [
                    [6, "2026-02-18 06:00:00"], [6, "2026-02-18 08:00:00"], [5, "2026-02-18 10:00:00"], [5, "2026-02-18 12:00:00"], [5, "2026-02-18 14:00:00"], [4, "2026-02-18 16:00:00"], [4, "2026-02-18 18:00:00"], [4, "2026-02-18 20:00:00"], [3, "2026-02-18 21:00:00"], [4, "2026-02-18 22:00:00"],
                    [5, "2026-02-19 06:00:00"], [5, "2026-02-19 08:00:00"], [5, "2026-02-19 10:00:00"], [4, "2026-02-19 12:00:00"], [4, "2026-02-19 14:00:00"], [4, "2026-02-19 16:00:00"], [3, "2026-02-19 18:00:00"], [4, "2026-02-19 20:00:00"], [3, "2026-02-19 21:00:00"], [3, "2026-02-19 22:00:00"],
                    [5, "2026-02-20 06:00:00"], [4, "2026-02-20 08:00:00"], [4, "2026-02-20 10:00:00"], [4, "2026-02-20 12:00:00"], [4, "2026-02-20 14:00:00"], [3, "2026-02-20 16:00:00"], [3, "2026-02-20 18:00:00"], [3, "2026-02-20 20:00:00"], [3, "2026-02-20 21:00:00"], [2, "2026-02-20 22:00:00"],
                    [4, "2026-02-21 06:00:00"], [4, "2026-02-21 08:00:00"], [4, "2026-02-21 10:00:00"], [3, "2026-02-21 12:00:00"], [4, "2026-02-21 14:00:00"], [3, "2026-02-21 16:00:00"], [3, "2026-02-21 18:00:00"], [3, "2026-02-21 20:00:00"], [2, "2026-02-21 21:00:00"], [3, "2026-02-21 22:00:00"],
                    [4, "2026-02-22 06:00:00"], [4, "2026-02-22 08:00:00"], [3, "2026-02-22 10:00:00"], [3, "2026-02-22 12:00:00"], [3, "2026-02-22 14:00:00"], [3, "2026-02-22 16:00:00"], [3, "2026-02-22 18:00:00"], [2, "2026-02-22 20:00:00"], [3, "2026-02-22 21:00:00"], [2, "2026-02-22 22:00:00"],
                    [3, "2026-02-23 06:00:00"], [3, "2026-02-23 08:00:00"], [3, "2026-02-23 10:00:00"], [3, "2026-02-23 12:00:00"], [2, "2026-02-23 14:00:00"], [3, "2026-02-23 16:00:00"], [2, "2026-02-23 18:00:00"], [2, "2026-02-23 20:00:00"], [2, "2026-02-23 21:00:00"], [2, "2026-02-23 22:00:00"],
                    [3, "2026-02-24 06:00:00"], [3, "2026-02-24 08:00:00"], [2, "2026-02-24 10:00:00"], [2, "2026-02-24 12:00:00"], [2, "2026-02-24 14:00:00"], [2, "2026-02-24 16:00:00"], [2, "2026-02-24 18:00:00"], [2, "2026-02-24 20:00:00"], [2, "2026-02-24 21:00:00"], [2, "2026-02-24 22:00:00"],
                ]
            },

        ]
    }
];

const conditions = conditionsSortById(conditionsForDisease);

// console.log(JSON.stringify(conditions, null, 2));
// return;

// Last seven days dummy records (Feb 11–17, 2026)
const vitals = [
    { "recorded_at": "2026-02-18 06:00:00", "vitals": [["HEART_RATE", 76], ["BLOOD_PRESSURE", { "systolic": 124, "diastolic": 84 }], ["SPO2", 96]] },
    { "recorded_at": "2026-02-18 08:00:00", "vitals": [["HEART_RATE", 74], ["BLOOD_PRESSURE", { "systolic": 122, "diastolic": 82 }], ["SPO2", 97]] },
    { "recorded_at": "2026-02-18 10:00:00", "vitals": [["HEART_RATE", 73], ["BLOOD_PRESSURE", { "systolic": 121, "diastolic": 81 }], ["SPO2", 97]] },
    { "recorded_at": "2026-02-18 12:00:00", "vitals": [["HEART_RATE", 75], ["BLOOD_PRESSURE", { "systolic": 123, "diastolic": 83 }], ["SPO2", 97]] },
    { "recorded_at": "2026-02-18 14:00:00", "vitals": [["HEART_RATE", 74], ["BLOOD_PRESSURE", { "systolic": 122, "diastolic": 82 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-18 16:00:00", "vitals": [["HEART_RATE", 72], ["BLOOD_PRESSURE", { "systolic": 120, "diastolic": 80 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-18 18:00:00", "vitals": [["HEART_RATE", 73], ["BLOOD_PRESSURE", { "systolic": 121, "diastolic": 81 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-18 20:00:00", "vitals": [["HEART_RATE", 71], ["BLOOD_PRESSURE", { "systolic": 119, "diastolic": 79 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-18 21:00:00", "vitals": [["HEART_RATE", 72], ["BLOOD_PRESSURE", { "systolic": 120, "diastolic": 80 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-18 22:00:00", "vitals": [["HEART_RATE", 70], ["BLOOD_PRESSURE", { "systolic": 118, "diastolic": 78 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-19 06:00:00", "vitals": [["HEART_RATE", 75], ["BLOOD_PRESSURE", { "systolic": 123, "diastolic": 83 }], ["SPO2", 97]] },
    { "recorded_at": "2026-02-19 08:00:00", "vitals": [["HEART_RATE", 73], ["BLOOD_PRESSURE", { "systolic": 121, "diastolic": 81 }], ["SPO2", 97]] },
    { "recorded_at": "2026-02-19 10:00:00", "vitals": [["HEART_RATE", 72], ["BLOOD_PRESSURE", { "systolic": 120, "diastolic": 80 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-19 12:00:00", "vitals": [["HEART_RATE", 74], ["BLOOD_PRESSURE", { "systolic": 122, "diastolic": 82 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-19 14:00:00", "vitals": [["HEART_RATE", 72], ["BLOOD_PRESSURE", { "systolic": 120, "diastolic": 80 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-19 16:00:00", "vitals": [["HEART_RATE", 71], ["BLOOD_PRESSURE", { "systolic": 119, "diastolic": 79 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-19 18:00:00", "vitals": [["HEART_RATE", 72], ["BLOOD_PRESSURE", { "systolic": 120, "diastolic": 80 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-19 20:00:00", "vitals": [["HEART_RATE", 70], ["BLOOD_PRESSURE", { "systolic": 118, "diastolic": 78 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-19 21:00:00", "vitals": [["HEART_RATE", 71], ["BLOOD_PRESSURE", { "systolic": 119, "diastolic": 79 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-19 22:00:00", "vitals": [["HEART_RATE", 69], ["BLOOD_PRESSURE", { "systolic": 117, "diastolic": 77 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-20 06:00:00", "vitals": [["HEART_RATE", 74], ["BLOOD_PRESSURE", { "systolic": 122, "diastolic": 82 }], ["SPO2", 97]] },
    { "recorded_at": "2026-02-20 08:00:00", "vitals": [["HEART_RATE", 72], ["BLOOD_PRESSURE", { "systolic": 120, "diastolic": 80 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-20 10:00:00", "vitals": [["HEART_RATE", 71], ["BLOOD_PRESSURE", { "systolic": 119, "diastolic": 79 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-20 12:00:00", "vitals": [["HEART_RATE", 73], ["BLOOD_PRESSURE", { "systolic": 121, "diastolic": 81 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-20 14:00:00", "vitals": [["HEART_RATE", 71], ["BLOOD_PRESSURE", { "systolic": 119, "diastolic": 79 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-20 16:00:00", "vitals": [["HEART_RATE", 70], ["BLOOD_PRESSURE", { "systolic": 118, "diastolic": 78 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-20 18:00:00", "vitals": [["HEART_RATE", 71], ["BLOOD_PRESSURE", { "systolic": 119, "diastolic": 79 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-20 20:00:00", "vitals": [["HEART_RATE", 69], ["BLOOD_PRESSURE", { "systolic": 117, "diastolic": 77 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-20 21:00:00", "vitals": [["HEART_RATE", 70], ["BLOOD_PRESSURE", { "systolic": 118, "diastolic": 78 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-20 22:00:00", "vitals": [["HEART_RATE", 68], ["BLOOD_PRESSURE", { "systolic": 116, "diastolic": 76 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-21 06:00:00", "vitals": [["HEART_RATE", 73], ["BLOOD_PRESSURE", { "systolic": 121, "diastolic": 81 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-21 08:00:00", "vitals": [["HEART_RATE", 71], ["BLOOD_PRESSURE", { "systolic": 119, "diastolic": 79 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-21 10:00:00", "vitals": [["HEART_RATE", 70], ["BLOOD_PRESSURE", { "systolic": 118, "diastolic": 78 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-21 12:00:00", "vitals": [["HEART_RATE", 72], ["BLOOD_PRESSURE", { "systolic": 120, "diastolic": 80 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-21 14:00:00", "vitals": [["HEART_RATE", 70], ["BLOOD_PRESSURE", { "systolic": 118, "diastolic": 78 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-21 16:00:00", "vitals": [["HEART_RATE", 69], ["BLOOD_PRESSURE", { "systolic": 117, "diastolic": 77 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-21 18:00:00", "vitals": [["HEART_RATE", 70], ["BLOOD_PRESSURE", { "systolic": 118, "diastolic": 78 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-21 20:00:00", "vitals": [["HEART_RATE", 68], ["BLOOD_PRESSURE", { "systolic": 116, "diastolic": 76 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-21 21:00:00", "vitals": [["HEART_RATE", 69], ["BLOOD_PRESSURE", { "systolic": 117, "diastolic": 77 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-21 22:00:00", "vitals": [["HEART_RATE", 67], ["BLOOD_PRESSURE", { "systolic": 115, "diastolic": 75 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-22 06:00:00", "vitals": [["HEART_RATE", 72], ["BLOOD_PRESSURE", { "systolic": 120, "diastolic": 80 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-22 08:00:00", "vitals": [["HEART_RATE", 70], ["BLOOD_PRESSURE", { "systolic": 118, "diastolic": 78 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-22 10:00:00", "vitals": [["HEART_RATE", 69], ["BLOOD_PRESSURE", { "systolic": 117, "diastolic": 77 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-22 12:00:00", "vitals": [["HEART_RATE", 71], ["BLOOD_PRESSURE", { "systolic": 119, "diastolic": 79 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-22 14:00:00", "vitals": [["HEART_RATE", 69], ["BLOOD_PRESSURE", { "systolic": 117, "diastolic": 77 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-22 16:00:00", "vitals": [["HEART_RATE", 68], ["BLOOD_PRESSURE", { "systolic": 116, "diastolic": 76 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-22 18:00:00", "vitals": [["HEART_RATE", 69], ["BLOOD_PRESSURE", { "systolic": 117, "diastolic": 77 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-22 20:00:00", "vitals": [["HEART_RATE", 67], ["BLOOD_PRESSURE", { "systolic": 115, "diastolic": 75 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-22 21:00:00", "vitals": [["HEART_RATE", 68], ["BLOOD_PRESSURE", { "systolic": 116, "diastolic": 76 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-22 22:00:00", "vitals": [["HEART_RATE", 66], ["BLOOD_PRESSURE", { "systolic": 114, "diastolic": 74 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-23 06:00:00", "vitals": [["HEART_RATE", 71], ["BLOOD_PRESSURE", { "systolic": 119, "diastolic": 79 }], ["SPO2", 98]] },
    { "recorded_at": "2026-02-23 08:00:00", "vitals": [["HEART_RATE", 69], ["BLOOD_PRESSURE", { "systolic": 117, "diastolic": 77 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-23 10:00:00", "vitals": [["HEART_RATE", 68], ["BLOOD_PRESSURE", { "systolic": 116, "diastolic": 76 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-23 12:00:00", "vitals": [["HEART_RATE", 70], ["BLOOD_PRESSURE", { "systolic": 118, "diastolic": 78 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-23 14:00:00", "vitals": [["HEART_RATE", 68], ["BLOOD_PRESSURE", { "systolic": 116, "diastolic": 76 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-23 16:00:00", "vitals": [["HEART_RATE", 67], ["BLOOD_PRESSURE", { "systolic": 115, "diastolic": 75 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-23 18:00:00", "vitals": [["HEART_RATE", 68], ["BLOOD_PRESSURE", { "systolic": 116, "diastolic": 76 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-23 20:00:00", "vitals": [["HEART_RATE", 66], ["BLOOD_PRESSURE", { "systolic": 114, "diastolic": 74 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-23 21:00:00", "vitals": [["HEART_RATE", 67], ["BLOOD_PRESSURE", { "systolic": 115, "diastolic": 75 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-23 22:00:00", "vitals": [["HEART_RATE", 65], ["BLOOD_PRESSURE", { "systolic": 113, "diastolic": 73 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-24 06:00:00", "vitals": [["HEART_RATE", 70], ["BLOOD_PRESSURE", { "systolic": 118, "diastolic": 78 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-24 08:00:00", "vitals": [["HEART_RATE", 68], ["BLOOD_PRESSURE", { "systolic": 116, "diastolic": 76 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-24 10:00:00", "vitals": [["HEART_RATE", 67], ["BLOOD_PRESSURE", { "systolic": 115, "diastolic": 75 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-24 12:00:00", "vitals": [["HEART_RATE", 69], ["BLOOD_PRESSURE", { "systolic": 117, "diastolic": 77 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-24 14:00:00", "vitals": [["HEART_RATE", 67], ["BLOOD_PRESSURE", { "systolic": 115, "diastolic": 75 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-24 16:00:00", "vitals": [["HEART_RATE", 66], ["BLOOD_PRESSURE", { "systolic": 114, "diastolic": 74 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-24 18:00:00", "vitals": [["HEART_RATE", 67], ["BLOOD_PRESSURE", { "systolic": 115, "diastolic": 75 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-24 20:00:00", "vitals": [["HEART_RATE", 65], ["BLOOD_PRESSURE", { "systolic": 113, "diastolic": 73 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-24 21:00:00", "vitals": [["HEART_RATE", 66], ["BLOOD_PRESSURE", { "systolic": 114, "diastolic": 74 }], ["SPO2", 99]] },
    { "recorded_at": "2026-02-24 22:00:00", "vitals": [["HEART_RATE", 64], ["BLOOD_PRESSURE", { "systolic": 112, "diastolic": 72 }], ["SPO2", 99]] },
];

const activities = [
    ["Breakfast", "2026-02-18 06:00:00"], ["Morning Walk", "2026-02-18 08:00:00"], ["Snack", "2026-02-18 10:00:00"], ["Lunch", "2026-02-18 12:00:00"], ["Rest", "2026-02-18 14:00:00"], ["Light Exercise", "2026-02-18 16:00:00"], ["Dinner", "2026-02-18 18:00:00"], ["Evening Walk", "2026-02-18 20:00:00"], ["Snack", "2026-02-18 21:00:00"], ["Rest", "2026-02-18 22:00:00"],
    ["Breakfast", "2026-02-19 06:00:00"], ["Morning Walk", "2026-02-19 08:00:00"], ["Snack", "2026-02-19 10:00:00"], ["Lunch", "2026-02-19 12:00:00"], ["Rest", "2026-02-19 14:00:00"], ["Light Exercise", "2026-02-19 16:00:00"], ["Dinner", "2026-02-19 18:00:00"], ["Evening Walk", "2026-02-19 20:00:00"], ["Snack", "2026-02-19 21:00:00"], ["Rest", "2026-02-19 22:00:00"],
    ["Breakfast", "2026-02-20 06:00:00"], ["Morning Walk", "2026-02-20 08:00:00"], ["Snack", "2026-02-20 10:00:00"], ["Lunch", "2026-02-20 12:00:00"], ["Rest", "2026-02-20 14:00:00"], ["Light Exercise", "2026-02-20 16:00:00"], ["Dinner", "2026-02-20 18:00:00"], ["Evening Walk", "2026-02-20 20:00:00"], ["Snack", "2026-02-20 21:00:00"], ["Rest", "2026-02-20 22:00:00"],
    ["Breakfast", "2026-02-21 06:00:00"], ["Morning Walk", "2026-02-21 08:00:00"], ["Snack", "2026-02-21 10:00:00"], ["Lunch", "2026-02-21 12:00:00"], ["Rest", "2026-02-21 14:00:00"], ["Light Exercise", "2026-02-21 16:00:00"], ["Dinner", "2026-02-21 18:00:00"], ["Evening Walk", "2026-02-21 20:00:00"], ["Snack", "2026-02-21 21:00:00"], ["Rest", "2026-02-21 22:00:00"],
    ["Breakfast", "2026-02-22 06:00:00"], ["Morning Walk", "2026-02-22 08:00:00"], ["Snack", "2026-02-22 10:00:00"], ["Lunch", "2026-02-22 12:00:00"], ["Rest", "2026-02-22 14:00:00"], ["Light Exercise", "2026-02-22 16:00:00"], ["Dinner", "2026-02-22 18:00:00"], ["Evening Walk", "2026-02-22 20:00:00"], ["Snack", "2026-02-22 21:00:00"], ["Rest", "2026-02-22 22:00:00"],
    ["Breakfast", "2026-02-23 06:00:00"], ["Morning Walk", "2026-02-23 08:00:00"], ["Snack", "2026-02-23 10:00:00"], ["Lunch", "2026-02-23 12:00:00"], ["Rest", "2026-02-23 14:00:00"], ["Light Exercise", "2026-02-23 16:00:00"], ["Dinner", "2026-02-23 18:00:00"], ["Evening Walk", "2026-02-23 20:00:00"], ["Snack", "2026-02-23 21:00:00"], ["Rest", "2026-02-23 22:00:00"],
    ["Breakfast", "2026-02-24 06:00:00"], ["Morning Walk", "2026-02-24 08:00:00"], ["Snack", "2026-02-24 10:00:00"], ["Lunch", "2026-02-24 12:00:00"], ["Rest", "2026-02-24 14:00:00"], ["Light Exercise", "2026-02-24 16:00:00"], ["Dinner", "2026-02-24 18:00:00"], ["Evening Walk", "2026-02-24 20:00:00"], ["Snack", "2026-02-24 21:00:00"], ["Rest", "2026-02-24 22:00:00"],
];

const payload = {
    conditions,
    patient: {
        name: "John Doe",
        gender: "Male",
        age: new Date().getFullYear() - new Date("1990-01-01").getFullYear(),
    },
    vitals,
    activities,
};

const prompt = `
Generate AI health overview in JSON format with the following structure:
{
  "overallSummary": "string",
  "healthAlerts": [
    {
      "level": "LOW|MEDIUM|HIGH",
      "message": "string"
    }
  ],
  "vitalsSummary": ["string"],
  "dailyPatterns": ["string"],
  "smartAdvices": ["string"],
  "careTeamNotes": ["string"],
  "nextSteps": ["string"]
}
User Requirements:
Health Alerts: Critical or abnormal findings requiring urgent attention
Vitals Summary: Consolidated AI insights on vital signs
Daily Patterns: How routine impacts vitals and symptoms
Smart Advice: AI-based lifestyle or diet suggestions
Care Team Notes: Doctor or caregiver comments on the AI report
Next Steps: Recommended actions or consultation scheduling
Rules:
- Not a medical diagnosis
- Simple language
- No prescriptions
- Return ONLY valid JSON, no additional text
Data:
${JSON.stringify(payload)}
`;

// Chat models only (v1/chat/completions). Run "node list-models.js" to see models for your key.
// These models have been tested for health analysis.
const medicalHealthModels = [
    'gpt-5',
    'gpt-5-pro',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
];

const test = async () => {
    const hash = getPayloadHash(payload);
    console.log("Hash:", hash);
    const cached = readCache(hash);
    console.log("Cached:", cached);
    if (cached) {
        console.log("Cache hit: same payload, reusing stored response.");
        // console.log(JSON.stringify(cached, null, 2));
        // const pdfFileName = `./pdf/health_report_${new Date().toISOString()}.pdf`;
        // await generateReportPdf(cached, payload, pdfFileName);
        // console.log(`PDF report saved to ${pdfFileName}`);
        return cached;
    }

    try {
        const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
            response_format: { type: "json_object" },
        });

        const jsonResponse = JSON.parse(response.choices[0].message.content);
        const result = {
            data: jsonResponse,
            tokenUsage: response.usage,
        };

        writeCache(hash, result);
        console.log(JSON.stringify(result, null, 2));
        await saveToExcel(result, payload.patient, conditions, OPENAI_MODEL, payload);

        const pdfFileName = `./pdf/health_report_${new Date().toISOString()}.pdf`;
        await generateReportPdf(result, payload, pdfFileName);
        console.log(`PDF report saved to ${pdfFileName}`);

        return result;
    } catch (err) {
        console.error(err);
        return { error: err.message };
    }
};

test()
    .then((result) => {
        console.log(result);
        fs.writeFileSync("output.json", JSON.stringify(result, null, 2));
    })
    .catch((error) => {
        console.error(error);
        fs.writeFileSync("error.json", JSON.stringify(error, null, 2));
    });
