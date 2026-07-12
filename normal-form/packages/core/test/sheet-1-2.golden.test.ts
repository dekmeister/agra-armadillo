// Golden tests for sheet 1-2 "Skipping the Pleasantries" (WS-F). The lesson:
// RECEIVED is a courtesy, not a contract — a commandee may skip it entirely. Each
// seed carries a commandee-behaviour variant (SPC-001 §5.1.1), not a transport drop:
//   ② terse commandee (straight to ACCEPTED, no RECEIVED) kills the pre-checked
//      "require RECEIVED first" gate — a machine that hard-sequences RECEIVED→ACCEPTED.
//   ③ terse + dup(ACCEPTED) additionally re-checks the terminal-state rule.
import { type Machine, runAllSeeds, runSeed } from "@normal-form/core";
import { sheet_1_2 } from "@normal-form/levels";
import { describe, expect, it } from "vitest";
import negHardseq from "./reference/neg-hardseq.json" with { type: "json" };
import negNonterminal from "./reference/neg-nonterminal.json" with { type: "json" };
import refMachine from "./reference/ref-1-2.json" with { type: "json" };

const ref = refMachine as Machine;
const hardseq = negHardseq as Machine;
const nonterminal = negNonterminal as Machine;

describe("sheet 1-2 — reference machine", () => {
  it("passes all three seeds", () => {
    const { results, allPass } = runAllSeeds(sheet_1_2, ref);
    expect(allPass, JSON.stringify(results.map((r) => [r.seedId, r.pass, r.fault]))).toBe(true);
  });
});

describe("sheet 1-2 — negative goldens (the seeds teach)", () => {
  it("the pre-checked gate (hard-sequences RECEIVED→ACCEPTED) fails the terse seeds", () => {
    const byId = Object.fromEntries(
      runAllSeeds(sheet_1_2, hardseq).results.map((r) => [r.seedId, r.pass]),
    );
    // ② and ③ have no RECEIVED, so ACCEPTED (armed only after RECEIVED) never fires.
    expect(byId).toEqual({ 1: true, 2: false, 3: false });
  });

  it("a machine whose ACCEPTED rule isn't terminal fails seed ③ only (the duplicate)", () => {
    const byId = Object.fromEntries(
      runAllSeeds(sheet_1_2, nonterminal).results.map((r) => [r.seedId, r.pass]),
    );
    expect(byId).toEqual({ 1: true, 2: true, 3: false });
  });

  it("seed ③ fails the non-terminal machine with the terminal-state fault", () => {
    const seed3 = sheet_1_2.seeds.find((s) => s.id === 3)!;
    const r = runSeed(sheet_1_2, nonterminal, seed3);
    expect(r.pass).toBe(false);
    expect(r.fault).toMatch(/double-proof/);
    expect(r.fault).toMatch(/UNIS §4\.6\.2/);
  });
});

describe("sheet 1-2 — determinism", () => {
  it("logs are byte-stable across repeated runs", () => {
    for (const seed of sheet_1_2.seeds) {
      const a = JSON.stringify(runSeed(sheet_1_2, ref, seed).log);
      const b = JSON.stringify(runSeed(sheet_1_2, ref, seed).log);
      expect(a).toBe(b);
    }
  });
});
