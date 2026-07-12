// @normal-form/levels — sheet data (goal, palette, seeds, fidelity notes,
// citations). Sheets are JSON under sheets/; this module loads, types, and
// registers them. Reference machines are test-only (packages/core/test) and never
// bundled here.
//
// The registry is the single ordered source of truth for the sheet lineup: the
// game reads `SHEET_LIST` (id-ordered) for the drawing-index / progression flow
// and looks sheets up by id via `getSheet`. De-hardcoding the game off a direct
// `sheet_1_1` import onto this registry is WS-C.
import type { Sheet } from "@normal-form/core";
import sheet01 from "../sheets/w0/sheet-0-1.json" with { type: "json" };
import sheet02 from "../sheets/w0/sheet-0-2.json" with { type: "json" };
import sheet03 from "../sheets/w0/sheet-0-3.json" with { type: "json" };
import sheet11 from "../sheets/w1/sheet-1-1.json" with { type: "json" };
import sheet12 from "../sheets/w1/sheet-1-2.json" with { type: "json" };
import sheet13 from "../sheets/w1/sheet-1-3.json" with { type: "json" };

// World 0 (WS-E). One-way (`-1`) sheets — the publish-plan editor + fan-out board
// landed in E2, so they lead the lineup. 0-3 is the classification sheet (E3): a
// per-job pattern-choice + the filed-finding mechanic.
export const sheet_0_1: Sheet = sheet01 as unknown as Sheet;
export const sheet_0_2: Sheet = sheet02 as unknown as Sheet;
export const sheet_0_3: Sheet = sheet03 as unknown as Sheet;

export const sheet_1_1: Sheet = sheet11 as unknown as Sheet;
// WS-F World 1: 1-2 "Skipping the Pleasantries" (RECEIVED is a courtesy — per-seed
// commandee variants) and 1-3 "Rejection Letter" (REJECTED kills the CommandID; the
// reactive retry loop recovers with a fresh NEW command). 1-4/1-5 are handed off in
// PROMPT.md (request patterns + enum-driven UI, and the CANCEL race — new surface).
export const sheet_1_2: Sheet = sheet12 as unknown as Sheet;
export const sheet_1_3: Sheet = sheet13 as unknown as Sheet;

/** The sheet lineup in play order — the progression / drawing-index source. */
export const SHEET_LIST: readonly Sheet[] = [
  sheet_0_1,
  sheet_0_2,
  sheet_0_3,
  sheet_1_1,
  sheet_1_2,
  sheet_1_3,
];

export const SHEETS: Readonly<Record<string, Sheet>> = Object.fromEntries(
  SHEET_LIST.map((s) => [s.id, s]),
);

/** The first sheet in the lineup (always unlocked). */
export const FIRST_SHEET_ID: string = SHEET_LIST[0]?.id ?? "";

/** Look a sheet up by id, or undefined if it isn't registered. */
export function getSheet(id: string): Sheet | undefined {
  return SHEETS[id];
}

/** The id of the sheet after `id` in play order, or undefined if `id` is last
 *  (or unregistered) — drives CERTIFIED → next-sheet unlock. */
export function nextSheetId(id: string): string | undefined {
  const i = SHEET_LIST.findIndex((s) => s.id === id);
  if (i < 0) return undefined;
  return SHEET_LIST[i + 1]?.id;
}
