/**
 * Board geometry, per scenario. Each level supplies hand-placed node coordinates
 * (readability beats auto-layout for these small topologies); link lanes, selection
 * highlights, the viewBox and the DMS-port direction are DERIVED from those coords so
 * a level only hand-tunes what actually needs an eye. Pure geometry — no sim knowledge
 * beyond node/link ids and classes.
 *
 * Phase 6 keeps its exact original coordinates + viewBox (the MVP slice, screenshot-
 * locked); the others are fresh but follow the same conventions.
 */
import type { InterfaceClass } from "@service-bus/core";

export interface NodeGeom {
  x: number;
  y: number;
  r: number;
}
export interface Pt {
  x: number;
  y: number;
}
export interface MeshHull {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
}

export interface ScenarioLayout {
  nodes: Record<string, NodeGeom>;
  viewBox: string;
  /** The contested-OTA mesh backdrop, when the topology is genuinely an OTA mesh. */
  mesh?: MeshHull;
  /** Where DMS ports point (toward the mesh interior). Defaults to the node centroid. */
  meshCenter: Pt;
}

/** Lateral lane offset (px) by interface class — splits opposing links onto two rails. */
const LANE_BY_CLS: Record<InterfaceClass, number> = {
  C2: 22,
  P2P: 18,
  MS: 18,
  VI: 16,
  MP: 16,
  MD: 16,
};

/**
 * Extra perpendicular push (px) that moves a message token OFF its rail centre, so a
 * token and its link never share pixels (each stays independently clickable).
 */
export const TOKEN_SIDECAR = 12;

// ---------------------------------------------------------------------------
// Per-scenario layouts
// ---------------------------------------------------------------------------

/** Compute a framed viewBox from node bounds + padding (with optional side extras). */
function frame(
  nodes: Record<string, NodeGeom>,
  pad = 80,
  extra: { l?: number; r?: number; t?: number; b?: number } = {},
): string {
  const xs = Object.values(nodes);
  const minX = Math.min(...xs.map((n) => n.x - n.r));
  const maxX = Math.max(...xs.map((n) => n.x + n.r));
  const minY = Math.min(...xs.map((n) => n.y - n.r));
  const maxY = Math.max(...xs.map((n) => n.y + n.r));
  const x = minX - pad - (extra.l ?? 0);
  const y = minY - pad - (extra.t ?? 0);
  const w = maxX - minX + 2 * pad + (extra.l ?? 0) + (extra.r ?? 0);
  const h = maxY - minY + 2 * pad + (extra.t ?? 0) + (extra.b ?? 0);
  return `${r(x)} ${r(y)} ${r(w)} ${r(h)}`;
}

/** Centroid of node centres (default DMS-port target). */
function centroid(nodes: Record<string, NodeGeom>): Pt {
  const xs = Object.values(nodes);
  return {
    x: xs.reduce((s, n) => s + n.x, 0) / xs.length,
    y: xs.reduce((s, n) => s + n.y, 0) / xs.length,
  };
}

// L1/L2/L8 — two nodes (LRE + ACP-1) plus a self-loop VI lane on the ACP.
const PAIR_NODES: Record<string, NodeGeom> = {
  lre: { x: 520, y: 96, r: 44 },
  acp1: { x: 520, y: 320, r: 46 },
};

// L3 — a leaderless P2P triangle.
const TRI_NODES: Record<string, NodeGeom> = {
  acp1: { x: 540, y: 96, r: 44 },
  acp2: { x: 372, y: 340, r: 42 },
  acp3: { x: 708, y: 340, r: 42 },
};

function mk(nodes: Record<string, NodeGeom>, o: Partial<ScenarioLayout> = {}): ScenarioLayout {
  return {
    nodes,
    viewBox: o.viewBox ?? frame(nodes),
    mesh: o.mesh,
    meshCenter: o.meshCenter ?? centroid(nodes),
  };
}

// Phase 6 — exact original geometry (screenshot-locked MVP slice); also the fallback.
const PHASE6_LAYOUT: ScenarioLayout = {
  nodes: {
    qb: { x: 560, y: 60, r: 44 },
    acp1: { x: 560, y: 252, r: 42 },
    acp2: { x: 320, y: 350, r: 36 },
    acp3: { x: 800, y: 350, r: 36 },
  },
  viewBox: "240 0 660 424",
  mesh: { x: 250, y: 14, w: 640, h: 402, rx: 44 },
  meshCenter: { x: 560, y: 232 },
};

export const LAYOUTS: Record<string, ScenarioLayout> = {
  phase6: PHASE6_LAYOUT,

  // L1/L2/L8 — the VI self-loop needs room to the right of ACP-1.
  phase1: mk(PAIR_NODES, { viewBox: frame(PAIR_NODES, 84, { r: 96 }) }),
  phase2: mk(PAIR_NODES, { viewBox: frame(PAIR_NODES, 84, { r: 96 }) }),
  phase8: mk(PAIR_NODES, { viewBox: frame(PAIR_NODES, 84, { r: 96 }) }),

  // L3 — the P2P mesh is the contested medium.
  phase3: mk(TRI_NODES),

  // L4 — two platforms, one capped link.
  phase4: mk({
    acp1: { x: 380, y: 210, r: 46 },
    acp2: { x: 740, y: 210, r: 44 },
  }),

  // L5 — leader over three followers (COP fan-out).
  phase5: mk({
    acp1: { x: 540, y: 92, r: 46 },
    acp2: { x: 336, y: 340, r: 38 },
    acp3: { x: 540, y: 340, r: 38 },
    acp4: { x: 744, y: 340, r: 38 },
  }),

  // L7 — authorities up top (QB/LRE), ACP-1 centre, the orphan pair below.
  phase7: mk({
    qb: { x: 372, y: 84, r: 40 },
    lre: { x: 708, y: 84, r: 40 },
    acp1: { x: 540, y: 236, r: 46 },
    acp2: { x: 400, y: 388, r: 38 },
    acp3: { x: 680, y: 388, r: 38 },
  }),
};

/** The layout for a scenario id (falls back to Phase 6). */
export function layoutFor(scenarioId: string): ScenarioLayout {
  return LAYOUTS[scenarioId] ?? PHASE6_LAYOUT;
}

// ---------------------------------------------------------------------------
// Geometry helpers (take the active layout's node map)
// ---------------------------------------------------------------------------

/** Endpoint of a directed link trimmed to each node's radius (arrows sit on the rim). */
function linkEndpoints(
  nodes: Record<string, NodeGeom>,
  from: string,
  to: string,
): { a: Pt; b: Pt } {
  const f = nodes[from];
  const t = nodes[to];
  if (!f || !t) return { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } };
  const dx = t.x - f.x;
  const dy = t.y - f.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    a: { x: f.x + ux * (f.r + 4), y: f.y + uy * (f.r + 4) },
    b: { x: t.x - ux * (t.r + 11), y: t.y - uy * (t.r + 11) },
  };
}

/** Point a fraction `t` (0..1) along a straight link, nudged perpendicular by `off`. */
export function alongLink(
  nodes: Record<string, NodeGeom>,
  from: string,
  to: string,
  t: number,
  off = 0,
): Pt {
  const { a, b } = linkEndpoints(nodes, from, to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return { x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off };
}

/** SVG path for a straight link, offset into its lane. */
export function straightPath(
  nodes: Record<string, NodeGeom>,
  from: string,
  to: string,
  lane = 0,
): string {
  const a = alongLink(nodes, from, to, 0, lane);
  const b = alongLink(nodes, from, to, 1, lane);
  return `M ${r(a.x)} ${r(a.y)} L ${r(b.x)} ${r(b.y)}`;
}

/** A self-loop link (from === to): a small arc hugging the node's right rim. */
export function selfLoopPath(node: NodeGeom): string {
  const cx = node.x + node.r;
  const cy = node.y;
  const rr = node.r * 0.62;
  // Two arcs forming a lobe to the node's right (an on-platform loop, off the mesh).
  return `M ${r(cx)} ${r(cy - rr * 0.5)} A ${r(rr)} ${r(rr)} 0 1 1 ${r(cx)} ${r(cy + rr * 0.5)}`;
}

/** Token position for a self-loop, near the outer edge of the lobe. */
export function selfLoopPoint(node: NodeGeom): Pt {
  return { x: node.x + node.r + node.r * 0.62, y: node.y };
}

/**
 * Lateral lane offset for a link: opposing links (A→B and B→A) split onto two rails;
 * a link with no opposing twin (or a self-loop) rides lane 0.
 */
export function laneFor(
  links: { id: string; from: string; to: string; cls: InterfaceClass }[],
  linkId: string,
): number {
  const l = links.find((x) => x.id === linkId);
  if (!l || l.from === l.to) return 0;
  const opposed = links.some((x) => x.from === l.to && x.to === l.from);
  return opposed ? (LANE_BY_CLS[l.cls] ?? 18) : 0;
}

/**
 * Each platform's own DMS instance, drawn as a small port badge on the node rim facing
 * the mesh interior — the seam where on-platform traffic meets the OTA mesh.
 */
export function dmsPort(node: NodeGeom, center: Pt): Pt {
  const dx = center.x - node.x;
  const dy = center.y - node.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: node.x + (dx / len) * node.r, y: node.y + (dy / len) * node.r };
}

function r(n: number): number {
  return Math.round(n * 10) / 10;
}
