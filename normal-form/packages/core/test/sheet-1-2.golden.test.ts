// Golden test for the WS-C stub sheet 1-2. Every registered sheet ships a
// test-only reference machine whose golden proves it solvable on all its seeds —
// the same solvability contract as 1-1. This also proves the sheet runtime is not
// hardcoded to a single sheet: a second sheet runs through the same pure pipeline.
import { type Machine, runAllSeeds, runSeed } from "@normal-form/core";
import { sheet_1_2 } from "@normal-form/levels";
import { describe, expect, it } from "vitest";
import refMachine from "./reference/ref-1-2.json" with { type: "json" };

const ref = refMachine as Machine;

describe("sheet 1-2 — reference machine", () => {
  it("passes all seeds", () => {
    const { results, allPass } = runAllSeeds(sheet_1_2, ref);
    expect(allPass, JSON.stringify(results.map((r) => [r.seedId, r.pass, r.fault]))).toBe(true);
  });

  it("logs are byte-stable across repeated runs (determinism)", () => {
    for (const seed of sheet_1_2.seeds) {
      const a = JSON.stringify(runSeed(sheet_1_2, ref, seed).log);
      const b = JSON.stringify(runSeed(sheet_1_2, ref, seed).log);
      expect(a).toBe(b);
    }
  });
});
