# Model Selection: Why We Use GPT-4o-mini

**Project:** Health Track AI Insight  
**Document purpose:** Rationale for using OpenAI's GPT-4o-mini for health overview and insight generation.

---

## Summary

This project uses **GPT-4o-mini** as the default OpenAI model for generating structured health insights (summaries, alerts, vitals summary, daily patterns, smart advice, care team notes, and next steps). This document explains the feasibility tradeoffs and why GPT-4o-mini was chosen after testing several alternatives.

---

## Models Tested

The following models were evaluated for health analysis in this project (see `medicalHealthModels` in `index.js`):

- **gpt-5**
- **gpt-5-pro**
- **gpt-4o-mini**
- **gpt-4-turbo**
- **gpt-4**
- **gpt-3.5-turbo**

GPT-4o-mini was selected as the default based on the criteria below.

---

## 1. Latency and Responsiveness

**Observation:** In our tests, GPT-4o, GPT-4, GPT-4-turbo, GPT-5, and GPT-5-pro often took **one minute or more** to return a response for our typical payload (conditions, vitals, activities, patient context).

**Impact:**

- Long wait times hurt usability when running analysis interactively or in semi–real-time workflows.
- Health-tracking use cases benefit from quick feedback so users can iterate on data or review results without long delays.

**Conclusion:** GPT-4o-mini provides **acceptable latency** for our workload, making it feasible for regular use without requiring background jobs or long polling.

---

## 2. Token Usage and Cost

**Observation:** In our tests, other models (e.g. GPT-4o, GPT-4, GPT-4-turbo, GPT-5, GPT-5-pro) frequently consumed **2,000+ tokens** per request for our health-analysis prompts.

**Impact:**

- Higher token usage increases cost per run.
- When running analyses frequently (e.g. daily or per-patient), cost scales quickly.
- For a tool focused on tracking and insight (not clinical diagnosis), cost-effectiveness is important.

**Conclusion:** GPT-4o-mini's **lower token consumption** keeps per-run and aggregate costs manageable while still delivering useful structured output.

---

## 3. Accuracy vs. Speed and Cost

**Observation:** GPT-4o-mini's response quality is **not perfect** compared to larger models—e.g. nuance in medical-style language or edge cases may be less consistent.

**Tradeoff we accept:**

- We prioritize **feasibility**: fast, affordable runs with **good enough** accuracy for **informational and tracking purposes**.
- This project explicitly **does not** provide medical diagnosis or prescriptions (see project disclaimer). Output is for overview, alerts, patterns, and suggestions—to be reviewed by users and healthcare providers.
- For that use case, GPT-4o-mini's accuracy is **acceptable** when weighed against latency and cost.

**Conclusion:** For "health overview and insight" rather than clinical decision-making, the **accuracy of GPT-4o-mini is sufficient** given the benefits in responsiveness and cost.

---

## Decision Matrix (Summary)

| Criterion       | GPT-4o / larger models | GPT-4o-mini |
| --------------- | ---------------------- | ----------- |
| **Latency**     | Often 1+ minute        | Acceptable  |
| **Token usage** | Often 2k+ per request  | Lower       |
| **Cost**        | Higher                 | Lower       |
| **Accuracy**    | Higher                 | Good enough |

**Chosen model:** GPT-4o-mini, as the best **feasible** option for our latency, token, and accuracy requirements.

---

## Configuration

The model is configurable so you can re-evaluate as APIs and use cases change:

- **Environment:** Set `OPENAI_MODEL` in `.env` (e.g. `OPENAI_MODEL=gpt-4o-mini`).
- **Default:** If unset, the application defaults to `gpt-4o-mini` (see `index.js` and README).

To list models available for your API key:

```bash
node list-models.js
```

---

## References

- Project README: setup, usage, and disclaimer.
- `index.js`: `OPENAI_MODEL` default, `medicalHealthModels` (tested models), and API usage.
- OpenAI model documentation for current capabilities and pricing.
