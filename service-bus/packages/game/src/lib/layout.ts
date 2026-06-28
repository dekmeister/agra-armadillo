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
  dms: { x: 560, y: 412, r: 23 },
};

export interface Pt {
  x: number;
  y: number;
}

/**
 * Lateral lane offset (px) per link. The two opposing C2 links between QB and
 * ACP-1 share a centre line; offsetting both along their own (direction-relative)
 * perpendicular splits them onto opposite physical sides — two clear lanes.
 */
const C2_LANE = 22;
export const LANE: Record<string, number> = { req: C2_LANE, bad: C2_LANE };

/**
 * Extra perpendicular push (px) that moves a message token OFF its rail centre,
 * so a token and its link never share pixels (each stays independently clickable).
 * Added on the same side as the link's lane offset, so opposing C2 tokens ride
 * outboard on opposite sides of the corridor.
 */
export const TOKEN_SIDECAR = 12;

/** Relay (MS) links bow around the ACP-1 node they would otherwise pass through. */
const RELAY_BOW = 96;
const RELAY_LINKS = new Set(["relayQbDms", "relayDmsAcp1"]);
export function isRelay(id: string): boolean {
  return RELAY_LINKS.has(id);
}

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

/** Quadratic control point that always bows to the right (larger x). */
function bowControl(from: string, to: string, bow: number): Pt {
  const { a, b } = linkEndpoints(from, to);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const c1 = { x: mx + nx * bow, y: my + ny * bow };
  const c2 = { x: mx - nx * bow, y: my - ny * bow };
  return c1.x >= c2.x ? c1 : c2;
}

/** SVG path for a relay link, bowed around the node between its endpoints. */
export function curvedPath(from: string, to: string, bow = RELAY_BOW): string {
  const { a, b } = linkEndpoints(from, to);
  const c = bowControl(from, to, bow);
  return `M ${r(a.x)} ${r(a.y)} Q ${r(c.x)} ${r(c.y)} ${r(b.x)} ${r(b.y)}`;
}

/** Point at fraction `t` along the bowed relay path (for tokens travelling the relay). */
export function pointOnCurve(from: string, to: string, t: number, bow = RELAY_BOW): Pt {
  const { a, b } = linkEndpoints(from, to);
  const c = bowControl(from, to, bow);
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
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
  "node:dms": [560, 412, 37],
  "link:req": [582, 156, 24],
  "link:bad": [538, 156, 28],
  "link:p2p": [440, 301, 24],
  "link:p2p3": [680, 301, 24],
};
