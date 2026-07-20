/**
 * OV-1 Phase 8 — "Land" — the campaign capstone.
 *
 * Closes the arc opened in L1 (Launch): a clean, LRE-authorised landing round-trip, now
 * fluent, on the far side of having seen the QB's strike authority in L6 and the RTB
 * authority hand-back in L7. The single lesson it reinforces is that AUTHORITY IS
 * CONTEXTUAL — landing, like takeoff and RTB, is the LRE's call, not the QB's. It doubles
 * as the whole-campaign debrief (the six-interface tour, recapped).
 *
 * Topology (identical shape to L1, the level this bookends):
 *   ACP-1 (leader) <-C2-> LRE     one clean landing round trip
 *   ACP-1 -> ACP-1                the on-platform VI loop flying the final approach
 *
 * The VI loop is the other half of the bookend: L1 opened with MA_FlightCommandMT taking
 * the aircraft off, L8 closes with it flying the approach. VI control modes for final
 * approach are the Vehicle Interface Volume's own territory (WaypointFollowing / Heading,
 * Tables A-1-52/53/56) — and, as in L1, it never crosses the air.
 *
 * [S] takeoff/landing/RTB collapsed to one MA_TaskCommandMT/MA_TaskStatusMT round trip.
 *     No degradation — the capstone is about fluency and recap, not new stress.
 */

import { adjudicate } from "../rbac.ts";
import { destNode, log, mkLink, mkNode, raiseBeat, spawn } from "../runtime.ts";
import type { ScenarioDef } from "../scenario-def.ts";
import type { GameState, Interaction, Link, Message, SimNode } from "../types.ts";

/** VI cadence on the approach — mirrors L1's free on-platform loop. */
const VI_PERIOD = 2;

const DEFAULT_CONFIG = {
  seed: 1,
  mode: "tutorial" as const,
  wezWindow: 30,
  contingencyTick: 999,
  copDecay: 0,
  copStart: 100,
  copThreshold: 0,
  copSyncPeriod: 6,
  bgC2Period: 4,
};

function cleanLink(p: Partial<Link> & Pick<Link, "id" | "from" | "to" | "cls">): Link {
  return mkLink({ pGoodToBad: 0, pBadToGood: 1, blockGood: 0, blockBad: 0, ackLoss: 0, ...p });
}

function activeLanding(s: GameState): Interaction | null {
  return Object.values(s.interactions)[0] ?? null;
}

export const phase8: ScenarioDef = {
  id: "phase8",
  phase: 8,
  title: "Land",
  principle: "the same command type means different things at different destinations",
  defaultConfig: DEFAULT_CONFIG,
  tutorialSeed: 1, // unloseable capstone — clean LRE-authorised landing
  beats: {
    "campaign-debrief": {
      id: "campaign-debrief",
      takeaway:
        "The same C2 command type means different things at different destinations; landing is the LRE's.",
      title: "Landing clearance is the LRE's to give",
      summary:
        "The request has reached the LRE. Landing is its call, like takeoff (L1) and RTB (L7) — never the QB's.",
      concept:
        "Watch the last round trip close. The same C2 command type you sent in L1 and L7 is in flight " +
        "again, and once again what decides the outcome is not where it went but who was standing at the " +
        "other end: the LRE holds takeoff, landing and recovery, and holds nothing else. In L6 the very " +
        "same pattern with the QB at the far end released a weapon — and a request that reached a node " +
        "without that authority arrived perfectly and did nothing. Authority is contextual, checked at " +
        "the destination, every time.",
      focus: { kind: "link", id: "landReq" },
      actions: [],
    },
  },

  build(seed, opts = {}) {
    const config = { ...DEFAULT_CONFIG, ...opts.config, seed };
    const nodes: Record<string, SimNode> = {
      lre: mkNode("lre", "LRE", "LRE", "LRE"),
      acp1: mkNode("acp1", "ACP", "AVC", "ACP-1", true),
    };
    const links: Record<string, Link> = {
      // latency 2 so the debrief beat surfaces before the round trip wins.
      landReq: cleanLink({ id: "landReq", from: "acp1", to: "lre", cls: "C2", latency: 2 }),
      landRep: cleanLink({ id: "landRep", from: "lre", to: "acp1", cls: "C2", latency: 2 }),
      vi: cleanLink({ id: "vi", from: "acp1", to: "acp1", cls: "VI" }),
    };
    return {
      scenarioId: "phase8",
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
      playerMoves: [],
      log: [
        {
          tick: 0,
          text: "Phase 8 — Land. Recovering the package under LRE oversight.",
          severity: "info",
        },
      ],
      nextSeq: 0,
      config,
    };
  },

  seedDemand(s) {
    const id = `ixn-${s.nextSeq}`;
    const req = spawn(s, {
      type: "MA_TaskCommandMT",
      cls: "C2",
      route: ["landReq"],
      leg: "request",
      ixn: id,
      priority: 2,
    });
    s.interactions[id] = { id, kind: "landing", request: req.id, reply: null, status: "open" };
    log(s, "ACP-1 → LRE: requesting landing clearance (MA_TaskCommandMT).", "info");
  },

  generateDemand(s) {
    // The approach itself: on-platform VI commands to Flight Autonomy, free and reliable,
    // closing the bookend L1 opened.
    if (s.tick % VI_PERIOD === 1) {
      spawn(s, { type: "MA_FlightCommandMT", cls: "VI", route: ["vi"], leg: "oneway" });
    }
    // The beat used to fire at T+1, narrating the landing round trip before any of it had
    // happened (WP5.5/WP6.1). It now waits for the request to have reached the LRE, so it
    // comments on something the player has watched. The campaign SYNTHESIS proper moved
    // out of here entirely and into the win debrief, where the mission is actually over.
    const ixn = activeLanding(s);
    const req = ixn ? s.messages[ixn.request] : null;
    if (req && (req.state === "SENT" || ixn?.reply)) raiseBeat(s, phase8, "campaign-debrief");
  },

  onDelivered(s, msg) {
    if (msg.type === "MA_TaskCommandMT" && msg.ixn) {
      const ixn = s.interactions[msg.ixn];
      const dest = destNode(s, msg);
      if (!ixn || !dest) return;
      const status = adjudicate(dest.role, "LRE"); // landing is the LRE's authority
      const reply = spawn(s, {
        type: "MA_TaskStatusMT",
        cls: "C2",
        route: ["landRep"],
        leg: "reply",
        ixn: ixn.id,
        approval: status,
        authorityVerified: status === "APPROVED",
      });
      ixn.reply = reply.id;
      ixn.status = status === "APPROVED" ? "approved" : "rejected";
      log(
        s,
        status === "APPROVED"
          ? "LRE cleared landing — MA_TaskStatusMT en route → ACP-1."
          : "Landing clearance REJECTED at destination — not the LRE's authority to give.",
        status === "APPROVED" ? "info" : "fail",
      );
    }
  },

  evaluateOutcome(s) {
    if (s.outcome !== "pending") return;
    const ixn = activeLanding(s);
    const reply: Message | null = ixn?.reply ? (s.messages[ixn.reply] ?? null) : null;
    const done = !!reply && reply.state === "SENT" && reply.approval === "APPROVED";
    s.objective = done ? "complete" : "in_progress";
    if (done && ixn) {
      s.outcome = "win";
      ixn.status = "delivered";
      log(s, "Landing clearance round trip complete — campaign complete. Wheels down.", "success");
    }
  },
};
