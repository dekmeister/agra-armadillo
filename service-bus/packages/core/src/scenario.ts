/**
 * OV-1 Phase 6 — "Threat Engagement at CAP" — the MVP scenario.
 *
 * Topology (no central DMS — each platform runs its OWN DMS instance; the OTA
 * layer is a DDS/RTPS pub-sub mesh, no central broker):
 *   QB (Target Authority) ── ACP-1 (package leader) ── ACP-2, ACP-3
 *
 * Interfaces in play: C2 (the gated strike-approval round trip) + P2P (COP
 * keep-alive fan-out among the ACPs). Only these + the MS reroute path cross the
 * contested air; VI / local sensor reads are on-platform and reliable, hence
 * absent here. Every OTA hop already traverses two DMS instances (sender +
 * receiver); a "relay" is simply a second path through *another platform's* DMS.
 *
 * Links (directed — A->B != B->A):
 *   req           ACP-1 -> QB     C2    GOOD  (approval request path)
 *   bad           QB -> ACP-1     C2    flips BAD at the contingency (the reply path)
 *   p2p           ACP-1 -> ACP-2  P2P   GOOD  (COP fan-out)
 *   p2p3          ACP-1 -> ACP-3  P2P   GOOD  (COP fan-out)
 *   relayQbAcp2   QB -> ACP-2     MS    GOOD  (reroute hop 1, via ACP-2's DMS)
 *   relayAcp2Acp1 ACP-2 -> ACP-1  MS    GOOD  (reroute hop 2, via ACP-2's DMS)
 *
 * [S] Background C2 on `bad` is routine command traffic (MA_RulesOfEngagementCommandMT),
 *     kept C2-only to honour the topology guard rail (the handoff mock's "P2P·3"
 *     backlog on a QB->ACP link would mis-state topology — see docs/01).
 */
import type { GameState, Link, ScenarioConfig, SimNode } from "./types.ts";

export interface ScenarioOpts {
  /** Override the QB node's role to demonstrate misrouting to a non-authority (RBAC tests). */
  qbRole?: SimNode["role"];
  config?: Partial<ScenarioConfig>;
}

export const DEFAULT_CONFIG: ScenarioConfig = {
  seed: 1,
  wezWindow: 18,
  contingencyTick: 2,
  copDecay: 0.4,
  copStart: 62,
  copThreshold: 25,
  copSyncPeriod: 6,
  bgC2Period: 4,
  scoreStart: 7420,
  scoreWin: 850,
  scoreMiss: 300,
};

/** Routine C2 messages pre-seeded ahead of the reply on the BAD link. */
export const ROUTINE_BACKLOG = 6;

function node(
  id: string,
  kind: SimNode["kind"],
  role: SimNode["role"],
  label: string,
  isLeader = false,
): SimNode {
  return { id, kind, role, label, isLeader };
}

function link(p: Partial<Link> & Pick<Link, "id" | "from" | "to" | "cls">): Link {
  return {
    bandwidthCap: 1,
    latency: 1,
    channel: "GOOD",
    pGoodToBad: 0.02,
    pBadToGood: 0.5,
    blockGood: 0.02,
    blockBad: 0.9,
    ackLoss: 0.05,
    policy: "fifo",
    queue: [],
    ...p,
  };
}

export function buildPhase6(seed: number, opts: ScenarioOpts = {}): GameState {
  const config: ScenarioConfig = { ...DEFAULT_CONFIG, ...opts.config, seed };

  const nodes: Record<string, SimNode> = {
    qb: node("qb", "QB", opts.qbRole ?? "QB", "QB"),
    acp1: node("acp1", "ACP", "AVC", "ACP-1", true),
    acp2: node("acp2", "ACP", "Observer", "ACP-2"),
    acp3: node("acp3", "ACP", "AVC", "ACP-3"),
  };

  const links: Record<string, Link> = {
    req: link({ id: "req", from: "acp1", to: "qb", cls: "C2" }),
    // The reply path. Reliable until the scripted contingency degrades it (see
    // engine.fireContingency), after which it is bursty: short GOOD windows amid
    // long BAD bursts. FIFO spends those scarce windows on routine traffic; EDF/
    // Class float the deadline-critical reply to the front.
    bad: link({ id: "bad", from: "qb", to: "acp1", cls: "C2" }),
    p2p: link({ id: "p2p", from: "acp1", to: "acp2", cls: "P2P" }),
    p2p3: link({ id: "p2p3", from: "acp1", to: "acp3", cls: "P2P" }),
    // Reroute path via ACP-2's DMS instance — reliable but higher latency (the
    // reroute trades latency for link health; the DDS mesh routes around the BAD hop).
    relayQbAcp2: link({ id: "relayQbAcp2", from: "qb", to: "acp2", cls: "MS", latency: 2 }),
    relayAcp2Acp1: link({ id: "relayAcp2Acp1", from: "acp2", to: "acp1", cls: "MS", latency: 2 }),
  };

  return {
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
    objective: "stalled",
    outcome: "pending",
    failReason: null,
    score: config.scoreStart,
    log: [{ tick: 0, text: "Phase 6 — Threat Engagement at CAP. COP flowing.", severity: "info" }],
    nextSeq: 0,
    config,
  };
}
