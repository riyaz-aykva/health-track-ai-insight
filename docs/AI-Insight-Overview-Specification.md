# AI Insight – AI Overview

**Document type:** Requirements & specification  
**Purpose:** Define functional requirements, data sources, UI/UX expectations, API design, and open questions for the AI Overview feature.

---

## 1. Purpose

The **AI Overview** section provides patients with a quick, easy-to-understand summary of their overall health using AI-generated insights. It helps patients:

- Track trends
- Identify potential risks
- Understand next steps

It clearly states that this is **not a medical diagnosis**.

---

## 2. Scope

This document defines:

- Functional requirements for the AI Overview
- Data sources (MongoDB models)
- UI/UX expectations
- AI disclaimer and limitations
- Open doubts and proposed clarifications
- Who is generating AI insight

---

## 3. User Stories & Functional Requirements

### AI Overview – User Stories

| #   | User story                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | As a **Patient**, I want to view an AI Overview section on my home page, so that I can get a quick, summarized insight into my overall health condition.                                                                                              |
| 2   | As a **Patient**, I want to see an AI disclaimer message that the information is AI-generated and not a medical diagnosis, so that I am aware that I should still consult a doctor for confirmation.                                                  |
| 3   | As a **Patient**, I want to see an automatically generated **Overall Summary** describing my health trends, so that I can understand potential risks and recommendations in simple language.                                                          |
| 4   | As a **Patient**, I want to see an **Overview Progress Graph** showing the trends of my tracked symptoms or vitals, so that I can visually interpret how my condition is changing over time.                                                          |
| 5   | As a **Patient**, I want each symptom or vital to be represented with a unique colour in the graph and labelled clearly, so that I can easily differentiate between multiple metrics.                                                                 |
| 6   | As a **Patient**, I want to see data points on the graph labelled with corresponding dates, so that I can track my health changes day by day.                                                                                                         |
| 7   | As a **Patient**, I want to view key insight categories such as **Health Alerts**, **Vitals Summary**, **Daily Patterns**, **Smart Advice**, **Care Team Notes**, and **Next Steps**, so that I can explore different aspects of my AI report easily. |
| 8   | As a **Patient**, I want to access the **Health Alerts** section, so that I can know if there are any critical or abnormal findings that need urgent attention.                                                                                       |
| 9   | As a **Patient**, I want to open the **Vitals Summary** section, so that I can view consolidated AI insights related to my vital signs.                                                                                                               |
| 10  | As a **Patient**, I want to open the **Daily Patterns** section, so that I can understand how my routine impacts my vitals and symptoms.                                                                                                              |
| 11  | As a **Patient**, I want to open the **Smart Advice** section, so that I can receive AI-based lifestyle or diet suggestions.                                                                                                                          |
| 12  | As a **Patient**, I want to access **Care Team Notes**, so that I can view doctor or caregiver comments related to my AI report.                                                                                                                      |
| 13  | As a **Patient**, I want to view the **Next Steps** section, so that I can follow recommended actions or schedule consultations.                                                                                                                      |
| 14  | As a **Patient**, I want an option to **download** the AI Overview report as a PDF, so that I can save or share it for further consultation.                                                                                                          |
| 15  | As a **Patient**, I want a **share** option next to the download button, so that I can quickly share my AI report through supported apps.                                                                                                             |
| 16  | As a **Patient**, I want the AI Overview to **auto-refresh** with my latest health data, so that I always see the most up-to-date analysis.                                                                                                           |

---

## 4. Data Sources (MongoDB Models)

| Model name               | Purpose                           |
| ------------------------ | --------------------------------- |
| `patientmodels`          | Patient profile & preferences     |
| `patientvitalsmodels`    | Vitals data (BP, sugar, HR, etc.) |
| `facilityactivitymodels` | App activity & care interactions  |
| `patientdiseasesmodels`  | All disease and symptom records   |

---

## 5. AI Data Flow (High Level)

1. Fetch latest vitals & symptoms
2. Aggregate by date range
3. Detect trends & anomalies
4. Generate summaries & insights
5. Store generated AI output (optional cache)
6. Render UI + graphs

---

## 6. Report PDF Structure

| Section            | Content                                 |
| ------------------ | --------------------------------------- |
| 1. Cover page      | Patient name, date range, AI disclaimer |
| 2. Overall summary | AI-generated health overview            |
| 3. Progress graphs | Symptom & vitals trends                 |
| 4. Health alerts   | Highlighted warnings                    |
| 5. Vitals summary  | —                                       |
| 6. Daily patterns  | —                                       |
| 7. Smart advice    | —                                       |
| 8. Care team notes | —                                       |
| 9. Next steps      | —                                       |

---

## 7. Open Doubts & Clarifications

### 7.1 Default date range

**Question:** Default which date?  
**Recommendation:** Default range **last 7 days**.

### 7.2 Categories details

Each category is an **expandable card** with:

- Short AI summary
- Optional detailed view

### 7.3 Report format

- **PDF (A4)**
- Download & share enabled

### 7.4 Why not use JS for AI?

- **JS (frontend)** should be used for: graph rendering (Chart.js / Recharts), auto-refresh, interactivity.
- **AI logic** should stay **server-side** (Node/Nest).

### 7.5 Care team notes

Care Team Notes apply when the AI insight is **generated by a care team member**.

### 7.6 How many symptoms & diseases to show? (Research)

**Recommendation:**

- **Max 5–7** active symptoms in graph
- **Priority-based** (most recent / critical)
- Diseases shown only as **references**, not diagnoses

### 7.7 Report saves in DB?

**Recommendation:**

- **Daily save** in DB.
- If insight already present for that date → **display existing**; otherwise generate and save.

---

## 8. Non-Functional Requirements

| Area               | Requirement                   |
| ------------------ | ----------------------------- |
| **Performance**    | Load < 2 seconds              |
| **Security**       | HIPAA-ready design            |
| **Explainability** | Simple, non-medical language  |
| **Accessibility**  | Colour-blind friendly palette |

---

## 9. Disclaimer (Mandatory)

**AI insights are informational only and must not be treated as medical advice or diagnosis.**

---

## 10. Old App – Condition and Symptom Record API

### 10.1 Get all disease and symptom condition records

**Params:** `recordType = [0, 1]`, `patientId = login_id`

```bash
curl --location 'https://india-dev.mdhealthtrak.com/api/v2/get-patient-disease-symptom?recordType=1&patientId=6800f3c45de85f0d82851f5a' \
  --header 'token: <JWT>' \
  --header 'usertype: patient'
```

### 10.2 Get disease and symptom condition record by ID

**Params:** `recordType = [0, 1]`, `patientId = login_id`, `residentsDiseaseId = record_id`

```bash
curl --location 'https://india-dev.mdhealthtrak.com/api/v2/get-patient-single-ds?recordType=0&patientId=6800f3c45de85f0d82851f5a&residentsDiseaseId=68e36fbc9950693f31349cc7' \
  --header 'token: <JWT>' \
  --header 'usertype: patient'
```

### 10.3 Get disease and symptom condition record graph by ID and date

**Params:** `recordType = [0, 1]`, `patientId = login_id`, `residentsDiseaseId = record_id`, `startDate`, `endDate`

```bash
curl --location 'https://india-dev.mdhealthtrak.com/api/v2/get-graph-averages-datev3?recordType=0&patientId=6800f3c45de85f0d82851f5a&residentsDiseaseId=68e36fbc9950693f31349cc7&startDate=2025-09-03&endDate=2025-09-06' \
  --header 'token: <JWT>' \
  --header 'usertype: patient'
```

---

## 11. API Development – AI Insight

### 11.1 MongoDB schema – AI Insight collection

```json
{
  "_id": "ObjectId",
  "record_id": "String",
  "summary": "String",
  "insights": "Object",
  "generated_date": "Date",
  "pdf_url": "String",
  "created_at": "Date",
  "updated_at": "Date"
}
```

### 11.2 Generate AI Insight API

| Item            | Detail                                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Endpoint**    | `GET /ai/generate/:record_id`                                                                                                                                                                               |
| **Description** | Generates AI insight for a given `record_id`. If insight for the same `record_id` and date already exists, data is returned from the database. Otherwise, a new insight is generated, stored, and returned. |

**Validation**

- `record_id` must be valid
- Check if AI insight already exists for the same date

**Flow**

1. Validate `record_id`
2. Check existing AI insight in DB (by `record_id` + date)
3. If exists → return stored insight
4. If not exists → generate AI insight → save to DB
5. Return AI insight summary

**Response**

```json
{
  "record_id": "string",
  "summary": "AI generated health insight summary",
  "generated_date": "YYYY-MM-DD"
}
```

### 11.3 Generate multiple records (symptom only) – AI Insight API

_To be defined: API for generating AI insight for multiple symptom records (consolidated report)._

### 11.4 Download AI Insight PDF API

| Item            | Detail                                                                   |
| --------------- | ------------------------------------------------------------------------ |
| **Endpoint**    | `GET /ai/pdf-download/:record_id`                                        |
| **Description** | Downloads the AI Insight report as a PDF file for the given `record_id`. |

**Flow**

1. Validate `record_id`
2. Fetch AI insight from DB
3. Generate PDF (if not already generated)
4. Return PDF file

**Response:** `application/pdf` file download

---

## 12. Open Questions

### 12.1 Home page AI insight

**Question:** How much data needs to be analyzed for generating the AI Insight on the Home Page? The required data flow is not currently defined in the Figma design.

### 12.2 Symptom records for AI insight

**Question:** How many symptom records should be sent to the AI Insight module, and what is the expected format for generating the report?

**Current assumption:** One condition corresponds to one record and one AI Insight report, stored using a single `record_id`. However, each symptom is currently saved as an individual record. **Clarity needed** on how to send multiple symptom records for generating a **consolidated** AI Insight report.

---

## 13. Doctor AI Insight (Future)

Planned areas for doctor-facing AI insight:

- **13.1 Appointment trend** (appointments)
- **13.2 Earning** (transactions)
- **13.3 Performance** (feedback)

_Details to be defined._

---

_End of AI Insight – AI Overview Specification_
