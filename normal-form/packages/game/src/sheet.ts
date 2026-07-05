// Small sheet-derived helpers shared across the panels, so components read the
// current sheet's data instead of hardcoding sheet 1-1 specifics (WS-C). The
// binding drives the message names on the board and inspector headers; `circled`
// replaces the fixed ①②③ seed arrays with a seed-count-agnostic glyph.
import type { Sheet } from "@normal-form/core";

export interface PrimaryBinding {
  readonly pattern: string;
  readonly request: string;
  readonly response: string;
}

/** The sheet's placed pattern + its request/response message names — the first
 *  unlocked palette entry (mirrors core `initialComposition`). Empty strings when
 *  the sheet has no unlocked pattern or no binding. */
export function primaryBinding(sheet: Sheet): PrimaryBinding {
  const primary = sheet.palette.find((p) => p.unlocked);
  return {
    pattern: primary?.pattern ?? "",
    request: primary?.binding?.request ?? "",
    response: primary?.binding?.response ?? "",
  };
}

/** A circled index glyph (①..⑳) for a 1-based number, falling back to the plain
 *  number outside that range — no assumption about how many seeds a sheet has. */
export function circled(n: number): string {
  return Number.isInteger(n) && n >= 1 && n <= 20 ? String.fromCodePoint(0x245f + n) : String(n);
}
