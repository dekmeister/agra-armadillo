/**
 * OV-1 Phase 7 — "RTB @ Bingo" — the authority-transfer + split-brain level.
 *
 * Teaches two hard truths at once:
 *  1. Authority is CONTEXTUAL and TRANSFERS. Return-to-base is an LRE action, not the
 *     QB's — so an RTB routed to the QB is REJECTED (the L6 strike gate, inverted). You
 *     must hand authority back QB→LRE for the RTB to be authorised.
 *  2. Partitions cause SPLIT-BRAIN. When the package splits, the orphan half re-elects
 *     its own leader (reuse L3 election) — now two leaders exist. Halves MERGE ONLY ON
 *     COMMAND (never automatically); leaving it split loses.
 *
 * Topology:
 *   ACP-1 (leader) —C2→ QB / LRE      RTB request/reply (authority check at destination)
 *   ACP-1 <-P2P-> ACP-2 <-P2P-> ACP-3  the package mesh; a partition orphans {ACP-2,ACP-3}
 *
 * [S] Split membership simplified to two halves that merge on command. [S] takeoff/
 *     landing/RTB collapsed to one MA_TaskCommandMT/MA_TaskStatusMT round trip. Links
 *     are loss-free so the authority + split lessons aren't muddied by loss.
 */

import { adjudicate } from "../rbac.ts";
import { destNode, log, mkLink, mkNode, raiseBeat, spawn } from "../runtime.ts";
import type { ScenarioDef } from "../scenario-def.ts";
import type { GameState, Interaction, Link, NodeId, SimNode } from "../types.ts";
import { handleElectionDelivery, startElection } from "./election-flow.ts";

/** Orphan-half fitness — ACP-2 outranks ACP-3, so it wins the re-election. */
const ORPHAN_FITNESS: Record<NodeId, number> = { acp2: 3, acp3: 1 };
/** The orphaned half after the partition. */
const ORPHAN: NodeId[] = ["acp2", "acp3"];
/** Links crossing the partition (severed when the package splits). */
const CROSSING = ["acp1_acp2", "acp2_acp1", "acp1_acp3", "acp3_acp1"];
/** Reply link back to ACP-1 keyed by the destination the request reached. */
const REPLY_LINK: Record<NodeId, string> = { qb: "rtbRepQb", lre: "rtbRepLre" };
const REQUEST_LINK: Record<"qb" | "lre", string> = { qb: "rtbReqQb", lre: "rtbReqLre" };

const DEFAULT_CONFIG = {
  seed: 1,
  mode: "tutorial" as const,
  wezWindow: 20, // bingo-fuel window to complete the RTB + heal the split
  contingencyTick: 3, // the package partitions here
  copDecay: 0,
  copStart: 100,
  copThreshold: 0,
  copSyncPeriod: 6,
  bgC2Period: 4,
};

function cleanLink(p: Partial<Link> & Pick<Link, "id" | "from" | "to" | "cls">): Link {
  return mkLink({ pGoodToBad: 0, pBadToGood: 1, blockGood: 0, blockBad: 0, ackLoss: 0, ...p });
}

/** The most recent RTB interaction (handBack opens a fresh one). */
function activeRtb(s: GameState): Interaction | null {
  const ixns = Object.values(s.interactions);
  return ixns[ixns.length - 1] ?? null;
}

/** RTB is done when its reply is delivered, APPROVED, and authority was verified (LRE). */
function rtbAuthorised(s: GameState): boolean {
  const ixn = activeRtb(s);
  const reply = ixn?.reply ? s.messages[ixn.reply] : null;
  return (
    !!reply && reply.state === "SENT" && reply.approval === "APPROVED" && reply.authorityVerified
  );
}

function leaderCount(s: GameState): number {
  return Object.values(s.nodes).filter((n) => n.isLeader).length;
}

/** Issue an RTB request routed to `to` (qb = wrong authority; lre = correct). */
function issueRtb(s: GameState, to: "qb" | "lre"): void {
  const id = `ixn-${s.nextSeq}`;
  const req = spawn(s, {
    type: "MA_TaskCommandMT",
    cls: "C2",
    route: [REQUEST_LINK[to]],
    leg: "request",
    ixn: id,
    priority: 2,
  });
  s.interactions[id] = { id, kind: "rtb", request: req.id, reply: null, status: "open" };
  log(s, `RTB requested → ${s.nodes[to]?.label ?? to}.`, "info");
}

/** Install the orphan half's re-elected leader (leaves the far-side leader in place). */
function installOrphanLeader(s: GameState, leader: NodeId): void {
  const node = s.nodes[leader];
  if (node) node.isLeader = true;
  log(
    s,
    `Orphan half re-elected ${node?.label ?? leader} — split-brain: two leaders now exist.`,
    "degrade",
  );
}

export const phase7: ScenarioDef = {
  id: "phase7",
  phase: 7,
  title: "RTB @ Bingo",
  defaultConfig: DEFAULT_CONFIG,
  tutorialSeed: 1, // loss-free — passive loses, handBack + re-elect + merge wins
  beats: {
    "authority-handback": {
      id: "authority-handback",
      title: "RTB REJECTED — wrong authority",
      summary:
        "RTB is an LRE action, not the QB's, so the QB rejected it. Hand authority back to the LRE.",
      concept:
        "Authority is contextual: the QB is the Target Authority for weapon employment, but RETURN-TO-" +
        "BASE is the LRE's call. Routing the RTB to the QB gets a REJECTED / CannotComply at the " +
        "destination — arrival ≠ authority, same gate as the strike in Phase 6, now inverted. Hand the " +
        "authority back to the LRE and re-issue the RTB there.",
      focus: { kind: "node", id: "qb" },
      actions: ["handBack"],
    },
    "split-brain": {
      id: "split-brain",
      title: "Package partitioned — split-brain risk",
      summary:
        "The package split; the orphan half has no leader. Re-elect one, then MERGE ON COMMAND — never leave it split.",
      concept:
        "A partition orphaned half the package. The orphan half must re-elect a local leader (Raft/" +
        "Static, as in Team Formation) so it can keep operating — but that means two leaders now exist. " +
        "The halves must MERGE ONLY ON COMMAND once contact is restored; A-GRA never auto-merges, because " +
        "a silent merge of two leaders is the split-brain hazard. Leaving the package split loses.",
      focus: { kind: "node", id: "acp3" },
      actions: ["pickElection", "mergeTeam"],
    },
  },

  build(seed, opts = {}) {
    const config = { ...DEFAULT_CONFIG, ...opts.config, seed };
    const nodes: Record<string, SimNode> = {
      qb: mkNode("qb", "QB", "QB", "QB"),
      lre: mkNode("lre", "LRE", "LRE", "LRE"),
      acp1: mkNode("acp1", "ACP", "AVC", "ACP-1", true),
      acp2: mkNode("acp2", "ACP", "AVC", "ACP-2"),
      acp3: mkNode("acp3", "ACP", "AVC", "ACP-3"),
    };
    const links: Record<string, Link> = {
      rtbReqQb: cleanLink({ id: "rtbReqQb", from: "acp1", to: "qb", cls: "C2" }),
      rtbRepQb: cleanLink({ id: "rtbRepQb", from: "qb", to: "acp1", cls: "C2" }),
      rtbReqLre: cleanLink({ id: "rtbReqLre", from: "acp1", to: "lre", cls: "C2" }),
      rtbRepLre: cleanLink({ id: "rtbRepLre", from: "lre", to: "acp1", cls: "C2" }),
      acp1_acp2: cleanLink({ id: "acp1_acp2", from: "acp1", to: "acp2", cls: "P2P" }),
      acp2_acp1: cleanLink({ id: "acp2_acp1", from: "acp2", to: "acp1", cls: "P2P" }),
      acp1_acp3: cleanLink({ id: "acp1_acp3", from: "acp1", to: "acp3", cls: "P2P" }),
      acp3_acp1: cleanLink({ id: "acp3_acp1", from: "acp3", to: "acp1", cls: "P2P" }),
      acp2_acp3: cleanLink({ id: "acp2_acp3", from: "acp2", to: "acp3", cls: "P2P" }),
      acp3_acp2: cleanLink({ id: "acp3_acp2", from: "acp3", to: "acp2", cls: "P2P" }),
    };
    return {
      scenarioId: "phase7",
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
          text: "Phase 7 — RTB @ Bingo. Package needs to return to base.",
          severity: "info",
        },
      ],
      nextSeq: 0,
      config,
    };
  },

  seedDemand(s) {
    // The RTB is first (mis)routed to the QB — the wrong authority.
    issueRtb(s, "qb");
  },

  fireContingency(s) {
    if (s.tick !== s.config.contingencyTick || s.partition) return;
    s.partition = [["acp1"], [...ORPHAN]];
    for (const id of CROSSING) {
      const link = s.links[id];
      if (link) {
        link.channel = "BAD";
        link.pGoodToBad = 1;
        link.pBadToGood = 0;
        link.blockBad = 1; // severed — nothing crosses the partition
        link.ackLoss = 1;
      }
    }
    log(s, "Package partitioned — ACP-2/ACP-3 orphaned from the leader.", "degrade");
    raiseBeat(s, phase7, "split-brain");
  },

  applyAction(s, action) {
    switch (action.type) {
      case "handBack":
        // Transfer authority QB→LRE: re-issue the RTB to the LRE role.
        issueRtb(s, "lre");
        log(s, "Authority handed back QB → LRE for RTB.", "info");
        return true;
      case "pickElection":
        // The orphan half re-elects a local leader (reuses the L3 election flow).
        startElection(
          s,
          action.method,
          ORPHAN.flatMap((id) => (s.nodes[id] ? [s.nodes[id]] : [])),
          ORPHAN_FITNESS,
          installOrphanLeader,
        );
        return true;
      case "mergeTeam": {
        // Heal the split ON COMMAND: collapse back to a single leader (ACP-1) and restore
        // the crossing links.
        s.partition = undefined;
        s.election = undefined;
        for (const n of Object.values(s.nodes)) n.isLeader = n.id === "acp1";
        for (const id of CROSSING) {
          const link = s.links[id];
          if (link) {
            link.channel = "GOOD";
            link.pGoodToBad = 0;
            link.pBadToGood = 1;
            link.blockBad = 0;
            link.ackLoss = 0;
          }
        }
        log(s, "Package merged on command — single leader (ACP-1) restored.", "success");
        return true;
      }
      default:
        return false;
    }
  },

  onDelivered(s, msg) {
    // Election traffic (orphan re-election).
    handleElectionDelivery(s, msg, installOrphanLeader);

    // RTB request arrived — adjudicate at the destination's role.
    if (msg.type === "MA_TaskCommandMT" && msg.ixn) {
      const ixn = s.interactions[msg.ixn];
      const dest = destNode(s, msg);
      if (!ixn || !dest) return;
      const status = adjudicate(dest.role, "LRE"); // RTB requires the LRE role
      const reply = spawn(s, {
        type: "MA_TaskStatusMT",
        cls: "C2",
        route: [REPLY_LINK[dest.id] ?? "rtbRepQb"],
        leg: "reply",
        ixn: ixn.id,
        approval: status,
        authorityVerified: status === "APPROVED",
      });
      ixn.reply = reply.id;
      ixn.status = status === "APPROVED" ? "approved" : "rejected";
      if (status === "REJECTED") {
        log(s, "RTB REJECTED at destination — arrival ≠ authority.", "fail");
        raiseBeat(s, phase7, "authority-handback");
      } else {
        log(s, "LRE authorised RTB — MA_TaskStatusMT(APPROVED) en route → ACP-1.", "info");
      }
    }
  },

  evaluateOutcome(s) {
    if (s.outcome !== "pending") return;
    const authorised = rtbAuthorised(s);
    const healed = !s.partition && leaderCount(s) === 1;

    if (authorised && healed) {
      s.outcome = "win";
      s.objective = "complete";
      log(s, "RTB authorised by the LRE and the package is whole — cleared to return.", "success");
      return;
    }
    s.objective = "in_progress";

    if (s.tick > s.config.wezWindow) {
      s.outcome = "loss";
      s.objective = "missed";
      s.failReason = !authorised
        ? "RTB never authorised — bingo fuel with wrong authority"
        : "split-brain unresolved — two leaders, package never merged";
      log(s, s.failReason, "fail");
    }
  },
};
