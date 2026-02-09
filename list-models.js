#!/usr/bin/env node
/**
 * List OpenAI models available for your API key.
 * Run: node list-models.js
 * Requires OPENAI_API_KEY in .env or environment.
 */

require("dotenv").config();
const OpenAI = require("openai");

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error("Error: OPENAI_API_KEY is not set in .env or environment.");
    process.exit(1);
}

const client = new OpenAI({ apiKey });

async function listModels() {
    try {
        const list = await client.models.list();
        const models = [];
        for await (const model of list) {
            models.push({ id: model.id, owned_by: model.owned_by });
        }
        models.sort((a, b) => a.id.localeCompare(b.id));

        console.log("Models available for this API key:\n");
        models.forEach((m) => console.log(`  ${m.id}  (${m.owned_by || "openai"})`));
        console.log(`\nTotal: ${models.length} models`);
    } catch (err) {
        console.error("Failed to list models:", err.message);
        if (err.status) console.error("Status:", err.status);
        process.exit(1);
    }
}

listModels();
