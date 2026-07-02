// @normal-form/levels — sheet data (goal, palette, seeds, pars, fidelity notes,
// citations). Sheets are JSON under sheets/; this module loads and types them.
// Reference machines are test-only (packages/core/test) and never bundled here.
import type { Sheet } from "@normal-form/core";
import sheet11 from "../sheets/w1/sheet-1-1.json" with { type: "json" };

export const sheet_1_1: Sheet = sheet11 as unknown as Sheet;

export const SHEETS: Readonly<Record<string, Sheet>> = {
  [sheet_1_1.id]: sheet_1_1,
};
