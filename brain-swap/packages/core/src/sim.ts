// The simulation orchestrator. `step(world): World` is a pure function over the
// immutable world (docs/04). Fixed per-tick order:
//   A. FA advances any PENDING control approvals (emitted from prior ticks).
//   B. Deliver due bus messages → FA validates / the brain reacts → outbound enqueued.
//   C. FA periodic vehicle-state publication.
//   D. Vehicle integrates one tick.
//   E. Level win/fail evaluation.
// Same scenario ⇒ identical message log, scores, and replay (CLAUDE.md rule #3).
import { enqueueAll, takeDue } from "./bus.ts";
import { reactToMessage } from "./brain/interpreter.ts";
import { faAdvanceApprovals, faHandleInbound, faPublish } from "./fa/engine.ts";
import { evaluateWin } from "./level/runtime.ts";
import { DELIVERED, type Message, type MessageLogEntry, msg } from "./types.ts";
import { integrate } from "./vehicle/pointmass.ts";
import type { Outcome, Scenario, World } from "./world.ts";

/** Capability fields exposed to brain `cap.*` references. */
function capContext(scenario: Scenario): Record<string, unknown> {
  const levelCapId = scenario.level?.capabilityId;
  const bodyCap = scenario.body.capabilities.find((c) => c.id === levelCapId) ?? scenario.body.capabilities[0];
  const capId = bodyCap?.id ?? levelCapId ?? '';
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
  const { body } = scenario;
  const tick = world.tick + 1;

  let bus = world.bus;
  let fa = world.fa;
  let vehicle = world.vehicle;
  let ma = world.ma;
  const log: MessageLogEntry[] = [...world.log];

  // Phase A — advance pending approvals from earlier ticks.
  const adv = faAdvanceApprovals(fa);
  fa = adv.fa;
  bus = enqueueAll(bus, adv.outbound, tick);

  // Phase B — deliver due messages.
  const taken = takeDue(bus, tick);
  bus = taken.bus;
  const cap = capContext(scenario);
  for (const q of taken.due) {
    const m = q.message;
    if (m.to === "FA") {
      const res = faHandleInbound(body, fa, m);
      fa = res.fa;
      if (res.targetUpdate !== undefined) vehicle = { ...vehicle, target: res.targetUpdate };
      bus = enqueueAll(bus, res.outbound, tick);
      log.push(entry(tick, m, res.disposition));
    } else {
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

  // Phase D — integrate the vehicle one tick.
  vehicle = integrate(vehicle, body.flight);

  // Phase E — level win/fail.
  let outcome: Outcome = world.outcome;
  let holdTicks = world.holdTicks;
  let waypointIndex = world.waypointIndex;
  if (scenario.level) {
    const wc = evaluateWin(scenario.level, vehicle, fa, { holdTicks, waypointIndex });
    holdTicks = wc.holdTicks;
    waypointIndex = wc.waypointIndex;
    if (wc.won) outcome = "won";
    else if (tick >= scenario.level.maxTicks) outcome = "failed";
  }

  return { scenario, tick, bus, log, fa, vehicle, ma, outcome, holdTicks, waypointIndex };
}

function entry(tick: number, m: Message, disposition: MessageLogEntry["disposition"]): MessageLogEntry {
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
 * (delivered next tick). Used by golden-log tests to drive FA without a brain.
 */
export function injectMA(world: World, message: Message): World {
  return { ...world, bus: enqueueAll(world.bus, [message], world.tick) };
}

// Re-export the message builder for test ergonomics.
export { msg };
