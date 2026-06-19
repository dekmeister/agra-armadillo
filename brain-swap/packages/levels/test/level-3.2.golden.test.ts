import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level32, level32NaiveBrain, level32ReferenceBrain, scenarioFor } from "@brain-swap/levels";
import { describe, expect, it } from "vitest";

// Level 3.2 "Eyes Open": the first MS *command* — sensor tasking. MS advertises an AMTI
// capability; the player schedules it with a time-windowed AMTI_CommandMT referencing the
// advertised CapabilityID, then waits for the activity to confirm and two EntityMT tracks
// to arrive. The win counts tracks *received* (delivered), so both appear in the log.

const MAX_STEPS = 500;

function solve(brain = level32ReferenceBrain): World {
  return run(initWorld(scenarioFor(level32, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

// Boot (t1): FA caps + MS heartbeat + the AMTI capability advert. The brain tasks the
// sensor at t1 (delivered t2). MS: RECEIVED + ACCEPTED + ENABLED (t3), ACTIVE (t5), TRK-1
// (t6), TRK-2 + COMPLETED (t8). Heartbeat repeats at t7. Win on the 2nd track at t8.
const GOLDEN_LOG = [
  "t1 FA->MA MA_FlightCapabilityMT [delivered]",
  "t1 FA->MA MA_FlightCapabilityStatusMT [delivered]",
  "t1 MS->MA SubsystemStatusMT [delivered]",
  "t1 MS->MA ServiceStatusMT [delivered]",
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
  "t6 MS->MA EntityMT [delivered]",
  "t7 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t7 MS->MA SubsystemStatusMT [delivered]",
  "t7 MS->MA ServiceStatusMT [delivered]",
  "t8 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t8 MS->MA EntityMT [delivered]",
  "t8 MS->MA AMTI_ActivityMT [delivered]",
];

describe("level 3.2 golden run (reference brain)", () => {
  it("the reference brain wins by collecting two sensor tracks", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.ms?.entitiesReported).toBeGreaterThanOrEqual(level32.objective.kind === "ms-track" ? level32.objective.requiredCount : 0);
  });

  it("produces the exact golden message log", () => {
    expect(project(solve().log)).toEqual(GOLDEN_LOG);
  });

  it("emits exactly one MA send: the AMTI command (MA→MS)", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, to: e.to, type: e.type, payload: e.payload }));
    expect(sends).toEqual([
      {
        tick: 2,
        to: "MS",
        type: "AMTI_CommandMT",
        payload: {
          CommandID: "AMTI-CMD-1",
          CapabilityID: "AESA-VOL-1",
          CommandState: "NEW",
          StartTimeWindow: 0,
          EndTimeWindow: 40,
          TargetVolume: "VOL-A",
        },
      },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level32.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 3.2 negative run (naive bait brain)", () => {
  it("commanding an unadvertised capability is CANCELED (not REJECTED) and never collects", () => {
    const w = solve(level32NaiveBrain);
    expect(w.outcome).not.toBe("won");
    // MS isn't safety-critical: the bad command is delivered and answered CANCELED, never
    // REJECTED — and no activity or tracks follow, so the run times out.
    const status = w.log.find((e) => e.type === "AMTI_CommandStatusMT");
    expect(status?.disposition.kind).toBe("delivered");
    expect((status?.payload as { CommandProcessingState: string }).CommandProcessingState).toBe(
      "CANCELED",
    );
    expect(w.log.some((e) => e.type === "EntityMT")).toBe(false);
    expect(w.ms?.entitiesReported).toBe(0);
  });
});
