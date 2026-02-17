# AI Insight R&D – Findings and Research

**Project:** Health Track AI Insight  
**Purpose:** Central record of research, design decisions, and findings from the AI health overview R&D.

---

## 1. Overview

This project explores **AI-generated health overviews** from structured input: patient conditions (disease/symptoms with severity over time), vitals, and activities. The goal is to produce a consistent JSON output (summary, alerts, vitals summary, daily patterns, smart advice, care team notes, next steps) suitable for tracking and reporting—**not** clinical diagnosis.

All findings below come from implementation and testing in this repo.

---

## 2. Model Selection

**Finding:** GPT-4o-mini is the default and recommended model for this use case.

**Reasoning:**

| Factor | Larger models (GPT-4o, GPT-4, GPT-5, etc.) | GPT-4o-mini |
|--------|---------------------------------------------|-------------|
| Latency | Often 1+ minute for typical payloads | Acceptable for interactive use |
| Token usage | Often 2k+ tokens per request | Lower; cost-effective at scale |
| Accuracy | Higher nuance | Sufficient for “overview + tracking” |

We explicitly do **not** provide diagnosis or prescriptions; output is informational. For that scope, GPT-4o-mini offers the best tradeoff of **latency**, **cost**, and **good-enough accuracy**.

**Reference:** [why-gpt4o-mini.md](why-gpt4o-mini.md)  
**Code:** `index.js` — `OPENAI_MODEL`, `medicalHealthModels` (list of models tested).

---

## 3. Prompt Design

**Finding:** A single user message with a strict JSON schema and clear rules yields reliable structured output.

**Approach:**

- **Single turn:** One user message containing:
  - Required JSON shape (overallSummary, healthAlerts, vitalsSummary, dailyPatterns, smartAdvices, careTeamNotes, nextSteps).
  - Short “User Requirements” explaining each section (e.g. Health Alerts = critical/abnormal findings; Smart Advice = lifestyle/diet suggestions).
  - **Rules:** Not a medical diagnosis; simple language; no prescriptions; return **only** valid JSON.
  - **Data:** Full payload as `JSON.stringify(payload)`.

- **API:** `response_format: { type: "json_object" }` to enforce JSON.

**Observation:** Asking for “ONLY valid JSON, no additional text” plus `json_object` reduces parsing errors and stray markdown.

**Code:** `index.js` — `prompt` constant, `client.chat.completions.create(..., response_format: { type: "json_object" })`.

---

## 4. Payload and Data Shapes

### 4.1 Conditions

**Finding:** Two condition types are supported; normalization keeps the API contract simple.

- **Disease (single):** `type: "disease"`, `disease_title`, `condition_id`, `symptoms[]` with `title` and `records` (severity, recorded_at).
- **Symptom (multiple):** `type: "symptom"`, `symptom_title` per condition, `symptoms[]` with `records`; if a symptom item has no `title`, the condition’s `symptom_title` is used.

**Implementation:** `normalizeConditionsInput()` in `index.js` accepts:
- A single condition object,
- An array of conditions,
- Or an API-style object `{ success, data }` and uses `data` as the list.

So the rest of the pipeline always receives a normalized array.

**Code:** `index.js` — `normalizeConditionsInput()`, `conditionsForDisease`, `conditionsForSymptom`.

### 4.2 Vitals

**Finding:** The current payload uses a **record-centric** format: one object per recording time, each with a `vitals` array of measurements (e.g. HEART_RATE, BLOOD_PRESSURE, SPO2).

- Each record has: `record_id`, `recorded_at`, `recorded_by`, `created_at`, `vitals[]`.
- Each vital: `vital_id`, `vital_type`, `value` (number or object e.g. `{ systolic, diastolic }`), `unit`.

The model receives this structure as-is; no flattening to “vital_name + records” is required for good summaries.

**Code:** `index.js` — `vitals` array in payload.

### 4.3 Activities

**Finding:** Activities need at least `activity_name` and a timestamp. The project uses `createdAt` (including MongoDB-style `{ $date: "ISO string" }`). The AI uses these for “daily patterns” and routine impact.

**Code:** `index.js` — `activities` array.

### 4.4 Patient

**Finding:** Minimal context is sufficient: `name`, `gender`, `age`. Optionally `lookup_id` / `lookupId` for cache identity (see below).

**Code:** `index.js` — `payload.patient`.

---

## 5. Payload Cache (Local)

**Finding:** Hashing the payload and reusing a stored response avoids duplicate API calls and cost when input is unchanged.

**Design:**

- **Hash:** SHA-256 of deterministic JSON: `conditions`, `vitals`, `activities`, `patientLookupId` (payload.patient.lookup_id or lookupId). Same input ⇒ same hash.
- **Storage:** `cache/<hash>.json` with full API result shape (`data` + `tokenUsage`).
- **Hit:** Return cached result; no OpenAI call; PDF can still be generated from cache. Excel append is skipped to avoid duplicate rows.
- **Miss:** Call OpenAI, write `cache/<hash>.json`, then proceed as usual.

**Reference:** [payload-cache.md](payload-cache.md)  
**Code:** `index.js` — `getPayloadHash()`, `readCache()`, `writeCache()`, and the `test()` flow.

---

## 6. Output Schema and Storage

**Finding:** A single JSON Schema plus a small set of storage conventions keeps outputs consistent and storable across backends.

- **Schema:** `schemas/ai-insight-output.schema.json` (JSON Schema draft 2020-12). Required: `data.overallSummary`; recommended for storage: `id`, `patientId`, `generatedAt`, `model`; optional: `tokenUsage`, `error` for failures.
- **MongoDB:** Collection `ai_insights` with Mongoose model `models/AiInsight.js`. Supports `lookupId`, `payloadHash` (unique for reuse), `generatedAt`, `model`, `data`, `tokenUsage`, `error`. Unique index on `payloadHash` allows one stored result per payload.
- **Validation:** Use Ajv (or similar) with the JSON Schema to validate before saving or sending.

**Reference:** [ai-insight-schema.md](ai-insight-schema.md)  
**Code:** `schemas/ai-insight-output.schema.json`, `models/AiInsight.js`.

---

## 7. PDF Report Generation

**Finding:** HTML + Puppeteer is a practical way to produce a branded, printable report from the same AI output.

- **Flow:** Build HTML from AI result + payload (patient, primary condition, all sections). Use Puppeteer in headless mode to render and export to PDF (Letter, 0.5 in margins, print background).
- **Content:** Patient demographics, clinical info (primary condition, status, onset, is cured), then AI sections: Condition Assessment, Health Alerts, Vitals Summary, Daily Patterns, Smart Advices, Care Team Notes, Next Steps. Footer states output is AI-generated and not medical advice.
- **Alerts:** Rendered with level-based styling (HIGH/MEDIUM/LOW) and escaped to avoid XSS.
- **Environment:** Launch args include `--no-sandbox`, `--disable-gpu`, etc., for compatibility in constrained environments.

**Code:** `pdfReport.js` — `generateHtmlContent()`, `generateReportPdf()`, `getPrimaryConditionInfo()`.

---

## 8. Excel Export and Logs

**Finding:** Excel is used for (1) appending each run’s insight (one row per condition) and (2) optional usage logs.

- **Health records:** `utils.js` — `saveToExcel()` appends to `health_records.xlsx` with timestamp, payload summary, patient, condition name/ID, all AI sections, model, and token usage. On cache hit, Excel append is skipped.
- **Usage:** `logs.js` uses OpenAI Organization Usage API (admin key) to fetch completion usage and export to `openai_logs.xlsx`. Useful for cost and usage R&D; requires org admin key.

**Code:** `utils.js`, `logs.js`.

---

## 9. Summary Table

| Topic | Main finding | Doc / code |
|-------|----------------|------------|
| Model | GPT-4o-mini for latency, cost, and sufficient accuracy | [why-gpt4o-mini.md](why-gpt4o-mini.md), `index.js` |
| Prompt | Single message + JSON schema + “only JSON” + `json_object` | `index.js` |
| Conditions | Disease (single) vs symptom (multiple); normalized before send | `index.js` |
| Vitals | Record-centric format (one record per time, vitals array) works as-is | `index.js` |
| Cache | SHA-256 payload hash → reuse `cache/<hash>.json`; no API call on hit | [payload-cache.md](payload-cache.md), `index.js` |
| Schema | JSON Schema + MongoDB `ai_insights` model; validate with Ajv | [ai-insight-schema.md](ai-insight-schema.md), `schemas/`, `models/` |
| PDF | HTML template + Puppeteer; branded, disclaimer in footer | `pdfReport.js` |
| Excel | Append insight rows; optional usage export via admin API | `utils.js`, `logs.js` |

---

## 10. Related Documentation

| Document | Description |
|----------|-------------|
| [project-overview.md](project-overview.md) | Setup, usage, data structures, project layout |
| [why-gpt4o-mini.md](why-gpt4o-mini.md) | Model selection rationale |
| [payload-cache.md](payload-cache.md) | Local payload cache behavior |
| [ai-insight-schema.md](ai-insight-schema.md) | Output schema and storage (MongoDB, validation) |

---

## 11. Disclaimer

This R&D and the resulting tool do **not** provide medical diagnosis or prescriptions. Output is for informational and tracking purposes only. Always consult a qualified healthcare provider for medical decisions.
