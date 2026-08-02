/**
 * OV-1 Phase 5 — "CAP" — the COP fan-out level.
 *
 * Teaches that the Common Operating Picture is ONE-TO-MANY: the leader must keep every
 * follower's picture fresh, so fan-out cost scales with follower count and freshness is
 * a per-recipient budget. When bulk sensor traffic crowds the P2P links, the COP syncs
 * starve and a follower goes stale — you must SHED the low-priority bulk to protect the
 * picture.
 *
 * Topology:
 *   ACP-1 (leader) -> ACP-2 / ACP-3 / ACP-4    three separate P2P COP-sync links
 *
 * Each link also carries bulk sensor background traffic competing for the same air.
 *
 * **Shedding is triage, not a free win (WP5.2).** Before WP5, `shedTraffic` simply
 * stopped the bulk and nothing whatsoever got worse — so the level's one decision was a
 * no-brainer and it taught, falsely, that shedding costs nothing. The bulk is now
 * `ObservationMeasurementReportMT`: the raw sensor observations local fusion builds
 * tracks from (MS Volume §1.2.4.1 "Distribute Single Sensor Track Data to Perform Local
 * Fusion", ~L1350-1400 — and that section is explicit that fused tracks then feed the
 * COP). So while the bulk is shed, `trackCompleteness` decays: you are trading the
 * fidelity of your own sensor picture for the currency of everyone else's shared one.
 * That is the correct call under COP pressure, and it is a real cost — which is why
 * RESUMING once the followers recover is the second half of the lesson.
 *
 * The trade is deliberately asymmetric: a stale follower LOSES the level, degraded track
 * completeness never does. Shedding remains the right answer; it just is not a free one.
 *
 * [S] Per-follower COP is a freshness scalar per node (not a real track picture) — the
 *     same simplification as the single-scalar COP, generalized to one value per
 *     follower. [S] Track completeness is likewise a scalar stand-in for fusion quality,
 *     not a track table. [S] Each link carries both the P2P COP sync and the MD sensor
 *     bulk, modelling the shared OTA air; each message keeps its true class. [S] Links
 *     are loss-free to isolate the fan-out/contention lesson from the loss lesson (L2).
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
/**
 * Messages each fan-out link passes per tick: one for the follower's COP sync, one spare.
 * The spare is what makes "resume within budget" expressible — at a cap of 1 there is no
 * sustainable bulk rate at all, and the resume half of the lesson could not exist.
 */
const COP_LINK_CAP = 2;
/**
 * Raise the shed prompt while a follower is within this band of breaching.
 *
 * Sized so the prompt is ACTIONABLE, which it was not before WP5.2. At 30 the beat fired
 * with the worst follower already at 40: one decay step (20) from breach, while shedding
 * needs two ticks to bite (the freed link dispatches a COP sync on the next tick, and it
 * lands the tick after). So a player who did exactly what the beat told them to still
 * lost, and the level was only winnable by shedding at T+1 — before the game had said to.
 * At 50 the beat fires at 60, leaving the two ticks recovery actually takes.
 */
const WARN_BAND = 50;
/**
 * Bulk sensor (MD) messages injected per follower link per tick until shed — the
 * firehose. Well over the link's spare capacity (cap 2, of which the COP sync takes one),
 * so the backlog grows fast enough to push a COP sync's wait past the ~3 ticks a
 * follower's freshness can absorb. That is what makes passive play lose.
 */
const BULK_PER_TICK = 6;
/**
 * The rate the bulk comes back at after a resume — one per tick, which is exactly the
 * headroom left under the cap once each follower's COP sync has been served.
 *
 * You do not restore a firehose you have just proved does not fit. The unshed rate (6)
 * exceeds the link's spare capacity, which is why it starves the fan-out in the first
 * place; resuming at that rate would simply re-run the failure, making the resume prompt
 * a trap rather than a lesson. Restoring at a SUSTAINABLE rate is the actual skill:
 * degrade deliberately, then come back within budget.
 */
const BULK_RESUMED_PER_TICK = 1;

/** Local track/fusion completeness: full picture at the start of CAP. */
const TRACK_START = 100;
/** Per-tick decay of fusion quality when no fresh observations are arriving. */
const TRACK_DECAY = 5;
/** What one delivered batch of observation reports restores. */
const TRACK_REFRESH = 8;
/**
 * Floor on track completeness while shedding. Not zero: MS Vol §1.2.4.1 notes a platform
 * that cannot fuse locally can still use PRE-FUSED tracks, and cooperative sensors
 * (Mode 5 IFF, ADS-B) keep reporting regardless. You lose fidelity, not the picture.
 */
const TRACK_FLOOR = 40;
/** Offer the resume prompt once every follower is this far clear of breach. */
const RECOVERED_BAND = 45;

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

/**
 * One unit of deferrable sensor bulk: raw observation reports the local fusion process
 * consumes (MS Vol §1.2.4.1). Priority 0 — it must lose every contest against a COP sync.
 */
function spawnSensorBulk(s: GameState, link: string): void {
  spawn(s, {
    type: "ObservationMeasurementReportMT",
    cls: "MD",
    route: [link],
    leg: "oneway",
    priority: 0,
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
  principle: "protecting the shared picture costs something else · triage is not free",
  defaultConfig: DEFAULT_CONFIG,
  tutorialSeed: 1, // loss-free — bulk starves a follower, shedding wins
  beats: {
    "cop-fanout": {
      id: "cop-fanout",
      takeaway: "COP is one-to-many; freshness is a per-follower budget, not a single number.",
      title: "COP (Common Operating Picture) is one-to-many — every follower needs feeding",
      summary:
        "The leader must sync the COP to all three followers; fan-out cost scales with the package size.",
      concept:
        "COP (GAME_CopSyncToPeer) is a one-to-many P2P fan-out: the leader owes every " +
        "follower a fresh picture, so the messaging cost grows with the number of followers and each " +
        "follower carries its OWN freshness budget. Keep them all above threshold — a single stale " +
        "follower breaches the shared picture.",
      focus: { kind: "node", id: "acp1" },
      actions: [],
    },
    "cop-starvation": {
      id: "cop-starvation",
      takeaway:
        "Shed low-priority bulk to protect the COP fan-out — triage, and it costs track completeness.",
      title: "Sensor bulk is starving the COP fan-out",
      summary:
        "MD observation reports are crowding the P2P links and a follower is going stale. Shed the bulk to protect COP.",
      concept:
        "Bulk ObservationMeasurementReportMT traffic — the raw sensor observations your local fusion " +
        "builds tracks from — is hogging the fan-out links, so the COP syncs can't get on the air and a " +
        "follower's picture is aging toward breach. Shed the bulk: it is deferrable in a way the shared " +
        "picture is not, because only a subset of observation reports are associated with any given " +
        "track, and a platform that stops fusing locally can still use pre-fused tracks. But it is NOT " +
        "free — watch your own track completeness fall while it is shed. This is triage: you are trading " +
        "the fidelity of your picture for the currency of everyone else's.",
      focus: { kind: "node", id: "acp1" },
      actions: ["shedTraffic"],
    },
    "bulk-resume": {
      id: "bulk-resume",
      takeaway:
        "Restore the shed feed once the pressure lifts; a shed never resumed is capability given away.",
      title: "Followers recovered — restore the sensor feed",
      summary:
        "Every follower's COP is clear of breach again, and your own track completeness has been decaying since you shed. Put the bulk back.",
      concept:
        "Shedding was triage, not a setting. The fan-out has caught up and there is air to spare, while " +
        "your local fusion has been running on a thinning set of observations the whole time. Restore " +
        "the MD bulk and the picture rebuilds. The lesson is the round trip of the decision: degrade " +
        "deliberately under pressure, then UNDO it deliberately when the pressure lifts — a shed that is " +
        "never resumed is just a capability you quietly gave up.",
      focus: { kind: "node", id: "acp1" },
      actions: ["resumeTraffic"],
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
      links[f.link] = copLink({
        id: f.link,
        from: "acp1",
        to: f.node,
        cls: "P2P",
        bandwidthCap: COP_LINK_CAP,
      });
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
      trackCompleteness: TRACK_START,
      sheddingBulk: false,
      wezDeadlineTick: null,
      armed: false,
      objective: "in_progress",
      outcome: "pending",
      failReason: null,
      pendingBeat: null,
      seenBeats: [],
      playerMoves: [],
      log: [{ tick: 0, text: "Phase 5 — CAP. Fanning COP to the package.", severity: "info" }],
      nextSeq: 0,
      config,
    };
  },

  seedDemand(s) {
    // Open with bulk already crowding each link so the COP fan-out is under pressure
    // from the first tick.
    for (const f of FOLLOWERS) spawnSensorBulk(s, f.link);
  },

  generateDemand(s) {
    if (s.tick > s.config.wezWindow) return;
    // Continuous COP fan-out to every follower.
    for (const f of FOLLOWERS) {
      spawn(s, {
        type: "GAME_CopSyncToPeer",
        cls: "P2P",
        route: [f.link],
        leg: "oneway",
        priority: 2,
      });
      raiseBeat(s, phase5, "cop-fanout");
      // Bulk sensor observations — at the firehose rate until shed, then at the
      // sustainable rate once restored. "Have we already been through a shed/resume
      // cycle?" is derivable from seenBeats, so this needs no extra state.
      if (!s.sheddingBulk) {
        const rate = s.seenBeats.includes("bulk-resume") ? BULK_RESUMED_PER_TICK : BULK_PER_TICK;
        for (let i = 0; i < rate; i++) spawnSensorBulk(s, f.link);
      }
    }
  },

  onDelivered(s, msg) {
    if (msg.type === "GAME_CopSyncToPeer") {
      const link = s.links[msg.route[msg.hop] ?? ""];
      if (link) refreshFollower(s, link.to, COP_REFRESH);
      return;
    }
    // Observations that get through feed local fusion, so the track picture recovers.
    if (msg.type === "ObservationMeasurementReportMT") {
      s.trackCompleteness = Math.min(
        TRACK_START,
        (s.trackCompleteness ?? TRACK_START) + TRACK_REFRESH,
      );
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
          if (m && m.cls === "MD") {
            delete s.messages[id];
            dropped += 1;
          } else {
            keep.push(id);
          }
        }
        link.queue = keep;
      }
      log(
        s,
        `Shed ${dropped} bulk MD observation report(s) — protecting the COP fan-out. ` +
          "Local track completeness will now decay.",
        "degrade",
      );
      return true;
    }
    if (action.type === "resumeTraffic") {
      s.sheddingBulk = false;
      log(s, "Sensor bulk restored — local fusion rebuilding the track picture.", "success");
      return true;
    }
    return false;
  },

  checkStandingBeats(s) {
    // Per-follower freshness decays once per tick (after this tick's arrivals refreshed).
    decayFollowers(s, FOLLOWER_DECAY, FOLLOWER_THRESHOLD);
    // So does local fusion quality, bounded below: shedding costs fidelity, never the
    // whole picture, and never the level.
    s.trackCompleteness = Math.max(TRACK_FLOOR, (s.trackCompleteness ?? TRACK_START) - TRACK_DECAY);
    if (s.pendingBeat || s.outcome !== "pending") return;
    if (!s.copBreached && minFreshness(s) < FOLLOWER_THRESHOLD + WARN_BAND) {
      raiseBeat(s, phase5, "cop-starvation");
      return;
    }
    // The other half of the decision: the fan-out has recovered and the bulk is still
    // shed, so the fidelity you traded away is now being given up for nothing.
    if (
      s.sheddingBulk &&
      !s.copBreached &&
      minFreshness(s) >= FOLLOWER_THRESHOLD + RECOVERED_BAND &&
      (s.trackCompleteness ?? TRACK_START) < TRACK_START - TRACK_DECAY * 2
    ) {
      raiseBeat(s, phase5, "bulk-resume");
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
