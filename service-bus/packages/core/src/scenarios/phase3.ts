/**
 * OV-1 Phase 3 — "Team Formation" — the leader-election level.
 *
 * Teaches that P2P coordination COSTS MESSAGES and the election METHOD trades cost
 * against robustness:
 *  - Static Fitness Score is cheap (~n declarations) and needs no quorum — the fittest
 *    node just declares — but is inflexible;
 *  - Raft is more expensive (~2n: request-vote + reply per peer) and needs a MAJORITY,
 *    so it STALLS on a partitioned set that can't muster a quorum.
 *
 * Topology:
 *   ACP-1 <-> ACP-2 <-> ACP-3   a leaderless package on a directed P2P mesh (no QB)
 *
 * The election is genuinely message-driven: request-vote / declaration messages ride
 * the real P2P links (so a partition can lose them) and are tallied as they deliver.
 * election.ts is the pure strategy layer (cost, candidate, quorum); this scenario owns
 * the topology and the message flow.
 *
 * [S] Fitness is a pre-loaded score (the dynamic "fitness = comms health" variant is
 *     future work). [S] Links are loss-free on the nominal path so convergence is
 *     deterministic; the partition (a scripted contingency) severs the mesh to force
 *     the Raft quorum stall. Only Raft + Static are modelled.
 */

import { log, mkLink, mkNode, raiseBeat } from "../runtime.ts";
import type { ScenarioDef } from "../scenario-def.ts";
import type { GameState, Link, NodeId, SimNode } from "../types.ts";
import { handleElectionDelivery, startElection } from "./election-flow.ts";

/** Pre-loaded fitness — ACP-2 is fittest, so it is the Static declarer / Raft candidate. */
const FITNESS: Record<NodeId, number> = { acp1: 2, acp2: 3, acp3: 1 };
/** Raise the quorum-stall prompt if Raft hasn't resolved within this many ticks of the pick. */
const STALL_WARN = 4;

const DEFAULT_CONFIG = {
  seed: 1,
  mode: "tutorial" as const,
  wezWindow: 15, // ticks to elect a leader
  contingencyTick: 999, // >window: no partition on the nominal path
  copDecay: 0,
  copStart: 100,
  copThreshold: 0,
  copSyncPeriod: 6,
  bgC2Period: 4,
};

/** Loss-free P2P link (nominal); a partition contingency severs it later. */
function meshLink(from: NodeId, to: NodeId): Link {
  return mkLink({
    id: `${from}_${to}`,
    from,
    to,
    cls: "P2P",
    pGoodToBad: 0,
    pBadToGood: 1,
    blockGood: 0,
    blockBad: 1,
    ackLoss: 0,
  });
}

/** Install the package leader: mark the winner across the package, seed COP, log. */
function installLeader(s: GameState, leader: NodeId): void {
  for (const n of Object.values(s.nodes)) n.isLeader = n.id === leader;
  s.cop = s.config.copStart; // fresh picture from the new leader
  log(
    s,
    `Leader elected: ${s.nodes[leader]?.label ?? leader} — COP seeded to the package.`,
    "success",
  );
}

export const phase3: ScenarioDef = {
  id: "phase3",
  phase: 3,
  title: "Team Formation",
  defaultConfig: DEFAULT_CONFIG,
  tutorialSeed: 1, // loss-free — doing nothing loses, picking a method wins
  beats: {
    "election-cost": {
      id: "election-cost",
      title: "Forming the team — pick an election method",
      summary:
        "The package has no leader. Static Fitness is cheap (~n msgs); Raft is robust but costs ~2n and needs a quorum.",
      concept:
        "Leader election is not free — it runs over the same P2P links the team uses. Static Fitness " +
        "Score has the fittest node declare locally: ~n messages, no quorum, but inflexible. Raft has a " +
        "candidate gather a MAJORITY of votes (request-vote + reply per peer, ~2n): robust to a bad " +
        "declarer, but it needs a quorum to resolve. Pick the method for the situation.",
      focus: { kind: "node", id: "acp2" },
      actions: ["pickElection"],
    },
    quorum: {
      id: "quorum",
      title: "Raft is stalling — no quorum",
      summary:
        "Raft can't reach a majority of votes over the partitioned mesh, so no leader resolves. Static needs no quorum.",
      concept:
        "Raft only elects a leader once a MAJORITY have voted. With the mesh partitioned, the candidate's " +
        "request-vote / reply traffic can't complete, so the vote count never reaches quorum and the " +
        "election stalls — leaderless. Static Fitness would have declared locally without a quorum (the " +
        "robustness-vs-cost trade this level is about).",
      focus: { kind: "node", id: "acp2" },
      actions: ["pickElection"],
    },
  },

  build(seed, opts = {}) {
    const config = { ...DEFAULT_CONFIG, ...opts.config, seed };
    const nodes: Record<string, SimNode> = {
      acp1: mkNode("acp1", "ACP", "AVC", "ACP-1"),
      acp2: mkNode("acp2", "ACP", "AVC", "ACP-2"),
      acp3: mkNode("acp3", "ACP", "AVC", "ACP-3"),
    };
    const pairs: [NodeId, NodeId][] = [
      ["acp1", "acp2"],
      ["acp2", "acp1"],
      ["acp1", "acp3"],
      ["acp3", "acp1"],
      ["acp2", "acp3"],
      ["acp3", "acp2"],
    ];
    const links: Record<string, Link> = {};
    for (const [from, to] of pairs) links[`${from}_${to}`] = meshLink(from, to);

    return {
      scenarioId: "phase3",
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
          text: "Phase 3 — Team Formation. Leaderless package forming up.",
          severity: "info",
        },
      ],
      nextSeq: 0,
      config,
    };
  },

  seedDemand() {
    // The election is player-initiated (pickElection); no opening demand.
  },

  fireContingency(s) {
    // Scripted partition: sever the mesh so a Raft election cannot muster a quorum.
    if (s.tick !== s.config.contingencyTick) return;
    for (const link of Object.values(s.links)) {
      link.channel = "BAD";
      link.pGoodToBad = 1;
      link.pBadToGood = 0;
      link.blockBad = 1; // never gets on the air
      link.ackLoss = 1;
    }
    log(s, "Package partitioned — P2P mesh severed.", "degrade");
  },

  generateDemand(s) {
    if (!s.election) raiseBeat(s, phase3, "election-cost");
  },

  applyAction(s, action) {
    if (action.type === "pickElection") {
      startElection(s, action.method, Object.values(s.nodes), FITNESS, installLeader);
      return true;
    }
    return false;
  },

  onDelivered(s, msg) {
    handleElectionDelivery(s, msg, installLeader);
  },

  checkStandingBeats(s) {
    if (s.pendingBeat || s.outcome !== "pending") return;
    const e = s.election;
    if (e && e.method === "raft" && !e.leader && s.tick - e.startTick >= STALL_WARN) {
      raiseBeat(s, phase3, "quorum");
    }
  },

  evaluateOutcome(s) {
    if (s.outcome !== "pending") return;
    if (s.election?.leader) {
      s.outcome = "win";
      s.objective = "complete";
      return;
    }
    if (s.tick > s.config.wezWindow) {
      s.outcome = "loss";
      s.objective = "missed";
      s.failReason = s.election
        ? "election stalled — no leader (no quorum)"
        : "no leader elected before the package needed one";
      log(s, s.failReason, "fail");
    }
  },
};
