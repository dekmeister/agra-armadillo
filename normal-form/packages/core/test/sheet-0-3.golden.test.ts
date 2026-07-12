// Golden test — sheet 0-3 "Pattern Choice Is Semantics" (the classification sheet:
// per-job pattern choice + the filed-finding mechanic). The reference solve assigns
// Status-1 to the status job, Data-1 to the datum job, and files the wrong-palette
// finding (CERT UNIS-000093) on the request job — which no `-1` primitive can serve.
// The negatives teach: leaving the request job unfiled fails (a `-1` can't answer a
// request), and swapping Status-1/Data-1 between the two servable jobs fails.
// See docs/03-levels.md 0-3.
import { type PlayerAction, replayScript, runAllSeedsJobs, runSeedJobs } from "@normal-form/core";
import { sheet_0_3 } from "@normal-form/levels";
import { describe, expect, it } from "vitest";
import negSwapped from "./reference/neg-0-3-swapped.json" with { type: "json" };
import negUnfiled from "./reference/neg-0-3-unfiled.json" with { type: "json" };
import refScript from "./reference/ref-0-3.json" with { type: "json" };

const session = (script: unknown) =>
  replayScript(sheet_0_3, script as readonly PlayerAction[]).session;
const byId = (script: unknown) =>
  Object.fromEntries(
    runAllSeedsJobs(sheet_0_3, session(script)).results.map((r) => [r.seedId, r.pass]),
  );

describe("sheet 0-3 — reference solve", () => {
  it("certifies on all seeds: right patterns + the request filed as unservable", () => {
    const { results, allPass } = runAllSeedsJobs(sheet_0_3, session(refScript));
    expect(allPass, JSON.stringify(results.map((r) => [r.seedId, r.pass, r.goalTick]))).toBe(true);
  });
});

describe("sheet 0-3 — negative goldens (the lesson)", () => {
  it("leaving the request job unfiled fails — a -1 primitive cannot answer a request", () => {
    expect(byId(negUnfiled)).toEqual({ 1: false, 2: false });
  });

  it("swapping Status-1 / Data-1 between the two servable jobs fails", () => {
    expect(byId(negSwapped)).toEqual({ 1: false, 2: false });
  });
});

describe("sheet 0-3 — determinism", () => {
  it("logs are byte-stable across repeated runs", () => {
    const ref = session(refScript);
    for (const seed of sheet_0_3.seeds) {
      const a = JSON.stringify(runSeedJobs(sheet_0_3, ref, seed).log);
      const b = JSON.stringify(runSeedJobs(sheet_0_3, ref, seed).log);
      expect(a).toBe(b);
    }
  });
});
