/**
 * OV-1 Phase 6 — "Threat Engagement at CAP" — the MVP slice and the campaign's
 * composite peak. Everything the precursor levels teach in isolation (burst loss,
 * queue discipline, COP fan-out, the authority gate) converges here under a WEZ
 * deadline.
 *
 * Topology (no central DMS — each platform runs its OWN DMS instance; the OTA layer
 * is a DDS/RTPS pub-sub mesh, no central broker):
 *   QB (Target Authority) ── ACP-1 (package leader) ── ACP-2, ACP-3
 *
 * Interfaces in play: C2 (the gated strike-approval round trip) + P2P (COP keep-alive
 * fan-out among the ACPs). Only these + the MS reroute path cross the contested air;
 * VI / local sensor reads are on-platform and reliable, hence absent here. Every OTA
 * hop already traverses two DMS instances (sender + receiver); a "relay" is simply a
 * second path through *another platform's* DMS.
 *
 * Links (directed — A->B != B->A):
 *   req           ACP-1 -> QB     C2    GOOD  (approval request path)
 *   bad           QB -> ACP-1     C2    flips BAD at the contingency (the reply path)
 *   p2p           ACP-1 -> ACP-2  P2P   GOOD  (COP fan-out)
 *   p2p3          ACP-1 -> ACP-3  P2P   GOOD  (COP fan-out)
 *   relayQbAcp2   QB -> ACP-2     MS    GOOD  (reroute hop 1, via ACP-2's DMS)
 *   relayAcp2Acp1 ACP-2 -> ACP-1  MS    GOOD  (reroute hop 2, via ACP-2's DMS)
 *
 * [S] Background C2 on `bad` is routine command traffic (MA_RulesOfEngagementCommandMT),
 *     kept C2-only to honour the topology guard rail (see docs/01).
 */
import { dequeue } from "../message.ts";
import { adjudicateApproval, isTargetAuthority } from "../rbac.ts";
import { destNode, log, mkLink, mkNode, raiseBeat, spawn } from "../runtime.ts";
import type { ScenarioDef, ScenarioOpts } from "../scenario-def.ts";
import type { Beat, GameState, Interaction, Link, Message, SimNode } from "../types.ts";

const COP_REFRESH = 96;
/** COP must be within this band of the breach threshold to raise the COP-watch beat. */
const COP_WARN_BAND = 12;
/** Routine C2 messages pre-seeded ahead of the reply on the BAD link. */
export const ROUTINE_BACKLOG = 6;

export const DEFAULT_CONFIG = {
  seed: 1,
  mode: "tutorial" as const,
  wezWindow: 18,
  contingencyTick: 2,
  copDecay: 0.4,
  copStart: 62,
  copThreshold: 25,
  copSyncPeriod: 6,
  bgC2Period: 4,
};

/**
 * The clamped tutorial seed. On this seed the paused-decision flow is deterministic:
 * do-nothing raises all three beats and LOSES, while EDF / Class / reroute each WIN
 * and the re-request trap loses — so the lesson always lands. Locked by
 * test/tutorial-seed.test.ts; changing scenario balance must re-find it.
 */
export const TUTORIAL_SEED = 1412;

/** Back-compat factory (re-exported from scenario.ts and @service-bus/core). */
export function buildPhase6(seed: number, opts: ScenarioOpts = {}): GameState {
  return phase6.build(seed, opts);
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

function fail(s: GameState, reason: string): void {
  s.outcome = "loss";
  s.objective = "missed";
  s.failReason = reason;
  const ixn = activeStrike(s);
  if (ixn) ixn.status = "failed";
  log(s, `reply FAILED — ${reason}.`, "fail");
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

function rerouteReply(s: GameState): void {
  const reply = openReply(s);
  if (!reply) return;
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
  spawnStrikeRequest(s);
  if (s.armed) s.wezDeadlineTick = s.tick + s.config.wezWindow;
  log(s, "Strike approval re-requested (fresh interaction).", "info");
}

const BEAT_DEFS: Record<
  "link-degraded" | "queue-starved" | "missing-ack" | "cop-warning",
  Omit<Beat, "tick">
> = {
  "link-degraded": {
    id: "link-degraded",
    title: "QB→ACP-1 return link degraded (BAD)",
    summary:
      "QB→ACP-1 reply link dropped to a BAD burst — the C2 reply now risks loss over the air.",
    concept:
      "The approval reply (MA_ApprovalRequestStatusMT) rides C2 over the contested air. " +
      "A Gilbert–Elliott burst just dropped this OTA link into a BAD state — short GOOD " +
      "windows amid long lossy bursts. On-platform interfaces (VI, local sensors) are " +
      "unaffected; only C2 / P2P / MS cross the air.",
    focus: { kind: "link", id: "bad" },
    actions: [],
  },
  "queue-starved": {
    id: "queue-starved",
    title: "Approval reply starved behind routine C2",
    summary:
      "Under FIFO the approval reply is stuck behind routine C2 — re-order so it goes first.",
    concept:
      "Under FIFO the deadline-critical reply sits behind routine MA_RulesOfEngagementCommandMT " +
      "traffic, so it squanders the link's scarce GOOD windows. Change the queue discipline so " +
      "the reply floats to the front: Deadline (EDF) or Class (priority).",
    focus: { kind: "link", id: "bad" },
    actions: ["setPolicy"],
  },
  "missing-ack": {
    id: "missing-ack",
    title: "Reply FAIL_MISSING_ACK — sent, unconfirmed",
    summary: "Reply sent but never confirmed. Reroute around the BAD hop, or re-request (risky).",
    concept:
      "The reply left the queue but no delivery confirmation came back — the insidious " +
      "return-leg failure. Arrival ≠ approval: you cannot assume it landed. Reroute it around " +
      "the BAD hop via ACP-2's DMS, or re-request (which re-routes onto the same BAD link — " +
      "usually not enough on its own).",
    focus: { kind: "link", id: "bad" },
    actions: ["reroute", "rerequest"],
  },
  "cop-warning": {
    id: "cop-warning",
    title: "COP freshness approaching breach",
    summary: "The P2P COP picture is going stale — refresh it before it breaches.",
    concept:
      "While you fight the C2 reply, the P2P COP fan-out is going stale. A-GRA assesses the " +
      "shared picture too — don't starve it to save the strike. Push a COP refresh over P2P.",
    focus: { kind: "link", id: "p2p" },
    actions: ["refreshCop"],
  },
};

// ---------------------------------------------------------------------------
// The descriptor
// ---------------------------------------------------------------------------

export const phase6: ScenarioDef = {
  id: "phase6",
  phase: 6,
  title: "Threat Engagement at CAP",
  defaultConfig: DEFAULT_CONFIG,
  tutorialSeed: TUTORIAL_SEED, // 1412 — the clamped MVP seed (see test/tutorial-seed.test.ts)
  beats: BEAT_DEFS,

  build(seed, opts = {}) {
    const config = { ...DEFAULT_CONFIG, ...opts.config, seed };

    const nodes: Record<string, SimNode> = {
      qb: mkNode("qb", "QB", opts.qbRole ?? "QB", "QB"),
      acp1: mkNode("acp1", "ACP", "AVC", "ACP-1", true),
      acp2: mkNode("acp2", "ACP", "Observer", "ACP-2"),
      acp3: mkNode("acp3", "ACP", "AVC", "ACP-3"),
    };

    const links: Record<string, Link> = {
      req: mkLink({ id: "req", from: "acp1", to: "qb", cls: "C2" }),
      bad: mkLink({ id: "bad", from: "qb", to: "acp1", cls: "C2" }),
      p2p: mkLink({ id: "p2p", from: "acp1", to: "acp2", cls: "P2P" }),
      p2p3: mkLink({ id: "p2p3", from: "acp1", to: "acp3", cls: "P2P" }),
      relayQbAcp2: mkLink({ id: "relayQbAcp2", from: "qb", to: "acp2", cls: "MS", latency: 2 }),
      relayAcp2Acp1: mkLink({
        id: "relayAcp2Acp1",
        from: "acp2",
        to: "acp1",
        cls: "MS",
        latency: 2,
      }),
    };

    return {
      scenarioId: "phase6",
      tick: 0,
      rngState: seed >>> 0,
      nodes,
      links,
      messages: {},
      interactions: {},
      inFlight: [],
      cop: config.copStart,
      copThreshold: config.copThreshold,
      copBreached: false,
      wezDeadlineTick: null,
      armed: false,
      objective: "stalled",
      outcome: "pending",
      failReason: null,
      pendingBeat: null,
      seenBeats: [],
      log: [
        { tick: 0, text: "Phase 6 — Threat Engagement at CAP. COP flowing.", severity: "info" },
      ],
      nextSeq: 0,
      config,
    };
  },

  seedDemand(s) {
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
    spawnStrikeRequest(s);
  },

  onArm(s) {
    const reply = openReply(s);
    if (reply) reply.deadlineTick = s.wezDeadlineTick;
  },

  applyAction(s, action) {
    switch (action.type) {
      case "reroute":
        rerouteReply(s);
        return true;
      case "rerequest":
        rerequestStrike(s);
        return true;
      case "refreshCop":
        s.cop = COP_REFRESH;
        log(s, "COP refreshed via P2P picture sync · age 0s", "success");
        return true;
      default:
        return false;
    }
  },

  fireContingency(s) {
    const bad = s.links.bad;
    if (!bad) return;
    if (s.tick === s.config.contingencyTick) {
      bad.channel = "BAD";
      bad.pGoodToBad = 0.45;
      bad.pBadToGood = 0.12;
      bad.ackLoss = 0.15;
      log(s, "QB→ACP-1 return link degraded — bursty/lossy (BAD).", "degrade");
      raiseBeat(s, phase6, "link-degraded");
    }
  },

  generateDemand(s) {
    if (s.tick % s.config.copSyncPeriod === 0) {
      spawn(s, {
        type: "MA_SynchronizeGlobalCopToPeer",
        cls: "P2P",
        route: ["p2p"],
        leg: "oneway",
      });
      spawn(s, {
        type: "MA_SynchronizeGlobalCopToPeer",
        cls: "P2P",
        route: ["p2p3"],
        leg: "oneway",
      });
    }
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
  },

  onDelivered(s, msg) {
    if (msg.type === "MA_SynchronizeGlobalCopToPeer") {
      s.cop = Math.max(s.cop, COP_REFRESH);
      return;
    }
    if (msg.type === "MA_ApprovalRequestMT" && msg.ixn) {
      const ixn = s.interactions[msg.ixn];
      const destRole = destNode(s, msg)?.role ?? "Observer";
      const status = adjudicateApproval(destRole);
      if (ixn) {
        ixn.status = status === "APPROVED" ? "approved" : "rejected";
        spawnReply(s, ixn, status, isTargetAuthority(destRole));
      }
    }
  },

  onLegFailed(s, msg) {
    if (msg.leg === "reply" && activeStrike(s)) {
      msg.state = "PENDING";
      const linkId = msg.route[msg.hop];
      if (linkId) s.links[linkId]?.queue.push(msg.id);
      log(s, "reply MISSING_ACK — sent, unconfirmed. Re-attempting.", "degrade");
      raiseBeat(s, phase6, "missing-ack", { kind: "token", id: msg.id });
    }
  },

  evaluateOutcome(s) {
    if (s.outcome !== "pending") return;
    const ixn = activeStrike(s);
    if (!ixn) return;
    const reply = ixn.reply ? s.messages[ixn.reply] : null;

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
      log(s, "reply ACK received · QB authority verified", "success");
      log(s, "MA_ApprovalRequestStatusMT SENT — strike approval complete.", "success");
      return;
    }

    if (s.armed && s.wezDeadlineTick !== null && s.tick > s.wezDeadlineTick) {
      fail(s, "WEZ window closed before reply was confirmed");
    }
  },

  checkStandingBeats(s) {
    if (s.pendingBeat || s.outcome !== "pending") return;

    const reply = openReply(s);
    if (reply && reply.state === "PENDING") {
      const link = s.links[reply.route[reply.hop] ?? ""];
      const routineAhead =
        link?.id === "bad" &&
        link.policy === "fifo" &&
        link.queue.some((id) => id !== reply.id && s.messages[id]?.cls === "C2");
      if (routineAhead) {
        raiseBeat(s, phase6, "queue-starved");
        return;
      }
    }

    if (s.cop <= s.copThreshold + COP_WARN_BAND && !s.copBreached) {
      raiseBeat(s, phase6, "cop-warning");
    }
  },
};
