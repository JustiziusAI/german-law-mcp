import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ZodError } from "zod";
import { AppError } from "../errors";
import { LegislationService } from "../neuris/service";
import { TOOL_CATALOG } from "../tools/catalog";
import type { Env } from "../types";

function toolText(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function createServer(env: Env) {
  const server = new McpServer({ name: "German Law MCP", version: "0.1.0" }, { capabilities: { tools: {} } });
  const service = new LegislationService(env);

  for (const definition of TOOL_CATALOG) {
    server.tool(definition.name, definition.description, definition.inputSchema, async (args) => {
      try {
        const data = await definition.execute(service, args as Record<string, unknown>);
        return { content: [{ type: "text" as const, text: toolText(data) }], structuredContent: data as Record<string, unknown> };
      } catch (error) {
        const message = error instanceof AppError ? error.message : error instanceof ZodError ? error.message : "Unexpected server error.";
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true };
      }
    });
  }
  return server;
}

export async function handleMcp(request: Request, env: Env): Promise<Response> {
  const server = createServer(env);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}
