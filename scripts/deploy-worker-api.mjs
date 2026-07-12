import { readFile } from "node:fs/promises";

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const scriptName = process.env.WORKER_NAME || "german-law-mcp";

if (!token || !accountId) {
  throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.");
}

const worker = await readFile("dist/worker.mjs");
const metadata = {
  main_module: "worker.mjs",
  compatibility_date: "2026-07-12",
  compatibility_flags: ["nodejs_compat"],
  workers_dev: true,
  bindings: [
    {
      type: "plain_text",
      name: "NEURIS_BASE_URL",
      text: "https://testphase.rechtsinformationen.bund.de",
    },
    ...(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
      ? [
          { type: "plain_text", name: "SUPABASE_URL", text: process.env.SUPABASE_URL },
          { type: "plain_text", name: "SUPABASE_ANON_KEY", text: process.env.SUPABASE_ANON_KEY },
        ]
      : []),
  ],
};

const form = new FormData();
form.set("metadata", JSON.stringify(metadata));
form.set("worker.mjs", new Blob([worker], { type: "application/javascript+module" }), "worker.mjs");

const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`, {
  method: "PUT",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const payload = await response.json();
if (!response.ok || !payload.success) {
  throw new Error(`Cloudflare Workers API upload failed (${response.status}): ${JSON.stringify(payload.errors ?? payload)}`);
}

const subdomainResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, {
  headers: { Authorization: `Bearer ${token}` },
});
const subdomainPayload = await subdomainResponse.json();
const subdomain = subdomainPayload?.result?.subdomain;
console.log(JSON.stringify({ deployed: true, script: scriptName, url: subdomain ? `https://${scriptName}.${subdomain}.workers.dev` : null }));
