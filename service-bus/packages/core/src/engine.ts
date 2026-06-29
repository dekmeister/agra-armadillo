/**
 * The engine: the whole game is `tick(state) -> state'` plus `apply(state, action)`,
 * both pure functions. No DOM, no wall-clock, no ambient RNG — the only randomness
 * is the seeded Rng reconstructed from `state.rngState` each tick. Given the same
 * (scenario, seed) and the same action schedule, the run is byte-identical.
 *
 * Tick pipeline:
 *   1. fire the scripted contingency (QB->ACP-1 goes BAD)
 *   2. step every link's Gilbert-Elliott channel
 *   3. resolve arrivals (EXECUTING -> SENT / FAIL_MISSING_ACK; advance relay hops)
 *   4. generate scheduled demand (COP fan-out, background C2)
 *   5. dispatch from queues under each link's policy (PENDING -> EXECUTING / FAIL_UNSENT)
 *   6. decay COP + breach check
 *   7. evaluate objective / outcome (win / loss)
 */
import { blockProb, dispatchOrder, stepChannel } from "./link.ts";
import { dequeue, enqueue, makeMsgId } from "./message.ts";
import { adjudicateApproval, isTargetAuthority } from "./rbac.ts";
import { Rng } from "./rng.ts";
import { buildPhase6, ROUTINE_BACKLOG, type ScenarioOpts } from "./scenario.ts";
import type {
  Action,
  GameState,
  Interaction,
  LogEntry,
  Message,
  MessageType,
  SimNode,
} from "./types.ts";

const COP_REFRESH = 96;

/** Build the initial Phase-6 state and seed the opening demand. */
export function createInitialState(seed: number, opts: ScenarioOpts = {}): GameState {
  const s = buildPhase6(seed, opts);

  // Pre-seed routine C2 backlog on the (about-to-go-BAD) reply link so that FIFO
  // spends its scarce GOOD windows on routine traffic and starves the deadline-
  // critical reply, while EDF/Class float the reply to the front. [S] routine = C2.
  for (let i = 0; i < ROUTINE_BACKLOG; i++) {
    spawn(s, {
      type: "MA_RulesOfEngagementCommandMT",
      cls: "C2",
      route: ["bad"],
      leg: "oneway",
      priority: 0,
    });
  }

  // The headline interaction: strike approval request ACP-1 -> QB.
  spawnStrikeRequest(s);
  return s;
}

/** Apply a player action purely. UI selection state is NOT modeled here. */
export function apply(state: GameState, action: Action): GameState {
  const s = clone(state);
  switch (action.type) {
    case "arm": {
      if (!s.armed) {
        s.armed = true;
        s.wezDeadlineTick = s.tick + s.config.wezWindow;
        stampReplyDeadline(s);
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
    case "reroute":
      rerouteReply(s);
      break;
    case "rerequest":
      rerequestStrike(s);
      break;
    case "refreshCop":
      s.cop = COP_REFRESH;
      log(s, "COP refreshed via P2P picture sync · age 0s", "success");
      break;
  }
  return s;
}

/** Advance the simulation one tick. Pure. */
export function tick(state: GameState): GameState {
  const s = clone(state);
  const rng = new Rng(s.rngState);
  s.tick += 1;

  fireContingency(s);
  for (const link of Object.values(s.links)) stepChannel(link, rng);
  resolveArrivals(s, rng);
  generateDemand(s);
  dispatchQueues(s, rng);
  decayCop(s);
  evaluateOutcome(s);

  s.rngState = rng.state;
  return s;
}

// ---------------------------------------------------------------------------
// Tick stages
// ---------------------------------------------------------------------------

function fireContingency(s: GameState): void {
  const bad = s.links.bad;
  if (!bad) return;
  if (s.tick === s.config.contingencyTick) {
    // Degrade the reply link: drop into a BAD burst and make it genuinely bursty
    // (short GOOD windows, long BAD bursts) with elevated unconfirmed-delivery.
    bad.channel = "BAD";
    bad.pGoodToBad = 0.45;
    bad.pBadToGood = 0.12;
    bad.ackLoss = 0.15;
    log(s, "QB→ACP-1 return link degraded — bursty/lossy (BAD).", "degrade");
  }
}

function resolveArrivals(s: GameState, rng: Rng): void {
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
      onLegFailed(s, msg);
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
      onDelivered(s, msg);
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

function generateDemand(s: GameState): void {
  // P2P COP fan-out from the leader to peers (one-to-many) — keeps the picture fresh.
  if (s.tick % s.config.copSyncPeriod === 0) {
    spawn(s, { type: "MA_SynchronizeGlobalCopToPeer", cls: "P2P", route: ["p2p"], leg: "oneway" });
    spawn(s, { type: "MA_SynchronizeGlobalCopToPeer", cls: "P2P", route: ["p2p3"], leg: "oneway" });
  }
  // Light routine C2 regen so the reply link stays congested/visible (newer seq,
  // so it never jumps ahead of the reply — purely keeps the queue populated).
  const bad = s.links.bad;
  if (bad && s.tick % s.config.bgC2Period === 0 && bad.queue.length < 7) {
    spawn(s, {
      type: "MA_RulesOfEngagementCommandMT",
      cls: "C2",
      route: ["bad"],
      leg: "oneway",
      priority: 0,
    });
  }
}

function decayCop(s: GameState): void {
  s.cop = Math.max(8, Math.round((s.cop - s.config.copDecay) * 10) / 10);
  if (s.cop < s.copThreshold) s.copBreached = true;
}

function evaluateOutcome(s: GameState): void {
  if (s.outcome !== "pending") return;
  const ixn = activeStrike(s);
  if (!ixn) return;
  const reply = ixn.reply ? s.messages[ixn.reply] : null;

  // Running objective for the UI: a created-but-undelivered reply reads as stalled.
  s.objective = reply && reply.state !== "SENT" ? "stalled" : "in_progress";

  if (reply && reply.state === "SENT") {
    if (reply.approval === "REJECTED" || !reply.authorityVerified) {
      fail(s, "approval REJECTED — request reached a non-authority (arrival ≠ authority)");
      return;
    }
    if (s.copBreached) {
      fail(s, "COP freshness breached during engagement");
      return;
    }
    s.outcome = "win";
    s.objective = "complete";
    ixn.status = "delivered";
    s.score += s.config.scoreWin;
    log(s, "reply ACK received · QB authority verified", "success");
    log(s, "MA_ApprovalRequestStatusMT SENT — strike approval complete.", "success");
    return;
  }

  if (s.armed && s.wezDeadlineTick !== null && s.tick > s.wezDeadlineTick) {
    s.score -= s.config.scoreMiss;
    fail(s, "WEZ window closed before reply was confirmed");
  }
}

// ---------------------------------------------------------------------------
// Interaction / message lifecycle effects
// ---------------------------------------------------------------------------

function onDelivered(s: GameState, msg: Message): void {
  if (msg.type === "MA_SynchronizeGlobalCopToPeer") {
    s.cop = Math.max(s.cop, COP_REFRESH);
    return;
  }
  if (msg.type === "MA_ApprovalRequestMT" && msg.ixn) {
    // RBAC adjudication happens at the destination — arrival ≠ effect.
    const ixn = s.interactions[msg.ixn];
    const destRole = destNode(s, msg)?.role ?? "Observer";
    const status = adjudicateApproval(destRole);
    if (ixn) {
      ixn.status = status === "APPROVED" ? "approved" : "rejected";
      spawnReply(s, ixn, status, isTargetAuthority(destRole));
    }
    return;
  }
}

function onLegFailed(s: GameState, msg: Message): void {
  // The mission-critical approval reply auto-retries (the system keeps trying);
  // routine fire-and-forget traffic just drops.
  if (msg.leg === "reply" && activeStrike(s)) {
    msg.state = "PENDING";
    const linkId = msg.route[msg.hop];
    if (linkId) s.links[linkId]?.queue.push(msg.id);
    log(s, "reply MISSING_ACK — sent, unconfirmed. Re-attempting.", "degrade");
  }
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------

interface SpawnSpec {
  type: MessageType;
  cls: Message["cls"];
  route: string[];
  leg: Message["leg"];
  ixn?: string | null;
  priority?: number;
  deadlineTick?: number | null;
  approval?: Message["approval"];
  authorityVerified?: boolean;
}

function spawn(s: GameState, spec: SpawnSpec): Message {
  const seq = s.nextSeq++;
  const msg: Message = {
    id: makeMsgId(
      spec.type === "MA_ApprovalRequestStatusMT" ? "reply" : spec.cls.toLowerCase(),
      seq,
    ),
    type: spec.type,
    cls: spec.cls,
    ixn: spec.ixn ?? null,
    leg: spec.leg,
    state: "PENDING",
    route: spec.route,
    hop: 0,
    seq,
    priority: spec.priority ?? 1,
    deadlineTick: spec.deadlineTick ?? null,
    approval: spec.approval ?? null,
    authorityVerified: spec.authorityVerified ?? false,
  };
  enqueue(s, msg);
  return msg;
}

function spawnStrikeRequest(s: GameState): Interaction {
  const id = `ixn-${s.nextSeq}`;
  const req = spawn(s, {
    type: "MA_ApprovalRequestMT",
    cls: "C2",
    route: ["req"],
    leg: "request",
    ixn: id,
    priority: 2,
  });
  const ixn: Interaction = {
    id,
    kind: "strike-approval",
    request: req.id,
    reply: null,
    status: "open",
  };
  s.interactions[id] = ixn;
  log(s, "MA_ApprovalRequestMT issued — ACP-1 → QB (strike approval).", "info");
  return ixn;
}

function spawnReply(
  s: GameState,
  ixn: Interaction,
  status: "APPROVED" | "REJECTED",
  authorityVerified: boolean,
): void {
  const reply = spawn(s, {
    type: "MA_ApprovalRequestStatusMT",
    cls: "C2",
    route: ["bad"],
    leg: "reply",
    ixn: ixn.id,
    priority: 3, // outranks routine C2 under the `class` policy
    deadlineTick: s.wezDeadlineTick,
    approval: status,
    authorityVerified,
  });
  ixn.reply = reply.id;
  log(
    s,
    status === "APPROVED"
      ? "QB authorised — MA_ApprovalRequestStatusMT(APPROVED) en route → ACP-1."
      : "QB role check FAILED at destination — MA_ApprovalRequestStatusMT(REJECTED).",
    status === "APPROVED" ? "info" : "fail",
  );
}

// ---------------------------------------------------------------------------
// Recovery actions
// ---------------------------------------------------------------------------

function rerouteReply(s: GameState): void {
  const reply = openReply(s);
  if (!reply) return;
  // Pull it off whatever it's on (queue or in flight) and send it via the relay.
  for (const link of Object.values(s.links)) dequeue(s, reply.id, link.id);
  s.inFlight = s.inFlight.filter((f) => f.msg !== reply.id);
  reply.route = ["relayQbAcp2", "relayAcp2Acp1"];
  reply.hop = 0;
  reply.state = "PENDING";
  s.links.relayQbAcp2?.queue.push(reply.id);
  log(s, "Reply rerouted QB → ACP-2 → ACP-1 via ACP-2's DMS.", "info");
}

function rerequestStrike(s: GameState): void {
  const ixn = activeStrike(s);
  if (ixn) ixn.status = "failed";
  // A fresh round trip — note this re-routes onto the same BAD link unless also
  // rerouted/reprioritised (the lesson: re-request alone doesn't fix routing).
  spawnStrikeRequest(s);
  if (s.armed) s.wezDeadlineTick = s.tick + s.config.wezWindow;
  log(s, "Strike approval re-requested (fresh interaction).", "info");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function activeStrike(s: GameState): Interaction | null {
  const ixns = Object.values(s.interactions).filter((i) => i.status !== "failed");
  return ixns[ixns.length - 1] ?? null;
}

function openReply(s: GameState): Message | null {
  const ixn = activeStrike(s);
  if (!ixn?.reply) return null;
  const reply = s.messages[ixn.reply];
  return reply && reply.state !== "SENT" ? reply : null;
}

function stampReplyDeadline(s: GameState): void {
  const reply = openReply(s);
  if (reply) reply.deadlineTick = s.wezDeadlineTick;
}

function destNode(s: GameState, msg: Message): SimNode | undefined {
  const lastLink = s.links[msg.route[msg.route.length - 1] ?? ""];
  return lastLink ? s.nodes[lastLink.to] : undefined;
}

function fail(s: GameState, reason: string): void {
  s.outcome = "loss";
  s.objective = "missed";
  s.failReason = reason;
  const ixn = activeStrike(s);
  if (ixn) ixn.status = "failed";
  log(s, `reply FAILED — ${reason}.`, "fail");
}

function log(s: GameState, text: string, severity: LogEntry["severity"]): void {
  s.log.push({ tick: s.tick, text, severity });
}

function clone(s: GameState): GameState {
  return structuredClone(s);
}

// structuredClone is a host global (Node 17+ / browsers); declared here so the
// core stays free of @types/node and DOM libs (tsconfig `types: []`).
declare function structuredClone<T>(value: T): T;
