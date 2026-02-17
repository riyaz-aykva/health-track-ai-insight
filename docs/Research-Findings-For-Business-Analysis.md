# Health Track AI Insight — Research Findings

**Project:** Health Track AI Insight
**Version:** 1.0
**Purpose:** Consolidated R&D findings for business analysis, requirements, and stakeholder review.
**Scope:** AI-generated health overview (informational only; not clinical diagnosis).

---

## Executive Summary

This document summarizes research and findings from the **Health Track AI Insight** R&D project. The system uses AI (OpenAI) to produce a structured health overview from patient **conditions**, **vitals**, and **activities**. Outputs include an overall summary, health alerts, vitals summary, daily patterns, smart advice, care team notes, and next steps. Findings cover **model choice**, **input data requirements**, **output structure**, **caching and cost**, and **delivery options** (JSON, Excel, PDF, database). All conclusions are based on implementation and testing in the project.

**Key takeaway for BA:** The solution is **feasible** for production-style use with GPT-4o-mini (fast, cost-effective, sufficient accuracy for tracking/overview). Input and output shapes are defined and can be used for requirements and integration specs.

---

## 1. Project Scope and Purpose

| Item                    | Finding                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **What it does**        | Generates a structured “health overview” from conditions, vitals, and activities.                                            |
| **What it does not do** | Does**not** provide medical diagnosis, prescriptions, or clinical decisions.                                                 |
| **Intended use**        | Informational tracking and reporting; output to be reviewed by users and care teams.                                         |
| **Output sections**     | Overall summary, health alerts (LOW/MEDIUM/HIGH), vitals summary, daily patterns, smart advice, care team notes, next steps. |

---

## 2. AI Model Selection

### 2.1 Decision: GPT-4o-mini

**Finding:** **GPT-4o-mini** is the recommended and default model for this use case.

### 2.2 Models Evaluated

The following models were tested for health analysis:

- gpt-5
- gpt-5-pro
- gpt-4o-mini
- gpt-4-turbo
- gpt-4
- gpt-3.5-turbo

### 2.3 Why GPT-4o-mini

| Criterion       | Larger models (e.g. GPT-4o, GPT-4, GPT-5) | GPT-4o-mini                          |
| --------------- | ----------------------------------------- | ------------------------------------ |
| **Latency**     | Often 1+ minute per request               | Acceptable for interactive use       |
| **Token usage** | Often 2,000+ tokens per request           | Lower usage                          |
| **Cost**        | Higher per run and at scale               | Lower; suitable for frequent runs    |
| **Accuracy**    | Higher nuance                             | Sufficient for “overview + tracking” |

**Conclusion:** For “health overview and insight” (not clinical decision-making), GPT-4o-mini offers the best balance of **speed**, **cost**, and **good-enough accuracy**. The model can be changed via configuration (e.g. `OPENAI_MODEL`) if requirements evolve.

---

## 3. Input Data Requirements

The AI receives a single payload with four main parts. Below is what the business/BA team needs to know.

### 3.1 Conditions

| Aspect            | Finding                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Types**         | **Disease** (single condition per payload) or **Symptom** (multiple conditions allowed).                                                                                             |
| **Disease**       | Needs: condition type, disease title, condition ID, list of symptoms with title and**records** (severity score + date/time).                                                         |
| **Symptom**       | Needs: condition type, symptom title per condition, condition ID, symptoms with**records** (severity + date/time). Missing symptom title can fall back to condition’s symptom title. |
| **Normalization** | The system accepts a single condition, an array of conditions, or an API-style `{ success, data }` object and normalizes to a single list before calling the AI.                     |

**Business implication:** Both “one disease with several symptoms” and “multiple symptom-based conditions” are supported. Severity and timestamps are required for useful trends and patterns.

### 3.2 Vitals

| Aspect         | Finding                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Format**     | **Record-centric:** one object per recording time, each containing a list of measurements (e.g. heart rate, blood pressure, SpO2). |
| **Per record** | Record ID, recorded time, who recorded it, created time, and list of vitals.                                                       |
| **Per vital**  | Vital ID, type (e.g. HEART_RATE, BLOOD_PRESSURE, SPO2), value (number or object e.g. systolic/diastolic), unit.                    |
| **Usage**      | No extra flattening is required; the AI uses this structure for vitals summary and patterns.                                       |

**Business implication:** Vitals are supplied as “one row per recording time, multiple measurements per row.” Typical types include heart rate, blood pressure, SpO2; others (e.g. temperature, blood sugar) can be added in the same shape.

### 3.3 Activities

| Aspect      | Finding                                                                |
| ----------- | ---------------------------------------------------------------------- |
| **Minimum** | Activity name and a timestamp (e.g.`createdAt`).                       |
| **Format**  | Can use ISO date strings or MongoDB-style `{ $date: "ISO string" }`.   |
| **Usage**   | Used for “daily patterns” and how routine affects vitals and symptoms. |

**Business implication:** Any time-stamped activity (meals, walks, exercise, etc.) can be sent; the AI uses them for pattern and advice sections.

### 3.4 Patient

| Aspect       | Finding                                     |
| ------------ | ------------------------------------------- |
| **Required** | Name, gender, age.                          |
| **Optional** | Lookup ID (for cache identity and storage). |

**Business implication:** Minimal demographics are enough for the current prompt; no PII beyond what is needed for reporting and cache/patient linkage.

---

## 4. AI Output Structure

The AI returns a single JSON object with the following sections. This is the **contract** for downstream systems and reports.

| Section            | Description                                                   | Required          |
| ------------------ | ------------------------------------------------------------- | ----------------- |
| **overallSummary** | High-level summary of health status and findings.             | Yes               |
| **healthAlerts**   | List of alerts: level (LOW / MEDIUM / HIGH) and message.      | No (can be empty) |
| **vitalsSummary**  | List of short text insights on vital signs.                   | No                |
| **dailyPatterns**  | How routine (activities, timing) impacts vitals and symptoms. | No                |
| **smartAdvices**   | Lifestyle or diet suggestions.                                | No                |
| **careTeamNotes**  | Notes intended for doctor or caregiver.                       | No                |
| **nextSteps**      | Recommended actions or follow-up (e.g. consultations).        | No                |

**Health alerts:** Levels are LOW, MEDIUM, HIGH. Used in the UI/PDF for severity-based styling (e.g. red / amber / green).

**Business implication:** All downstream consumers (Excel, PDF, APIs, databases) should expect this structure. Only `overallSummary` is guaranteed; other arrays may be empty.

---

## 5. Caching and Cost Control

### 5.1 Payload cache (local)

| Aspect                    | Finding                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mechanism**             | Before calling the API, the system computes a hash (SHA-256) of conditions, vitals, activities, and patient lookup ID. Same input → same hash.                           |
| **Cache hit**             | If a result for that hash already exists in local storage, it is reused.**No OpenAI call.** PDF can still be generated; Excel append is skipped to avoid duplicate rows. |
| **Cache miss**            | If the hash is new, the system calls OpenAI, saves the result (e.g. under `cache/<hash>.json`), then continues as normal.                                                |
| **What changes the hash** | Any change to conditions, vitals, activities, or patient lookup ID (or order that changes the serialized JSON).                                                          |

### 5.2 Behavior summary

| Scenario                 | OpenAI called? | Excel updated? | PDF generated?   |
| ------------------------ | -------------- | -------------- | ---------------- |
| First run (new payload)  | Yes            | Yes            | Yes              |
| Same payload (cache hit) | No             | No             | Yes (from cache) |

**Business implication:** Repeated runs with the same data do not increase API cost or latency. Useful for demos, testing, and re-generating reports without re-analyzing.

---

## 6. Output Delivery and Storage

### 6.1 Immediate outputs

| Output          | Description                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **output.json** | Full AI response (all sections + token usage).                                                                                  |
| **PDF report**  | Branded report: patient demographics, clinical info, all AI sections, disclaimer. Generated from AI result (from API or cache). |
| **error.json**  | Written only when the run fails (e.g. API error).                                                                               |

### 6.2 Storing insights (e.g. for APIs or analytics)

| Storage                   | Recommendation                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MongoDB**               | Use a collection (e.g.`ai_insights`) with fields: patient reference, generated-at time, model, full `data` object, optional token usage and error. Can use a unique payload hash to avoid storing duplicate insights. |
| **PostgreSQL**            | One table with a JSONB column for the full payload, or separate columns for each section and metadata.                                                                                                                |
| **File / object storage** | One JSON file per run (e.g. by patient ID and generation time).                                                                                                                                                       |
| **API**                   | Return the same JSON shape; validate with the same schema before saving or sending.                                                                                                                                   |

**Schema:** A formal JSON Schema exists for the AI output (`ai-insight-output.schema.json`). Validation (e.g. with Ajv) is recommended before persisting or exposing via API.

**Business implication:** The same insight structure can be written to files, Excel, PDF, and any database or API; the document shape is defined and consistent.

---

## 7. PDF Report

| Aspect      | Finding                                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Method**  | HTML template filled with AI result and payload, then converted to PDF (e.g. via headless browser).                                                                          |
| **Content** | Patient demographics, primary condition info (name, status, onset, is cured), then all AI sections (summary, alerts, vitals, patterns, advice, care team notes, next steps). |
| **Alerts**  | Rendered with level-based styling (HIGH / MEDIUM / LOW).                                                                                                                     |
| **Footer**  | Disclaimer that content is AI-generated and not medical advice.                                                                                                              |

**Business implication:** Every run (including cache hits) can produce a shareable, branded PDF for patients or care teams, without a second AI call when data is unchanged.

---

## 8. Limitations and Disclaimer

- The system does **not** provide medical diagnosis or prescriptions.
- Output is for **informational and tracking purposes only**.
- Users and care teams should **always** consult qualified healthcare providers for medical decisions.
- AI accuracy is “good enough” for overview and tracking, not for clinical decision-making.

---

## 9. Quick Reference — Summary of Findings

| Topic        | Main finding                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Model**    | GPT-4o-mini: best balance of latency, cost, and accuracy for overview/tracking.                                  |
| **Input**    | Conditions (disease or symptom), vitals (record-centric), activities (name + time), patient (name, gender, age). |
| **Output**   | overallSummary (required), healthAlerts, vitalsSummary, dailyPatterns, smartAdvices, careTeamNotes, nextSteps.   |
| **Cache**    | Same payload → reuse stored result; no API call; PDF still generated; Excel append skipped.                      |
| **Delivery** | JSON file, Excel append, PDF report; same structure can be stored in DB or returned via API.                     |
| **Schema**   | JSON Schema defined; validate before storage or API response.                                                    |

---

## 10. Document History and References

- **Source:** Health Track AI Insight R&D repository.
- **Related docs (in repo):** project-overview.md, why-gpt4o-mini.md, payload-cache.md, ai-insight-schema.md, research-findings.md.
- **Contact:** For technical or product questions, refer to the project maintainers and the main project documentation.

---

_End of Research Findings for Business Analysis_
