/**
 * The engine: the whole game is `tick(state) -> state'` plus `apply(state, action)`,
 * both pure functions. No DOM, no wall-clock, no ambient RNG — the only randomness
 * is the seeded Rng reconstructed from `state.rngState` each tick. Given the same
 * (scenario, seed) and the same action schedule, the run is byte-identical.
 *
 * The engine is scenario-agnostic: it owns the generic mechanics and delegates every
 * level-specific decision to the active ScenarioDef (resolved from `state.scenarioId`).
 *
 * Tick pipeline:
 *   1. fire the scenario's scripted contingency
 *   2. step every link's Gilbert-Elliott channel
 *   3. resolve arrivals (EXECUTING -> SENT / FAIL_MISSING_ACK; advance relay hops)
 *   4. generate the scenario's scheduled demand
 *   5. dispatch from queues under each link's policy (PENDING -> EXECUTING / FAIL_UNSENT)
 *   6. decay COP + breach check
 *   7. evaluate the scenario's objective / outcome (win / loss)
 */
import { blockProb, dispatchOrder, stepChannel } from "./link.ts";
import { dequeue } from "./message.ts";
import { Rng } from "./rng.ts";
import { clone, log } from "./runtime.ts";
import { getScenario, type ScenarioOpts } from "./scenario.ts";
import type { ScenarioDef } from "./scenario-def.ts";
import type { Action, GameState } from "./types.ts";

/** Build the initial state for a level (default Phase 6) and seed its opening demand. */
export function createInitialState(seed: number, opts: ScenarioOpts = {}): GameState {
  const def = getScenario(opts.scenarioId ?? "phase6");
  const s = def.build(seed, opts);
  s.scenarioId = def.id;
  def.seedDemand(s);
  return s;
}

/** Apply a player action purely. UI selection state is NOT modeled here. */
export function apply(state: GameState, action: Action): GameState {
  const s = clone(state);
  const def = getScenario(s.scenarioId);
  switch (action.type) {
    case "arm": {
      if (!s.armed) {
        s.armed = true;
        s.wezDeadlineTick = s.tick + s.config.wezWindow;
        def.onArm?.(s);
      }
      break;
    }
    case "setPolicy": {
      const link = s.links[action.linkId];
      if (link) {
        link.policy = action.policy;
        log(s, `${action.linkId} queue policy -> ${action.policy.toUpperCase()}`, "info");
      }
      break;
    }
    case "acknowledgeBeat":
      // Dismiss the current decision point; the view resumes the clock. Pure —
      // touches no RNG, so the run stays byte-identical to a headless replay.
      s.pendingBeat = null;
      break;
    default:
      // Scenario-specific affordances (reroute, refreshCop, retry, …).
      def.applyAction?.(s, action);
      break;
  }
  return s;
}

/** Advance the simulation one tick. Pure. */
export function tick(state: GameState): GameState {
  const s = clone(state);
  const rng = new Rng(s.rngState);
  s.tick += 1;
  const def = getScenario(s.scenarioId);

  def.fireContingency?.(s);
  for (const link of Object.values(s.links)) stepChannel(link, rng);
  resolveArrivals(s, rng, def);
  def.generateDemand?.(s);
  dispatchQueues(s, rng);
  decayCop(s);
  def.checkStandingBeats?.(s);
  def.evaluateOutcome(s);
  // A decided run has no decision left to make — clear any beat so it never
  // lingers over the debrief.
  if (s.outcome !== "pending") s.pendingBeat = null;

  s.rngState = rng.state;
  return s;
}

// ---------------------------------------------------------------------------
// Generic tick stages (scenario-independent)
// ---------------------------------------------------------------------------

function resolveArrivals(s: GameState, rng: Rng, def: ScenarioDef): void {
  const arriving = s.inFlight.filter((f) => f.arrivalTick === s.tick);
  s.inFlight = s.inFlight.filter((f) => f.arrivalTick !== s.tick);

  for (const f of arriving) {
    const msg = s.messages[f.msg];
    const link = s.links[f.link];
    if (!msg || !link) continue;

    // Delivery confirmation roll: the message left the queue but the ack may be
    // lost — "sent, unconfirmed" — independent of the burst that gates throughput.
    if (rng.chance(link.ackLoss)) {
      msg.state = "FAIL_MISSING_ACK";
      def.onLegFailed?.(s, msg);
      continue;
    }

    // Confirmed this hop. Advance relay hops or deliver end-to-end.
    if (msg.hop < msg.route.length - 1) {
      msg.hop += 1;
      msg.state = "PENDING";
      const next = msg.route[msg.hop];
      if (next) s.links[next]?.queue.push(msg.id);
    } else {
      msg.state = "SENT";
      def.onDelivered?.(s, msg);
    }
  }
}

function dispatchQueues(s: GameState, rng: Rng): void {
  for (const link of Object.values(s.links)) {
    let budget = link.bandwidthCap;
    for (const msgId of dispatchOrder(link, s.messages)) {
      if (budget <= 0) break;
      const msg = s.messages[msgId];
      if (!msg) continue;
      if (msg.state !== "PENDING") continue;
      budget -= 1;

      if (rng.chance(blockProb(link))) {
        // Couldn't get on the air this tick (bursty channel) — stays queued.
        msg.state = "FAIL_UNSENT";
        continue;
      }
      msg.state = "EXECUTING";
      dequeue(s, msg.id, link.id);
      s.inFlight.push({ msg: msg.id, link: link.id, arrivalTick: s.tick + link.latency });
    }
    // FAIL_UNSENT messages remain PENDING-in-queue for next tick.
    for (const id of link.queue) {
      const m = s.messages[id];
      if (m && m.state === "FAIL_UNSENT") m.state = "PENDING";
    }
  }
}

/** COP freshness decay. No-op for levels that don't use COP (copThreshold <= 0). */
function decayCop(s: GameState): void {
  s.cop = Math.max(8, Math.round((s.cop - s.config.copDecay) * 10) / 10);
  if (s.copThreshold > 0 && s.cop < s.copThreshold) s.copBreached = true;
}
