require("dotenv").config();
const OpenAI = require("openai");
const ExcelJS = require("exceljs");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_ADMIN_API_KEY,
});

/**
 * Fetch usage from OpenAI Usage API (organization/usage/completions).
 * Requires an Admin API key: https://platform.openai.com/settings/organization/admin-keys
 */
async function fetchUsageData(daysAgo = 30) {
    const startTime = Math.floor(Date.now() / 1000) - daysAgo * 24 * 60 * 60;
    const allRows = [];
    let pageCursor = null;

    do {
        const query = {
            start_time: startTime,
            bucket_width: "1d",
            limit: 31,
            ...(pageCursor && { page: pageCursor }),
        };
        const body = await openai.get("organization/usage/completions", { query });
        const list = Array.isArray(body) ? body : body?.data ?? [];
        const nextPage = typeof body?.next_page === "string" ? body.next_page : null;

        for (const bucket of list) {
            const results = bucket?.results ?? [];
            const bucketDate = bucket?.start_time
                ? new Date(bucket.start_time * 1000).toLocaleString()
                : "";
            for (const r of results) {
                const inputTokens = r?.input_tokens ?? 0;
                const outputTokens = r?.output_tokens ?? 0;
                allRows.push({
                    date: bucketDate,
                    model: r?.model ?? "(aggregated)",
                    prompt_tokens: inputTokens,
                    completion_tokens: outputTokens,
                    total_tokens: inputTokens + outputTokens,
                });
            }
            if (results.length === 0 && (bucket?.start_time != null)) {
                allRows.push({
                    date: bucketDate,
                    model: "(no usage)",
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                });
            }
        }

        pageCursor = nextPage || null;
    } while (pageCursor);

    return allRows;
}

async function exportLogsToExcel() {
    try {
        const rows = await fetchUsageData(30);
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("OpenAI Logs");

        worksheet.columns = [
            { header: "Date", key: "date", width: 20 },
            { header: "Model", key: "model", width: 25 },
            { header: "Prompt Tokens", key: "prompt_tokens", width: 15 },
            { header: "Completion Tokens", key: "completion_tokens", width: 18 },
            { header: "Total Tokens", key: "total_tokens", width: 15 },
        ];

        rows.forEach((row) => worksheet.addRow(row));

        await workbook.xlsx.writeFile("openai_logs.xlsx");
        console.log("✅ Excel file created: openai_logs.xlsx");
    } catch (error) {
        const status = error?.status ?? error?.code;
        if (status === 403) {
            console.error(
                "❌ Usage API requires an Organization Admin API key. Create one at: https://platform.openai.com/settings/organization/admin-keys"
            );
        } else if (status === 404) {
            console.error(
                "❌ Usage API returned 404. This endpoint may require an Organization Admin key (not a regular API key). See: https://platform.openai.com/settings/organization/admin-keys"
            );
        } else {
            console.error("❌ Error:", error?.message ?? error);
        }
    }
}

exportLogsToExcel();