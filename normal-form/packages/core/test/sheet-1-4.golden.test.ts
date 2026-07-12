// Golden test — sheet 1-4 "Request Is Not Command" (the `-2` classification sheet).
// The reference solve assigns DataRequest-2 to the data job and ActionRequest-2 to
// the process job; each correctly-classified request runs to COMPLETED and reaches
// its world-state (data returned / activity executed). The negatives teach: choosing
// Command-2 (a command is not a request) dead-ends the job, and swapping the two
// request patterns dead-ends both. See docs/03-levels.md 1-4.
import { type PlayerAction, replayScript, runAllSeedsJobs, runSeedJobs } from "@normal-form/core";
import { sheet_1_4 } from "@normal-form/levels";
import { describe, expect, it } from "vitest";
import negCommand from "./reference/neg-1-4-command.json" with { type: "json" };
import negSwapped from "./reference/neg-1-4-swapped.json" with { type: "json" };
import refScript from "./reference/ref-1-4.json" with { type: "json" };

const session = (script: unknown) =>
  replayScript(sheet_1_4, script as readonly PlayerAction[]).session;
const byId = (script: unknown) =>
  Object.fromEntries(
    runAllSeedsJobs(sheet_1_4, session(script)).results.map((r) => [r.seedId, r.pass]),
  );

describe("sheet 1-4 — reference solve", () => {
  it("certifies on all seeds: DataRequest-2 returns data, ActionRequest-2 runs", () => {
    const { results, allPass } = runAllSeedsJobs(sheet_1_4, session(refScript));
    expect(allPass, JSON.stringify(results.map((r) => [r.seedId, r.pass, r.goalTick]))).toBe(true);
  });

  it("surfaces the RequestProcessingStateEnum progression in the run log", () => {
    const seed1 = sheet_1_4.seeds.find((s) => s.id === 1)!;
    const log = runSeedJobs(sheet_1_4, session(refScript), seed1).log;
    const states = log.filter((e) => e.kind === "request-state").map((e) => e.detail);
    expect(states.some((d) => d.includes("QUEUED"))).toBe(true);
    expect(states.some((d) => d.includes("PROCESSING"))).toBe(true);
    expect(states.some((d) => d.includes("COMPLETED"))).toBe(true);
  });
});

describe("sheet 1-4 — negative goldens (the lesson: request ≠ command)", () => {
  it("Command-2 on the data job dead-ends it (a command is not a request)", () => {
    expect(byId(negCommand)).toEqual({ 1: false, 2: false, 3: false });
  });

  it("swapping the two request patterns dead-ends both jobs", () => {
    expect(byId(negSwapped)).toEqual({ 1: false, 2: false, 3: false });
  });
});

describe("sheet 1-4 — determinism", () => {
  it("logs are byte-stable across repeated runs", () => {
    const ref = session(refScript);
    for (const seed of sheet_1_4.seeds) {
      const a = JSON.stringify(runSeedJobs(sheet_1_4, ref, seed).log);
      const b = JSON.stringify(runSeedJobs(sheet_1_4, ref, seed).log);
      expect(a).toBe(b);
    }
  });
});
