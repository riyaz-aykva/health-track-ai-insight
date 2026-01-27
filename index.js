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
    conditionId: "68e36fbc9950693f31349cc7",
    conditionName: "Asthma Attack",
    patientId: "6800f3c45de85f0d82851f5a",
    isCured: false,
    symptoms: [
        {
            id: "38f82812-56ad-48c6-95a4-1acbef16cc6a",
            title: "Increased coughing",
            score: 5,
            baseline: 0,
        },
        {
            id: "fc4fb222-b562-416a-8021-3743f534d40c",
            title: "Difficulty breathing",
            score: 5,
            baseline: 0,
        },
        {
            id: "ad794088-9a79-4882-b733-88b68ff0d05c",
            title: "Inability to talk",
            score: 6,
            baseline: 0,
        },
        {
            id: "76250cae-df4e-4f21-9413-ff8053da6aba",
            title: "Inability to eat",
            score: 7,
            baseline: 0,
        },
        {
            id: "d8841bbc-35e1-4ee5-a951-72b701f7befe",
            title: "Inability to sleep",
            score: 8,
            baseline: 0,
        },
        {
            id: "3e147111-5bc1-4910-9f47-2e9eb00e9aa8",
            title: "Inability to perform usual tasks",
            score: 9,
            baseline: 0,
        },
        {
            id: "c57ba701-4a82-46fc-871c-007cde1258ed",
            title: "Faster breathing",
            score: 10,
            baseline: 0,
        },
        {
            id: "cd15ab42-5e9e-470b-8dd8-9072b520eff0",
            title: "Gasping for air",
            score: 2,
            baseline: 0,
        },
        {
            id: "3cb68a89-c2cd-4e5b-bfa4-43c992d15b53",
            title: "Noisy exhalation",
            score: 3,
            baseline: 0,
        },
        {
            id: "55242aaf-1d16-495e-90f2-ea770279f071",
            title: "Low peak flow",
            score: 4,
            baseline: 4,
        },
        {
            id: "9e2d9cb4-c5ce-4833-9e50-5e69b0ecaf0b",
            title: "Attack build-up over hours/days",
            score: 5,
            baseline: 0,
        },
    ],
    status: "active",
    createdAt: "2025-10-06T07:29:00.949Z",
};

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

const test = async (role = "user") => {
    const response = await client.chat.completions.create({
        model: OPENAI_MODEL || "gpt-4o-mini",
        messages: [
            {
                role: "user",
                content: role === "user" ? prompt : doctor_prompt,
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
    saveToExcel(result, payload.patient, conditions);

    // Generate PDF report
    generatePDFReport(result, payload.patient, conditions, payload.vitals);

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
