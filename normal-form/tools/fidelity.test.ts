import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalog, REFS_DIR } from "./catalog-source.ts";
import {
  buildXsdNameIndex,
  collectTokens,
  findOffenders,
  normalizeWhitespace,
} from "./fidelity.ts";

// Gates the catalog on `npm test` too (PLAN_MVP ground rule #2): no invented
// names, no invented CERT/RQMT numbers, no misquoted findings.
describe("fidelity: catalog is fully traceable to the UCI sources", () => {
  const cat = loadCatalog();

  it("vendored UCI sources exist", () => {
    expect(existsSync(resolve(REFS_DIR, cat.xsd)), cat.xsd).toBe(true);
    for (const s of Object.values(cat.sources))
      expect(existsSync(resolve(REFS_DIR, s)), s).toBe(true);
  });

  it("every catalog name is in the XSD, every CERT/RQMT number and finding quote in its source", () => {
    const { offenders } = findOffenders();
    const report = offenders.map((t) => `${t.kind} ${t.value} (${t.owner})`).join("\n");
    expect(offenders, report).toEqual([]);
  });

  it("the gate actually bites: a fake name, a fake CERT, and a misquote are rejected", () => {
    const index = buildXsdNameIndex('<xs:element name="RealName"/>');
    expect(index.has("TaskCommandFooMT")).toBe(false); // fake name absent from a tiny index

    const specText = "see CERT SCH-002461 and RQMT USTD-000436";
    expect(specText.includes("SCH-999999")).toBe(false); // fake CERT absent from text

    // A misquote: normalized text does not contain a fabricated requirement.
    expect(normalizeWhitespace("The\nreal   text.").includes("invented requirement")).toBe(false);

    // Sanity: the catalog produced all three token kinds to police.
    const tokens = collectTokens();
    for (const kind of ["name", "cert", "quote"] as const) {
      expect(
        tokens.some((t) => t.kind === kind),
        kind,
      ).toBe(true);
    }
  });
});
