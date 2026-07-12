import { Hono } from "hono";
import { AppError } from "./errors";
import { handleMcp } from "./mcp/server";
import { NeurisClient } from "./neuris/client";
import { LegislationService } from "./neuris/service";
import { siteAsset } from "./site";
import { toolSpec } from "./tools/catalog";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

function jsonError(error: unknown) {
  const appError = error instanceof AppError ? error : new AppError("Unexpected server error.");
  return { body: { error: { code: appError.code, message: appError.message } }, status: appError.status as 400 | 401 | 403 | 404 | 409 | 500 | 502 | 503 };
}


app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});

app.get("/health", async (c) => {
  try {
    const statistics = await new NeurisClient(c.env).getJson<Record<string, unknown>>("/v1/statistics");
    return c.json({ status: "ok", service: "german-law-mcp", source: "NeuRIS preview API", statistics });
  } catch (error) {
    const result = jsonError(error);
    return c.json(result.body, result.status);
  }
});

app.get("/api/spec", (c) => c.json(toolSpec()));
app.get("/openapi.json", (c) => c.json({
  openapi: "3.1.0",
  info: { title: "German Law MCP public API", version: "0.1.0", description: "Runtime API documentation. MCP tools are defined at /api/spec." },
  paths: {
    "/mcp": { post: { summary: "Remote MCP endpoint", description: "Streamable HTTP MCP transport." } },
    "/api/spec": { get: { summary: "Runtime MCP tool catalog" } },
    "/health": { get: { summary: "Deployment and upstream health" } },
  },
}));

app.post("/api/laws/find", async (c) => {
  try {
    const body = await c.req.json<{ query?: string; as_of?: string; limit?: number }>();
    if (!body.query) throw new AppError("query is required.", 400, "validation_error");
    return c.json(await new LegislationService(c.env).findLaws(body.query, body.as_of, body.limit));
  } catch (error) {
    const result = jsonError(error);
    return c.json(result.body, result.status);
  }
});

app.get("/api/auth/config", (c) => {
  const enabled = Boolean(c.env.SUPABASE_URL && c.env.SUPABASE_ANON_KEY);
  return c.json(enabled ? { enabled, url: c.env.SUPABASE_URL, anon_key: c.env.SUPABASE_ANON_KEY } : { enabled: false });
});

app.all("/mcp", async (c) => {
  if (c.req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id" } });
  const response = await handleMcp(c.req.raw, c.env);
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, { status: response.status, headers });
});

app.get("*", (c) => siteAsset(c.req.path));

export default app;
