/**
 * OV-1 Phase 2 — "Hold" — the failure-vocabulary level, met calmly.
 *
 * Teaches how OTA links actually fail, with no deadline and low stakes so the player
 * can absorb the words before Phase 6 weaponises them:
 *  - links fail in BURSTS (Gilbert–Elliott GOOD↔BAD), not as independent coin flips;
 *  - FAIL_UNSENT = couldn't get on the air (cheap — it auto-retries next tick);
 *  - FAIL_MISSING_ACK = it left, but no confirmation came back (the insidious one);
 *  - arrival ≠ confirmation: a report may have landed and you cannot know.
 *
 * Topology:
 *   ACP-1 -> LRE   one flapping C2 link carrying periodic status reports
 *   ACP-1 -> ACP-1 the free on-platform VI loop (unaffected by the bursts)
 *
 * Goal: get TARGET status reports confirmed (SENT) before the hold window ends. A
 * FAIL_MISSING_ACK report is terminal until the player chooses to `retry` it.
 */

import { log, mkLink, mkNode, raiseBeat, spawn } from "../runtime.ts";
import type { ScenarioDef } from "../scenario-def.ts";
import type { GameState, Link, Message, SimNode } from "../types.ts";

const STATUS_PERIOD = 2; // a status report every other tick
const VI_PERIOD = 3;
const TARGET = 7; // confirmed reports needed to clear the hold (of ~12 sent)

const DEFAULT_CONFIG = {
  seed: 1,
  mode: "tutorial" as const,
  wezWindow: 24, // hold-window length (ticks)
  contingencyTick: 3, // a scripted BAD burst, so the lesson always fires
  copDecay: 0,
  copStart: 100,
  copThreshold: 0, // COP unused this level
  copSyncPeriod: 6,
  bgC2Period: 4,
};

function statusLink(p: Partial<Link> & Pick<Link, "id" | "from" | "to" | "cls">): Link {
  // Bursty with a real ack-loss rate: FAIL_UNSENT auto-retries (cheap), but
  // FAIL_MISSING_ACK is terminal — so passivity can fall short of TARGET and
  // actively retrying the unconfirmed reports is what clears the hold.
  return mkLink({
    pGoodToBad: 0.15,
    pBadToGood: 0.55,
    blockGood: 0.03,
    blockBad: 0.6,
    ackLoss: 0.2,
    ...p,
  });
}

function cleanLink(p: Partial<Link> & Pick<Link, "id" | "from" | "to" | "cls">): Link {
  return mkLink({ pGoodToBad: 0, pBadToGood: 1, blockGood: 0, blockBad: 0, ackLoss: 0, ...p });
}

function reports(s: GameState): Message[] {
  return Object.values(s.messages).filter((m) => m.type === "MA_CommTeamReportMT");
}

function confirmed(s: GameState): number {
  return reports(s).filter((m) => m.state === "SENT").length;
}

export const phase2: ScenarioDef = {
  id: "phase2",
  phase: 2,
  title: "Hold",
  defaultConfig: DEFAULT_CONFIG,
  tutorialSeed: 7, // scanned: passive play loses, actively retrying MISSING_ACK wins
  beats: {
    "burst-loss": {
      id: "burst-loss",
      title: "The link just dropped into a BAD burst",
      summary:
        "Gilbert–Elliott flipped the status link to BAD — losses now come in bursts, not one-offs.",
      concept:
        "Tactical RF links fail in bursts (fade, terrain mask, jam), so this game models the channel " +
        "as a two-state Gilbert–Elliott chain, not independent per-message loss. While the link sits in " +
        "BAD, dispatches mostly can't get on the air (FAIL_UNSENT) — but those just re-queue and retry " +
        "next tick. The VI loop, being on-platform, is untouched.",
      focus: { kind: "link", id: "status" },
      actions: [],
    },
    "missing-ack-intro": {
      id: "missing-ack-intro",
      title: "FAIL_MISSING_ACK — sent, but unconfirmed",
      summary:
        "A report left the queue but no ack returned. It may have arrived — you cannot tell. Retry it?",
      concept:
        "FAIL_MISSING_ACK is the insidious failure: the message left (so it is NOT auto-retried like " +
        "FAIL_UNSENT) but no delivery confirmation came back. The report may already be sitting at the " +
        "LRE. Here it's harmless to just retry. In Phase 6 the same state on a strike-approval reply " +
        "forces a real dilemma — retry and risk double action, or wait and risk the deadline.",
      focus: { kind: "link", id: "status" },
      actions: ["retry"],
    },
  },

  build(seed, opts = {}) {
    const config = { ...DEFAULT_CONFIG, ...opts.config, seed };
    const nodes: Record<string, SimNode> = {
      lre: mkNode("lre", "LRE", "LRE", "LRE"),
      acp1: mkNode("acp1", "ACP", "AVC", "ACP-1", true),
    };
    const links: Record<string, Link> = {
      status: statusLink({ id: "status", from: "acp1", to: "lre", cls: "C2" }),
      vi: cleanLink({ id: "vi", from: "acp1", to: "acp1", cls: "VI" }),
    };
    return {
      scenarioId: "phase2",
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
      log: [{ tick: 0, text: "Phase 2 — Hold. Sending periodic status to LRE.", severity: "info" }],
      nextSeq: 0,
      config,
    };
  },

  seedDemand() {
    // Reports are generated per-tick in generateDemand.
  },

  fireContingency(s) {
    const link = s.links.status;
    if (link && s.tick === s.config.contingencyTick) {
      link.channel = "BAD";
      link.pGoodToBad = 0.25;
      link.pBadToGood = 0.4; // a felt BAD burst, but GOOD windows still return
      link.ackLoss = 0.3;
      log(s, "Status link dropped into a BAD burst — reports now lossy.", "degrade");
      raiseBeat(s, phase2, "burst-loss");
    }
  },

  generateDemand(s) {
    if (s.tick <= s.config.wezWindow && s.tick % STATUS_PERIOD === 0) {
      spawn(s, { type: "MA_CommTeamReportMT", cls: "C2", route: ["status"], leg: "oneway" });
    }
    if (s.tick % VI_PERIOD === 0) {
      spawn(s, { type: "MA_VehicleCommandMT", cls: "VI", route: ["vi"], leg: "oneway" });
    }
  },

  onLegFailed(s, msg) {
    // FAIL_MISSING_ACK is terminal here (no auto-retry) — surface the lesson.
    if (msg.type === "MA_CommTeamReportMT") {
      log(s, "status report MISSING_ACK — left the queue, never confirmed.", "degrade");
      raiseBeat(s, phase2, "missing-ack-intro", { kind: "token", id: msg.id });
    }
  },

  applyAction(s, action) {
    if (action.type === "retry") {
      let n = 0;
      for (const m of reports(s)) {
        if (m.state === "FAIL_MISSING_ACK") {
          m.state = "PENDING";
          m.hop = 0;
          s.links.status?.queue.push(m.id);
          n += 1;
        }
      }
      if (n > 0) log(s, `Re-attempting ${n} unconfirmed status report(s).`, "info");
      return true;
    }
    return false;
  },

  evaluateOutcome(s) {
    if (s.outcome !== "pending") return;
    const got = confirmed(s);
    if (got >= TARGET) {
      s.outcome = "win";
      s.objective = "complete";
      log(s, `Hold cleared — ${got}/${TARGET} status reports confirmed.`, "success");
      return;
    }
    s.objective = "in_progress";
    // Hold window closed without enough confirmations (no more reports will spawn).
    if (s.tick > s.config.wezWindow) {
      s.outcome = "loss";
      s.objective = "missed";
      s.failReason = `hold window closed with only ${got}/${TARGET} reports confirmed`;
      log(s, s.failReason, "fail");
    }
  },
};
