import { describe, expect, it } from "vitest";
import {
  type BodyProfile,
  injectMA,
  initWorld,
  type LevelDef,
  makeScenario,
  msg,
  step,
  type World,
} from "@brain-swap/core";

// Collision-avoidance interrupt (Phase 4). On a flinchy body, a commanded vector that
// would enter a threat zone makes FA take the aircraft: a CAUTION MA_FaultMT, a fly-away
// override, and rejection (VIOLATION_AIR_TRAFFIC) of any re-issued dangerous vector until
// MA commands a clear one. Driven through the live step loop (the realtime path).

const body: BodyProfile = {
  id: "ferret-test",
  name: "Flinchy",
  capabilities: [{ id: "FX-1", type: "HSA_CSA", profile: { minAltitude: 0, maxAltitude: 9000, minAirspeed: 20, maxAirspeed: 120 } }],
  flight: { maxTurnRateDeg: 10, maxClimbRate: 60, maxAccel: 25 },
  control: { approvalLatencyTicks: 0 },
  collisionLookaheadTicks: 6,
  publish: { positionIntervalTicks: 1, activityIntervalTicks: 0 },
  start: { x: 0, y: 0, altitude: 3000, heading: 270, speed: 50 },
};

// A threat sitting on the direct westbound track, spawned at boot.
const level: LevelDef = {
  id: "collision-test",
  title: "Collision",
  body: "ferret-test",
  capabilityId: "FX-1",
  objective: { kind: "reach-hold", zone: { x: -5000, y: 0, radius: 100 }, altitude: 3000, altitudeTolerance: 50, holdTicks: 5 },
  maxTicks: 300,
  events: [{ kind: "spawn-threat", tick: 1, threatId: "T", zone: { x: -500, y: 0, radius: 200 } }],
};

const cmd = (state: "NEW" | "UPDATE", heading: number) =>
  msg("MA_FlightCommandMT", "MA", "FA", { CommandID: "CMD-1", CommandState: state, CapabilityID: "FX-1", Heading: heading, ...(state === "NEW" ? { Altitude: 3000, Speed: 50 } : {}) });

const stepUntil = (w: World, pred: (w: World) => boolean, max = 14): World => {
  for (let i = 0; i < max && !pred(w); i += 1) w = step(w);
  return w;
};
const lastCmdStatus = (w: World) => w.log.filter((e) => e.type === "MA_FlightCommandStatusMT").at(-1);

/** Acquire control, command the direct (dangerous) vector, and step until the CAUTION
 *  fault has been raised and delivered (it lands in the log the tick after the flinch). */
function flyIntoThreat(): World {
  let w = initWorld(makeScenario(body, { brain: null, level }));
  w = step(w); // t1: boot + threat spawn
  w = injectMA(w, msg("MA_ControlRequestMT", "MA", "FA", { RequestType: "ACQUIRE", CapabilityID: "FX-1" }));
  w = step(w); // t2: ACQUIRE → APPROVED (instant)
  w = step(w); // t3: control confirmed
  w = injectMA(w, cmd("NEW", 270)); // command straight at the threat
  return stepUntil(w, (x) => x.log.some((e) => e.type === "MA_FaultMT"));
}

describe("collision interrupt", () => {
  it("raises a CAUTION MA_FaultMT and takes the aircraft when the vector enters a threat", () => {
    const w = flyIntoThreat();
    expect(w.fa.collisionFault).toBe("T");
    const fault = w.log.find((e) => e.type === "MA_FaultMT");
    expect(fault).toBeDefined();
    expect((fault!.payload as { Severity?: string }).Severity).toBe("CAUTION");
  });

  it("rejects a re-issued dangerous vector with VIOLATION_AIR_TRAFFIC (hold persists)", () => {
    let w = flyIntoThreat();
    w = injectMA(w, cmd("UPDATE", 270)); // still pointing into the threat
    w = stepUntil(w, (x) => (lastCmdStatus(x)?.payload as { CommandProcessingState?: string })?.CommandProcessingState === "REJECTED");
    const rej = lastCmdStatus(w)!;
    expect((rej.payload as { CommandProcessingState?: string }).CommandProcessingState).toBe("REJECTED");
    expect((rej.payload as { ValidationResult?: string }).ValidationResult).toBe("VIOLATION_AIR_TRAFFIC");
    expect(w.fa.collisionFault).toBe("T"); // not released
  });

  it("accepts a clear vector and hands control back (releases the hold)", () => {
    let w = flyIntoThreat();
    w = injectMA(w, cmd("UPDATE", 180)); // turn due south — clear of the threat
    // The clear command releases the hold immediately (Phase B), before its ACCEPTED
    // status is delivered; check the state, then confirm the command was accepted.
    w = stepUntil(w, (x) => x.fa.collisionFault === null);
    expect(w.fa.collisionFault).toBeNull();
    w = stepUntil(w, (x) => (lastCmdStatus(x)?.payload as { CommandID?: string })?.CommandID === "CMD-1" && (lastCmdStatus(x)?.payload as { CommandProcessingState?: string })?.CommandProcessingState === "ACCEPTED");
    expect((lastCmdStatus(w)!.payload as { CommandProcessingState?: string }).CommandProcessingState).toBe("ACCEPTED");
  });

  it("a body without collisionLookaheadTicks never intervenes", () => {
    const calm: BodyProfile = { ...body, collisionLookaheadTicks: undefined };
    let w = initWorld(makeScenario(calm, { brain: null, level }));
    for (let i = 0; i < 10; i += 1) w = step(w);
    expect(w.fa.collisionFault).toBeNull();
    expect(w.log.some((e) => e.type === "MA_FaultMT")).toBe(false);
  });
});
