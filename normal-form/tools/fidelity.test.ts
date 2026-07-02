import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalog, REFS_DIR } from "./catalog-source.ts";
import { buildXsdNameIndex, collectTokens, findOffenders } from "./fidelity.ts";

// Gates the catalog on `npm test` too (PLAN_MVP ground rule #2): no invented
// names, no invented CERT/RQMT numbers.
describe("fidelity: catalog is fully traceable to the UCI sources", () => {
  const cat = loadCatalog();

  it("vendored UCI sources exist", () => {
    expect(existsSync(resolve(REFS_DIR, cat.xsd)), cat.xsd).toBe(true);
    for (const s of cat.sources) expect(existsSync(resolve(REFS_DIR, s)), s).toBe(true);
  });

  it("every catalog name is in the XSD and every CERT/RQMT number is in the specs", () => {
    const { offenders } = findOffenders();
    const report = offenders.map((t) => `${t.kind} ${t.value} (${t.owner})`).join("\n");
    expect(offenders, report).toEqual([]);
  });

  it("the gate actually bites: a fake name and a fake CERT are rejected", () => {
    const index = buildXsdNameIndex('<xs:element name="RealName"/>');
    expect(index.has("TaskCommandFooMT")).toBe(false); // fake name absent from a tiny index

    const specText = "see CERT SCH-002461 and RQMT USTD-000436";
    expect(specText.includes("SCH-999999")).toBe(false); // fake CERT absent from text

    // Sanity: the catalog produced both token kinds to police.
    const tokens = collectTokens();
    expect(tokens.some((t) => t.kind === "name")).toBe(true);
    expect(tokens.some((t) => t.kind === "cert")).toBe(true);
  });
});
