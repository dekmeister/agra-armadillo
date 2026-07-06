// Golden test — sheet 0-1 "Hello, Bus" (Status-1, deadline goal). Like the 1-1
// golden, the sheet is provably solvable headlessly before any one-way UI exists:
// a reference publish plan shows a status by the tick-4 deadline on both seeds, and
// a plan that publishes too late is killed by the delay seed. The player's artifact
// on a `-1` sheet is a *publish plan*, not a handler machine.
import { type PublishPlan, runAllSeedsOneWay, runSeedOneWay } from "@normal-form/core";
import { sheet_0_1 } from "@normal-form/levels";
import { describe, expect, it } from "vitest";
import negLate from "./reference/neg-0-1-late.json" with { type: "json" };
import refPlan from "./reference/ref-0-1.json" with { type: "json" };

const ref = refPlan as PublishPlan;
const late = negLate as PublishPlan;

describe("sheet 0-1 — reference publish plan", () => {
  it("shows the status by tick 4 on all seeds", () => {
    const { results, allPass } = runAllSeedsOneWay(sheet_0_1, ref);
    expect(allPass, JSON.stringify(results.map((r) => [r.seedId, r.pass, r.goalTick]))).toBe(true);
  });
});

describe("sheet 0-1 — negative golden (the delay seed teaches)", () => {
  it("a plan that publishes too late misses the deadline on the delay seed", () => {
    const byId = Object.fromEntries(
      runAllSeedsOneWay(sheet_0_1, late).results.map((r) => [r.seedId, r.pass]),
    );
    expect(byId).toEqual({ 1: true, 2: false });
  });
});

describe("sheet 0-1 — determinism", () => {
  it("logs are byte-stable across repeated runs", () => {
    for (const seed of sheet_0_1.seeds) {
      const a = JSON.stringify(runSeedOneWay(sheet_0_1, ref, seed).log);
      const b = JSON.stringify(runSeedOneWay(sheet_0_1, ref, seed).log);
      expect(a).toBe(b);
    }
  });
});
