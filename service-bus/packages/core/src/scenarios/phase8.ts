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
 *
 * [S] takeoff/landing/RTB collapsed to one MA_TaskCommandMT/MA_TaskStatusMT round trip.
 *     No degradation — the capstone is about fluency and recap, not new stress.
 */

import { adjudicate } from "../rbac.ts";
import { destNode, log, mkLink, mkNode, raiseBeat, spawn } from "../runtime.ts";
import type { ScenarioDef } from "../scenario-def.ts";
import type { GameState, Interaction, Link, Message, SimNode } from "../types.ts";

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
  defaultConfig: DEFAULT_CONFIG,
  tutorialSeed: 1, // unloseable capstone — clean LRE-authorised landing
  beats: {
    "campaign-debrief": {
      id: "campaign-debrief",
      title: "Debrief — landing under LRE authority",
      summary:
        "Landing is the LRE's call, like takeoff (L1) and RTB (L7) — not the QB's. One clean round trip closes the campaign.",
      concept:
        "The campaign toured the topology: C2 command round trips gated by role (LRE for takeoff/landing/" +
        "RTB, QB for weapon employment), P2P for team formation / leader election / COP fan-out, MS/DMS " +
        "reroutes across the contested air, and the on-platform VI/sensor lanes that never leave the " +
        "platform. Only C2/P2P/MS cross the air and feel burst loss, bandwidth and latency. This final " +
        "landing is a clean LRE-authorised round trip — authority is contextual, and here it's the LRE's.",
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
    raiseBeat(s, phase8, "campaign-debrief");
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
      log(s, "LRE cleared landing — MA_TaskStatusMT en route → ACP-1.", "info");
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
