import { describe, expect, it } from "vitest";
import { flattenParts, parseCoverage } from "../src/neuris/normalize";

describe("NeuRIS normalization", () => {
  it("normalizes open-ended validity and preserves human labels", () => {
    expect(parseCoverage("1001-01-01/..")).toEqual({ valid_from: null, valid_to: null });
    const parts = flattenParts([{ name: "Abschnitt 1", hasPart: [{ eId: "art-z17", name: "§ 17", headline: "Zuwendungen", temporalCoverage: "2025-01-01/.." }] }]);
    expect(parts[1]).toMatchObject({ name: "§ 17", eId: "art-z17", isNorm: true, path: ["Abschnitt 1"] });
  });
});
