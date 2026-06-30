/**
 * Pure GameState -> view-model derivations. Keeps Svelte components dumb: they
 * render what these functions return. No mutation, no sim logic beyond reads.
 */

import type { GameState, Interaction, Link, Message } from "@service-bus/core";
import { dispatchOrder } from "@service-bus/core";
import { alongLink, LANE, NODES, straightPath, TOKEN_SIDECAR } from "./layout.ts";

export type Selection = { type: "node" | "link" | "token"; id: string } | null;

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
  if (!NODES[l.from] || !NODES[l.to]) return null;
  const d = straightPath(l.from, l.to, LANE[linkId] ?? 0);
  // Once the scripted contingency degrades the reply link, render it as stably
  // CONTESTED rather than flickering amber/grey with every Gilbert-Elliott
  // transition — the per-tick flip was unreadable. [S] The board shows "this link
  // is bursty/unreliable"; the live GOOD/BAD channel is still in the Inspector.
  const contested =
    l.channel === "BAD" || (linkId === "bad" && gs.tick >= gs.config.contingencyTick);
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

const SHAPE: Record<string, "square" | "circle"> = { C2: "square", P2P: "circle" };

/**
 * Token position: along the link at fraction `t`, but pushed off the rail centre
 * by TOKEN_SIDECAR (on the lane side) so the token never overlaps the link's hit
 * band.
 */
function place(linkId: string, from: string, to: string, t: number): { x: number; y: number } {
  return alongLink(from, to, t, (LANE[linkId] ?? 0) + TOKEN_SIDECAR);
}

/**
 * Message tokens. In-flight (EXECUTING) messages render individually and glide
 * along their link; queued (PENDING) messages collapse to ONE token per link at
 * the source with a count badge, so the queue reads as a single source the
 * individual tokens stream out of (rather than an unreadable blob).
 */
export function tokens(gs: GameState, heroId: string | null): TokenVM[] {
  const out: TokenVM[] = [];

  // In-flight: one moving token each.
  for (const f of gs.inFlight) {
    if (f.msg === heroId) continue;
    const m = gs.messages[f.msg];
    const link = gs.links[f.link];
    if (!m || !link) continue;
    const t = clamp01(1 - (f.arrivalTick - gs.tick) / Math.max(1, link.latency));
    const p = place(link.id, link.from, link.to, t);
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
    const p = place(link.id, link.from, link.to, 0.3);
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
  const ixn = activeStrike(gs);
  const reply = ixn?.reply ? gs.messages[ixn.reply] : null;
  if (!reply) return null;
  const linkId = reply.route[reply.hop] ?? "bad";
  const link = gs.links[linkId];
  // Same sidecar placement as ordinary tokens, so the reply rides beside its rail
  // (not on it) and the rail stays clickable along its length.
  const p = link ? place(linkId, link.from, link.to, 0.5) : { x: 526, y: 156 };

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
  return inspectLink(gs, "bad"); // default focus = the crisis
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

function inspectNode(gs: GameState, id: string): InspectorVM {
  const n = gs.nodes[id];
  if (!n) return empty();
  const cat = n.kind === "QB" ? "AUTHORITY" : n.isLeader ? "LEADER" : "AIRCRAFT";
  return {
    title: n.label,
    badge: cat,
    badgeTone: n.kind === "QB" ? "gold" : n.isLeader ? "blue" : "neutral",
    sub: `role ${n.role} · ${n.kind}`,
    link: null,
    rows: [
      { label: "Role", value: n.role, tone: n.kind === "QB" ? "gold" : "blue" },
      {
        label: "Target authority",
        value: n.role === "QB" ? "yes" : "no",
        tone: n.role === "QB" ? "good" : undefined,
      },
      { label: "Queued", value: `${nodeQueueDepth(gs, id)} msgs` },
      { label: "Leader", value: n.isLeader ? "yes ★" : "no" },
    ],
  };
}

function inspectToken(gs: GameState, id: string): InspectorVM {
  const m = gs.messages[id];
  if (!m) return empty();
  const rows: StatRow[] = [
    { label: "Message", value: m.type, tone: m.cls === "C2" ? "blue" : undefined },
    {
      label: "Class",
      value: `${m.cls} (${m.cls === "C2" ? "command" : "peer"})`,
      tone: m.cls === "C2" ? "blue" : undefined,
    },
    { label: "Lifecycle", value: m.state, tone: lifecycleTone(m.state) },
  ];
  if (m.leg === "reply") {
    const rem = wezRemaining(gs);
    rows.push({ label: "Deadline", value: rem === null ? "standby" : mmss(rem), tone: "bad" });
    rows.push({
      label: "Authority",
      value: m.authorityVerified ? "QB-signed ✓" : "unverified",
      tone: m.authorityVerified ? "gold" : "bad",
    });
    rows.push({ label: "Note", value: "arrival ≠ authority" });
  }
  return {
    title:
      m.leg === "reply" ? "Approval reply" : m.leg === "request" ? "Approval request" : "Message",
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
