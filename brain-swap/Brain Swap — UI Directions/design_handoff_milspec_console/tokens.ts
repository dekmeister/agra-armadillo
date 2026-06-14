// ============================================================
// Brain Swap — MIL-SPEC Ground Station · Design Tokens (TS)
// Mirror of tokens.css for use in a React/TS codebase.
// ============================================================

export const color = {
  // surfaces
  black: '#0a0d0a',
  panel: '#11150f',
  panel2: '#161b13',
  bezel: '#070a07',
  // lines
  line: '#2c3325',
  line2: '#3c4632',
  // neutrals / text
  olive: '#5d6b3f',
  oliveDim: '#3f4a2c',
  phos: '#c2cdb0',
  dim: '#7d876b',
  // semantic — do not use decoratively
  cyan: '#3fc6d6',     // MA sender / cap.* references
  amber: '#e0a322',    // FA sender / advertised + literal values
  green: '#8fd06a',    // nominal
  ok: '#6fce8a',       // accepted / pass
  caution: '#f2c200',  // REJECTED (validator failure) only
  warn: '#e0483a',     // REVOKED / fault only
} as const;

export const font = {
  mono: "'IBM Plex Mono', monospace",          // data / identifiers / values
  cond: "'Saira Semi Condensed', sans-serif",  // labels / headers / state names
  stencil: "'Saira Stencil One', sans-serif",  // brand + title accents only
} as const;

export const space = {
  panelGap: 8,
  panelPad: 9,
  panelHeader: 22,
  statusStrip: 30,
  chromeBar: 58,
  selector: 26,
  radius: 0,            // square bezels
} as const;

// Map a disposition kind → semantic style. Keep this the single source of truth.
export type DispositionKind =
  | 'delivered' | 'pending' | 'accepted' | 'ignored' | 'rejected' | 'revoked';

export const dispositionStyle: Record<DispositionKind, { fg: string; bg?: string; border?: string }> = {
  delivered: { fg: color.dim, border: color.line2 },
  pending:   { fg: color.dim, border: color.line2 },
  accepted:  { fg: color.black, bg: color.green },
  ignored:   { fg: color.olive, bg: 'rgba(93,107,63,.12)', border: color.oliveDim },
  rejected:  { fg: color.black, bg: color.caution },
  revoked:   { fg: '#ffffff', bg: color.warn },
};

// Direction → sender color.
export const directionColor = (dir: 'MA→FA' | 'FA→MA') =>
  dir === 'MA→FA' ? color.cyan : color.amber;
