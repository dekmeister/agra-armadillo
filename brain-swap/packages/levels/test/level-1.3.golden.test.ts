import { describe, expect, it } from "vitest";
import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level13, level13NaiveBrain, level13ReferenceBrain, scenarioFor } from "@brain-swap/levels";

// Level 1.3 "Envelope": reach-hold at the Heron's ceiling. Only a brain that reads
// cap.MaxAltitude reaches the band; a hardcoded over-ceiling altitude is rejected.

const MAX_STEPS = 500;

function solve(brain = level13ReferenceBrain): World {
  return run(initWorld(scenarioFor(level13, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LOG = [
  "t1 FA->MA MA_FlightCapabilityMT [delivered]",
  "t1 FA->MA MA_FlightCapabilityStatusMT [delivered]",
  "t2 MA->FA MA_ControlRequestMT [delivered]",
  "t2 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t3 FA->MA MA_ControlRequestStatusMT [delivered]",
  "t3 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t4 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t5 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t6 FA->MA MA_ControlRequestStatusMT [delivered]",
  "t6 FA->MA ControlStatusMT [delivered]",
  "t6 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t7 MA->FA MA_FlightCommandMT [delivered]",
  "t7 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t8 FA->MA MA_FlightCommandStatusMT [delivered]",
  "t8 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t8 FA->MA MA_FlightActivityMT [delivered]",
  "t9 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t10 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t11 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t12 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t13 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t13 FA->MA MA_FlightActivityMT [delivered]",
  "t14 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t15 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t16 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t17 MA->FA MA_FlightCommandMT [delivered]",
  "t17 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t18 FA->MA MA_FlightCommandStatusMT [delivered]",
  "t18 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t18 FA->MA MA_FlightActivityMT [delivered]",
  "t19 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t20 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t21 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t22 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t23 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t23 FA->MA MA_FlightActivityMT [delivered]",
  "t24 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t25 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t26 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t27 FA->MA MA_PositionReportDetailedMT [delivered]",
];

describe("level 1.3 golden run (reference brain)", () => {
  it("the profile-reading brain wins with zero rejections", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.holdTicks).toBeGreaterThanOrEqual(level13.objective.holdTicks);
  });

  it("produces the exact golden message log", () => {
    expect(project(solve().log)).toEqual(GOLDEN_LOG);
  });

  it("clamps the commanded altitude to cap.MaxAltitude and the speeds to the band", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));
    expect(sends).toEqual([
      { tick: 2, type: "MA_ControlRequestMT", payload: { RequestType: "ACQUIRE", CapabilityID: "CAP-HSA" } },
      {
        tick: 7,
        type: "MA_FlightCommandMT",
        payload: {
          CommandID: "CMD-1",
          CommandState: "NEW",
          CapabilityID: "CAP-HSA",
          Heading: 270,
          Altitude: 8000,
          Speed: 50,
        },
      },
      {
        tick: 17,
        type: "MA_FlightCommandMT",
        payload: { CommandID: "CMD-1", CommandState: "UPDATE", CapabilityID: "CAP-HSA", Speed: 25 },
      },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level13.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 1.3 negative run (naive over-ceiling brain)", () => {
  it("commanding above MaxAltitude is rejected with PERFORMANCE_LIMIT_EXCEEDED and never wins", () => {
    const w = solve(level13NaiveBrain);
    expect(w.outcome).not.toBe("won");
    const rejected = w.log.find(
      (e) =>
        e.type === "MA_FlightCommandStatusMT" &&
        (e.payload as { CommandProcessingState?: string }).CommandProcessingState === "REJECTED",
    );
    expect(rejected).toBeDefined();
    expect((rejected!.payload as { ValidationResult?: string }).ValidationResult).toBe(
      "PERFORMANCE_LIMIT_EXCEEDED",
    );
  });
});
