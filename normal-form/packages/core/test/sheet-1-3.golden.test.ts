// Golden tests for sheet 1-3 "Rejection Letter" (WS-F). The commandee REJECTS the
// first attempt (with a real CannotComplyEnum reason) and accepts the retry. The
// lesson: REJECTED is terminal for that CommandID — recovery is a NEW command, and
// the old id is retired (its stragglers are ignored).
//   ref     — RECEIVED→wait, ACCEPTED→terminal, REJECTED→retry(1): passes all seeds.
//   ② reorder(RECEIVED, ACCEPTED) on the *retry* round kills a hard-sequencer.
//   ③ dup(REJECTED) after the retry succeeds is a straggler for the retired id.
import { type Machine, runAllSeeds, runSeed } from "@normal-form/core";
import { sheet_1_3 } from "@normal-form/levels";
import { describe, expect, it } from "vitest";
import negHardseq from "./reference/neg-hardseq.json" with { type: "json" };
import negRejectTerminal from "./reference/neg-reject-terminal.json" with { type: "json" };
import refMachine from "./reference/ref-1-3.json" with { type: "json" };

const ref = refMachine as Machine;
const hardseq = negHardseq as Machine;
const rejectTerminal = negRejectTerminal as Machine;

describe("sheet 1-3 — reference machine", () => {
  it("passes all three seeds (retry-as-NEW recovers the rejection)", () => {
    const { results, allPass } = runAllSeeds(sheet_1_3, ref);
    expect(allPass, JSON.stringify(results.map((r) => [r.seedId, r.pass, r.fault]))).toBe(true);
  });

  it("surfaces the cited CannotComplyEnum reason on the REJECTED status", () => {
    const seed1 = sheet_1_3.seeds.find((s) => s.id === 1)!;
    const log = runSeed(sheet_1_3, ref, seed1).log;
    expect(log.some((e) => e.detail.includes("INVALID_INPUT_PARAMETER"))).toBe(true);
    // The machine retried, so a second TaskCommand was sent.
    expect(log.some((e) => e.kind === "command-retried")).toBe(true);
  });
});

describe("sheet 1-3 — negative goldens (the seeds teach)", () => {
  it("treating REJECTED as terminal ('accept the rejection') never runs the activity", () => {
    const results = runAllSeeds(sheet_1_3, rejectTerminal).results;
    expect(Object.fromEntries(results.map((r) => [r.seedId, r.pass]))).toEqual({
      1: false,
      2: false,
      3: false,
    });
    expect(results.every((r) => !r.activityExecuted)).toBe(true);
  });

  it("hard-sequencing RECEIVED→ACCEPTED fails only when the retry round is reordered", () => {
    const byId = Object.fromEntries(
      runAllSeeds(sheet_1_3, hardseq).results.map((r) => [r.seedId, r.pass]),
    );
    expect(byId).toEqual({ 1: true, 2: false, 3: true });
  });
});

describe("sheet 1-3 — determinism", () => {
  it("logs are byte-stable across repeated runs", () => {
    for (const seed of sheet_1_3.seeds) {
      const a = JSON.stringify(runSeed(sheet_1_3, ref, seed).log);
      const b = JSON.stringify(runSeed(sheet_1_3, ref, seed).log);
      expect(a).toBe(b);
    }
  });
});
