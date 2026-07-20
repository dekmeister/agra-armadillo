/**
 * OV-1 Phase 4 — "Transit" — the queue-discipline level.
 *
 * Teaches that bandwidth is finite and, when demand exceeds it, the LINK'S QUEUE
 * DISCIPLINE decides who gets the air:
 *  - a continuous P2P formation heartbeat (MA_TaskMT · FollowFormation) must reach each
 *    follower or that follower falls out of formation;
 *  - on one of the two formation links it shares the air with an OTA mission-plan update;
 *  - under FIFO the heartbeat sits behind the older plan backlog and STARVES;
 *  - under Class (priority) or EDF (deadline) it floats to the front and survives.
 *
 * Topology (WP5.1 — was two nodes and one link):
 *   QB --MP--> ACP-1 (leader) --P2P--> ACP-2   <- capped, and CONTENDED
 *                             --P2P--> ACP-3   <- capped, and quiet
 *   ACP-2/ACP-3 --MP--> ACP-1                     status replies, clean
 *
 * The two formation links are deliberately identical in every respect except what else
 * is on them. That contrast IS the lesson: ACP-3's heartbeat sails through on the same
 * cap that starves ACP-2's, so the player can see that the cap is not the villain — the
 * ordering policy is.
 *
 * **What contends is now real traffic.** Before WP5 the competing load was synthetic
 * `MA_RulesOfEngagementCommandMT` spam, and the MP interface was exercised by nothing
 * anywhere in the campaign. The contention is now an actual mission-plan update —
 * `MA_MissionPlanCommandMT`, with its required `MA_MissionPlanCommandStatusMT` reply —
 * pushed from the QB through the leader and out to the re-tasked follower. Both names
 * are XSD-confirmed. This is MP's one honest appearance in the game.
 *
 * [S] One physical bandwidth-capped link carries both the P2P heartbeat and the MP plan
 *     traffic — modelling the *shared RF/DMS air* between two platforms (interfaces are
 *     logically distinct but contend for one physical resource). Each message keeps its
 *     true interface class.
 * [S] The plan update re-tasks ACP-2 only, so exactly one formation link is contended.
 *     A package-wide push would contend on both, which the per-link queue policy cannot
 *     express in one decision — a scoping choice about the control, not a claim about
 *     how mission plans are distributed.
 * [S] Links are loss-free (no burst, no ack loss) to isolate the bandwidth lesson from
 *     the loss lesson L2 already taught — the only way the heartbeat fails here is by
 *     losing the queue, never the air.
 *
 * Each follower's formation currency is tracked with the engine's per-follower freshness
 * machinery (`copFollowers` + `refreshFollower`/`decayFollowers`, shared with L5): each
 * confirmed heartbeat refreshes that follower; every tick without one decays it; dropping
 * below threshold = that follower's formation link lapsed (loss).
 */

import {
  decayFollowers,
  log,
  mkLink,
  mkNode,
  raiseBeat,
  refreshFollower,
  spawn,
} from "../runtime.ts";
import type { ScenarioDef } from "../scenario-def.ts";
import type { GameState, Link, NodeId, SimNode } from "../types.ts";

interface Follower {
  node: NodeId;
  link: string;
  ack: string;
}

/** The follower the mission-plan update re-tasks — so `form2` is the contended link. */
const RETASKED: Follower = { node: "acp2", link: "form2", ack: "ack2" };
/** The quiet follower: same cap, same heartbeat, no contention — the control case. */
const QUIET: Follower = { node: "acp3", link: "form3", ack: "ack3" };

/** The two followers and the capped formation link that feeds each its heartbeat. */
const FOLLOWERS: Follower[] = [RETASKED, QUIET];

/** Deadline horizon stamped on each heartbeat so EDF can float it up. */
const HEARTBEAT_DEADLINE = 3;
/** Formation currency a confirmed heartbeat restores. */
const HEARTBEAT_REFRESH = 100;
const FOLLOWER_START = 100;
/** Per-tick decay: survives a ~1-tick service gap, not a ~4-tick one. */
const FOLLOWER_DECAY = 20;
const FOLLOWER_THRESHOLD = 25;
/**
 * The mission-plan update, in fragments, pushed once at the start of transit.
 *
 * It is a BURST, not a stream, because a mission plan is a bounded artefact — you send
 * one and it is sent. That matters mechanically as well as faithfully: an endless
 * low-priority stream would be starved forever by the higher-priority heartbeat under
 * `class`, so the "right trade" the level teaches would quietly mean the plan never
 * arrives at all. Sized so FIFO serves it ahead of ~5 heartbeats (long enough for ACP-2's
 * formation currency to lapse) while Class/EDF drain it in the leftover capacity and
 * still complete the round trip inside the window.
 */
const PLAN_FRAGMENTS = 12;
/** Formation links pass two messages a tick: the heartbeat, plus one unit of whatever else. */
const FORMATION_CAP = 2;

const DEFAULT_CONFIG = {
  seed: 1,
  mode: "tutorial" as const,
  wezWindow: 20, // level length (ticks)
  contingencyTick: 999, // no scripted burst — the pressure is bandwidth, not loss
  copDecay: 0, // scalar COP unused — L4 tracks per-follower formation currency
  copStart: 100,
  copThreshold: FOLLOWER_THRESHOLD,
  copSyncPeriod: 6,
  bgC2Period: 4,
};

/** A loss-free link: reliable air, so failure can only come from losing the queue. */
function capLink(p: Partial<Link> & Pick<Link, "id" | "from" | "to" | "cls">): Link {
  return mkLink({
    bandwidthCap: 1,
    pGoodToBad: 0,
    pBadToGood: 1,
    blockGood: 0,
    blockBad: 0,
    ackLoss: 0,
    ...p,
  });
}

/** Spawn one follower's formation heartbeat: high priority + a near deadline. */
function spawnHeartbeat(s: GameState, link: string): void {
  spawn(s, {
    type: "MA_TaskMT",
    cls: "P2P",
    route: [link],
    leg: "oneway",
    priority: 3, // outranks the plan update under `class`
    deadlineTick: s.tick + HEARTBEAT_DEADLINE, // near deadline — floats up under `edf`
  });
}

/**
 * Spawn one mission-plan update: QB -> ACP-1 -> the re-tasked follower, two hops, the
 * second of which is the contended formation link. Low priority, no deadline — a plan
 * update is important but not time-critical, which is exactly why it should yield.
 */
function spawnPlanUpdate(s: GameState): void {
  spawn(s, {
    type: "MA_MissionPlanCommandMT",
    cls: "MP",
    route: ["plan", RETASKED.link],
    leg: "request",
    priority: 0,
  });
}

export const phase4: ScenarioDef = {
  id: "phase4",
  phase: 4,
  title: "Transit",
  principle: "bandwidth is finite · queue discipline decides what arrives in time",
  defaultConfig: DEFAULT_CONFIG,
  tutorialSeed: 1, // loss-free — FIFO starves, Class/EDF wins
  beats: {
    "bandwidth-cap": {
      id: "bandwidth-cap",
      takeaway: "Bandwidth is finite — excess demand queues and waits.",
      title: "Demand exceeds the link's bandwidth",
      summary:
        "More messages want the air than the link can pass this tick — the excess queues and waits.",
      concept:
        "Every directed link has a hard bandwidth cap: only so many messages get on the air per tick, " +
        "the rest stay queued. ACP-1 is holding formation with two followers and relaying a mission-plan " +
        "update (MP) to ACP-2 at the same time, so on the ACP-2 link something must wait. Compare it with " +
        "the ACP-3 link: same cap, same heartbeat, no contention, no problem. Which message waits is not " +
        "luck — it's set by the link's queue discipline.",
      focus: { kind: "link", id: "form2" },
      actions: [],
    },
    "queue-discipline": {
      id: "queue-discipline",
      takeaway: "Class/EDF float the critical flow ahead of routine traffic; FIFO starves it.",
      title: "FIFO is starving ACP-2's formation heartbeat",
      summary:
        "Under FIFO the heartbeat sits behind the older mission-plan backlog and never gets the air. Re-order the queue.",
      concept:
        "Under FIFO the deadline-bearing heartbeat waits behind MA_MissionPlanCommandMT fragments that " +
        "arrived earlier, so ACP-2's formation picture goes stale while ACP-3's stays current. Change the " +
        "discipline so the heartbeat floats to the front: Class (serve highest priority first) or EDF " +
        "(serve earliest deadline first). The plan update will now wait instead — the right trade, because " +
        "a plan update has no deadline and formation keeping does.",
      focus: { kind: "link", id: "form2" },
      actions: ["setPolicy"],
    },
  },

  build(seed, opts = {}) {
    const config = { ...DEFAULT_CONFIG, ...opts.config, seed };
    const nodes: Record<string, SimNode> = {
      qb: mkNode("qb", "QB", "QB", "QB"),
      acp1: mkNode("acp1", "ACP", "AVC", "ACP-1", true),
      acp2: mkNode("acp2", "ACP", "AVC", "ACP-2"),
      acp3: mkNode("acp3", "ACP", "AVC", "ACP-3"),
    };
    const links: Record<string, Link> = {
      // The plan push into the package. Uncapped and clean: the squeeze is inside the
      // formation, not on the way in.
      plan: capLink({
        id: "plan",
        from: "qb",
        to: "acp1",
        cls: "MP",
        bandwidthCap: PLAN_FRAGMENTS,
      }),
    };
    const copFollowers: Record<NodeId, number> = {};
    for (const f of FOLLOWERS) {
      links[f.link] = capLink({
        id: f.link,
        from: "acp1",
        to: f.node,
        cls: "P2P",
        bandwidthCap: FORMATION_CAP,
      });
      // Status replies ride a clean, uncapped return path — the level's lesson is about
      // the outbound queue, and a contended return leg is L6's story, not L4's.
      links[f.ack] = capLink({ id: f.ack, from: f.node, to: "acp1", cls: "MP", bandwidthCap: 4 });
      copFollowers[f.node] = FOLLOWER_START;
    }
    return {
      scenarioId: "phase4",
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
      copFollowers,
      wezDeadlineTick: null,
      armed: false,
      objective: "in_progress",
      outcome: "pending",
      failReason: null,
      pendingBeat: null,
      seenBeats: [],
      playerMoves: [],
      log: [
        {
          tick: 0,
          text: "Phase 4 — Transit. Three-ship formation; a mission-plan update is inbound for ACP-2.",
          severity: "info",
        },
      ],
      nextSeq: 0,
      config,
    };
  },

  seedDemand(s) {
    // The whole plan update is pushed up front, so it is already ahead of every
    // heartbeat in FIFO order — older traffic, served first, forever.
    for (let i = 0; i < PLAN_FRAGMENTS; i++) spawnPlanUpdate(s);
  },

  generateDemand(s) {
    if (s.tick > s.config.wezWindow) return;
    // One heartbeat per follower per tick. On form2 that lands on top of the plan
    // backlog, so demand exceeds the cap and a choice is forced.
    for (const f of FOLLOWERS) spawnHeartbeat(s, f.link);

    const contended = s.links[RETASKED.link];
    if (contended && contended.queue.length > contended.bandwidthCap) {
      raiseBeat(s, phase4, "bandwidth-cap");
    }
  },

  onDelivered(s, msg) {
    // A confirmed heartbeat restores that follower's formation currency.
    if (msg.type === "MA_TaskMT") {
      const link = s.links[msg.route[msg.hop] ?? ""];
      if (link) refreshFollower(s, link.to, HEARTBEAT_REFRESH);
      return;
    }
    // A plan update that reaches the follower owes a status reply back to the leader —
    // the round trip is the unit A-GRA assesses.
    if (msg.type === "MA_MissionPlanCommandMT") {
      spawn(s, {
        type: "MA_MissionPlanCommandStatusMT",
        cls: "MP",
        route: [RETASKED.ack],
        leg: "reply",
        priority: 1,
      });
    }
  },

  checkStandingBeats(s) {
    // Per-follower currency decays once per tick (after this tick's arrivals refreshed).
    decayFollowers(s, FOLLOWER_DECAY, FOLLOWER_THRESHOLD);
    if (s.pendingBeat || s.outcome !== "pending") return;
    const contended = s.links[RETASKED.link];
    if (!contended) return;
    if (contended.policy !== "fifo") return;
    // Heartbeat queued behind older plan traffic under FIFO — the starvation lesson.
    const heartbeatWaiting = contended.queue.some((id) => s.messages[id]?.type === "MA_TaskMT");
    const planAhead = contended.queue.some((id) => s.messages[id]?.cls === "MP");
    if (heartbeatWaiting && planAhead) raiseBeat(s, phase4, "queue-discipline");
  },

  evaluateOutcome(s) {
    if (s.outcome !== "pending") return;
    if (s.copBreached) {
      s.outcome = "loss";
      s.objective = "missed";
      s.failReason = "formation heartbeat lapsed — a follower fell out of formation";
      log(s, s.failReason, "fail");
      return;
    }
    if (s.tick > s.config.wezWindow) {
      s.outcome = "win";
      s.objective = "complete";
      log(s, "Transit complete — formation held throughout, plan update delivered.", "success");
      return;
    }
    s.objective = "in_progress";
  },
};
