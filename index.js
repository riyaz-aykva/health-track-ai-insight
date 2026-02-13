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


const client = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Normalize conditions for payload:
 * - type "disease" → only one condition (single object); wrapped to [one] internally.
 * - type "symptom" → multiple conditions allowed (array).
 * Accepts: single condition, array of conditions, or API response { success, data }.
 * For symptom-type, symptom items without "title" get condition's symptom_title.
 */
function normalizeConditionsInput(input) {
    let raw = input;
    if (input && typeof input === "object" && "success" in input && "data" in input) {
        raw = input.data;
    }
    const isArray = Array.isArray(raw);
    const list = isArray ? raw : (raw != null ? [raw] : []);

    return list.map((c) => {
        if (!c || typeof c !== "object") return c;
        const type = c.type || "disease";
        const symptomTitle = c.symptom_title || null;
        const symptoms = (c.symptoms || []).map((s) => {
            const hasTitle = s && "title" in s && s.title != null && s.title !== "";
            return { ...s, title: hasTitle ? s.title : (symptomTitle || "N/A") };
        });
        return { ...c, type, symptoms };
    });
}

// Disease: single object only. Symptom: array of conditions (multiple allowed).
// Example disease: conditionsInput = { type: "disease", disease_title: "...", condition_id: "...", symptoms: [...] };
const conditionsForSymptom = [
    {
        "condition_id": "6985cdf941eeb53a74254f5f",
        "type": "symptom",
        "status": "suspected",
        "symptom_lookup_id": "56f51f54-0b28-4e3a-b5ca-1344f2f2cc4a",
        "symptom_title": "short of breath",
        "symptoms": [
            {
                "records": [
                    {
                        "severity": 6,
                        "recorded_at": "2026-02-12T11:22:02.375Z",
                    },
                    {
                        "severity": 7,
                        "recorded_at": "2026-02-11T09:18:17.203Z",
                    },
                    {
                        "severity": 8,
                        "recorded_at": "2026-02-10T08:18:17.203Z",
                    },
                    {
                        "severity": 10,
                        "recorded_at": "2026-02-09T07:18:17.203Z",
                    },
                    {
                        "severity": 5,
                        "recorded_at": "2026-02-08T11:18:17.203Z",
                    },
                    {
                        "severity": 5,
                        "recorded_at": "2026-02-07T06:30:15.500Z",
                    }
                ]
            }
        ]
    },
    {
        "condition_id": "698d82c7bb05e0b7c13a1f34",
        "type": "symptom",
        "status": "suspected",
        "symptom_lookup_id": "cc50560b-a35e-4315-9856-7c693335dbb0",
        "symptom_title": "ADHD-is forgetful in daily activities.(0-4)",
        "symptoms": [
            {
                "records": [
                    {
                        "severity": 7,
                        "recorded_at": "2026-02-12T07:35:35.042Z",
                    },
                    {
                        "severity": 6,
                        "recorded_at": "2026-02-11T07:35:35.042Z",
                    },
                    {
                        "severity": 5,
                        "recorded_at": "2026-02-10T07:35:35.042Z",
                    },
                    {
                        "severity": 4,
                        "recorded_at": "2026-02-09T07:35:35.042Z",
                    },
                    {
                        "severity": 5,
                        "recorded_at": "2026-02-08T07:35:35.042Z",
                    },
                    {
                        "severity": 6,
                        "recorded_at": "2026-02-07T07:35:35.042Z",
                    },
                    {
                        "severity": 7,
                        "recorded_at": "2026-02-06T07:35:35.042Z",
                    }
                ]
            }
        ]
    }
];

const conditionsForDisease = [
    {
        "condition_id": "6985cb0d41eeb53a74254efe",
        "type": "disease",
        "status": "cured",
        "disease_lookup_id": "e47e34b0-430a-4353-9935-7aa526d0686e",
        "disease_title": "Alcohol Withdrawal",
        "symptoms": [
            {
                "title": "confusion",
                "records": [
                    { severity: 5, recorded_at: "2026-02-03T09:00:00.000Z" },
                    { severity: 6, recorded_at: "2026-02-04T09:15:00.000Z" },
                    { severity: 4, recorded_at: "2026-02-05T08:45:00.000Z" },
                    { severity: 5, recorded_at: "2026-02-06T09:30:00.000Z" },
                    { severity: 3, recorded_at: "2026-02-07T08:50:00.000Z" },
                    { severity: 4, recorded_at: "2026-02-08T09:10:00.000Z" },
                    { severity: 2, recorded_at: "2026-02-09T09:00:00.000Z" },
                ]
            },
            {
                "title": "sweating",
                "records": [
                    { severity: 6, recorded_at: "2026-02-03T09:00:00.000Z" },
                    { severity: 5, recorded_at: "2026-02-04T09:15:00.000Z" },
                    { severity: 5, recorded_at: "2026-02-05T08:45:00.000Z" },
                    { severity: 4, recorded_at: "2026-02-06T09:30:00.000Z" },
                    { severity: 4, recorded_at: "2026-02-07T08:50:00.000Z" },
                    { severity: 3, recorded_at: "2026-02-08T09:10:00.000Z" },
                    { severity: 2, recorded_at: "2026-02-09T09:00:00.000Z" },
                ]
            }
        ]
    }
];

const conditions = normalizeConditionsInput(conditionsForDisease);

const vitals = [
    {
        lookup_id: "BLOOD_PRESSURE",
        vital_name: "Blood Pressure",
        records: [
            {
                recorded_at: "2026-02-03T08:15:00.000Z", value: {
                    "systolic": 120,
                    "diastolic": 80
                }
            },
            {
                recorded_at: "2026-02-04T08:20:00.000Z", value: {
                    "systolic": 120,
                    "diastolic": 80
                }
            },
            {
                recorded_at: "2026-02-05T08:10:00.000Z", value: {
                    "systolic": 120,
                    "diastolic": 80
                }
            },
            {
                recorded_at: "2026-02-06T08:25:00.000Z", value: {
                    "systolic": 121,
                    "diastolic": 79
                }
            },
            {
                recorded_at: "2026-02-07T08:30:00.000Z", value: {
                    "systolic": 119,
                    "diastolic": 81
                }
            },
            {
                recorded_at: "2026-02-08T08:18:00.000Z", value: {
                    "systolic": 120,
                    "diastolic": 80
                }
            },
            {
                recorded_at: "2026-02-09T08:22:00.000Z", value: {
                    "systolic": 123,
                    "diastolic": 81
                }
            },
        ]
    },
    {
        lookup_id: "HEART_RATE",
        vital_name: "Heart Rate",
        records: [
            { recorded_at: "2026-02-03T08:15:00.000Z", value: "68" },
            { recorded_at: "2026-02-04T08:20:00.000Z", value: "72" },
            { recorded_at: "2026-02-05T08:10:00.000Z", value: "70" },
            { recorded_at: "2026-02-06T08:25:00.000Z", value: "71" },
            { recorded_at: "2026-02-07T08:30:00.000Z", value: "69" },
            { recorded_at: "2026-02-08T08:18:00.000Z", value: "70" },
            { recorded_at: "2026-02-09T08:22:00.000Z", value: "73" },
        ]
    },
    {
        lookup_id: "SPO2",
        vital_name: "SpO2",
        records: [
            { recorded_at: "2026-02-03T08:15:00.000Z", value: "97" },
            { recorded_at: "2026-02-04T08:20:00.000Z", value: "98" },
            { recorded_at: "2026-02-05T08:10:00.000Z", value: "98" },
            { recorded_at: "2026-02-06T08:25:00.000Z", value: "99" },
            { recorded_at: "2026-02-07T08:30:00.000Z", value: "97" },
            { recorded_at: "2026-02-08T08:18:00.000Z", value: "98" },
            { recorded_at: "2026-02-09T08:22:00.000Z", value: "98" },
        ]
    },
    {
        lookup_id: "BODY_TEMPERATURE",
        vital_name: "Body Temperature",
        records: [
            { recorded_at: "2026-02-03T08:15:00.000Z", value: "98.4" },
            { recorded_at: "2026-02-04T08:20:00.000Z", value: "98.6" },
            { recorded_at: "2026-02-05T08:10:00.000Z", value: "98.5" },
            { recorded_at: "2026-02-06T08:25:00.000Z", value: "98.6" },
            { recorded_at: "2026-02-07T08:30:00.000Z", value: "98.4" },
            { recorded_at: "2026-02-08T08:18:00.000Z", value: "98.5" },
            { recorded_at: "2026-02-09T08:22:00.000Z", value: "98.6" },
        ]
    },
    {
        lookup_id: "BLOOD_SUGAR",
        vital_name: "Blood Sugar",
        records: [
            { recorded_at: "2026-02-03T08:15:00.000Z", value: "95" },
            { recorded_at: "2026-02-04T08:20:00.000Z", value: "102" },
            { recorded_at: "2026-02-05T08:10:00.000Z", value: "98" },
            { recorded_at: "2026-02-06T08:25:00.000Z", value: "105" },
            { recorded_at: "2026-02-07T08:30:00.000Z", value: "99" },
            { recorded_at: "2026-02-08T08:18:00.000Z", value: "100" },
            { recorded_at: "2026-02-09T08:22:00.000Z", value: "103" },
        ]
    },
]

const activities = [
    { activity_name: "Breakfast", createdAt: { $date: "2026-02-03T07:30:00.000Z" }, updatedAt: { $date: "2026-02-03T07:30:00.000Z" }, __v: 0, image: "8187733396.png" },
    { activity_name: "Morning Walk", createdAt: { $date: "2026-02-03T09:00:00.000Z" }, updatedAt: { $date: "2026-02-03T09:00:00.000Z" }, __v: 0, image: null },
    { activity_name: "Lunch", createdAt: { $date: "2026-02-03T12:45:00.000Z" }, updatedAt: { $date: "2026-02-03T12:45:00.000Z" }, __v: 0, image: null },
    { activity_name: "Breakfast", createdAt: { $date: "2026-02-04T08:00:00.000Z" }, updatedAt: { $date: "2026-02-04T08:00:00.000Z" }, __v: 0, image: null },
    { activity_name: "Dinner", createdAt: { $date: "2026-02-04T18:30:00.000Z" }, updatedAt: { $date: "2026-02-04T18:30:00.000Z" }, __v: 0, image: null },
    { activity_name: "Breakfast", createdAt: { $date: "2026-02-05T07:45:00.000Z" }, updatedAt: { $date: "2026-02-05T07:45:00.000Z" }, __v: 0, image: null },
    { activity_name: "Light Exercise", createdAt: { $date: "2026-02-05T10:15:00.000Z" }, updatedAt: { $date: "2026-02-05T10:15:00.000Z" }, __v: 0, image: null },
    { activity_name: "Breakfast", createdAt: { $date: "2026-02-06T08:20:00.000Z" }, updatedAt: { $date: "2026-02-06T08:20:00.000Z" }, __v: 0, image: null },
    { activity_name: "Lunch", createdAt: { $date: "2026-02-06T13:00:00.000Z" }, updatedAt: { $date: "2026-02-06T13:00:00.000Z" }, __v: 0, image: null },
    { activity_name: "Breakfast", createdAt: { $date: "2026-02-07T07:30:00.000Z" }, updatedAt: { $date: "2026-02-07T07:30:00.000Z" }, __v: 0, image: null },
    { activity_name: "Morning Walk", createdAt: { $date: "2026-02-07T09:30:00.000Z" }, updatedAt: { $date: "2026-02-07T09:30:00.000Z" }, __v: 0, image: null },
    { activity_name: "Breakfast", createdAt: { $date: "2026-02-08T08:00:00.000Z" }, updatedAt: { $date: "2026-02-08T08:00:00.000Z" }, __v: 0, image: null },
    { activity_name: "Dinner", createdAt: { $date: "2026-02-08T19:00:00.000Z" }, updatedAt: { $date: "2026-02-08T19:00:00.000Z" }, __v: 0, image: null },
    { activity_name: "Breakfast", createdAt: { $date: "2026-02-09T08:15:00.000Z" }, updatedAt: { $date: "2026-02-09T08:15:00.000Z" }, __v: 0, image: null },
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
• Health Alerts: Critical or abnormal findings requiring urgent attention
• Vitals Summary: Consolidated AI insights on vital signs
• Daily Patterns: How routine impacts vitals and symptoms
• Smart Advice: AI-based lifestyle or diet suggestions
• Care Team Notes: Doctor or caregiver comments on the AI report
• Next Steps: Recommended actions or consultation scheduling

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
    // const results = [];
    // for (const model of medicalHealthModels) {

    // }
    // return results;

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

        console.log(JSON.stringify(result, null, 2));
        await saveToExcel(result, payload.patient, conditions, OPENAI_MODEL, payload);

        const pdfFileName = `health_report_${new Date().toISOString().slice(0, 10)}.pdf`;
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
