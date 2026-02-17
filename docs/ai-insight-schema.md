# AI Insight Output Schema

Schema for the AI health insight output and how to store it.

## Schema file

- **`ai-insight-output.schema.json`** — JSON Schema (draft 2020-12) for the full AI insight payload.

## Document shape (for storage)

When persisting to a database, use a document like:

```json
{
  "id": "uuid-or-objectid",
  "patientId": "patient-reference",
  "generatedAt": "2026-02-16T12:00:00.000Z",
  "model": "gpt-4o-mini",
  "data": {
    "overallSummary": "...",
    "healthAlerts": [{ "level": "HIGH", "message": "..." }],
    "vitalsSummary": ["..."],
    "dailyPatterns": ["..."],
    "smartAdvices": ["..."],
    "careTeamNotes": ["..."],
    "nextSteps": ["..."]
  },
  "tokenUsage": {
    "prompt_tokens": 2611,
    "completion_tokens": 344,
    "total_tokens": 2955
  }
}
```

- **Required for storage:** `data` (and within it, `overallSummary`).
- **Recommended:** `id`, `patientId`, `generatedAt`, `model` for querying and auditing.
- **Optional:** `tokenUsage` for cost/analytics; `error` when storing a failed run instead of `data`.

## MongoDB collection

Collection **`ai_insights`** is defined by the Mongoose model:

- **Model:** `models/AiInsight.js`

### Collection schema (BSON)

| Field         | Type     | Required | Index | Notes                          |
| ------------- | -------- | -------- | ----- | ------------------------------ |
| `_id`         | ObjectId | auto     | ✓     | Default MongoDB id.            |
| `patientId`   | ObjectId | yes      | ✓     | Reference to patient.          |
| `generatedAt` | Date     | no       | ✓     | Defaults to now.               |
| `model`       | String   | no       | ✓     | e.g. `gpt-4o-mini`.            |
| `data`        | Object   | yes      | —     | See `insightDataSchema` below. |
| `tokenUsage`  | Object   | no       | —     | OpenAI usage.                  |
| `error`       | String   | no       | —     | Set when generation failed.    |
| `createdAt`   | Date     | auto     | —     | From `timestamps: true`.       |
| `updatedAt`   | Date     | auto     | —     | From `timestamps: true`.       |

**`data` sub-document:**

| Field                    | Type                     | Required |
| ------------------------ | ------------------------ | -------- |
| `overallSummary`         | String                   | yes      |
| `healthAlerts`           | Array                    | no       |
| `healthAlerts[].level`   | String (LOW/MEDIUM/HIGH) | yes      |
| `healthAlerts[].message` | String                   | yes      |
| `vitalsSummary`          | [String]                 | no       |
| `dailyPatterns`          | [String]                 | no       |
| `smartAdvices`           | [String]                 | no       |
| `careTeamNotes`          | [String]                 | no       |
| `nextSteps`              | [String]                 | no       |

**Indexes:** `patientId`, `generatedAt`, `model`; compound `{ patientId: 1, generatedAt: -1 }` for "latest insight per patient".

### Usage

```bash
npm install mongoose
```

```javascript
const mongoose = require("mongoose");
const AiInsight = require("./models/AiInsight");

await mongoose.connect(process.env.MONGODB_URI);

const doc = await AiInsight.create({
  patientId: new mongoose.Types.ObjectId("..."),
  model: "gpt-4o-mini",
  data: result.data,
  tokenUsage: result.tokenUsage,
});
// generatedAt, createdAt, updatedAt set automatically
```

If your app uses string IDs for patients, change `patientId` in `models/AiInsight.js` to `type: String`.

## Where to store

| Storage          | Suggested approach                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| **MongoDB**      | Use collection `ai_insights` and model `models/AiInsight.js` (see above).                              |
| **PostgreSQL**   | One table with a `JSONB` column for the full payload, or normalised columns for `data.*` and metadata. |
| **File / S3**    | One JSON file per run, e.g. `insights/{patientId}/{generatedAt}.json`.                                 |
| **API response** | Return the same shape; validate with this schema before saving or sending.                             |

## Validation

To validate a payload at runtime (e.g. before saving):

```bash
npm install ajv
```

```javascript
const Ajv = require("ajv");
const schema = require("./schemas/ai-insight-output.schema.json");
const ajv = new Ajv();
const validate = ajv.compile(schema);
const valid = validate(yourOutput);
if (!valid) console.error(validate.errors);
```
