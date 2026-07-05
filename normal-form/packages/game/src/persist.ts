// localStorage persistence for progression + per-sheet work (WS-C; docs/04-tech
// "Persistence: localStorage + JSON export/import"). The save is deliberately
// small and portable: certified flags + each sheet's recorded action `script`
// (the replayable solve) + the last sheet opened. Restoring on load replays each
// script back into a Session via the core reducer; there is no serialized runtime
// state to drift. The same shape is the export/import file, so a solve is shareable.
import type { PlayerAction } from "@normal-form/core";

const STORAGE_KEY = "normal-form/save/v1";
const VERSION = 1 as const;

export interface SaveState {
  readonly version: typeof VERSION;
  /** sheet id → certified (all seeds pass); presence unlocks the next sheet */
  readonly certified: Readonly<Record<string, boolean>>;
  /** sheet id → the ordered edit script that reconstructs that sheet's Session */
  readonly scripts: Readonly<Record<string, readonly PlayerAction[]>>;
  /** the sheet the player last opened, restored on next load */
  readonly lastSheet?: string;
}

function emptySave(): SaveState {
  return { version: VERSION, certified: {}, scripts: {} };
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Access can throw in sandboxed/headless contexts — treat as no persistence.
    return null;
  }
}

/** Coerce unknown parsed JSON into a SaveState, dropping anything malformed.
 *  Lenient by design: a partial or older-shaped blob still yields a usable save
 *  rather than wiping the player's progress. */
function coerce(raw: unknown): SaveState {
  if (typeof raw !== "object" || raw === null) return emptySave();
  const o = raw as Record<string, unknown>;
  const certified: Record<string, boolean> = {};
  if (typeof o.certified === "object" && o.certified !== null) {
    for (const [k, v] of Object.entries(o.certified)) if (v === true) certified[k] = true;
  }
  const scripts: Record<string, readonly PlayerAction[]> = {};
  if (typeof o.scripts === "object" && o.scripts !== null) {
    for (const [k, v] of Object.entries(o.scripts)) if (Array.isArray(v)) scripts[k] = v;
  }
  const lastSheet = typeof o.lastSheet === "string" ? o.lastSheet : undefined;
  return { version: VERSION, certified, scripts, ...(lastSheet ? { lastSheet } : {}) };
}

export function loadSave(): SaveState {
  const s = storage();
  if (!s) return emptySave();
  const text = s.getItem(STORAGE_KEY);
  if (text === null) return emptySave();
  try {
    return coerce(JSON.parse(text));
  } catch {
    return emptySave();
  }
}

export function writeSave(save: SaveState): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Quota or privacy-mode failures are non-fatal — play continues in memory.
  }
}

/** Whether the player has any prior progress — drives the first-visit welcome
 *  card (WS-D): shown only when no save exists (no last sheet, nothing certified,
 *  no recorded work). */
export function hasSave(save: SaveState): boolean {
  return (
    save.lastSheet !== undefined ||
    Object.keys(save.certified).length > 0 ||
    Object.keys(save.scripts).length > 0
  );
}

/** Pretty-printed save for the JSON export (download). */
export function exportSave(save: SaveState): string {
  return JSON.stringify(save, null, 2);
}

/** Parse an imported JSON string into a SaveState (throws on invalid JSON so the
 *  UI can report a bad file); malformed-but-parseable blobs are coerced. */
export function parseSave(text: string): SaveState {
  return coerce(JSON.parse(text));
}
