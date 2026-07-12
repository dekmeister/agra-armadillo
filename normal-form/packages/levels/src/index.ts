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
import sheet11 from "../sheets/w1/sheet-1-1.json" with { type: "json" };
import sheet12 from "../sheets/w1/sheet-1-2.json" with { type: "json" };

// World 0 (WS-E). One-way (`-1`) sheets — the publish-plan editor + fan-out board
// landed in E2, so they now lead the lineup. 0-3 (the filed-finding sheet) is E3.
export const sheet_0_1: Sheet = sheet01 as unknown as Sheet;
export const sheet_0_2: Sheet = sheet02 as unknown as Sheet;

export const sheet_1_1: Sheet = sheet11 as unknown as Sheet;
// WS-C infrastructure stub: a second solvable Command-2 sheet that proves the
// registry + progression flow generalize past one hardcoded sheet. WS-F replaces
// this with the real 1-2 "Skipping the Pleasantries" (needs new engine work).
export const sheet_1_2: Sheet = sheet12 as unknown as Sheet;

/** The sheet lineup in play order — the progression / drawing-index source. */
export const SHEET_LIST: readonly Sheet[] = [sheet_0_1, sheet_0_2, sheet_1_1, sheet_1_2];

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
