/**
 * OV-1 Phase 5 — "CAP" — the COP fan-out level.
 *
 * Teaches that the Common Operating Picture is ONE-TO-MANY: the leader must keep every
 * follower's picture fresh, so fan-out cost scales with follower count and freshness is
 * a per-recipient budget. When bulk background traffic (MD/MP updates) crowds the P2P
 * links, the COP syncs starve and a follower goes stale — you must SHED the low-priority
 * bulk to protect the picture.
 *
 * Topology:
 *   ACP-1 (leader) -> ACP-2 / ACP-3 / ACP-4    three separate P2P COP-sync links
 *
 * Each link also carries bulk MD/MP background traffic competing for the same air.
 *
 * [S] Per-follower COP is a freshness scalar per node (not a real track picture) — the
 *     same simplification as the single-scalar COP, generalized to one value per
 *     follower. [S] Each link carries both the P2P COP sync and bulk MD/MP, modelling
 *     the shared OTA air; each message keeps its true class. [S] Links are loss-free to
 *     isolate the fan-out/contention lesson from the loss lesson (L2).
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

/** The three followers and the link that feeds each their COP. */
const FOLLOWERS: { node: NodeId; link: string }[] = [
  { node: "acp2", link: "cop2" },
  { node: "acp3", link: "cop3" },
  { node: "acp4", link: "cop4" },
];

const COP_REFRESH = 100;
const FOLLOWER_START = 100;
/** Per-tick per-follower freshness decay. Survives a ~1-tick sync gap, not a ~4-tick one. */
const FOLLOWER_DECAY = 20;
const FOLLOWER_THRESHOLD = 25;
/** Raise the shed prompt while a follower is within this band of breaching. */
const WARN_BAND = 30;
/** Bulk MD/MP messages injected per follower link per tick (until shed). */
const BULK_PER_TICK = 3;

const DEFAULT_CONFIG = {
  seed: 1,
  mode: "tutorial" as const,
  wezWindow: 20, // level length (ticks)
  contingencyTick: 999,
  copDecay: 0, // scalar COP frozen — L5 tracks per-follower freshness instead
  copStart: 100,
  copThreshold: FOLLOWER_THRESHOLD,
  copSyncPeriod: 6,
  bgC2Period: 4,
};

/** Loss-free link so failure comes only from starved fan-out, not the air. */
function copLink(p: Partial<Link> & Pick<Link, "id" | "from" | "to" | "cls">): Link {
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

/** Lowest freshness across all followers (for the warning beat). */
function minFreshness(s: GameState): number {
  const vals = Object.values(s.copFollowers ?? {});
  return vals.length ? Math.min(...vals) : FOLLOWER_START;
}

export const phase5: ScenarioDef = {
  id: "phase5",
  phase: 5,
  title: "CAP",
  defaultConfig: DEFAULT_CONFIG,
  tutorialSeed: 1, // loss-free — bulk starves a follower, shedding wins
  beats: {
    "cop-fanout": {
      id: "cop-fanout",
      title: "COP is one-to-many — every follower needs feeding",
      summary:
        "The leader must sync the COP to all three followers; fan-out cost scales with the package size.",
      concept:
        "COP (MA_SynchronizeGlobalCopToPeer) is a one-to-many P2P fan-out: the leader owes every " +
        "follower a fresh picture, so the messaging cost grows with the number of followers and each " +
        "follower carries its OWN freshness budget. Keep them all above threshold — a single stale " +
        "follower breaches the shared picture.",
      focus: { kind: "node", id: "acp1" },
      actions: [],
    },
    "cop-starvation": {
      id: "cop-starvation",
      title: "Bulk traffic is starving the COP fan-out",
      summary:
        "MD/MP bulk is crowding the P2P links and a follower is going stale. Shed the bulk to protect COP.",
      concept:
        "Low-priority bulk MD/MP updates are hogging the fan-out links, so the COP syncs can't get on " +
        "the air and a follower's picture is aging toward breach. Protect the picture: shed the " +
        "low-priority bulk so the COP syncs get the bandwidth. Compliance assesses the shared picture — " +
        "don't let routine data starve it.",
      focus: { kind: "node", id: "acp1" },
      actions: ["shedTraffic"],
    },
  },

  build(seed, opts = {}) {
    const config = { ...DEFAULT_CONFIG, ...opts.config, seed };
    const nodes: Record<string, SimNode> = {
      acp1: mkNode("acp1", "ACP", "AVC", "ACP-1", true),
      acp2: mkNode("acp2", "ACP", "AVC", "ACP-2"),
      acp3: mkNode("acp3", "ACP", "AVC", "ACP-3"),
      acp4: mkNode("acp4", "ACP", "AVC", "ACP-4"),
    };
    const links: Record<string, Link> = {};
    const copFollowers: Record<NodeId, number> = {};
    for (const f of FOLLOWERS) {
      links[f.link] = copLink({ id: f.link, from: "acp1", to: f.node, cls: "P2P" });
      copFollowers[f.node] = FOLLOWER_START;
    }
    return {
      scenarioId: "phase5",
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
      sheddingBulk: false,
      wezDeadlineTick: null,
      armed: false,
      objective: "in_progress",
      outcome: "pending",
      failReason: null,
      pendingBeat: null,
      seenBeats: [],
      log: [{ tick: 0, text: "Phase 5 — CAP. Fanning COP to the package.", severity: "info" }],
      nextSeq: 0,
      config,
    };
  },

  seedDemand(s) {
    // Open with bulk already crowding each link so the COP fan-out is under pressure
    // from the first tick.
    for (const f of FOLLOWERS) {
      spawn(s, {
        type: "MA_CommTeamReportMT",
        cls: "MD",
        route: [f.link],
        leg: "oneway",
        priority: 0,
      });
    }
  },

  generateDemand(s) {
    if (s.tick > s.config.wezWindow) return;
    // Continuous COP fan-out to every follower.
    for (const f of FOLLOWERS) {
      spawn(s, {
        type: "MA_SynchronizeGlobalCopToPeer",
        cls: "P2P",
        route: [f.link],
        leg: "oneway",
        priority: 2,
      });
      raiseBeat(s, phase5, "cop-fanout");
      // Bulk MD/MP background load — until the player sheds it.
      if (!s.sheddingBulk) {
        for (let i = 0; i < BULK_PER_TICK; i++) {
          spawn(s, {
            type: "MA_CommTeamReportMT",
            cls: i % 2 === 0 ? "MD" : "MP",
            route: [f.link],
            leg: "oneway",
            priority: 0,
          });
        }
      }
    }
  },

  onDelivered(s, msg) {
    if (msg.type === "MA_SynchronizeGlobalCopToPeer") {
      const link = s.links[msg.route[msg.hop] ?? ""];
      if (link) refreshFollower(s, link.to, COP_REFRESH);
    }
  },

  applyAction(s, action) {
    if (action.type === "shedTraffic") {
      s.sheddingBulk = true;
      let dropped = 0;
      for (const link of Object.values(s.links)) {
        const keep: string[] = [];
        for (const id of link.queue) {
          const m = s.messages[id];
          if (m && (m.cls === "MD" || m.cls === "MP")) {
            delete s.messages[id];
            dropped += 1;
          } else {
            keep.push(id);
          }
        }
        link.queue = keep;
      }
      log(s, `Shed ${dropped} bulk MD/MP message(s) — protecting the COP fan-out.`, "info");
      return true;
    }
    return false;
  },

  checkStandingBeats(s) {
    // Per-follower freshness decays once per tick (after this tick's arrivals refreshed).
    decayFollowers(s, FOLLOWER_DECAY, FOLLOWER_THRESHOLD);
    if (s.pendingBeat || s.outcome !== "pending") return;
    if (!s.copBreached && minFreshness(s) < FOLLOWER_THRESHOLD + WARN_BAND) {
      raiseBeat(s, phase5, "cop-starvation");
    }
  },

  evaluateOutcome(s) {
    if (s.outcome !== "pending") return;
    if (s.copBreached) {
      s.outcome = "loss";
      s.objective = "missed";
      s.failReason = "a follower's COP went stale — shared picture breached";
      log(s, s.failReason, "fail");
      return;
    }
    if (s.tick > s.config.wezWindow) {
      s.outcome = "win";
      s.objective = "complete";
      log(s, "CAP held — every follower's COP stayed fresh.", "success");
      return;
    }
    s.objective = "in_progress";
  },
};
