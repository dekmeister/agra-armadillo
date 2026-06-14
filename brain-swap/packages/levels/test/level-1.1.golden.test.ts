import { describe, expect, it } from "vitest";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level11, level11NaiveBrain, level11ReferenceBrain, scenarioFor } from "@brain-swap/levels";

// Level 1.1 "Handshake": the control-acquisition handshake in isolation (no flight).
// Win = MA is the secondary controller of CAP-HSA for 30 consecutive ticks.

const MAX_STEPS = 500;

function solve(brain = level11ReferenceBrain): World {
  return run(initWorld(scenarioFor(level11, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LOG = [
  "t1 FA->MA MA_FlightCapabilityMT [delivered]",
  "t1 FA->MA MA_FlightCapabilityStatusMT [delivered]",
  "t2 MA->FA MA_ControlRequestMT [delivered]",
  "t2 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t3 FA->MA MA_ControlRequestStatusMT [delivered]",
  "t3 FA->MA ControlStatusMT [delivered]",
  "t3 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t4 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t5 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t6 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t7 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t8 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t9 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t10 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t11 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t12 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t13 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t14 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t15 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t16 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t17 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t18 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t19 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t20 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t21 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t22 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t23 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t24 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t25 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t26 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t27 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t28 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t29 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t30 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t31 FA->MA MA_PositionReportDetailedMT [delivered]",
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
      { tick: 2, type: "MA_ControlRequestMT", payload: { RequestType: "ACQUIRE", CapabilityID: "CAP-HSA" } },
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
