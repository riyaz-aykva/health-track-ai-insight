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
const { saveToExcel, generatePDFReport } = require("./utils");
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

const conditions = {
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
            ],
            "baselines": {
                "patient_baseline": 8
            }
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
            ],
            "baselines": {
                "patient_baseline": 8
            }
        }
    ]
}

const vitals = [
    {
        lookup_id: "BLOOD_PRESSURE",
        vital_name: "Blood Pressure",
        records: [
            { timestamp: "2026-02-03T08:15:00.000Z", value: "118/78" },
            { timestamp: "2026-02-04T08:20:00.000Z", value: "122/82" },
            { timestamp: "2026-02-05T08:10:00.000Z", value: "120/80" },
            { timestamp: "2026-02-06T08:25:00.000Z", value: "121/79" },
            { timestamp: "2026-02-07T08:30:00.000Z", value: "119/81" },
            { timestamp: "2026-02-08T08:18:00.000Z", value: "120/80" },
            { timestamp: "2026-02-09T08:22:00.000Z", value: "123/81" },
        ]
    },
    {
        lookup_id: "HEART_RATE",
        vital_name: "Heart Rate",
        records: [
            { timestamp: "2026-02-03T08:15:00.000Z", value: "68" },
            { timestamp: "2026-02-04T08:20:00.000Z", value: "72" },
            { timestamp: "2026-02-05T08:10:00.000Z", value: "70" },
            { timestamp: "2026-02-06T08:25:00.000Z", value: "71" },
            { timestamp: "2026-02-07T08:30:00.000Z", value: "69" },
            { timestamp: "2026-02-08T08:18:00.000Z", value: "70" },
            { timestamp: "2026-02-09T08:22:00.000Z", value: "73" },
        ]
    },
    {
        lookup_id: "SPO2",
        vital_name: "SpO2",
        records: [
            { timestamp: "2026-02-03T08:15:00.000Z", value: "97" },
            { timestamp: "2026-02-04T08:20:00.000Z", value: "98" },
            { timestamp: "2026-02-05T08:10:00.000Z", value: "98" },
            { timestamp: "2026-02-06T08:25:00.000Z", value: "99" },
            { timestamp: "2026-02-07T08:30:00.000Z", value: "97" },
            { timestamp: "2026-02-08T08:18:00.000Z", value: "98" },
            { timestamp: "2026-02-09T08:22:00.000Z", value: "98" },
        ]
    },
    {
        lookup_id: "BODY_TEMPERATURE",
        vital_name: "Body Temperature",
        records: [
            { timestamp: "2026-02-03T08:15:00.000Z", value: "98.4" },
            { timestamp: "2026-02-04T08:20:00.000Z", value: "98.6" },
            { timestamp: "2026-02-05T08:10:00.000Z", value: "98.5" },
            { timestamp: "2026-02-06T08:25:00.000Z", value: "98.6" },
            { timestamp: "2026-02-07T08:30:00.000Z", value: "98.4" },
            { timestamp: "2026-02-08T08:18:00.000Z", value: "98.5" },
            { timestamp: "2026-02-09T08:22:00.000Z", value: "98.6" },
        ]
    },
    {
        lookup_id: "BLOOD_SUGAR",
        vital_name: "Blood Sugar",
        records: [
            { timestamp: "2026-02-03T08:15:00.000Z", value: "95" },
            { timestamp: "2026-02-04T08:20:00.000Z", value: "102" },
            { timestamp: "2026-02-05T08:10:00.000Z", value: "98" },
            { timestamp: "2026-02-06T08:25:00.000Z", value: "105" },
            { timestamp: "2026-02-07T08:30:00.000Z", value: "99" },
            { timestamp: "2026-02-08T08:18:00.000Z", value: "100" },
            { timestamp: "2026-02-09T08:22:00.000Z", value: "103" },
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

// Best OpenAI models for medical / health (accuracy & reasoning focus)
const medicalHealthModels = [
    'gpt-5.2-pro',      // Most capable, precise
    'gpt-5.2',          // Best for complex/agentic tasks
    'gpt-5.1',          // Strong reasoning, configurable
    'o3-deep-research', // Deep research (e.g. literature)
    'o3-pro',           // High-compute reasoning
    'o3',               // Strong reasoning for complex tasks
    'gpt-4.1',          // Smartest non-reasoning, good balance
    'gpt-4o',           // Fast, intelligent, flexible
];

const test = async () => {
    for (const model of medicalHealthModels) {
        const response = await client.chat.completions.create({
            model: model,
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

        // Save to Excel sheet
        saveToExcel(result, payload.patient, conditions, model, payload);
    }

    return result;
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
