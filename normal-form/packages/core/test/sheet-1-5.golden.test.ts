// Golden test — bonus sheet 1-5 "Cancel Culture" (the request-run path). The player
// injects a CANCEL at a tick; the requestee works QUEUED→PROCESSING→COMPLETED unless
// the CANCEL is received before it commits COMPLETED. The reference injects CANCEL
// early (tick 1): it lands in time on the two clean seeds (→ CANCELED, no activity)
// but loses the race on the delayed seed ③, where COMPLETED wins — and the seed's
// relaxed goal accepts that outcome. The negatives teach the "arrives broken" beat:
// no cancel (or a too-late cancel) lets the activity run and fails the CANCELED goal.
// See docs/03-levels.md 1-5.
import {
  type PlayerAction,
  replayScript,
  runAllSeedsRequest,
  runSeedRequest,
} from "@normal-form/core";
import { sheet_1_5 } from "@normal-form/levels";
import { describe, expect, it } from "vitest";
import refScript from "./reference/ref-1-5.json" with { type: "json" };

const cancelAt = (script: readonly PlayerAction[]) =>
  replayScript(sheet_1_5, script).session.cancelAt;
const refCancel = cancelAt(refScript as readonly PlayerAction[]);
const seed = (id: number) => sheet_1_5.seeds.find((s) => s.id === id)!;
const states = (cancel: number | null, id: number) =>
  runSeedRequest(sheet_1_5, cancel, seed(id))
    .log.filter((e) => e.kind === "request-state")
    .map((e) => e.detail);

describe("sheet 1-5 — reference solve", () => {
  it("certifies on all seeds: CANCELED on the clean seeds, outcome held on the race", () => {
    const { results, allPass } = runAllSeedsRequest(sheet_1_5, refCancel);
    expect(allPass, JSON.stringify(results.map((r) => [r.seedId, r.pass, r.goalTick]))).toBe(true);
  });

  it("seed ① cancels during QUEUED → CANCELED, no activity", () => {
    const result = runSeedRequest(sheet_1_5, refCancel, seed(1));
    expect(states(refCancel, 1).some((d) => d.startsWith("CANCELED"))).toBe(true);
    expect(states(refCancel, 1).some((d) => d === "COMPLETED")).toBe(false);
    expect(result.log.some((e) => e.kind === "activity-executed")).toBe(false);
  });

  it("seed ② cancels during PROCESSING → QUEUED, PROCESSING, then CANCELED", () => {
    const d = states(refCancel, 2);
    expect(d).toContain("QUEUED");
    expect(d).toContain("PROCESSING");
    expect(d.some((x) => x.startsWith("CANCELED"))).toBe(true);
  });

  it("seed ③ loses the race → COMPLETED wins, activity runs (goal variant)", () => {
    const result = runSeedRequest(sheet_1_5, refCancel, seed(3));
    expect(states(refCancel, 3)).toContain("COMPLETED");
    expect(result.log.some((e) => e.kind === "activity-executed")).toBe(true);
    expect(result.pass).toBe(true);
  });
});

describe("sheet 1-5 — arrives broken (the lesson is guaranteed)", () => {
  it("no cancel lets the activity run and fails the CANCELED goal on the clean seeds", () => {
    const byId = Object.fromEntries(
      runAllSeedsRequest(sheet_1_5, null).results.map((r) => [r.seedId, r.pass]),
    );
    expect(byId[1]).toBe(false);
    expect(byId[2]).toBe(false);
    // The race seed only asks you to hold the outcome — COMPLETED satisfies it.
    expect(byId[3]).toBe(true);
    expect(runAllSeedsRequest(sheet_1_5, null).allPass).toBe(false);
  });

  it("a too-late cancel loses even the clean seed ①", () => {
    // completesAt = 4 (+latency 1) ⇒ COMPLETED commits at tick 5; a cancel injected at
    // tick 5 is received at tick 6, a straggler the terminal COMPLETED ignores.
    expect(runSeedRequest(sheet_1_5, 5, seed(1)).pass).toBe(false);
  });

  it("the sheet ships with no cancel (default is broken)", () => {
    expect(replayScript(sheet_1_5, []).session.cancelAt).toBeNull();
  });
});

describe("sheet 1-5 — determinism", () => {
  it("logs are byte-stable across repeated runs", () => {
    for (const s of sheet_1_5.seeds) {
      const a = JSON.stringify(runSeedRequest(sheet_1_5, refCancel, s).log);
      const b = JSON.stringify(runSeedRequest(sheet_1_5, refCancel, s).log);
      expect(a).toBe(b);
    }
  });
});
