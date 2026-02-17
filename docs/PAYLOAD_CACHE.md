# Payload cache (local)

When the same payload is sent, the app **does not call the OpenAI API again**. It reuses the stored response from a local file cache.

## How it works

1. **Hash** – Before calling OpenAI, a SHA-256 hash is computed from the payload (conditions, vitals, activities, patient lookup id). Same input → same hash.
2. **Lookup** – The app checks the `cache/` directory for a file named `<hash>.json`.
3. **Cache hit** – If the file exists, the stored result is loaded and returned. No API call. A PDF report is still generated from the cached data.
4. **Cache miss** – If the file does not exist, the app calls OpenAI, then saves the result as `cache/<hash>.json` for future runs.

## What is included in the hash

The hash is based on a JSON string of:

- `conditions`
- `vitals`
- `activities`
- `patientLookupId` (`payload.patient.lookup_id` or `payload.patient.lookupId`)

Changing any of these (or their order in a way that changes the string) produces a different hash and triggers a new generation.

## Cache location and format

- **Directory:** `cache/` (project root). Created automatically on first write.
- **Files:** One file per payload: `<sha256-hex>.json`
- **Content:** Same shape as the API result, e.g.:
  ```json
  {
    "data": {
      "overallSummary": "...",
      "healthAlerts": [...],
      "vitalsSummary": [...],
      "dailyPatterns": [...],
      "smartAdvices": [...],
      "careTeamNotes": [...],
      "nextSteps": [...]
    },
    "tokenUsage": { "prompt_tokens": ..., "completion_tokens": ..., "total_tokens": ... }
  }
  ```

## Behavior summary

| Scenario              | OpenAI called? | Excel updated? | PDF generated? |
|-----------------------|----------------|----------------|-----------------|
| First run (new hash)  | Yes            | Yes            | Yes             |
| Same payload (cache hit) | No          | No             | Yes (from cache)|

On cache hit, `output.json` is still written by the top-level `.then()` in `index.js`; only the Excel append is skipped to avoid duplicate rows.

## Clearing the cache

To force a new AI response for all payloads, delete the cache directory or its contents:

```bash
rm -rf cache/
```

Or delete a single cached response by removing the corresponding `cache/<hash>.json` file.

## Implementation details (index.js)

- **`getPayloadHash(payload)`** – Builds deterministic JSON from payload fields and returns SHA-256 hex.
- **`readCache(hash)`** – Reads `cache/<hash>.json`; returns parsed object or `null`.
- **`writeCache(hash, result)`** – Creates `cache/` if needed and writes `result` as JSON.

The `cache/` directory is listed in `.gitignore` and is not committed to the repository.
