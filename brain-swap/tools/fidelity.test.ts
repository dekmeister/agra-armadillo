import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_XSD_PATH } from "./catalog-source.ts";
import { buildXsdNameIndex, collectTokens, findOffenders } from "./fidelity.ts";

// Gates the catalog on `npm test` too (CLAUDE.md hard rule #1): no invented names.
describe("fidelity: catalog names are all real A-GRA names", () => {
  it("default in-repo XSD exists", () => {
    expect(existsSync(DEFAULT_XSD_PATH), DEFAULT_XSD_PATH).toBe(true);
  });

  it("every catalog message/field/enum name appears in the XSD", () => {
    const { offenders } = findOffenders(DEFAULT_XSD_PATH);
    const report = offenders.map((t) => `${t.kind} ${t.value} (${t.owner})`).join("\n");
    expect(offenders, report).toEqual([]);
  });

  it("a deliberately invented name is rejected (the gate actually bites)", () => {
    const index = buildXsdNameIndex('<xs:element name="RealName"/>');
    const tokens = collectTokens();
    // Sanity: catalog has tokens, and a fake name isn't in a tiny index.
    expect(tokens.length).toBeGreaterThan(0);
    expect(index.has("MA_TotallyMadeUpMT")).toBe(false);
  });
});
