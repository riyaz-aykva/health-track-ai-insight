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
const XLSX = require("xlsx");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Validate API key before creating client
if (!OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY is not set.");
    console.error("");
    if (dotenvLoaded) {
        console.error("The .env file was loaded but OPENAI_API_KEY was not found in it.");
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
    "conditionId": "68e36fbc9950693f31349cc7",
    "conditionName": "Asthma Attack",
    "patientId": "6800f3c45de85f0d82851f5a",
    "isCured": false,
    "symptoms": [
        {
            "id": "38f82812-56ad-48c6-95a4-1acbef16cc6a",
            "title": "Increased coughing",
            "score": 5,
            "baseline": 0
        },
        {
            "id": "fc4fb222-b562-416a-8021-3743f534d40c",
            "title": "Difficulty breathing",
            "score": 5,
            "baseline": 0
        },
        {
            "id": "ad794088-9a79-4882-b733-88b68ff0d05c",
            "title": "Inability to talk",
            "score": 6,
            "baseline": 0
        },
        {
            "id": "76250cae-df4e-4f21-9413-ff8053da6aba",
            "title": "Inability to eat",
            "score": 7,
            "baseline": 0
        },
        {
            "id": "d8841bbc-35e1-4ee5-a951-72b701f7befe",
            "title": "Inability to sleep",
            "score": 8,
            "baseline": 0
        },
        {
            "id": "3e147111-5bc1-4910-9f47-2e9eb00e9aa8",
            "title": "Inability to perform usual tasks",
            "score": 9,
            "baseline": 0
        },
        {
            "id": "c57ba701-4a82-46fc-871c-007cde1258ed",
            "title": "Faster breathing",
            "score": 10,
            "baseline": 0
        },
        {
            "id": "cd15ab42-5e9e-470b-8dd8-9072b520eff0",
            "title": "Gasping for air",
            "score": 2,
            "baseline": 0
        },
        {
            "id": "3cb68a89-c2cd-4e5b-bfa4-43c992d15b53",
            "title": "Noisy exhalation",
            "score": 3,
            "baseline": 0
        },
        {
            "id": "55242aaf-1d16-495e-90f2-ea770279f071",
            "title": "Low peak flow",
            "score": 4,
            "baseline": 4
        },
        {
            "id": "9e2d9cb4-c5ce-4833-9e50-5e69b0ecaf0b",
            "title": "Attack build-up over hours/days",
            "score": 5,
            "baseline": 0
        }
    ],
    "status": "active",
    "createdAt": "2025-10-06T07:29:00.949Z"
}

const payload = {
    conditions,
    patient: {
        name: 'John Doe',
        gender: 'Male',
        age: new Date().getFullYear() - new Date('1990-01-01').getFullYear()
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
            "_id": {
                "$oid": "66e2761ae288f29d07a1d094"
            },
            "attendees": [],
            "facility_id": {
                "$oid": "66b4cce3b672e092b873cace"
            },
            "name": "Breakfast",
            "from_date": {
                "$date": "2024-09-13T00:00:00.000Z"
            },
            "from_time": "10:00",
            "to_time": "10:30",
            "description": "The attitude of gratitude is the highest Lunch.",
            "location": "Canteen",
            "createdAt": {
                "$date": "2024-09-12T05:03:22.594Z"
            },
            "updatedAt": {
                "$date": "2024-09-12T05:03:22.604Z"
            },
            "__v": 0,
            "image": "8187733396.png"
        }
    ]
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

// Function to save record to Excel sheet
const saveToExcel = (result, patientData, conditionData) => {
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

const test = async () => {
    const response = await client.chat.completions.create({
        model: OPENAI_MODEL || "gpt-4o-mini",
        messages: [
            {
                role: "user",
                content: prompt
            }
        ],
        response_format: { type: "json_object" }
    });

    const jsonResponse = JSON.parse(response.choices[0].message.content);

    const result = {
        data: jsonResponse,
        tokenUsage: response.usage
    };

    // Save to Excel sheet
    saveToExcel(result, payload.patient, conditions);

    return result;
}

test().then(result => {
    console.log(result)
    fs.writeFileSync('output.json', JSON.stringify(result, null, 2))
})
    .catch(error => {
        console.error(error)
        fs.writeFileSync('error.json', JSON.stringify(error, null, 2))
    })