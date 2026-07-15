// Design tokens for the Blueprint puzzle screen — the single source that keeps
// the chrome and the SVG board in lockstep. Every hex and measurement here is
// quoted from the original Blueprint design handoff; do not invent new ones.
import type { CommandProcessingStateEnum } from "@normal-form/core";

/** Surfaces (handoff § Colors — surfaces). */
export const SURFACE = {
  desk: "#dcd6c7",
  vellum: "#f3efe4",
  board: "#f6f2e8",
  panelWarm: "#efe7d5",
  panelCool: "#e8edf0",
  console: "#faf6ec",
  chrome: "#e9e2d1",
  ink: "#24435f",
} as const;

/** Zone / category accents (handoff § Colors — zone / category accents). */
export const ZONE = {
  oneWay: "#2f6fb0", // palette dot, one-way group, request arrow
  sendRespond: "#1f8a6d", // inspector dot, send·respond group, SIZE metric
  stamp: "#b23a2e", // validator dot, red drafting stamp
  accent: "#c07d1f", // Command-2 active, TICK metric, active tab, "(you)"
  accentFill: "#fbeccb", // active Command-2 chip background
} as const;

/** State-enum colors (handoff § Colors — state enums). Must read distinctly. */
export const ENUM_COLOR: Record<CommandProcessingStateEnum, string> = {
  RECEIVED: "#3b6ea5",
  ACCEPTED: "#2f8f5b",
  REJECTED: "#c0392b",
  CANCELED: "#c9962b",
};

/** RequestProcessingStateEnum colors for the request-run board (1-5). QUEUED /
 *  PROCESSING are the in-flight blues; COMPLETED reuses the ACCEPTED green (a
 *  successful terminal) and CANCELED the amber (shared with the command enum). */
export const REQUEST_ENUM_COLOR: Record<string, string> = {
  QUEUED: "#5a7a95",
  PROCESSING: "#3b6ea5",
  COMPLETED: "#2f8f5b",
  CANCELED: "#c9962b",
};

/** Status / validation (handoff § Colors — status / validation). */
export const STATUS = {
  pass: "#2f8f5b",
  fail: "#c0392b",
  errorBg: "#f7dcd7",
  runActiveSeed: "#3b6ea5",
  waitSeed: "#9a9384",
} as const;

/** Band heights, column widths, geometry (handoff § Spacing / geometry). */
export const LAYOUT = {
  headerH: 52,
  subBarH: 46,
  bottomH: 154,
  paletteW: 236,
  inspectorW: 348,
  titleBlockW: 348,
  minWidth: 1024,
  minHeight: 640,
  /** lifelines at 36% / 74%; connectors left:36% width:38% */
  lifelineLeftPct: 36,
  lifelineRightPct: 74,
} as const;

/** Radii (handoff § Spacing / geometry). */
export const RADIUS = {
  chip: 2,
  pill: 3,
  badge: 10,
} as const;

/** Signature hard drafting shadow — offset, no blur, element's ink/accent at ~.2. */
export const SHADOW = {
  drafting2: "2px 2px 0 rgba(36,67,95,.2)",
  drafting3: "3px 3px 0 rgba(36,67,95,.2)",
  amber2: "2px 2px 0 rgba(192,125,31,.25)",
} as const;

/** Structural borders (handoff § Spacing / geometry). */
export const BORDER = {
  divider: `1.5px solid ${SURFACE.ink}`,
  dashedEdge: `1.5px dashed ${SURFACE.ink}`,
  lifeline: "2px dashed rgba(36,67,95,.55)",
} as const;

export const FONT = {
  mono: "'JetBrains Mono', monospace",
  hand: "'Architects Daughter', cursive",
} as const;
