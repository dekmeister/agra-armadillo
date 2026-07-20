/**
 * OV-1 Phase 1 — "Launch" — the campaign's first level and pure vocabulary.
 *
 * Teaches the words the rest of the game uses, on a clean link so nothing else is in
 * the way:
 *  - an interaction is a ROUND TRIP (request + required status reply);
 *  - watch a message walk PENDING -> EXECUTING -> SENT (the DMS lifecycle);
 *  - VI and MS fire on-platform for FREE while the C2 command crosses the contested air;
 *  - an LRE may authorise takeoff (its authority is narrow — takeoff/landing only).
 *
 * Topology:
 *   LRE (C2 ground node) <-> ACP-1 (leader)   — one clean C2 link pair
 *   ACP-1 -> ACP-1                              — free, reliable on-platform VI and MS loops
 *
 * Links (directed):
 *   cmdReq   ACP-1 -> LRE   C2   request: "request takeoff authorisation"
 *   cmdRep   LRE -> ACP-1   C2   reply:   MA_TaskStatusMT (authorised)
 *   vi       ACP-1 -> ACP-1 VI   on-platform MA_FlightCommandMT — never crosses the air [S]
 *   ms       ACP-1 -> ACP-1 MS   on-platform MA <-> local Mission Systems over the ASB [S]
 *
 * The MS traffic is the PNT service package, verbatim from the Mission Systems Interface
 * Volume §1.2.7.1 "Request PNT Navigation Data" (~L2063-2085):
 *   MA -> MS  SubsystemStatusDataRequestMT        "can you provide position?"
 *   MS -> MA  SubsystemStatusDataRequestStatusMT  health/status of the MS
 *   MA -> MS  SubsystemSettingsCommandMT          set the PNT publish frequency
 *   MS -> MA  MA_PositionReportDetailedMT         the PNT product, published periodically
 * All four names are XSD-confirmed. This runs MA <-> *local* MS over the on-platform ASB,
 * so like VI it is reliable and costs no air — which is exactly the lesson of this level.
 *
 * No degradation, no deadline, no COP. Essentially unloseable — teaching by
 * observation, not punishment.
 */

import { log, mkLink, mkNode, raiseBeat, spawn } from "../runtime.ts";
import type { ScenarioDef } from "../scenario-def.ts";
import type { GameState, Interaction, Link, Message, SimNode } from "../types.ts";

/** VI fan cadence — a free on-platform command every few ticks. */
const VI_PERIOD = 3;
/**
 * PNT publication cadence once the MS has been commanded (the frequency
 * SubsystemSettingsCommandMT sets). Offset from VI_PERIOD so the two on-platform
 * loops are visibly distinct rather than moving in lockstep.
 */
const PNT_PERIOD = 4;

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

/**
 * Open the PNT exchange: MA asks its local MS whether it can supply position.
 * MS Volume §1.2.7.1, step 1.
 */
function pntInteraction(s: GameState): Interaction {
  const id = `ixn-${s.nextSeq}`;
  const req = spawn(s, {
    type: "SubsystemStatusDataRequestMT",
    cls: "MS",
    route: ["ms"],
    leg: "request",
    ixn: id,
    priority: 1,
  });
  const ixn: Interaction = { id, kind: "pnt", request: req.id, reply: null, status: "open" };
  s.interactions[id] = ixn;
  log(s, "ACP-1 MA → local MS: SubsystemStatusDataRequestMT (can you provide PNT?).", "info");
  return ixn;
}

/** Look an interaction up by kind — this level runs two concurrently (takeoff + PNT). */
function byKind(s: GameState, kind: Interaction["kind"]): Interaction | null {
  return Object.values(s.interactions).find((i) => i.kind === kind) ?? null;
}

function activeTakeoff(s: GameState): Interaction | null {
  return byKind(s, "takeoff");
}

/** True once the PNT service has been commanded and is publishing. */
function pntPublishing(s: GameState): boolean {
  return byKind(s, "pnt")?.status === "delivered";
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
      title: "VI and MS are on-platform — and free",
      summary:
        "The VI command to Flight Autonomy and the MS PNT exchange never cross the air: no burst loss, no bandwidth cost.",
      concept:
        "Two of the loops on this board stay aboard the aircraft. VI (MA ↔ Flight Autonomy) and the " +
        "MA ↔ local Mission Systems exchange both ride the on-platform Abstract Service Bus, so they " +
        "never traverse the contested OTA mesh, never suffer Gilbert–Elliott bursts, and cost no air " +
        "bandwidth. The MS loop here is the PNT service package: MA asks whether position is available, " +
        "commands a publish rate, and MA_PositionReportDetailedMT starts flowing. Only C2, P2P and " +
        "MS/DMS updates between platforms cross the air — which is why the C2 takeoff can stall later " +
        "and these two never will.",
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
      // MA <-> local Mission Systems over the on-platform ASB — as reliable as VI.
      ms: cleanLink({ id: "ms", from: "acp1", to: "acp1", cls: "MS" }),
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
    // PNT init runs alongside the takeoff request — the ACP needs position and time
    // before it is useful, and it costs the air nothing to get it.
    pntInteraction(s);
  },

  generateDemand(s) {
    // Free on-platform VI loop — fires forever at no air cost, always delivered.
    // Starts at tick 1 so on-platform-free is raised before the takeoff round trip wins.
    if (s.tick % VI_PERIOD === 1) {
      spawn(s, { type: "MA_FlightCommandMT", cls: "VI", route: ["vi"], leg: "oneway" });
      raiseBeat(s, phase1, "on-platform-free");
    }
    // Once the PNT service has been commanded, it publishes position at the frequency
    // it was set to (MS Vol §1.2.7.1) — another free on-platform loop.
    if (pntPublishing(s) && s.tick % PNT_PERIOD === 0) {
      spawn(s, { type: "MA_PositionReportDetailedMT", cls: "MS", route: ["ms"], leg: "oneway" });
    }
  },

  onDelivered(s, msg) {
    // --- the PNT exchange, MS Vol §1.2.7.1 steps 2 and 3 ---
    if (msg.type === "SubsystemStatusDataRequestMT" && msg.ixn) {
      // Step 2: the MS reports its health/status back to MA.
      const ixn = s.interactions[msg.ixn];
      if (ixn) {
        const reply = spawn(s, {
          type: "SubsystemStatusDataRequestStatusMT",
          cls: "MS",
          route: ["ms"],
          leg: "reply",
          ixn: ixn.id,
        });
        ixn.reply = reply.id;
        ixn.status = "approved";
        log(s, "Local MS → MA: SubsystemStatusDataRequestStatusMT (PNT available).", "info");
      }
      return;
    }
    if (msg.type === "SubsystemStatusDataRequestStatusMT" && msg.ixn) {
      // Step 3: MA commands the PNT service's publish frequency.
      spawn(s, {
        type: "SubsystemSettingsCommandMT",
        cls: "MS",
        route: ["ms"],
        leg: "oneway",
        ixn: msg.ixn,
      });
      log(s, "MA → local MS: SubsystemSettingsCommandMT (set PNT publish rate).", "info");
      return;
    }
    if (msg.type === "SubsystemSettingsCommandMT" && msg.ixn) {
      const ixn = s.interactions[msg.ixn];
      if (ixn) ixn.status = "delivered";
      log(s, "PNT service configured — MA_PositionReportDetailedMT now publishing.", "success");
      return;
    }

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
