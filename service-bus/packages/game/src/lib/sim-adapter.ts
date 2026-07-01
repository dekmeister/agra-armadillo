/**
 * Pure GameState -> view-model derivations. Keeps Svelte components dumb: they
 * render what these functions return. No mutation, no sim logic beyond reads.
 */

import type { GameState, Interaction, InterfaceClass, Link, Message } from "@service-bus/core";
import { dispatchOrder } from "@service-bus/core";
import {
  alongLink,
  laneFor,
  layoutFor,
  selfLoopPath,
  selfLoopPoint,
  straightPath,
  TOKEN_SIDECAR,
} from "./layout.ts";

export type Selection = { type: "node" | "link" | "token"; id: string } | null;

/** Links as the lane helper wants them (id/from/to/cls). */
function linkList(gs: GameState): { id: string; from: string; to: string; cls: InterfaceClass }[] {
  return Object.values(gs.links).map((l) => ({ id: l.id, from: l.from, to: l.to, cls: l.cls }));
}

/** Token/label placement along a link (self-loops included), on the lane + sidecar. */
function place(gs: GameState, linkId: string, t: number): { x: number; y: number } {
  const nodes = layoutFor(gs.scenarioId).nodes;
  const link = gs.links[linkId];
  if (!link) return { x: 0, y: 0 };
  if (link.from === link.to) {
    const n = nodes[link.from];
    return n ? selfLoopPoint(n) : { x: 0, y: 0 };
  }
  const off = laneFor(linkList(gs), linkId) + TOKEN_SIDECAR;
  return alongLink(nodes, link.from, link.to, t, off);
}

// ---- nodes -----------------------------------------------------------------

/** Outbound queue depth for a node = messages it is currently trying to send. */
function nodeQueueDepth(gs: GameState, nodeId: string): number {
  return Object.values(gs.links)
    .filter((l) => l.from === nodeId)
    .reduce((n, l) => n + l.queue.length, 0);
}

// ---- links -----------------------------------------------------------------

export interface LinkVM {
  id: string;
  d: string;
  cls: Link["cls"];
  bad: boolean;
  width: number;
}

export function linkView(gs: GameState, linkId: string): LinkVM | null {
  const l = gs.links[linkId];
  if (!l) return null;
  const nodes = layoutFor(gs.scenarioId).nodes;
  const from = nodes[l.from];
  const to = nodes[l.to];
  if (!from || !to) return null;
  const d =
    l.from === l.to
      ? selfLoopPath(from)
      : straightPath(nodes, l.from, l.to, laneFor(linkList(gs), linkId));
  // A degraded OTA link renders as stably CONTESTED (amber marching) rather than
  // flickering with every Gilbert-Elliott transition. [S] presentational — the live
  // GOOD/BAD channel is in the Inspector. Phase 6 keeps its exact damping (the reply
  // link reads contested from the contingency on, even during its brief GOOD windows).
  const contested =
    l.channel === "BAD" ||
    (gs.scenarioId === "phase6" && linkId === "bad" && gs.tick >= gs.config.contingencyTick);
  return {
    id: linkId,
    d,
    cls: l.cls,
    bad: contested,
    width: l.cls === "MS" ? 3 : 7,
  };
}

// ---- tokens ----------------------------------------------------------------

export interface TokenVM {
  /** Real message id, or `stack:<linkId>` for a collapsed queue badge. */
  id: string;
  /** For a stack, the head queued message it stands in for (so a click inspects it). */
  headId?: string;
  x: number;
  y: number;
  shape: "square" | "circle";
  cls: Message["cls"];
  state: Message["state"];
  /** If set, this is a queue stack of `count` messages (rendered as one + a badge). */
  count?: number;
}

// Square = C2 command; every other interface class reads as a circle (colour carries
// the class — see Graph.svelte's CLASS_FILL).
const SHAPE: Record<InterfaceClass, "square" | "circle"> = {
  C2: "square",
  P2P: "circle",
  VI: "circle",
  MS: "circle",
  MP: "circle",
  MD: "circle",
};

/**
 * Message tokens. In-flight (EXECUTING) messages render individually and glide
 * along their link; queued (PENDING) messages collapse to ONE token per link at
 * the source with a count badge, so the queue reads as a single source the
 * individual tokens stream out of (rather than an unreadable blob).
 */
export function tokens(gs: GameState, heroId: string | null, frac = 0): TokenVM[] {
  const out: TokenVM[] = [];

  // In-flight: one moving token each. `frac` is the view's wall-clock fraction into the
  // current tick, so `gs.tick + frac` glides the message continuously along its link
  // (constant speed, faithful to the link's fixed latency) instead of snapping per tick.
  for (const f of gs.inFlight) {
    if (f.msg === heroId) continue;
    const m = gs.messages[f.msg];
    const link = gs.links[f.link];
    if (!m || !link) continue;
    const t = clamp01(1 - (f.arrivalTick - (gs.tick + frac)) / Math.max(1, link.latency));
    const p = place(gs, link.id, t);
    out.push({
      id: m.id,
      x: p.x,
      y: p.y,
      shape: SHAPE[m.cls] ?? "circle",
      cls: m.cls,
      state: "EXECUTING",
    });
  }

  // Queued: one stack token per link with a count.
  for (const link of Object.values(gs.links)) {
    const queued = link.queue.filter((id) => id !== heroId && gs.messages[id]?.state === "PENDING");
    const head = queued[0] ? gs.messages[queued[0]] : undefined;
    if (!head) continue;
    // Upper rail (0.3): clears the node rims and sits above the focal hero (t=0.5).
    const p = place(gs, link.id, 0.3);
    out.push({
      id: `stack:${link.id}`,
      headId: head.id,
      x: p.x,
      y: p.y,
      shape: SHAPE[head.cls] ?? "circle",
      cls: head.cls,
      state: "PENDING",
      count: queued.length,
    });
  }
  return out;
}

// ---- the hero strike reply -------------------------------------------------

export interface HeroVM {
  id: string;
  x: number;
  y: number;
  ack: "missing" | "sent" | "fail";
  label: string;
  /** Which side the floating label hangs, so it points away from the corridor. */
  labelSide: "left" | "right";
}

function activeStrike(gs: GameState): Interaction | null {
  const list = Object.values(gs.interactions).filter((i) => i.status !== "failed");
  return list[list.length - 1] ?? Object.values(gs.interactions).at(-1) ?? null;
}

export function heroReply(gs: GameState): HeroVM | null {
  // The bespoke strike-reply glyph (spinning "?", authority seal) is Phase 6's. Other
  // levels render their replies as ordinary tokens — see PLAN_VISUALS.md for per-level
  // hero treatments. [S] presentational gate; the sim reply is identical either way.
  if (gs.scenarioId !== "phase6") return null;
  const ixn = activeStrike(gs);
  const reply = ixn?.reply ? gs.messages[ixn.reply] : null;
  if (!reply) return null;
  const linkId = reply.route[reply.hop] ?? "bad";
  const link = gs.links[linkId];
  // Same sidecar placement as ordinary tokens, so the reply rides beside its rail
  // (not on it) and the rail stays clickable along its length.
  const p = link ? place(gs, linkId, 0.5) : { x: 526, y: 156 };

  let ack: HeroVM["ack"] = "missing";
  let label = "MISSING ACK";
  if (reply.state === "SENT" && reply.authorityVerified) {
    ack = "sent";
    label = "DELIVERED + AUTH";
  } else if (gs.outcome === "loss" || reply.approval === "REJECTED") {
    ack = "fail";
    label = "MISSED";
  }
  // Hang the label outboard (away from the corridor centre at x=560).
  return { id: reply.id, x: p.x, y: p.y, ack, label, labelSide: p.x < 560 ? "left" : "right" };
}

// ---- HUD -------------------------------------------------------------------

export function copColor(cop: number): string {
  if (cop > 50) return "var(--green)";
  if (cop >= 26) return "var(--amber)";
  return "var(--red)";
}

export function wezRemaining(gs: GameState): number | null {
  if (gs.wezDeadlineTick === null) return null;
  return Math.max(0, gs.wezDeadlineTick - gs.tick);
}

export function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---- inspector -------------------------------------------------------------

interface StatRow {
  label: string;
  value: string;
  tone?: "good" | "bad" | "amber" | "blue" | "gold";
}
export interface InspectorVM {
  title: string;
  badge: string;
  badgeTone: "good" | "bad" | "blue" | "gold" | "neutral";
  sub: string;
  rows: StatRow[];
  link: Link | null;
}

export function inspect(gs: GameState, sel: Selection): InspectorVM {
  if (sel?.type === "link") return inspectLink(gs, sel.id);
  if (sel?.type === "node") return inspectNode(gs, sel.id);
  if (sel?.type === "token") return inspectToken(gs, sel.id);
  return inspectLink(gs, defaultLinkId(gs)); // default focus = a degraded link, else the first
}

/** The link to focus when nothing is selected: a contested one if any, else the first. */
export function defaultLinkId(gs: GameState): string {
  const links = Object.values(gs.links);
  const bad = links.find((l) => l.channel === "BAD");
  return (bad ?? links[0])?.id ?? "";
}

/** Selection ring [cx, cy, r] for the current selection, derived from the layout. */
export function highlightFor(gs: GameState, sel: Selection): [number, number, number] | null {
  if (!sel) return null;
  const nodes = layoutFor(gs.scenarioId).nodes;
  if (sel.type === "node") {
    const n = nodes[sel.id];
    return n ? [n.x, n.y, n.r + 14] : null;
  }
  if (sel.type === "link") {
    const l = gs.links[sel.id];
    if (!l) return null;
    const p = place(gs, sel.id, 0.5);
    return [p.x, p.y, 26];
  }
  const m = gs.messages[sel.id];
  const linkId = m?.route[m.hop];
  if (!linkId) return null;
  const p = place(gs, linkId, 0.5);
  return [p.x, p.y, 24];
}

function inspectLink(gs: GameState, id: string): InspectorVM {
  const l = gs.links[id];
  if (!l) return empty();
  const bad = l.channel === "BAD";
  const backlogC2 = l.queue.filter((m) => gs.messages[m]?.cls === "C2").length;
  const backlogP2P = l.queue.filter((m) => gs.messages[m]?.cls === "P2P").length;
  return {
    title: `${l.from.toUpperCase()} → ${l.to.toUpperCase()}`,
    badge: bad ? "BAD" : "GOOD",
    badgeTone: bad ? "bad" : "good",
    sub: `${l.cls} link · directed`,
    link: l,
    rows: [
      { label: "Quality", value: bad ? "bursty / lossy" : "nominal", tone: bad ? "bad" : "good" },
      { label: "Latency", value: `${l.latency * 120} ms`, tone: bad ? "bad" : undefined },
      { label: "Bandwidth", value: `${l.bandwidthCap} msg/tick` },
      {
        label: "Unconfirmed",
        value: `${Math.round(l.ackLoss * 100)}%`,
        tone: bad ? "bad" : undefined,
      },
      { label: "Backlog", value: `C2·${backlogC2}  P2P·${backlogP2P}` },
      { label: "Next dispatch", value: nextDispatch(gs, l), tone: "blue" },
    ],
  };
}

/** What authority a role holds at the destination gate (arrival ≠ authority). */
function authorityOf(role: string): string {
  if (role === "QB") return "weapon employment";
  if (role === "LRE") return "takeoff / land / RTB";
  if (role === "Admin") return "administrative";
  return "none";
}

function inspectNode(gs: GameState, id: string): InspectorVM {
  const n = gs.nodes[id];
  if (!n) return empty();
  const isAuthority = n.kind === "QB" || n.kind === "LRE";
  const cat = isAuthority ? "AUTHORITY" : n.isLeader ? "LEADER" : "AIRCRAFT";
  return {
    title: n.label,
    badge: cat,
    badgeTone: n.kind === "QB" ? "gold" : n.isLeader ? "blue" : isAuthority ? "gold" : "neutral",
    sub: `role ${n.role} · ${n.kind}`,
    link: null,
    rows: [
      { label: "Role", value: n.role, tone: isAuthority ? "gold" : "blue" },
      {
        label: "Authority",
        value: authorityOf(n.role),
        tone: isAuthority ? "good" : undefined,
      },
      { label: "Queued", value: `${nodeQueueDepth(gs, id)} msgs` },
      { label: "Leader", value: n.isLeader ? "yes ★" : "no" },
    ],
  };
}

const CLASS_DESC: Record<InterfaceClass, string> = {
  C2: "command",
  P2P: "peer",
  VI: "on-platform",
  MS: "mission-sys",
  MP: "mission-plan",
  MD: "mission-data",
};

function inspectToken(gs: GameState, id: string): InspectorVM {
  const m = gs.messages[id];
  if (!m) return empty();
  const rows: StatRow[] = [
    { label: "Message", value: m.type, tone: m.cls === "C2" ? "blue" : undefined },
    {
      label: "Class",
      value: `${m.cls} (${CLASS_DESC[m.cls]})`,
      tone: m.cls === "C2" ? "blue" : undefined,
    },
    { label: "Lifecycle", value: m.state, tone: lifecycleTone(m.state) },
  ];
  // A deadline-bearing reply (the gated round trips) shows its countdown + authority.
  if (m.leg === "reply" && (m.deadlineTick !== null || m.approval)) {
    if (m.deadlineTick !== null) {
      const rem = wezRemaining(gs);
      rows.push({ label: "Deadline", value: rem === null ? "standby" : mmss(rem), tone: "bad" });
    }
    if (m.approval) {
      rows.push({
        label: "Authority",
        value: m.authorityVerified ? "verified ✓" : "unverified",
        tone: m.authorityVerified ? "gold" : "bad",
      });
      rows.push({ label: "Note", value: "arrival ≠ authority" });
    }
  }
  return {
    title: m.leg === "reply" ? "Status reply" : m.leg === "request" ? "Request" : "Message",
    badge: m.state,
    badgeTone: lifecycleBadgeTone(m.state),
    sub: `${m.cls} · ${m.leg}`,
    link: null,
    rows,
  };
}

export function nextDispatch(gs: GameState, link: Link): string {
  const order = dispatchOrder(link, gs.messages);
  const head = order[0] ? gs.messages[order[0]] : undefined;
  if (!head) return "idle";
  if (head.leg === "reply") {
    const rem = wezRemaining(gs);
    return `C2 reply${rem !== null ? ` (${mmss(rem)})` : ""}`;
  }
  return head.cls === "P2P" ? "P2P picture (oldest)" : "routine C2 (oldest)";
}

function lifecycleTone(s: Message["state"]): StatRow["tone"] {
  if (s === "SENT") return "good";
  if (s === "FAIL_MISSING_ACK") return "amber";
  if (s === "FAIL_UNSENT") return "bad";
  return undefined;
}
function lifecycleBadgeTone(s: Message["state"]): InspectorVM["badgeTone"] {
  if (s === "SENT") return "good";
  if (s === "FAIL_MISSING_ACK") return "bad";
  return "blue";
}

function empty(): InspectorVM {
  return { title: "—", badge: "", badgeTone: "neutral", sub: "", rows: [], link: null };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
