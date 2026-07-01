/**
 * OV-1 Phase 1 — "Launch" — the campaign's first level and pure vocabulary.
 *
 * Teaches the words the rest of the game uses, on a clean link so nothing else is in
 * the way:
 *  - an interaction is a ROUND TRIP (request + required status reply);
 *  - watch a message walk PENDING -> EXECUTING -> SENT (the DMS lifecycle);
 *  - VI fires on-platform for FREE while the C2 command crosses the contested air;
 *  - an LRE may authorise takeoff (its authority is narrow — takeoff/landing only).
 *
 * Topology:
 *   LRE (C2 ground node) <-> ACP-1 (leader)   — one clean C2 link pair
 *   ACP-1 -> ACP-1                              — a free, reliable on-platform VI loop
 *
 * Links (directed):
 *   cmdReq   ACP-1 -> LRE   C2   request: "request takeoff authorisation"
 *   cmdRep   LRE -> ACP-1   C2   reply:   MA_TaskStatusMT (authorised)
 *   vi       ACP-1 -> ACP-1 VI   on-platform MA_VehicleCommandMT — never crosses the air [S]
 *
 * No degradation, no deadline, no COP. Essentially unloseable — teaching by
 * observation, not punishment.
 */

import { log, mkLink, mkNode, raiseBeat, spawn } from "../runtime.ts";
import type { ScenarioDef } from "../scenario-def.ts";
import type { GameState, Interaction, Link, Message, SimNode } from "../types.ts";

/** VI fan cadence — a free on-platform command every few ticks. */
const VI_PERIOD = 3;

const DEFAULT_CONFIG = {
  seed: 1,
  mode: "tutorial" as const,
  wezWindow: 30, // level length (ticks) — no real deadline
  contingencyTick: 999, // no contingency
  copDecay: 0,
  copStart: 100,
  copThreshold: 0, // COP unused this level
  copSyncPeriod: 6,
  bgC2Period: 4,
};

/** A perfectly clean link (no burst, no block, no ack loss). */
function cleanLink(p: Partial<Link> & Pick<Link, "id" | "from" | "to" | "cls">): Link {
  return mkLink({ pGoodToBad: 0, pBadToGood: 1, blockGood: 0, blockBad: 0, ackLoss: 0, ...p });
}

function takeoffInteraction(s: GameState): Interaction {
  const id = `ixn-${s.nextSeq}`;
  const req = spawn(s, {
    type: "MA_TaskCommandMT",
    cls: "C2",
    route: ["cmdReq"],
    leg: "request",
    ixn: id,
    priority: 2,
  });
  const ixn: Interaction = { id, kind: "takeoff", request: req.id, reply: null, status: "open" };
  s.interactions[id] = ixn;
  log(s, "ACP-1 → LRE: requesting takeoff authorisation (MA_TaskCommandMT).", "info");
  return ixn;
}

function activeTakeoff(s: GameState): Interaction | null {
  return Object.values(s.interactions)[0] ?? null;
}

export const phase1: ScenarioDef = {
  id: "phase1",
  phase: 1,
  title: "Launch",
  defaultConfig: DEFAULT_CONFIG,
  tutorialSeed: 1, // unloseable (clean links) — any seed teaches by observation
  beats: {
    lifecycle: {
      id: "lifecycle",
      title: "An interaction is a round trip",
      summary:
        "The takeoff request is in flight (EXECUTING). It will deliver (SENT), the LRE replies, and the round trip closes.",
      concept:
        "A 'cargo' in this game is an interaction: a request plus its required status reply — the unit " +
        "A-GRA compliance is assessed at. Each leg walks the DMS lifecycle PENDING → EXECUTING → SENT. " +
        "The takeoff isn't done when the request arrives; it's done when the LRE's reply gets back.",
      focus: { kind: "link", id: "cmdReq" },
      actions: [],
    },
    "on-platform-free": {
      id: "on-platform-free",
      title: "VI is on-platform — and free",
      summary:
        "The VI command to Flight Autonomy never crosses the air: no burst loss, no bandwidth cost.",
      concept:
        "VI (MA ↔ Flight Autonomy) is on-platform and reliable — it does not traverse the contested " +
        "OTA mesh, so it never suffers Gilbert–Elliott bursts and costs no air bandwidth. Only C2, P2P " +
        "and MS/DMS updates cross the air. Keep that split in mind: it's why the C2 takeoff can stall " +
        "later and the VI loop never will.",
      focus: { kind: "link", id: "vi" },
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
      // latency 2 so the lifecycle + on-platform-free beats both surface before the win.
      cmdReq: cleanLink({ id: "cmdReq", from: "acp1", to: "lre", cls: "C2", latency: 2 }),
      cmdRep: cleanLink({ id: "cmdRep", from: "lre", to: "acp1", cls: "C2", latency: 2 }),
      vi: cleanLink({ id: "vi", from: "acp1", to: "acp1", cls: "VI" }),
    };
    return {
      scenarioId: "phase1",
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
        { tick: 0, text: "Phase 1 — Launch. ACPs take off under LRE oversight.", severity: "info" },
      ],
      nextSeq: 0,
      config,
    };
  },

  seedDemand(s) {
    takeoffInteraction(s);
  },

  generateDemand(s) {
    // Free on-platform VI loop — fires forever at no air cost, always delivered.
    // Starts at tick 1 so on-platform-free is raised before the takeoff round trip wins.
    if (s.tick % VI_PERIOD === 1) {
      spawn(s, { type: "MA_VehicleCommandMT", cls: "VI", route: ["vi"], leg: "oneway" });
      raiseBeat(s, phase1, "on-platform-free");
    }
  },

  onDelivered(s, msg) {
    if (msg.type === "MA_TaskCommandMT" && msg.ixn) {
      // LRE authorises takeoff (its narrow authority) — emit the status reply.
      const ixn = s.interactions[msg.ixn];
      if (ixn) {
        ixn.status = "approved";
        const reply = spawn(s, {
          type: "MA_TaskStatusMT",
          cls: "C2",
          route: ["cmdRep"],
          leg: "reply",
          ixn: ixn.id,
          authorityVerified: true,
        });
        ixn.reply = reply.id;
        log(s, "LRE authorised takeoff — MA_TaskStatusMT en route → ACP-1.", "info");
      }
    }
  },

  checkStandingBeats(s) {
    if (s.pendingBeat || s.outcome !== "pending") return;
    const ixn = activeTakeoff(s);
    const req = ixn ? s.messages[ixn.request] : null;
    if (req && req.state === "EXECUTING") raiseBeat(s, phase1, "lifecycle");
  },

  evaluateOutcome(s) {
    if (s.outcome !== "pending") return;
    const ixn = activeTakeoff(s);
    const reply: Message | null = ixn?.reply ? (s.messages[ixn.reply] ?? null) : null;
    s.objective = reply && reply.state === "SENT" ? "complete" : "in_progress";
    if (reply && reply.state === "SENT" && ixn) {
      s.outcome = "win";
      ixn.status = "delivered";
      log(s, "Takeoff authorisation round trip complete — wheels up.", "success");
    }
  },
};
