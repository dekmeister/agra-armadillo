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
/**
 * The OTA field: the region every off-platform hop crosses. Present on EVERY layout —
 * all eight levels put traffic over the air, and rendering the air on only one of them
 * (WP4.2) hid the game's central metaphor and gutted the L1/L2 "VI is free, OTA costs"
 * lesson.
 *
 * `label` describes what the medium IS and is static; the *contested* treatment is
 * derived per-frame in the view from live link state, so the field can never contradict
 * the rails drawn on top of it. See `docs/01` items 22-23.
 */
export interface MeshHull {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  /**
   * What this medium is. Only boards where three or more platforms actually peer may
   * call it a *mesh*; labelling a two-node board one would imply peering the topology
   * does not have (guard rail). Phase 4 was such a board until WP5.1 grew it to a
   * three-ship formation, at which point it earned the label.
   */
  label: string;
  /** Caption corner — `bl` unless a node occupies the bottom-left of the hull. */
  labelPos: "tl" | "bl";
}

export interface ScenarioLayout {
  nodes: Record<string, NodeGeom>;
  viewBox: string;
  /** The OTA field backdrop. */
  mesh?: MeshHull;
  /** Where DMS ports point (toward the mesh interior). Defaults to the node centroid. */
  meshCenter: Pt;
}

/** Label for the boards where >= 3 platforms genuinely peer over the DDS/RTPS mesh. */
const MESH_LABEL = "DMS / DDS-RTPS mesh — no central broker";

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

// L4 — the QB pushes a plan down through the leader to a three-ship formation (WP5.1;
// was two platforms and one link). Laid out along the direction of flow: QB on top,
// ACP-1 relaying in the middle, the two followers below.
const PHASE4_NODES: Record<string, NodeGeom> = {
  qb: { x: 540, y: 76, r: 40 },
  acp1: { x: 540, y: 236, r: 46 },
  acp2: { x: 380, y: 396, r: 40 },
  acp3: { x: 700, y: 396, r: 40 },
};

// L5 — leader over three followers (COP fan-out).
const PHASE5_NODES: Record<string, NodeGeom> = {
  acp1: { x: 540, y: 92, r: 46 },
  acp2: { x: 336, y: 340, r: 38 },
  acp3: { x: 540, y: 340, r: 38 },
  acp4: { x: 744, y: 340, r: 38 },
};

// L7 — authorities up top (QB/LRE), ACP-1 centre, the orphan pair below.
const PHASE7_NODES: Record<string, NodeGeom> = {
  qb: { x: 372, y: 84, r: 40 },
  lre: { x: 708, y: 84, r: 40 },
  acp1: { x: 540, y: 236, r: 46 },
  acp2: { x: 400, y: 388, r: 38 },
  acp3: { x: 680, y: 388, r: 38 },
};

function mk(nodes: Record<string, NodeGeom>, o: Partial<ScenarioLayout> = {}): ScenarioLayout {
  return {
    nodes,
    viewBox: o.viewBox ?? frame(nodes),
    mesh: o.mesh,
    meshCenter: o.meshCenter ?? centroid(nodes),
  };
}

/**
 * An OTA field derived from the node bounding box, inflated by `pad`. `left` overrides
 * the left edge (caption room) and `right` clamps it — the pair boards clamp to the ACP
 * rim so the on-platform VI lobe falls visibly OUTSIDE the field, which is the whole
 * point of L1/L2. `layout.test.ts` pins both containments.
 */
function hull(
  nodes: Record<string, NodeGeom>,
  o: {
    pad?: number;
    left?: number;
    right?: number;
    rx?: number;
    label: string;
    labelPos?: "tl" | "bl";
  },
): MeshHull {
  const pad = o.pad ?? 30;
  const ns = Object.values(nodes);
  const x0 = o.left ?? Math.min(...ns.map((n) => n.x - n.r)) - pad;
  const x1 = o.right ?? Math.max(...ns.map((n) => n.x + n.r)) + pad;
  const y0 = Math.min(...ns.map((n) => n.y - n.r)) - pad;
  const y1 = Math.max(...ns.map((n) => n.y + n.r)) + pad;
  return {
    x: r(x0),
    y: r(y0),
    w: r(x1 - x0),
    h: r(y1 - y0),
    rx: o.rx ?? 40,
    label: o.label,
    labelPos: o.labelPos ?? "bl",
  };
}

/**
 * L1/L2/L8's field: a narrow vertical corridor between the LRE and ACP-1. The right edge
 * is clamped to ACP-1's rim (x = 566) because the VI self-loop lobe starts exactly there
 * and runs out to x ~ 619 — so the loop hugs the OUTSIDE of the field. The caption goes
 * top-left; a bottom-left caption would run straight through ACP-1.
 */
function pairHull(): MeshHull {
  return hull(PAIR_NODES, {
    left: 404, // caption room only — nothing is drawn left of 474
    right: 566, // = acp1.x + acp1.r, tangent to the rim, so the VI lobe sits outside
    rx: 28,
    label: "OTA · short-range C2 (LRE)",
    labelPos: "tl",
  });
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
  // Screenshot-locked: these exact numbers predate WP4 and are deliberately NOT
  // regularised to `hull()` — they already satisfy the convention.
  mesh: { x: 250, y: 14, w: 640, h: 402, rx: 44, label: MESH_LABEL, labelPos: "bl" },
  meshCenter: { x: 560, y: 232 },
};

export const LAYOUTS: Record<string, ScenarioLayout> = {
  phase6: PHASE6_LAYOUT,

  // L1/L2/L8 — the VI self-loop needs room to the right of ACP-1, outside the field.
  phase1: mk(PAIR_NODES, { viewBox: frame(PAIR_NODES, 84, { r: 96 }), mesh: pairHull() }),
  phase2: mk(PAIR_NODES, { viewBox: frame(PAIR_NODES, 84, { r: 96 }), mesh: pairHull() }),
  phase8: mk(PAIR_NODES, { viewBox: frame(PAIR_NODES, 84, { r: 96 }), mesh: pairHull() }),

  // L3 — three platforms peering: a genuine mesh. Caption goes top-left: the triangle
  // puts ACP-2 in the bottom-left corner, and its selection ring runs over the text.
  phase3: mk(TRI_NODES, { mesh: hull(TRI_NODES, { label: MESH_LABEL, labelPos: "tl" }) }),

  // L4 — three ACPs peering plus the QB pushing the plan in. Now a genuine mesh (it was
  // two platforms and one link before WP5.1, which is why it used to be labelled a plain
  // link — two peers do not make a pub-sub mesh).
  phase4: mk(PHASE4_NODES, { mesh: hull(PHASE4_NODES, { label: MESH_LABEL }) }),

  // L5 — leader over three followers (COP fan-out).
  phase5: mk(PHASE5_NODES, { mesh: hull(PHASE5_NODES, { label: MESH_LABEL }) }),

  // L7 — authorities up top (QB/LRE), ACP-1 centre, the orphan pair below.
  phase7: mk(PHASE7_NODES, { mesh: hull(PHASE7_NODES, { label: MESH_LABEL }) }),
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

/**
 * Vertical centre of one of a node's self-loop lobes.
 *
 * A node can carry more than one on-platform lane — L1 has both the VI loop to Flight
 * Autonomy and the MS loop to local Mission Systems (WP5.6) — and before this they drew
 * as one lobe with two captions stacked on the same pixel. Lobes are stacked vertically
 * and centred on the node, which keeps them all in the same x-band: the "self-loop lobes
 * stay outside the OTA field" guard is an x-axis test, so it holds regardless of count.
 */
function loopCy(node: NodeGeom, index: number, count: number): number {
  const rr = node.r * 0.62;
  return node.y + (index - (count - 1) / 2) * (2 * rr + 8);
}

/** A self-loop link (from === to): a small arc hugging the node's right rim. */
export function selfLoopPath(node: NodeGeom, index = 0, count = 1): string {
  const cx = node.x + node.r;
  const cy = loopCy(node, index, count);
  const rr = node.r * 0.62;
  // Two arcs forming a lobe to the node's right (an on-platform loop, off the mesh).
  return `M ${r(cx)} ${r(cy - rr * 0.5)} A ${r(rr)} ${r(rr)} 0 1 1 ${r(cx)} ${r(cy + rr * 0.5)}`;
}

/** Token position for a self-loop: inside the lobe, near its centre. */
export function selfLoopPoint(node: NodeGeom, index = 0, count = 1): Pt {
  return { x: node.x + node.r + node.r * 0.62, y: loopCy(node, index, count) };
}

/**
 * Bounding box of the arc `selfLoopPath` actually draws. Exported rather than re-derived
 * at the call sites because the arc centre is the subtle part: the chord runs vertically
 * at `x = node.x + node.r` with length `rr`, and large-arc=1/sweep=1 selects the centre
 * `rr*sqrt(3)/2` to its RIGHT, so the lobe reaches `rr*(1 + sqrt(3)/2)` past the rim —
 * markedly further than the token point suggests. The pair boards' mesh hull is clamped
 * against this box so the on-platform loop never overlaps the OTA field.
 */
export function selfLoopBBox(
  node: NodeGeom,
  index = 0,
  count = 1,
): { x: number; y: number; w: number; h: number } {
  const rr = node.r * 0.62;
  const x0 = node.x + node.r; // the chord
  const cx = x0 + (rr * Math.sqrt(3)) / 2; // arc centre
  return { x: x0, y: loopCy(node, index, count) - rr, w: cx + rr - x0, h: 2 * rr };
}

/** Caption anchor for a self-loop: just outboard of the lobe, vertically centred. */
export function selfLoopLabelPoint(node: NodeGeom, index = 0, count = 1): Pt {
  const b = selfLoopBBox(node, index, count);
  return { x: r(b.x + b.w + 10), y: loopCy(node, index, count) + 4 };
}

/** Unit normal of a link's rail — the direction lane/sidecar offsets push along. */
export function railNormal(nodes: Record<string, NodeGeom>, from: string, to: string): Pt {
  const f = nodes[from];
  const t = nodes[to];
  if (!f || !t || from === to) return { x: 1, y: 0 };
  const dx = t.x - f.x;
  const dy = t.y - f.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

/** Length of the drawn rail (between the rim-trimmed endpoints). */
function railLength(nodes: Record<string, NodeGeom>, from: string, to: string): number {
  const { a, b } = linkEndpoints(nodes, from, to);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Arc-length from the source rim at which a queue stack sits. */
const STACK_PX = 34;
/** Envelope (beyond a node's radius) that the stack token + its badge must clear. */
const RIM_CLEAR = 24;

/**
 * Where along a rail a queue stack sits, as a fraction. A fixed *fraction* (the old
 * `t = 0.3`) means wildly different pixel gaps across the eight boards — rails run from
 * ~150px to ~360px — which is why Phase 5's stacks collided with ACP-1's rim (WP4.6).
 * So: a fixed pixel offset, then walk forward until the token clears every node circle.
 * The test asserts the postcondition (clearance), not the constant.
 */
export function stackFrac(
  nodes: Record<string, NodeGeom>,
  from: string,
  to: string,
  off = 0,
): number {
  if (from === to) return 0.3; // self-loops ignore `t` entirely
  const len = railLength(nodes, from, to) || 1;
  const start = Math.min(0.45, Math.max(0.12, STACK_PX / len));
  const clears = (t: number): boolean => {
    const p = alongLink(nodes, from, to, t, off);
    return Object.values(nodes).every((n) => Math.hypot(p.x - n.x, p.y - n.y) >= n.r + RIM_CLEAR);
  };
  for (let t = start; t <= 0.5; t += 0.02) if (clears(t)) return t;
  return 0.5; // mid-rail is the best available on a very short link
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
