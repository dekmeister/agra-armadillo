// Small sheet-derived helpers shared across the panels, so components read the
// current sheet's data instead of hardcoding sheet 1-1 specifics (WS-C). The
// binding drives the message names on the board and inspector headers; `circled`
// replaces the fixed ①②③ seed arrays with a seed-count-agnostic glyph.
import type { Sheet } from "@normal-form/core";

export interface PrimaryBinding {
  readonly pattern: string;
  readonly request: string;
  readonly response: string;
  /** the one-way (`-1`) publication message name, when the sheet is one-way */
  readonly publication: string;
}

/** The sheet's placed pattern + its message names — the first unlocked palette
 *  entry (mirrors core `initialComposition`). Empty strings when the sheet has no
 *  unlocked pattern or no binding. */
export function primaryBinding(sheet: Sheet): PrimaryBinding {
  const primary = sheet.palette.find((p) => p.unlocked);
  return {
    pattern: primary?.pattern ?? "",
    request: primary?.binding?.request ?? "",
    response: primary?.binding?.response ?? "",
    publication: primary?.publication ?? "",
  };
}

/** True on a one-way (`-1`) sheet — selects the publish-plan editor + fan-out board
 *  over the Command-2 handler machine + two-party board. */
export function isOneWay(sheet: Sheet): boolean {
  return sheet.oneway !== undefined;
}

/** True on a classification sheet (0-3) — selects the per-job pattern-choice editor
 *  + jobs board + the filed-finding mechanic over both other sim paths. */
export function isJobs(sheet: Sheet): boolean {
  return (sheet.jobs?.length ?? 0) > 0;
}

/** True on the request-run sheet (bonus 1-5) — selects the ActionRequest-2
 *  conversation + injected-CANCEL board over both other sim paths. RUN gates on
 *  `placed` only (the request message is validator-agnostic; the lesson is timing). */
export function isRequestRun(sheet: Sheet): boolean {
  return sheet.request !== undefined;
}

/** A circled index glyph (①..⑳) for a 1-based number, falling back to the plain
 *  number outside that range — no assumption about how many seeds a sheet has. */
export function circled(n: number): string {
  return Number.isInteger(n) && n >= 1 && n <= 20 ? String.fromCodePoint(0x245f + n) : String(n);
}
