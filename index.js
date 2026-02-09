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
                {
                    "severity": 1,
                    "recorded_at": "2026-02-06T11:14:39.036Z",
                },
                {
                    "severity": 6,
                    "recorded_at": "2026-02-06T11:12:05.141Z",
                },
                {
                    "severity": 7,
                    "recorded_at": "2026-02-06T11:05:49.613Z",
                }
            ],
            "baselines": {
                "patient_baseline": null
            }
        },
        {
            "title": "sweating",
            "records": [
                {
                    "severity": 1,
                    "recorded_at": "2026-02-06T11:14:39.036Z",
                },
                {
                    "severity": 6,
                    "recorded_at": "2026-02-06T11:12:05.141Z",
                },
                {
                    "severity": 5,
                    "recorded_at": "2026-02-06T11:05:49.613Z",
                }
            ],
            "baselines": {
                "patient_baseline": null
            }
        }
    ]
}

const payload = {
    conditions,
    patient: {
        name: "John Doe",
        gender: "Male",
        age: new Date().getFullYear() - new Date("1990-01-01").getFullYear(),
    },
    vitals: [
        {
            blood_pressure: "120/80",
            heart_rate: "70",
            oxygen_level: "98",
            body_temp: "98.6",
            blood_sugar: "100",
        },
        {
            blood_pressure: "120/80",
            heart_rate: "70",
            oxygen_level: "98",
            body_temp: "98.6",
            blood_sugar: "100",
        },
        {
            blood_pressure: "120/80",
            heart_rate: "70",
            oxygen_level: "98",
            body_temp: "98.6",
            blood_sugar: "100",
        },
        {
            blood_pressure: "120/80",
            heart_rate: "70",
            oxygen_level: "98",
            body_temp: "98.6",
            blood_sugar: "100",
        },
    ],
    activities: [
        {
            _id: {
                $oid: "66e2761ae288f29d07a1d094",
            },
            attendees: [],
            facility_id: {
                $oid: "66b4cce3b672e092b873cace",
            },
            name: "Breakfast",
            from_date: {
                $date: "2024-09-13T00:00:00.000Z",
            },
            from_time: "10:00",
            to_time: "10:30",
            description: "The attitude of gratitude is the highest Lunch.",
            location: "Canteen",
            createdAt: {
                $date: "2024-09-12T05:03:22.594Z",
            },
            updatedAt: {
                $date: "2024-09-12T05:03:22.604Z",
            },
            __v: 0,
            image: "8187733396.png",
        },
    ],
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

const doctor_prompt = `
As a doctor, analyze the following patient data and generate an AI health overview in valid JSON format with this structure:
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

Instructions (respond as a doctor):
- Provide Health Alerts: Note any urgent or abnormal findings that would require immediate or close follow-up.
- Summarize the vitals: Give concise insights based on provided vital sign trends.
- Elaborate on Daily Patterns: Describe how routine and symptoms seem to interact and affect patient health.
- Offer Smart Advices: Suggest lifestyle, diet, or routine adjustments grounded in medical best practice (no prescriptions).
- Add Care Team Notes: Contribute professional comments as would be given in a care team note.
- List Next Steps: Suggest any recommended actions, monitoring, possible referrals, or further evaluation.

Rules:
- This is NOT a formal diagnosis nor a prescription.
- Write in clear, simple, reassuring language.
- Do not include any medication names or instructions.
- Return ONLY valid JSON per the structure above, with NO extra explanation or commentary.

Here is the patient data:
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

const test = async (role = "user") => {
    const response = await client.chat.completions.create({
        model: OPENAI_MODEL || "gpt-4o-mini",
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
    saveToExcel(result, payload.patient, conditions, OPENAI_MODEL, payload);

    // Generate PDF report (HTML-to-PDF via Puppeteer)
    // await generatePDFReport(result, payload.patient, conditions, payload.vitals);

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
