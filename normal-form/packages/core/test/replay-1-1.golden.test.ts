// Replay golden (PLAN_MVP S5) — the session/editor path is provably solvable and
// the UI-reachable footguns behave. A recorded solve script folds to a clean
// composition + a machine that passes all three seeds at par; the two gated /
// non-terminal scripts fail exactly the seed they teach (mirroring the S2
// neg-hardseq / neg-nonterminal machine goldens, but built through the editor).
import {
  evaluateSheet,
  type PlayerAction,
  replayScript,
  runAllSeeds,
  validate,
} from "@normal-form/core";
import { sheet_1_1 } from "@normal-form/levels";
import { describe, expect, it } from "vitest";

// The canonical solve a newcomer performs: place, fix both fields, wire 3 handlers.
const SOLVE: PlayerAction[] = [
  { do: "place" },
  { do: "setField", name: "SystemID", value: "sys-alpha-01" },
  { do: "setField", name: "CommandID", value: sheet_1_1.opening.commandId },
  { do: "setHandler", on: "RECEIVED", action: "wait" },
  { do: "setHandler", on: "ACCEPTED", action: "terminal" },
  { do: "setHandler", on: "REJECTED", action: "retry" },
];

describe("sheet 1-1 — replay golden (the editor path solves it)", () => {
  it("the canonical solve validates clean", () => {
    const { composition } = replayScript(sheet_1_1, SOLVE);
    expect(validate(sheet_1_1, composition)).toEqual([]);
  });

  it("the canonical solve passes all three seeds at par", () => {
    const { machine } = replayScript(sheet_1_1, SOLVE);
    const { allPass, score } = evaluateSheet(sheet_1_1, machine);
    expect(allPass).toBe(true);
    expect(score.messages).toBe(sheet_1_1.pars.messages); // 2
    expect(score.machineSize).toBe(sheet_1_1.pars.machineSize); // 3
    expect(score.ticks).toBeLessThanOrEqual(sheet_1_1.pars.ticks); // ≤6
  });

  it("replay is deterministic (same script ⇒ same machine)", () => {
    const a = JSON.stringify(replayScript(sheet_1_1, SOLVE).machine);
    const b = JSON.stringify(replayScript(sheet_1_1, SOLVE).machine);
    expect(a).toBe(b);
  });
});

describe("sheet 1-1 — replay negatives (the UI-reachable footguns)", () => {
  it("the gate toggle (require RECEIVED first) fails seed ② only", () => {
    const gated: PlayerAction[] = [...SOLVE, { do: "gateAccepted", value: true }];
    const { machine } = replayScript(sheet_1_1, gated);
    const byId = Object.fromEntries(
      runAllSeeds(sheet_1_1, machine).results.map((r) => [r.seedId, r.pass]),
    );
    expect(byId).toEqual({ 1: true, 2: false, 3: true });
  });

  it("ACCEPTED → wait (not terminal) fails seed ③ only", () => {
    const nonTerminal: PlayerAction[] = [
      ...SOLVE,
      { do: "setHandler", on: "ACCEPTED", action: "wait" },
    ];
    const { machine } = replayScript(sheet_1_1, nonTerminal);
    const byId = Object.fromEntries(
      runAllSeeds(sheet_1_1, machine).results.map((r) => [r.seedId, r.pass]),
    );
    expect(byId).toEqual({ 1: true, 2: true, 3: false });
  });
});
