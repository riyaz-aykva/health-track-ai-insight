# Health Track AI Insight

AI-powered health overview from patient conditions, vitals, and activities. Uses OpenAI to generate structured insights (summary, alerts, vitals summary, daily patterns, smart advice, care team notes, next steps) and optionally saves results to Excel.

## Features

- **Conditions**: Supports both **disease** (single) and **symptom** (multiple) types with severity records over time
- **Vitals**: Blood pressure, heart rate, SpO2, body temperature, blood sugar with timestamped values
- **Activities**: Daily activities (meals, walks, exercise) with timestamps
- **AI output**: Overall summary, health alerts (LOW/MEDIUM/HIGH), vitals summary, daily patterns, smart advice, care team notes, next steps
- **Export**: Results written to `output.json` and appended to `health_records.xlsx` (Excel)
- **Payload cache**: Same payload does not trigger a new API call; response is reused from local `cache/` (see [payload-cache.md](payload-cache.md))

## Prerequisites

- **Node.js** (v14+)
- **OpenAI API key** (for GPT models)

## Setup

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:

   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   OPENAI_MODEL=gpt-4o-mini
   ```

   - `OPENAI_API_KEY` is required.
   - `OPENAI_MODEL` is optional; defaults to `gpt-4o-mini` if not set.

## Usage

### Run health analysis

Edit `index.js` to set your **conditions**, **vitals**, **activities**, and **patient** in the `payload` object, then run:

```bash
node index.js
```

- Prints the AI result to the console
- Writes the full result to `output.json`
- Appends one row per condition to `health_records.xlsx` (creates the file if it doesn't exist)
- On error, writes to `error.json`

### List available OpenAI models

```bash
node list-models.js
```

Use this to see which models your API key can use; then set `OPENAI_MODEL` in `.env` or change the model in `index.js` (e.g. `medicalHealthModels` / `test`).

## Data structures

### Conditions

- **Disease** (single): `type: "disease"`, `disease_title`, `condition_id`, `symptoms` array with `title` and `records` (severity, recorded_at).
- **Symptom** (multiple): `type: "symptom"`, `symptom_title`, `condition_id`, `symptoms` with `records` (severity, recorded_at). Symptom title can be inherited from the condition if not on each item.

Use `conditionsForDisease` or `conditionsForSymptom` in `index.js` as reference; pass the chosen list through `normalizeConditionsInput()` into the payload.

### Vitals

Array of objects: `lookup_id`, `vital_name`, `records` with `recorded_at` and `value` (number, string, or object e.g. `{ systolic, diastolic }` for blood pressure).

### Patient

```js
patient: { name: string, gender: string, age: number }
```

### Activities

Array of objects with at least `activity_name` and `createdAt` (e.g. `{ $date: "ISO date string" }`).

## Output

| Output                | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `output.json`         | Full AI response + token usage                           |
| `health_records.xlsx` | One row per condition with summary, alerts, vitals, etc. |
| `error.json`          | Error payload if the run fails                           |

## Documentation

All documentation lives in the **[docs](.)** folder. See **[docs/README.md](README.md)** for the full index. Key documents:

- **[research-findings.md](research-findings.md)** – R&D findings and research (model choice, prompt design, payload shapes, cache, schema, PDF, Excel).

## Project structure

| File / folder    | Purpose                                                       |
| ---------------- | ------------------------------------------------------------- |
| `index.js`       | Main script: builds payload, calls OpenAI, saves JSON + Excel |
| [payload-cache.md](payload-cache.md) | Payload cache: same payload → reuse stored response (local `cache/`) |
| `utils.js`       | `saveToExcel()`, Excel read/write, sheet↔JSON                 |
| `list-models.js` | Lists OpenAI models for your API key                          |
| `package.json`   | Dependencies: dotenv, openai, exceljs                         |
| `.env`           | `OPENAI_API_KEY`, optional `OPENAI_MODEL`                     |

## Dependencies

- **dotenv** – load `.env`
- **openai** – OpenAI API client
- **exceljs** – read/write `health_records.xlsx`

## Disclaimer

This tool does **not** provide medical diagnosis or prescriptions. Output is for informational and tracking purposes only. Always consult a qualified healthcare provider for medical decisions.

## License

ISC · [Repository](https://github.com/riyaz-aykva/health-track-ai-insight)
