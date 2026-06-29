/**
 * Static graph geometry (the handoff coordinates, viewBox 1120x470) plus helpers
 * to place links and message tokens. Pure geometry — no sim knowledge beyond ids.
 */
export interface NodeGeom {
  x: number;
  y: number;
  r: number;
}

export const NODES: Record<string, NodeGeom> = {
  qb: { x: 560, y: 60, r: 44 },
  acp1: { x: 560, y: 252, r: 42 },
  acp2: { x: 320, y: 350, r: 36 },
  acp3: { x: 800, y: 350, r: 36 },
};

export interface Pt {
  x: number;
  y: number;
}

/**
 * Lateral lane offset (px) per link. Opposing links that share a centre line are
 * each offset along their own (direction-relative) perpendicular, which splits
 * them onto opposite physical sides — two clear lanes. Two corridors need this:
 *   - QB↔ACP-1 carries C2 `req` (up) and `bad` (down).
 *   - ACP-1↔ACP-2 carries P2P `p2p` (down) and the MS reroute `relayAcp2Acp1` (up).
 * `relayQbAcp2` and `p2p3` have no opposing link, so they ride lane 0.
 */
const C2_LANE = 22;
const P2P_LANE = 18;
export const LANE: Record<string, number> = {
  req: C2_LANE,
  bad: C2_LANE,
  p2p: P2P_LANE,
  relayAcp2Acp1: P2P_LANE,
};

/**
 * The contested OTA region: a shaded field standing in for the DMS / DDS-RTPS
 * pub-sub mesh (no central broker — each platform runs its own DMS instance).
 * Encloses the platforms whose OTA hops cross it. [S] (bounds are presentational.)
 */
export const MESH_HULL = { x: 250, y: 14, w: 640, h: 402, rx: 44 };

/**
 * Each platform's own DMS instance, drawn as a small port badge on the node rim
 * facing the mesh interior — the seam where on-platform traffic meets the OTA mesh.
 */
const MESH_CENTER: Pt = { x: 560, y: 232 };
export function dmsPort(id: string): Pt {
  const n = NODES[id];
  if (!n) return { x: 0, y: 0 };
  const dx = MESH_CENTER.x - n.x;
  const dy = MESH_CENTER.y - n.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: n.x + (dx / len) * n.r, y: n.y + (dy / len) * n.r };
}

/**
 * Extra perpendicular push (px) that moves a message token OFF its rail centre,
 * so a token and its link never share pixels (each stays independently clickable).
 * Added on the same side as the link's lane offset, so opposing C2 tokens ride
 * outboard on opposite sides of the corridor.
 */
export const TOKEN_SIDECAR = 12;

/** Endpoint of a directed link trimmed to each node's radius (so arrows sit on the rim). */
function linkEndpoints(from: string, to: string): { a: Pt; b: Pt } {
  const f = NODES[from];
  const t = NODES[to];
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
export function alongLink(from: string, to: string, t: number, off = 0): Pt {
  const { a, b } = linkEndpoints(from, to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return { x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off };
}

/** SVG path for a straight link, offset into its lane. */
export function straightPath(from: string, to: string, lane = 0): string {
  const a = alongLink(from, to, 0, lane);
  const b = alongLink(from, to, 1, lane);
  return `M ${r(a.x)} ${r(a.y)} L ${r(b.x)} ${r(b.y)}`;
}

function r(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Inspection-highlight coordinates per selectable id (on each element's lane). */
export const HIGHLIGHT: Record<string, [number, number, number]> = {
  "node:qb": [560, 60, 58],
  "node:acp1": [560, 252, 56],
  "node:acp2": [320, 350, 50],
  "node:acp3": [800, 350, 50],
  "link:req": [582, 156, 24],
  "link:bad": [538, 156, 28],
  "link:p2p": [433, 284, 24],
  "link:p2p3": [680, 301, 24],
  "link:relayQbAcp2": [440, 205, 26],
  "link:relayAcp2Acp1": [447, 318, 24],
};
