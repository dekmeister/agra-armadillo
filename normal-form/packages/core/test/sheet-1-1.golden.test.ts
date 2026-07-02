// Golden tests — the heart of the MVP (PLAN_MVP S2). Sheet 1-1 is provably
// solvable before any UI exists, and the seeds teach exactly what docs/03 says:
//   ② reorder(RECEIVED, ACCEPTED) kills a machine that hard-sequences the two.
//   ③ dup(ACCEPTED after terminal) kills a machine whose ACCEPTED isn't terminal.

import { evaluateSheet, type Machine, runAllSeeds, runSeed } from "@normal-form/core";
import { sheet_1_1 } from "@normal-form/levels";
import { describe, expect, it } from "vitest";
import negHardseq from "./reference/neg-hardseq.json" with { type: "json" };
import negNonterminal from "./reference/neg-nonterminal.json" with { type: "json" };
import refMachine from "./reference/ref-1-1.json" with { type: "json" };

const ref = refMachine as Machine;
const hardseq = negHardseq as Machine;
const nonterminal = negNonterminal as Machine;

describe("sheet 1-1 — reference machine", () => {
  it("passes all three seeds", () => {
    const { results, allPass } = runAllSeeds(sheet_1_1, ref);
    expect(allPass, JSON.stringify(results.map((r) => [r.seedId, r.pass, r.fault]))).toBe(true);
  });

  it("scores match pars (2 messages · 3 machine size · ≤6 ticks)", () => {
    const { score } = evaluateSheet(sheet_1_1, ref);
    expect(score.messages).toBe(sheet_1_1.pars.messages); // 2
    expect(score.machineSize).toBe(sheet_1_1.pars.machineSize); // 3
    expect(score.ticks).toBeLessThanOrEqual(sheet_1_1.pars.ticks); // ≤6
  });
});

describe("sheet 1-1 — negative goldens (the seeds teach)", () => {
  it("a machine that hard-sequences RECEIVED→ACCEPTED fails seed ② only", () => {
    const byId = Object.fromEntries(
      runAllSeeds(sheet_1_1, hardseq).results.map((r) => [r.seedId, r.pass]),
    );
    expect(byId).toEqual({ 1: true, 2: false, 3: true });
  });

  it("a machine whose ACCEPTED rule isn't terminal fails seed ③ only", () => {
    const byId = Object.fromEntries(
      runAllSeeds(sheet_1_1, nonterminal).results.map((r) => [r.seedId, r.pass]),
    );
    expect(byId).toEqual({ 1: true, 2: true, 3: false });
  });

  it("seed ③ fails the non-terminal machine with the terminal-state fault", () => {
    const seed3 = sheet_1_1.seeds.find((s) => s.id === 3)!;
    const r = runSeed(sheet_1_1, nonterminal, seed3);
    expect(r.pass).toBe(false);
    expect(r.fault).toMatch(/double-proof/);
    expect(r.fault).toMatch(/UNIS §4\.6\.2/);
  });
});

describe("sheet 1-1 — determinism", () => {
  it("logs are byte-stable across repeated runs", () => {
    for (const seed of sheet_1_1.seeds) {
      const a = JSON.stringify(runSeed(sheet_1_1, ref, seed).log);
      const b = JSON.stringify(runSeed(sheet_1_1, ref, seed).log);
      expect(a).toBe(b);
    }
  });
});
