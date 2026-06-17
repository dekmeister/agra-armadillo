import { describe, expect, it } from "vitest";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level11, level11NaiveBrain, level11ReferenceBrain, scenarioFor } from "@brain-swap/levels";

// Level 1.1 "Handshake": the control-acquisition handshake in isolation (no flight).
// Win = MA is the secondary controller of MULE-01 for 30 consecutive ticks.

const MAX_STEPS = 500;

function solve(brain = level11ReferenceBrain): World {
  return run(initWorld(scenarioFor(level11, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

// FA advertises MULE-01 TEMPORARILY_UNAVAILABLE at boot and AVAILABLE only at tick 12
// (capability-available event → status delivered t13). The reference brain waits for
// AVAILABLE, ACQUIREs at t14, is APPROVED at t15, and holds 30 ticks to win at t43.
const GOLDEN_LOG = [
  "t1 FA->MA MA_FlightCapabilityMT [delivered]",
  "t1 FA->MA MA_FlightCapabilityStatusMT [delivered]",
  ...Array.from({ length: 11 }, (_, i) => `t${i + 2} FA->MA MA_PositionReportDetailedMT [delivered]`),
  "t13 FA->MA MA_FlightCapabilityStatusMT [delivered]",
  "t13 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t14 MA->FA MA_ControlRequestMT [delivered]",
  "t14 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t15 FA->MA MA_ControlRequestStatusMT [delivered]",
  "t15 FA->MA ControlStatusMT [delivered]",
  "t15 FA->MA MA_PositionReportDetailedMT [delivered]",
  ...Array.from({ length: 28 }, (_, i) => `t${i + 16} FA->MA MA_PositionReportDetailedMT [delivered]`),
];

describe("level 1.1 golden run (reference brain)", () => {
  it("the reference brain wins by holding control for the required span", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.holdTicks).toBeGreaterThanOrEqual(level11.objective.holdTicks);
  });

  it("produces the exact golden message log", () => {
    expect(project(solve().log)).toEqual(GOLDEN_LOG);
  });

  it("emits exactly one MA send: the ACQUIRE request", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));
    expect(sends).toEqual([
      { tick: 14, type: "MA_ControlRequestMT", payload: { RequestType: "ACQUIRE", CapabilityID: "MULE-01" } },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level11.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 1.1 negative run (naive bait brain)", () => {
  it("commanding before acquiring control is ignored and never wins", () => {
    const w = solve(level11NaiveBrain);
    expect(w.outcome).not.toBe("won");
    expect(w.log.some((e) => e.disposition.kind === "ignored-not-controller")).toBe(true);
  });
});
