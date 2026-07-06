// Golden test — sheet 0-2 "Fire and Forget" (Data-1, continuous-hold goal + the
// `drop` seed + multi-consumer fan-out + `staleAfter` staleness). The reference
// publish plan republishes every tick so that losing the first send to one consumer
// (seed ②) or every other send (seed ③) still keeps all three consumers refreshed
// within `staleAfter`. The negatives teach: a single fire-and-forget goes stale and
// fails even the polite seed; a too-slow cadence survives ① but the odd-drop seed
// opens a stale gap. See docs/03-levels.md 0-2 for the numbers.
import { type PublishPlan, runAllSeedsOneWay, runSeedOneWay } from "@normal-form/core";
import { sheet_0_2 } from "@normal-form/levels";
import { describe, expect, it } from "vitest";
import negSingle from "./reference/neg-0-2-single.json" with { type: "json" };
import negSlow from "./reference/neg-0-2-slow.json" with { type: "json" };
import refPlan from "./reference/ref-0-2.json" with { type: "json" };

const ref = refPlan as PublishPlan;
const single = negSingle as PublishPlan;
const slow = negSlow as PublishPlan;

const byId = (plan: PublishPlan) =>
  Object.fromEntries(runAllSeedsOneWay(sheet_0_2, plan).results.map((r) => [r.seedId, r.pass]));

describe("sheet 0-2 — reference publish plan", () => {
  it("holds the datum at all three consumers across 6–12 on all seeds", () => {
    const { results, allPass } = runAllSeedsOneWay(sheet_0_2, ref);
    expect(allPass, JSON.stringify(results.map((r) => [r.seedId, r.pass, r.goalTick]))).toBe(true);
  });
});

describe("sheet 0-2 — negative goldens (the seeds teach)", () => {
  it("a single fire-and-forget goes stale and fails even the polite seed ①", () => {
    expect(byId(single)).toEqual({ 1: false, 2: false, 3: false });
  });

  it("a too-slow cadence survives ① but the drop seeds open a stale gap", () => {
    expect(byId(slow)).toEqual({ 1: true, 2: false, 3: false });
  });
});

describe("sheet 0-2 — determinism", () => {
  it("logs are byte-stable across repeated runs", () => {
    for (const seed of sheet_0_2.seeds) {
      const a = JSON.stringify(runSeedOneWay(sheet_0_2, ref, seed).log);
      const b = JSON.stringify(runSeedOneWay(sheet_0_2, ref, seed).log);
      expect(a).toBe(b);
    }
  });
});
