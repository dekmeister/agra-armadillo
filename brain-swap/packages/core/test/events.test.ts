import {
  type BodyProfile,
  isSecondaryController,
  type LevelDef,
  type MessageLogEntry,
  makeScenario,
  msg,
  replayScript,
  type ScriptedInput,
  validateFlightCommand,
  type World,
} from "@brain-swap/core";
import { describe, expect, it } from "vitest";

// Deterministic mission-events system (Phase 1). A level carries a `events` schedule;
// each event fires in Phase A′ of the step that advances the world to its `tick`,
// before inbound delivery, so this tick's commands are validated against the new
// envelope. Everything here is driven through the realtime path (replayScript) to
// prove the events system replays deterministically (CLAUDE.md rule #3).

// Heron-flavoured body: real ceiling 8000, instant approval, publication disabled so
// the golden log is just control + command + event traffic.
const body: BodyProfile = {
  id: "test",
  name: "Test Heron",
  capabilities: [
    {
      id: "TEST-01",
      type: "HSA_CSA",
      profile: { minAltitude: 0, maxAltitude: 8000, minAirspeed: 20, maxAirspeed: 60 },
    },
  ],
  flight: { maxTurnRateDeg: 5, maxClimbRate: 50, maxAccel: 20 },
  control: { approvalLatencyTicks: 0 },
  publish: { positionIntervalTicks: 0, activityIntervalTicks: 0 },
  start: { x: 0, y: 0, altitude: 3000, heading: 270, speed: 0 },
};

/** A level that never wins (hold-control with an unreachable hold), so the run is a
 *  fixed-length window we can assert against. `events` overridden per test. */
function levelWith(events: LevelDef["events"]): LevelDef {
  return {
    id: "events-test",
    title: "Events Test",
    body: "test",
    capabilityId: "TEST-01",
    objective: { kind: "hold-control", holdTicks: 999 },
    maxTicks: 100,
    events,
  };
}

const acquire = msg("MA_ControlRequestMT", "MA", "FA", {
  RequestType: "ACQUIRE",
  CapabilityID: "TEST-01",
});
const cmdAlt = (alt: number) =>
  msg("MA_FlightCommandMT", "MA", "FA", {
    CommandID: "CMD-1",
    CommandState: "NEW",
    CapabilityID: "TEST-01",
    Heading: 270,
    Altitude: alt,
    Speed: 40,
  });

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

const frameAt = (frames: World[], tick: number): World => frames.find((f) => f.tick === tick)!;

describe("mission events — degrade-envelope", () => {
  // Tick 1 inject delivers at t2; tick 3 inject delivers at t4. The degrade fires in
  // the step to t4 (Phase A′), so the command delivered that same tick is validated
  // against the *new* ceiling.
  const script: ScriptedInput[] = [
    { tick: 1, message: acquire },
    { tick: 3, message: cmdAlt(6000) }, // within old ceiling (8000), above new (5000)
  ];
  const events: LevelDef["events"] = [
    { kind: "degrade-envelope", tick: 4, capabilityId: "TEST-01", maxAltitude: 5000 },
  ];
  const runFrames = () => replayScript(makeScenario(body, { level: levelWith(events) }), script, 6);

  it("re-advertises the tightened envelope at N+1 and rejects the over-(new-)ceiling command", () => {
    const final = runFrames().at(-1)!;
    expect(project(final.log)).toEqual([
      "t1 FA->MA MA_FlightCapabilityMT [delivered]",
      "t1 FA->MA MA_FlightCapabilityStatusMT [delivered]",
      "t2 MA->FA MA_ControlRequestMT [delivered]",
      "t3 FA->MA MA_ControlRequestStatusMT [delivered]",
      "t3 FA->MA ControlStatusMT [delivered]",
      "t4 MA->FA MA_FlightCommandMT [delivered]",
      "t5 FA->MA MA_FlightCapabilityMT [delivered]", // re-advert (degrade@4 → delivered@5)
      "t5 FA->MA MA_FlightCommandStatusMT [delivered]", // the rejection
    ]);

    const readvert = final.log.filter((e) => e.type === "MA_FlightCapabilityMT").at(-1)!;
    expect((readvert.payload as { MaxAltitude?: number }).MaxAltitude).toBe(5000);

    const status = final.log.find((e) => e.type === "MA_FlightCommandStatusMT")!;
    expect(status.payload).toMatchObject({
      CommandProcessingState: "REJECTED",
      ValidationResult: "PERFORMANCE_LIMIT_EXCEEDED",
    });

    // The overlay is reflected in the world snapshot from the degrade tick onward.
    expect(frameAt(runFrames(), 4).dynamicEnvelope["TEST-01"]).toEqual({
      minAltitude: 0,
      maxAltitude: 5000,
      minAirspeed: 20,
      maxAirspeed: 60,
    });
  });

  it("the same command is accepted against the body's static envelope (proves it was the degrade)", () => {
    expect(validateFlightCommand(body, cmdAlt(6000).payload).accepted).toBe(true);
    expect(validateFlightCommand(body, cmdAlt(6000).payload, { maxAltitude: 5000 }).accepted).toBe(
      false,
    );
  });

  it("is deterministic: two replays are byte-identical (log + overlay)", () => {
    const a = runFrames();
    const b = runFrames();
    expect(JSON.stringify(a.map((w) => [w.log, w.dynamicEnvelope, w.threats]))).toBe(
      JSON.stringify(b.map((w) => [w.log, w.dynamicEnvelope, w.threats])),
    );
  });
});

describe("mission events — capability-unavailable", () => {
  const script: ScriptedInput[] = [
    { tick: 1, message: acquire },
    { tick: 4, message: cmdAlt(3000) }, // delivered t5, after the pull at t4
  ];
  const events: LevelDef["events"] = [
    {
      kind: "capability-unavailable",
      tick: 4,
      capabilityId: "TEST-01",
      reason: "TEMPORARILY_UNAVAILABLE",
    },
  ];
  const final = () =>
    replayScript(makeScenario(body, { level: levelWith(events) }), script, 6).at(-1)!;

  it("signals TEMPORARILY_UNAVAILABLE, drops MA control, and ignores commands on the pulled cap", () => {
    const w = final();
    const status = w.log.filter((e) => e.type === "MA_FlightCapabilityStatusMT").at(-1)!;
    expect((status.payload as { Availability: string }).Availability).toBe(
      "TEMPORARILY_UNAVAILABLE",
    );

    expect(isSecondaryController(w.fa, "TEST-01")).toBe(false);
    expect(w.fa.unavailableCaps["TEST-01"]).toBe("TEMPORARILY_UNAVAILABLE");

    const cmd = w.log.find((e) => e.type === "MA_FlightCommandMT")!;
    expect(cmd.disposition.kind).toBe("ignored-not-controller");
    expect(w.log.some((e) => e.type === "MA_FlightCommandStatusMT")).toBe(false);
  });
});

describe("mission events — spawn-threat / despawn-threat", () => {
  const events: LevelDef["events"] = [
    {
      kind: "spawn-threat",
      tick: 2,
      threatId: "T1",
      zone: { x: 100, y: 0, radius: 50 },
      velocity: { vx: 1, vy: 0 },
    },
    { kind: "despawn-threat", tick: 5, threatId: "T1" },
  ];
  const frames = () => replayScript(makeScenario(body, { level: levelWith(events) }), [], 7);

  it("records a spawned threat, advances it by its velocity, and removes it on despawn", () => {
    const f = frames();
    expect(frameAt(f, 1).threats).toEqual([]); // before spawn (tick 2)
    const t3 = frameAt(f, 3).threats;
    expect(t3).toHaveLength(1);
    expect(t3[0]!.id).toBe("T1");
    // Moving threat: its center advances by vx=1 each tick from the spawn x=100.
    expect(t3[0]!.zone.x).toBeGreaterThan(100);
    expect(frameAt(f, 4).threats[0]!.zone.x).toBeGreaterThan(t3[0]!.zone.x);
    expect(frameAt(f, 6).threats).toEqual([]); // despawned at tick 5
  });
});

describe("mission events — eventless levels are unaffected", () => {
  it("a level with no events carries an empty overlay every tick", () => {
    const f = replayScript(
      makeScenario(body, { level: levelWith(undefined) }),
      [{ tick: 1, message: acquire }],
      4,
    );
    for (const w of f) {
      expect(w.threats).toEqual([]);
      expect(w.dynamicEnvelope).toEqual({});
    }
  });
});
