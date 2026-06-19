import { initWorld, type MessageLogEntry, run, scoreWorld, type World } from "@brain-swap/core";
import { level31, level31NaiveBrain, level31ReferenceBrain, scenarioFor } from "@brain-swap/levels";
import { describe, expect, it } from "vitest";

// Level 3.1 "Meet MS": first contact with the Mission Systems interface (no flight).
// MS runs in parallel with FA on the same bus (party "MS"). The Sentry radar boots
// INITIALIZATION and reaches OPERATE at tick 6; the heartbeat publishes every 3 ticks.
// Win = an on-demand SubsystemStatusDataRequestMT confirms SENTRY-RADAR-01 is OPERATE.

const MAX_STEPS = 500;

function solve(brain = level31ReferenceBrain): World {
  return run(initWorld(scenarioFor(level31, brain)), MAX_STEPS);
}

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

// Boot (t1): FA capability advert + MS heartbeat (subsystem INITIALIZATION + 2 services).
// FA publishes position every tick. MS heartbeat repeats at t4 (still INITIALIZATION) and
// t7 (OPERATE — reached at tick 6). The reference brain sees OPERATE at t7 and sends the
// on-demand request, delivered t8; MS confirms OPERATE and the run wins at t8.
const GOLDEN_LOG = [
  "t1 FA->MA MA_FlightCapabilityMT [delivered]",
  "t1 FA->MA MA_FlightCapabilityStatusMT [delivered]",
  "t1 MS->MA SubsystemStatusMT [delivered]",
  "t1 MS->MA ServiceStatusMT [delivered]",
  "t1 MS->MA ServiceStatusMT [delivered]",
  "t2 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t3 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t4 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t4 MS->MA SubsystemStatusMT [delivered]",
  "t4 MS->MA ServiceStatusMT [delivered]",
  "t4 MS->MA ServiceStatusMT [delivered]",
  "t5 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t6 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t7 FA->MA MA_PositionReportDetailedMT [delivered]",
  "t7 MS->MA SubsystemStatusMT [delivered]",
  "t7 MS->MA ServiceStatusMT [delivered]",
  "t7 MS->MA ServiceStatusMT [delivered]",
  "t8 MA->MS SubsystemStatusDataRequestMT [delivered]",
  "t8 FA->MA MA_PositionReportDetailedMT [delivered]",
];

describe("level 3.1 golden run (reference brain)", () => {
  it("the reference brain wins by confirming the subsystem is OPERATE on demand", () => {
    const w = solve();
    expect(w.outcome).toBe("won");
    expect(w.holdTicks).toBeGreaterThanOrEqual(level31.objective.holdTicks);
  });

  it("produces the exact golden message log", () => {
    expect(project(solve().log)).toEqual(GOLDEN_LOG);
  });

  it("emits exactly one MA send: the on-demand status request (MA→MS)", () => {
    const sends = solve()
      .log.filter((e) => e.from === "MA")
      .map((e) => ({ tick: e.tick, to: e.to, type: e.type, payload: e.payload }));
    expect(sends).toEqual([
      {
        tick: 8,
        to: "MS",
        type: "SubsystemStatusDataRequestMT",
        payload: { SubsystemID: "SENTRY-RADAR-01" },
      },
    ]);
  });

  it("produces stable scores equal to par", () => {
    expect(scoreWorld(solve())).toEqual(level31.pars);
  });

  it("is deterministic: two in-process runs yield byte-identical logs", () => {
    expect(JSON.stringify(solve().log)).toBe(JSON.stringify(solve().log));
  });
});

describe("level 3.1 negative run (naive bait brain)", () => {
  it("requesting status during INITIALIZATION latches the wrong state and never wins", () => {
    const w = solve(level31NaiveBrain);
    expect(w.outcome).not.toBe("won");
    // MS does not REJECT the early request (it isn't safety-critical) — the request is
    // delivered, but it confirms a non-OPERATE state, so the objective is never met.
    const req = w.log.find((e) => e.type === "SubsystemStatusDataRequestMT");
    expect(req?.disposition.kind).toBe("delivered");
  });
});
