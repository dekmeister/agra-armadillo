import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level33, level33NaiveBrain, level33ReferenceBrain, scenarioFor } from "@brain-swap/levels";
import { describe, expect, it } from "vitest";

// Level 3.3 "Clear to Engage": weapon employment + release consent. The power relationship
// is inverted from FA — MS holds the weapon but asks MA for consent. The player runs the
// fire sequence (task → execute → consent) and the strike completes; ignore the consent
// request and MS withholds the weapon. The win is the strike activity reaching COMPLETED.

const MAX_STEPS = 500;

function solve(brain = level33ReferenceBrain): World {
  return run(initWorld(scenarioFor(level33, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const GOLDEN_LOG = [
  "t1 FA->MA MA_FlightCapabilityMT [delivered]",
  "t1 FA->MA MA_FlightCapabilityStatusMT [delivered]",
  "t1 MS->MA SubsystemStatusMT [delivered]",
  "t1 MS->MA ServiceStatusMT [delivered]",
  "t1 MS->MA StrikeCapabilityMT [delivered]",
  "t1 MS->MA StrikeCapabilityStatusMT [delivered]",
  "t2 MA->MS MA_TaskMT [delivered]",
  "t2 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t3 MS->MA MA_TaskStatusMT [delivered]",
  "t3 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t4 MA->MS MA_TaskCommandMT [delivered]",
  "t4 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t5 MS->MA MA_TaskCommandStatusMT [delivered]",
  "t5 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t6 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t7 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t7 MS->MA StrikeConsentRequestMT [delivered]",
  "t8 MA->MS StrikeConsentRequestStatusMT [delivered]",
  "t8 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t9 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t9 MS->MA MA_StrikeActivityMT [delivered]",
  "t9 MS->MA SubsystemStatusMT [delivered]",
  "t9 MS->MA ServiceStatusMT [delivered]",
  "t10 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t11 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t11 MS->MA MA_StrikeActivityMT [delivered]",
];

describe("level 3.3 golden run (reference brain)", () => {
  it("the reference brain completes the strike through the consent chain", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.ms?.strikeTasks["TASK-1"]?.activityState).toBe("COMPLETED");
  });

  it("produces the exact golden message log", () => {
    expect(project(solve().log)).toEqual(GOLDEN_LOG);
  });

  it("emits the three MA→MS sends of the fire + consent sequence", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, type: e.type, payload: e.payload }));
    expect(sends).toEqual([
      {
        tick: 2,
        type: "MA_TaskMT",
        payload: {
          TaskID: "TASK-1",
          TaskType: "STRIKE",
          Target: "TGT-1",
          StoreType: "GBU-53",
          StoreQuantity: 1,
        },
      },
      { tick: 4, type: "MA_TaskCommandMT", payload: { TaskID: "TASK-1", CommandState: "NEW" } },
      {
        tick: 8,
        type: "StrikeConsentRequestStatusMT",
        payload: { TaskID: "TASK-1", ConsentState: "APPROVED" },
      },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level33.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 3.3 negative run (naive bait brain)", () => {
  it("ignoring the consent request withholds the weapon and times out", () => {
    const w = solve(level33NaiveBrain);
    expect(w.outcome).not.toBe("won");
    // MS requested consent but the brain never answered, so the strike is withheld.
    expect(w.log.some((e) => e.type === "StrikeConsentRequestMT")).toBe(true);
    expect(w.ms?.strikeTasks["TASK-1"]?.activityState).not.toBe("COMPLETED");
  });
});
