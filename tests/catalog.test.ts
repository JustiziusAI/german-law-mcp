import { describe, expect, it } from "vitest";
import { TOOL_CATALOG, toolSpec } from "../src/tools/catalog";

describe("tool catalog", () => {
  it("is a unique, documented runtime contract", () => {
    const names = TOOL_CATALOG.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(["find_laws", "get_law", "search_legislation_text", "list_norms", "list_law_structure", "get_norm", "get_law_versions"]);
    const spec = toolSpec();
    expect(spec.tools.map((tool) => tool.name)).toEqual(names);
    for (const tool of spec.tools) {
      expect(tool.description.length).toBeGreaterThan(30);
      expect(tool.input_schema.type).toBe("object");
    }
  });
});
