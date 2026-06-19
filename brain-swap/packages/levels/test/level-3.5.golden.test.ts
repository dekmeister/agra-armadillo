import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level35, level35NaiveBrain, level35ReferenceBrain, scenarioFor } from "@brain-swap/levels";
import { describe, expect, it } from "vitest";

// Level 3.5 "Sensor Failure": MS robustness. The player tasks the primary AMTI radar; it
// goes ACTIVE but DEGRADES at tick 5 (before its track fires) and MS raises MA_FaultMT (the
// same message FA uses, on the MS bus — lie #19). The player must cancel the dead task and
// re-task the healthy backup radar, which collects both tracks. Ignoring the fault → silence.

const MAX_STEPS = 500;

function solve(brain = level35ReferenceBrain): World {
  return run(initWorld(scenarioFor(level35, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LOG = [
  "t1 FA->MA MA_FlightCapabilityMT [delivered]",
  "t1 FA->MA MA_FlightCapabilityStatusMT [delivered]",
  "t1 MS->MA SubsystemStatusMT [delivered]",
  "t1 MS->MA SubsystemStatusMT [delivered]",
  "t1 MS->MA ServiceStatusMT [delivered]",
  "t1 MS->MA MA_AMTI_CapabilityMT [delivered]",
  "t1 MS->MA MA_AMTI_CapabilityMT [delivered]",
  "t2 MA->MS AMTI_CommandMT [delivered]",
  "t2 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t3 MS->MA AMTI_CommandStatusMT [delivered]",
  "t3 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t3 MS->MA AMTI_CommandStatusMT [delivered]",
  "t3 MS->MA AMTI_ActivityMT [delivered]",
  "t4 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t5 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t5 MS->MA AMTI_ActivityMT [delivered]",
  "t6 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t6 MS->MA MA_FaultMT [delivered]",
  "t7 MA->MS AMTI_CommandMT [delivered]",
  "t7 MA->MS AMTI_CommandMT [delivered]",
  "t7 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t7 MS->MA SubsystemStatusMT [delivered]",
  "t7 MS->MA SubsystemStatusMT [delivered]",
  "t7 MS->MA ServiceStatusMT [delivered]",
  "t8 MS->MA AMTI_CommandStatusMT [delivered]",
  "t8 MS->MA AMTI_CommandStatusMT [delivered]",
  "t8 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t8 MS->MA AMTI_CommandStatusMT [delivered]",
  "t8 MS->MA AMTI_ActivityMT [delivered]",
  "t9 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t9 MS->MA AMTI_ActivityMT [delivered]",
  "t10 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t10 MS->MA EntityMT [delivered]",
  "t11 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t11 MS->MA EntityMT [delivered]",
  "t11 MS->MA AMTI_ActivityMT [delivered]",
];

describe("level 3.5 golden run (reference brain)", () => {
  it("the reference brain recovers from the fault and collects two tracks", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.ms?.entitiesReported).toBe(2);
  });

  it("produces the exact golden message log", () => {
    expect(project(solve().log)).toEqual(GOLDEN_LOG);
  });

  it("cancels the dead primary and re-tasks the backup (three MA→MS sends)", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));
    expect(sends).toEqual([
      {
        tick: 2,
        type: "AMTI_CommandMT",
        payload: {
          CommandID: "AMTI-CMD-P",
          CapabilityID: "AESA-PRIMARY-1",
          CommandState: "NEW",
          StartTimeWindow: 0,
          EndTimeWindow: 60,
          TargetVolume: "VOL-A",
        },
      },
      {
        tick: 7,
        type: "AMTI_CommandMT",
        payload: {
          CommandID: "AMTI-CMD-P-CANCEL",
          CapabilityID: "AESA-PRIMARY-1",
          CommandState: "CANCEL",
        },
      },
      {
        tick: 7,
        type: "AMTI_CommandMT",
        payload: {
          CommandID: "AMTI-CMD-B",
          CapabilityID: "AESA-BACKUP-1",
          CommandState: "NEW",
          StartTimeWindow: 0,
          EndTimeWindow: 60,
          TargetVolume: "VOL-A",
        },
      },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level35.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 3.5 negative run (naive bait brain)", () => {
  it("ignoring the fault collects nothing and times out", () => {
    const w = solve(level35NaiveBrain);
    expect(w.outcome).not.toBe("won");
    expect(w.log.some((e) => e.type === "MA_FaultMT")).toBe(true);
    expect(w.log.some((e) => e.type === "EntityMT")).toBe(false);
    expect(w.ms?.entitiesReported).toBe(0);
  });
});
