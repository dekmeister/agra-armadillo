/**
 * OV-1 Phase 4 — "Transit" — the queue-discipline level.
 *
 * Teaches that bandwidth is finite and, when demand exceeds it, the LINK'S QUEUE
 * DISCIPLINE decides who gets the air:
 *  - a continuous P2P formation heartbeat (MA_TaskMT · FollowFormation) must stay
 *    current or the package falls out of formation;
 *  - it shares one bandwidth-capped link with routine C2 command traffic;
 *  - under FIFO the heartbeat sits behind the older routine backlog and STARVES;
 *  - under Class (priority) or EDF (deadline) it floats to the front and survives.
 *
 * Topology:
 *   ACP-1 (leader) -> ACP-2 (follower)   one capped link, the shared OTA air
 *
 * [S] One physical bandwidth-capped link carries both the P2P heartbeat and routine
 *     C2 — modelling the *shared RF/DMS air* between two platforms (interfaces are
 *     logically distinct but contend for one physical resource). Each message keeps
 *     its true interface class. [S] The link is loss-free (no burst, no ack loss) to
 *     isolate the bandwidth lesson from the loss lesson L2 already taught — the only
 *     way the heartbeat fails here is by losing the queue, never the air.
 *
 * The heartbeat's currency is tracked with the engine's freshness scalar (`cop` +
 * `decayCop`): each confirmed heartbeat refreshes it; every tick without one decays
 * it; dropping below threshold = the formation link lapsed (loss). This reuses the
 * generic freshness machinery — no new engine code.
 */

import { log, mkLink, mkNode, raiseBeat, spawn } from "../runtime.ts";
import type { ScenarioDef } from "../scenario-def.ts";
import type { GameState, Link, SimNode } from "../types.ts";

/** Deadline horizon stamped on each heartbeat so EDF can float it up. */
const HEARTBEAT_DEADLINE = 3;
/** Freshness a confirmed heartbeat restores. */
const HEARTBEAT_REFRESH = 100;
/** Routine-C2 backlog pre-seeded so FIFO opens on older traffic. */
const C2_BACKLOG = 1;
/**
 * Routine C2 injected per tick. With bandwidthCap 1, this sets FIFO's per-heartbeat
 * service gap (~ROUTINE_PER_TICK+1 ticks): fast enough that the heartbeat's freshness
 * lapses under FIFO, while Class/EDF serve it every tick and it stays current.
 */
const ROUTINE_PER_TICK = 3;

const DEFAULT_CONFIG = {
  seed: 1,
  mode: "tutorial" as const,
  wezWindow: 20, // level length (ticks)
  contingencyTick: 999, // no scripted burst — the pressure is bandwidth, not loss
  copDecay: 20, // heartbeat-freshness decay per tick: survives a ~1-tick gap, not a ~4-tick one
  copStart: 100,
  copThreshold: 25, // below this, the formation link has lapsed
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

/** Spawn the continuous formation heartbeat: high priority + a near deadline. */
function spawnHeartbeat(s: GameState): void {
  spawn(s, {
    type: "MA_TaskMT",
    cls: "P2P",
    route: ["form"],
    leg: "oneway",
    priority: 3, // outranks routine C2 under `class`
    deadlineTick: s.tick + HEARTBEAT_DEADLINE, // near deadline — floats up under `edf`
  });
}

/** Spawn one routine C2 command (low priority, no deadline) — the competing traffic. */
function spawnRoutineC2(s: GameState): void {
  spawn(s, {
    type: "MA_RulesOfEngagementCommandMT",
    cls: "C2",
    route: ["form"],
    leg: "oneway",
    priority: 0,
  });
}

export const phase4: ScenarioDef = {
  id: "phase4",
  phase: 4,
  title: "Transit",
  defaultConfig: DEFAULT_CONFIG,
  tutorialSeed: 1, // loss-free — FIFO starves, Class/EDF wins
  beats: {
    "bandwidth-cap": {
      id: "bandwidth-cap",
      title: "Demand exceeds the link's bandwidth",
      summary:
        "More messages want the air than the link can pass this tick — the excess queues and waits.",
      concept:
        "Every directed link has a hard bandwidth cap: only so many messages get on the air per tick, " +
        "the rest stay queued. Here the formation heartbeat and routine C2 both want the same capped " +
        "leader→follower link, so something must wait. Which one waits is not luck — it's set by the " +
        "link's queue discipline.",
      focus: { kind: "link", id: "form" },
      actions: [],
    },
    "queue-discipline": {
      id: "queue-discipline",
      title: "FIFO is starving the formation heartbeat",
      summary:
        "Under FIFO the heartbeat sits behind older routine C2 and never gets the air. Re-order the queue.",
      concept:
        "Under FIFO the deadline-bearing heartbeat waits behind routine MA_RulesOfEngagementCommandMT " +
        "that arrived earlier, so the formation picture goes stale. Change the discipline so the " +
        "heartbeat floats to the front: Class (serve highest priority first) or EDF (serve earliest " +
        "deadline first). Routine C2 will now wait instead — the right trade.",
      focus: { kind: "link", id: "form" },
      actions: ["setPolicy"],
    },
  },

  build(seed, opts = {}) {
    const config = { ...DEFAULT_CONFIG, ...opts.config, seed };
    const nodes: Record<string, SimNode> = {
      acp1: mkNode("acp1", "ACP", "AVC", "ACP-1", true),
      acp2: mkNode("acp2", "ACP", "AVC", "ACP-2"),
    };
    const links: Record<string, Link> = {
      form: capLink({ id: "form", from: "acp1", to: "acp2", cls: "P2P" }),
    };
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
      wezDeadlineTick: null,
      armed: false,
      objective: "in_progress",
      outcome: "pending",
      failReason: null,
      pendingBeat: null,
      seenBeats: [],
      log: [
        {
          tick: 0,
          text: "Phase 4 — Transit. Formation heartbeat sharing the link with routine C2.",
          severity: "info",
        },
      ],
      nextSeq: 0,
      config,
    };
  },

  seedDemand(s) {
    // A standing routine-C2 backlog so FIFO always serves older traffic first and the
    // heartbeat (spawned later, higher seq) never reaches the air.
    for (let i = 0; i < C2_BACKLOG; i++) spawnRoutineC2(s);
  },

  generateDemand(s) {
    if (s.tick > s.config.wezWindow) return;
    // One heartbeat + a burst of routine C2 every tick: demand far exceeds the cap (1),
    // so a choice is forced every tick. Under FIFO the heartbeat's service gap stretches
    // to ~ROUTINE_PER_TICK+1 ticks and its freshness lapses; Class/EDF serve it first.
    spawnHeartbeat(s);
    for (let i = 0; i < ROUTINE_PER_TICK; i++) spawnRoutineC2(s);

    const form = s.links.form;
    if (form && form.queue.length > form.bandwidthCap) {
      raiseBeat(s, phase4, "bandwidth-cap");
    }
  },

  onDelivered(s, msg) {
    // A confirmed heartbeat restores formation currency.
    if (msg.type === "MA_TaskMT") s.cop = Math.max(s.cop, HEARTBEAT_REFRESH);
  },

  checkStandingBeats(s) {
    if (s.pendingBeat || s.outcome !== "pending") return;
    const form = s.links.form;
    if (!form) return;
    if (form.policy !== "fifo") return;
    // Heartbeat queued behind older routine C2 under FIFO — the starvation lesson.
    const heartbeatWaiting = form.queue.some((id) => s.messages[id]?.type === "MA_TaskMT");
    const routineAhead = form.queue.some((id) => s.messages[id]?.cls === "C2");
    if (heartbeatWaiting && routineAhead) raiseBeat(s, phase4, "queue-discipline");
  },

  evaluateOutcome(s) {
    if (s.outcome !== "pending") return;
    if (s.copBreached) {
      s.outcome = "loss";
      s.objective = "missed";
      s.failReason = "formation heartbeat lapsed — the follower fell out of formation";
      log(s, s.failReason, "fail");
      return;
    }
    if (s.tick > s.config.wezWindow) {
      s.outcome = "win";
      s.objective = "complete";
      log(s, "Transit complete — formation held throughout.", "success");
      return;
    }
    s.objective = "in_progress";
  },
};
