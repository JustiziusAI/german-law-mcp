import { z, type ZodRawShape } from "zod";
import type { LegislationService } from "../neuris/service";

const asOf = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").optional();
const limit = z.number().int().min(1).max(20).optional();

type Execute = (service: LegislationService, args: Record<string, unknown>) => Promise<unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  inputSpec: Record<string, unknown>;
  execute: Execute;
}

export const TOOL_CATALOG: ToolDefinition[] = [
  {
    name: "find_laws",
    description: "Find German federal laws by official title, short title or abbreviation. Returns compact official metadata, validity and source links.",
    inputSchema: { query: z.string().min(2).describe("Law title or abbreviation, for example BGB, FinVermV or Gewerbeordnung."), as_of: asOf, limit },
    inputSpec: {
      required: ["query"],
      properties: {
        query: { type: "string", example: "FinVermV" },
        as_of: { type: "string", format: "date", description: "Version date. Defaults to today." },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
      },
    },
    execute: (service, args) => service.findLaws(args.query as string, args.as_of as string | undefined, args.limit as number | undefined),
  },
  {
    name: "get_law",
    description: "Get compact official metadata for one law: title, abbreviation, force, validity period, publication and source URL.",
    inputSchema: { law: z.string().min(2).describe("Law title or abbreviation, for example FinVermV."), as_of: asOf },
    inputSpec: { required: ["law"], properties: { law: { type: "string", example: "FinVermV" }, as_of: { type: "string", format: "date", description: "Version date. Defaults to today." } } },
    execute: (service, args) => service.getLaw(args.law as string, args.as_of as string | undefined),
  },
  {
    name: "search_legislation_text",
    description: "Search statutory text by keyword. Optionally restrict to one identified law. Returns matching norms, concise snippets, validity and official sources.",
    inputSchema: { query: z.string().min(2).describe("Keywords to find in statutory text."), law: z.string().min(2).optional().describe("Optional law title or abbreviation."), as_of: asOf, limit },
    inputSpec: {
      required: ["query"],
      properties: {
        query: { type: "string", example: "Offenlegung Zuwendungen" },
        law: { type: "string", example: "FinVermV" },
        as_of: { type: "string", format: "date", description: "Version date. Defaults to today." },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
      },
    },
    execute: (service, args) => service.searchText(args.query as string, args.law as string | undefined, args.as_of as string | undefined, args.limit as number | undefined),
  },
  {
    name: "list_norms",
    description: "List directly addressable norms in a law, including section or article label, title and whether each norm is currently valid.",
    inputSchema: { law: z.string().min(2).describe("Law title or abbreviation."), as_of: asOf },
    inputSpec: { required: ["law"], properties: { law: { type: "string", example: "FinVermV" }, as_of: { type: "string", format: "date", description: "Version date. Defaults to today." } } },
    execute: (service, args) => service.listNorms(args.law as string, args.as_of as string | undefined),
  },
  {
    name: "list_law_structure",
    description: "List the full human-readable structure of a law: books, parts, sections, chapters, norms and annexes with their validity metadata.",
    inputSchema: { law: z.string().min(2).describe("Law title or abbreviation."), as_of: asOf },
    inputSpec: { required: ["law"], properties: { law: { type: "string", example: "FinVermV" }, as_of: { type: "string", format: "date", description: "Version date. Defaults to today." } } },
    execute: (service, args) => service.listLawStructure(args.law as string, args.as_of as string | undefined),
  },
  {
    name: "get_norm",
    description: "Retrieve the official text of one norm using human references only, for example law=FinVermV and norm=17. Never requires an internal NeuRIS ID.",
    inputSchema: { law: z.string().min(2).describe("Law title or abbreviation."), norm: z.string().min(1).describe("Norm label, for example 17, 34f, Art. 6 or Anlage 1."), as_of: asOf },
    inputSpec: {
      required: ["law", "norm"],
      properties: {
        law: { type: "string", example: "FinVermV" },
        norm: { type: "string", example: "17" },
        as_of: { type: "string", format: "date", description: "Version date. Defaults to today." },
      },
    },
    execute: (service, args) => service.getNorm(args.law as string, args.norm as string, args.as_of as string | undefined),
  },
  {
    name: "get_law_versions",
    description: "List available official law versions, including validity dates, force, publication dates and source links. Use this before comparing historical versions.",
    inputSchema: { law: z.string().min(2).describe("Law title or abbreviation."), limit },
    inputSpec: { required: ["law"], properties: { law: { type: "string", example: "FinVermV" }, limit: { type: "integer", minimum: 1, maximum: 20, default: 20 } } },
    execute: (service, args) => service.getLawVersions(args.law as string, args.limit as number | undefined),
  },
];

export const TOOL_CATALOG_BY_NAME = new Map(TOOL_CATALOG.map((tool) => [tool.name, tool]));

export function toolSpec() {
  return {
    name: "German Law MCP",
    version: "0.1.0",
    transport: "Streamable HTTP",
    endpoint: "/mcp",
    source_of_truth: "NeuRIS preview API",
    tools: TOOL_CATALOG.map(({ name, description, inputSpec }) => ({ name, description, input_schema: { type: "object", additionalProperties: false, ...inputSpec } })),
  };
}
