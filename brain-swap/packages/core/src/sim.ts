// The simulation orchestrator. `step(world): World` is a pure function over the
// immutable world (docs/04). Fixed per-tick order:
//   A.  FA advances any PENDING control approvals (emitted from prior ticks).
//   A′. Deterministic mission events scheduled for this tick fire (envelope degrade,
//       capability pull, threat spawn) — before inbound, so this tick's MA commands
//       are validated against the new envelope.
//   B.  Deliver due bus messages → FA validates / the brain reacts → outbound enqueued.
//   C.  FA periodic vehicle-state publication.
//   D.  Vehicle integrates one tick.
//   E.  Level win/fail evaluation.
// Same scenario ⇒ identical message log, scores, and replay (CLAUDE.md rule #3).

import { reactToMessage } from "./brain/interpreter.ts";
import { enqueueAll, takeDue } from "./bus.ts";
import { faAdvanceApprovals, faCollisionCheck, faHandleInbound, faPublish } from "./fa/engine.ts";
import { advanceThreats, applyEvents } from "./level/events.ts";
import { msAdvanceState, msCountDeliveredEntity, msHandleInbound, msPublish } from "./ms/engine.ts";
import { evaluateWin } from "./level/runtime.ts";
import { DELIVERED, type Message, type MessageLogEntry, msg } from "./types.ts";
import { integrate } from "./vehicle/pointmass.ts";
import { initWorld, type Outcome, type Scenario, type World } from "./world.ts";

/** Capability fields exposed to brain `cap.*` references. */
function capContext(scenario: Scenario): Record<string, unknown> {
  const levelCapId = scenario.level?.capabilityId;
  const bodyCap =
    scenario.body.capabilities.find((c) => c.id === levelCapId) ?? scenario.body.capabilities[0];
  const capId = bodyCap?.id ?? levelCapId ?? "";
  const profile = bodyCap?.profile;
  return {
    CapabilityID: capId,
    ...(profile?.minAltitude !== undefined ? { MinAltitude: profile.minAltitude } : {}),
    ...(profile?.maxAltitude !== undefined ? { MaxAltitude: profile.maxAltitude } : {}),
    ...(profile?.minAirspeed !== undefined ? { MinAirspeed: profile.minAirspeed } : {}),
    ...(profile?.maxAirspeed !== undefined ? { MaxAirspeed: profile.maxAirspeed } : {}),
  };
}

export function step(world: World): World {
  if (world.outcome !== "running") return world;

  const { scenario } = world;
  const { body, msBody } = scenario;
  const tick = world.tick + 1;

  let bus = world.bus;
  let fa = world.fa;
  let ms = world.ms;
  let vehicle = world.vehicle;
  let ma = world.ma;
  let threats = world.threats;
  let dynamicEnvelope = world.dynamicEnvelope;
  const log: MessageLogEntry[] = [...world.log];

  // Phase A — advance pending approvals from earlier ticks.
  const adv = faAdvanceApprovals(fa);
  fa = adv.fa;
  bus = enqueueAll(bus, adv.outbound, tick);

  // Phase A (MS) — apply each subsystem's deterministic state timeline for this tick.
  if (msBody && ms) ms = msAdvanceState(msBody, ms, tick);

  // Phase A′ — fire mission events scheduled for this tick. Updates the envelope /
  // availability / threat overlay before inbound so this tick's commands see it.
  const ev = applyEvents(scenario.level?.events, tick, {
    body,
    fa,
    overlay: { dynamicEnvelope, threats },
  });
  fa = ev.fa;
  dynamicEnvelope = ev.overlay.dynamicEnvelope;
  threats = ev.overlay.threats;
  bus = enqueueAll(bus, ev.outbound, tick);

  // Phase B — deliver due messages.
  const taken = takeDue(bus, tick);
  bus = taken.bus;
  const cap = capContext(scenario);
  for (const q of taken.due) {
    const m = q.message;
    if (m.to === "FA") {
      const res = faHandleInbound(body, fa, m, dynamicEnvelope, vehicle, threats);
      fa = res.fa;
      if (res.targetUpdate !== undefined) vehicle = { ...vehicle, target: res.targetUpdate };
      bus = enqueueAll(bus, res.outbound, tick);
      log.push(entry(tick, m, res.disposition));
    } else if (m.to === "MS" && msBody && ms) {
      const res = msHandleInbound(msBody, ms, m, tick);
      ms = res.ms;
      bus = enqueueAll(bus, res.outbound, tick);
      log.push(entry(tick, m, res.disposition));
    } else {
      // Delivered to MA. Count any MS sensor track toward the ms-track objective here, so
      // the win reflects tracks *received* (in the log), not merely emitted by MS.
      if (m.type === "EntityMT" && ms) ms = msCountDeliveredEntity(ms);
      if (scenario.brain && ma.brainState !== null) {
        const reaction = reactToMessage(scenario.brain, ma.brainState, m, cap);
        ma = { brainState: reaction.nextState };
        bus = enqueueAll(bus, reaction.outbound, tick);
      }
      log.push(entry(tick, m, DELIVERED));
    }
  }

  // Phase C — FA periodic publication.
  const pub = faPublish(body, fa, vehicle);
  fa = pub.fa;
  bus = enqueueAll(bus, pub.outbound, tick);

  // Phase C (MS) — heartbeat + time-driven MS emissions (sensor activity/tracks, strike
  // consent/activity, faults). `vehicle` is this tick's pre-integration position, read by
  // the 3.4 DLZ geometry gate.
  if (msBody && ms) {
    const msPub = msPublish(msBody, ms, tick, vehicle);
    ms = msPub.ms;
    bus = enqueueAll(bus, msPub.outbound, tick);
  }

  // Phase C′ — collision-avoidance interrupt (CAUTION fault + fly-away override).
  const col = faCollisionCheck(body, fa, vehicle, threats);
  fa = col.fa;
  if (col.targetOverride !== undefined) vehicle = { ...vehicle, target: col.targetOverride };
  bus = enqueueAll(bus, col.outbound, tick);

  // Phase D — integrate the vehicle one tick (burns fuel on fuel-bearing bodies);
  // advance any moving threats by their velocity.
  vehicle = integrate(vehicle, body.flight, body.fuel);
  threats = advanceThreats(threats);

  // Phase E — level win/fail.
  let outcome: Outcome = world.outcome;
  let holdTicks = world.holdTicks;
  let waypointIndex = world.waypointIndex;
  if (scenario.level) {
    const wc = evaluateWin(scenario.level, vehicle, fa, ms, { holdTicks, waypointIndex }, threats);
    holdTicks = wc.holdTicks;
    waypointIndex = wc.waypointIndex;
    const fuelOut = vehicle.fuel !== undefined && vehicle.fuel <= 0;
    // Priority: a breach fails immediately; else a win; else running dry; else budget.
    if (wc.failed) outcome = "failed";
    else if (wc.won) outcome = "won";
    else if (fuelOut) outcome = "failed";
    else if (tick >= scenario.level.maxTicks) outcome = "failed";
  }

  return {
    scenario,
    tick,
    bus,
    log,
    fa,
    ms,
    vehicle,
    ma,
    outcome,
    holdTicks,
    waypointIndex,
    threats,
    dynamicEnvelope,
  };
}

function entry(
  tick: number,
  m: Message,
  disposition: MessageLogEntry["disposition"],
): MessageLogEntry {
  return { tick, from: m.from, to: m.to, type: m.type, payload: m.payload, disposition };
}

/** Step until terminal or `maxSteps` reached. Returns the final world. */
export function run(world: World, maxSteps: number): World {
  let w = world;
  for (let i = 0; i < maxSteps && w.outcome === "running"; i += 1) {
    w = step(w);
  }
  return w;
}

/**
 * Enqueue a scripted MA→FA message into the world's bus at the current tick
 * (delivered next tick). Used by golden-log tests, the realtime player session,
 * and `replayScript` to drive FA without a brain.
 */
export function injectMA(world: World, message: Message): World {
  return { ...world, bus: enqueueAll(world.bus, [message], world.tick) };
}

/**
 * One recorded MA→FA input in a realtime (player-driven) session: the message and
 * the tick at which the player committed it — enqueued at that tick, delivered the
 * following tick (the honest 1-tick latency). An ordered list of these fully
 * describes a session; replaying it reproduces an identical run (CLAUDE.md rule #3).
 */
export interface ScriptedInput {
  readonly tick: number;
  readonly message: Message;
}

/**
 * Replay a recorded input script headlessly. At each tick, every input committed
 * at that tick is injected (via injectMA) before the world steps. Returns the full
 * frame list (index === tick) — the brainless, human-session analogue of
 * buildTimeline. Deterministic: same scenario + script ⇒ identical frames. The
 * realtime UI advances the live edge with the same inject-then-step order, so a
 * session and its replay agree exactly.
 */
export function replayScript(
  scenario: Scenario,
  script: readonly ScriptedInput[],
  maxSteps: number,
): World[] {
  const frames: World[] = [initWorld(scenario)];
  let w = frames[0]!;
  while (w.outcome === "running" && w.tick < maxSteps) {
    for (const input of script) {
      if (input.tick === w.tick) w = injectMA(w, input.message);
    }
    w = step(w);
    frames.push(w);
  }
  return frames;
}

/**
 * Derive the input script implied by a finished timeline: every MA→FA delivery,
 * back-dated to the tick it was enqueued (delivered tick − 1). Lets a reference
 * brain double as a realtime reference solution — golden tests extract a script
 * from a brain run, then `replayScript` it to prove the same level is solvable by
 * hand. (Within-tick ordering of an MA send vs an FA publication may differ from
 * the brain run, so the replay log is byte-stable but not byte-identical to it;
 * the FA decisions, MA sends, outcome, and score are identical.)
 */
export function extractScript(timeline: readonly World[]): ScriptedInput[] {
  const final = timeline[timeline.length - 1];
  if (!final) return [];
  const out: ScriptedInput[] = [];
  for (const e of final.log) {
    if (e.from === "MA") {
      out.push({
        tick: e.tick - 1,
        message: { type: e.type, from: e.from, to: e.to, payload: e.payload } as Message,
      });
    }
  }
  return out;
}

// Re-export the message builder for test ergonomics.
export { msg };
