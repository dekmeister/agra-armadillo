// UI state for the Blueprint screen. The player's editable work is a core
// `Session` (headless, pure) — the store folds edits into it via `applyAction` and
// records each into a replayable `script`. The wired machine and validated
// composition are derived from the session in the hooks.
//
// WS-C de-hardcodes the store off a single `sheet_1_1` import: it holds the
// `currentSheet` and the whole registry's progression (which sheets are certified,
// each sheet's saved script), switches between a `select` drawing-index screen and
// the `play` screen, and persists everything to localStorage so a reload restores
// the player where they were. Phase / tick / seed still deep-link from the URL for
// headless screenshots.

import type { CommandProcessingStateEnum, Sheet } from "@normal-form/core";
import {
  applyAction,
  buildComposition,
  isReady as compositionReady,
  type MachineAction,
  type PlayerAction,
  replayScript,
  type Session,
} from "@normal-form/core";
import { FIRST_SHEET_ID, getSheet, nextSheetId } from "@normal-form/levels";
import { create } from "zustand";
import { hasSave, loadSave, parseSave, type SaveState, writeSave } from "./persist.ts";
import { isJobs, isRequestRun } from "./sheet.ts";

/** RUN is unblocked when the arrow is placed and the composition validates clean.
 *  A classification sheet (0-3) has no compose gate — the player runs to check the
 *  per-job triage — so RUN is always available there. A request-run sheet (1-5)
 *  gates on placement only: the request message is validator-agnostic and the lesson
 *  lives in the RUN-phase cancel timing, not a compose field. */
function isReady(sheet: Sheet, session: Session): boolean {
  if (isJobs(sheet)) return true;
  if (isRequestRun(sheet)) return session.placed;
  return session.placed && compositionReady(sheet, buildComposition(sheet, session));
}

export type Phase = "compose" | "handlers" | "run";
type Screen = "select" | "play";
/** The three player-facing meta surfaces (WS-D), rendered as full-viewport
 *  overlays over the current screen; `null` when none is open. */
type Overlay = "welcome" | "howto" | "reference" | null;

/** Handoff run speed: default 750ms, clamp 250–1500ms. */
export const RUN_SPEED_DEFAULT = 750;
export const RUN_SPEED_MIN = 250;
export const RUN_SPEED_MAX = 1500;

export interface GameState {
  screen: Screen;
  phase: Phase;
  tick: number;
  playing: boolean;
  seedId: number;
  runSpeed: number;
  /** whether the seed strip has been run (RUN ALL / a seed click) — gates the
   *  ✔/✖ reveal so verdicts don't leak before the player asks for them. Reset
   *  on any edit that changes the machine/composition. */
  ranAll: boolean;

  /** the open meta overlay (welcome / how-to / reference), or null (WS-D) */
  overlay: Overlay;
  /** deep-link target within the UCI Reference (e.g. "pat-Command-2"), or null */
  referenceAnchor: string | null;

  /** the sheet currently being played */
  sheet: Sheet;
  /** sheet id → certified (all seeds pass); unlocks the next sheet */
  certified: Readonly<Record<string, boolean>>;
  /** sheet id → its saved edit script (so switching/reloading restores work) */
  scripts: Readonly<Record<string, readonly PlayerAction[]>>;

  /** the current sheet's editable work (core reducer state) */
  session: Session;
  /** ordered record of every edit to the current sheet — the replayable solve */
  script: readonly PlayerAction[];

  // Progression / navigation.
  selectSheet: (id: string) => void;
  backToSelect: () => void;
  /** mark the current sheet certified (all seeds pass) — unlocks the next sheet */
  certifyCurrent: () => void;
  /** open the next sheet in the lineup, if there is one */
  goNextSheet: () => void;
  /** replace all progress from an imported save file (JSON export/import) */
  importState: (json: string) => void;

  // Meta overlays (WS-D).
  /** open the HOW TO PLAY overlay */
  openHowTo: () => void;
  /** open the UCI REFERENCE overlay, optionally scrolled to a deep-link anchor */
  openReference: (anchor?: string) => void;
  /** close whichever meta overlay is open */
  closeOverlay: () => void;
  /** dismiss the welcome card and open the first sheet */
  startFromWelcome: () => void;

  setPhase: (phase: Phase) => void;
  /** Run every seed headless and reveal the seed strip verdicts. */
  runAll: () => void;
  /** Activate the RUN section and start playback (optionally on a given seed). */
  activateRun: (seedId?: number) => void;
  setSeed: (seedId: number) => void;
  setTick: (tick: number) => void;
  play: () => void;
  pause: () => void;
  reset: () => void;

  // Editing (each dispatches a PlayerAction and appends it to `script`).
  place: () => void;
  setField: (name: string, value: string | null) => void;
  setHandler: (on: CommandProcessingStateEnum, action: MachineAction | null) => void;
  setGate: (value: boolean) => void;
  /** set the one-way publish-plan knobs (first-publish tick + republish cadence) */
  setPublish: (startTick: number, everyN: number) => void;
  /** request-run sheet (1-5): inject a CANCEL at `tick` (null clears it — no cancel) */
  setCancel: (tick: number | null) => void;
  /** classification sheet (0-3): assign a palette pattern to a job (null clears it) */
  assignPattern: (job: string, pattern: string | null) => void;
  /** classification sheet (0-3): file/unfile a certification finding on a job */
  fileFinding: (job: string, code: string, on: boolean) => void;
}

/** The first seed id declared on a sheet (no assumption seeds start at 1). */
function firstSeedId(sheet: Sheet): number {
  return sheet.seeds[0]?.id ?? 1;
}

/** Clamp a seed number to one this sheet actually declares (de-hardcodes the old
 *  {1,2,3} assumption); falls back to the sheet's first seed. */
function clampSeed(sheet: Sheet, n: number): number {
  return sheet.seeds.some((s) => s.id === n) ? n : firstSeedId(sheet);
}

const save = loadSave();
const startSheet = getSheet(save.lastSheet ?? "") ?? getSheet(FIRST_SHEET_ID);
if (!startSheet) throw new Error("no sheets registered in @normal-form/levels");

function readInitialView(sheet: Sheet): {
  screen: Screen;
  phase: Phase;
  seedId: number;
  tick: number;
} {
  const q = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const phaseParam = q.get("phase");
  const phase: Phase = phaseParam === "handlers" || phaseParam === "run" ? phaseParam : "compose";
  const seedId = clampSeed(sheet, Number(q.get("seed")));
  const tick = Number.isFinite(Number(q.get("tick"))) ? Math.max(0, Number(q.get("tick"))) : 0;
  // A deep-linked view (used by headless screenshots) opens straight into play;
  // otherwise the drawing index is the entry point.
  const deepLinked = q.has("phase") || q.has("seed") || q.has("tick");
  return { screen: deepLinked ? "play" : "select", phase, seedId, tick };
}

const view = readInitialView(startSheet);

export const useGameStore = create<GameState>((set, get) => {
  /** Persist the durable slice (progression + scripts + last sheet). */
  const persist = (partial?: Partial<Pick<SaveState, "certified" | "scripts" | "lastSheet">>) => {
    const s = get();
    writeSave({
      version: 1,
      certified: partial?.certified ?? s.certified,
      scripts: partial?.scripts ?? s.scripts,
      lastSheet: partial?.lastSheet ?? s.sheet.id,
    });
  };

  // Fold an action into the session, record it, and persist the updated script.
  // Any edit changes the machine/composition, so stale seed verdicts are hidden
  // again (ranAll: false).
  const dispatch = (action: PlayerAction) =>
    set((s) => {
      const script = [...s.script, action];
      const scripts = { ...s.scripts, [s.sheet.id]: script };
      writeSave({ version: 1, certified: s.certified, scripts, lastSheet: s.sheet.id });
      return { session: applyAction(s.session, action), script, scripts, ranAll: false };
    });

  return {
    screen: view.screen,
    phase: view.phase,
    tick: view.tick,
    playing: false,
    seedId: view.seedId,
    runSpeed: RUN_SPEED_DEFAULT,
    ranAll: false,

    // First visit (no save) opens the welcome card — but never over a deep-linked
    // view (headless screenshots load straight into play; `screen === "play"`
    // there flags the deep link, per readInitialView).
    overlay: view.screen === "select" && !hasSave(save) ? "welcome" : null,
    referenceAnchor: null,

    sheet: startSheet,
    certified: save.certified,
    scripts: save.scripts,
    session: replayScript(startSheet, save.scripts[startSheet.id] ?? []).session,
    script: save.scripts[startSheet.id] ?? [],

    selectSheet: (id) => {
      const sheet = getSheet(id);
      if (!sheet) return;
      const script = get().scripts[id] ?? [];
      const session = replayScript(sheet, script).session;
      persist({ lastSheet: id });
      set({
        screen: "play",
        sheet,
        session,
        script,
        phase: "compose",
        tick: 0,
        playing: false,
        seedId: firstSeedId(sheet),
        ranAll: false,
      });
    },
    backToSelect: () => set({ screen: "select", playing: false }),
    certifyCurrent: () =>
      set((s) => {
        if (s.certified[s.sheet.id]) return {};
        const certified = { ...s.certified, [s.sheet.id]: true };
        writeSave({ version: 1, certified, scripts: s.scripts, lastSheet: s.sheet.id });
        return { certified };
      }),
    goNextSheet: () => {
      const next = nextSheetId(get().sheet.id);
      if (next) get().selectSheet(next);
    },
    importState: (json) => {
      let imported: SaveState;
      try {
        imported = parseSave(json);
      } catch {
        return; // invalid JSON — leave progress untouched
      }
      writeSave(imported);
      const sheet = get().sheet;
      const script = imported.scripts[sheet.id] ?? [];
      set({
        certified: imported.certified,
        scripts: imported.scripts,
        session: replayScript(sheet, script).session,
        script,
        screen: "select",
        playing: false,
      });
    },

    openHowTo: () => set({ overlay: "howto" }),
    openReference: (anchor) => set({ overlay: "reference", referenceAnchor: anchor ?? null }),
    closeOverlay: () => set({ overlay: null, referenceAnchor: null }),
    startFromWelcome: () => {
      set({ overlay: null, referenceAnchor: null });
      get().selectSheet(FIRST_SHEET_ID);
    },

    // Switching phases resets tick and stops playback (handoff § Interactions).
    // Re-activating the current phase is a no-op so interacting twice within one
    // section doesn't needlessly reset tick / stop playback.
    setPhase: (phase) => set((s) => (s.phase === phase ? {} : { phase, tick: 0, playing: false })),
    // RUN ALL runs every seed headless (the verdicts are already computed live in
    // useRun — this only reveals them on the seed strip).
    runAll: () => set({ ranAll: true }),
    // Activate the RUN view and auto-start playback — but only when the composition
    // validates clean (mirrors the SubBar's RUN gate). Running an unsolved
    // composition would auto-play a misleading failure, so when not ready we just
    // switch to the run view without playing.
    activateRun: (seedId) =>
      set((s) => ({
        phase: "run",
        seedId: clampSeed(s.sheet, seedId ?? s.seedId),
        tick: 0,
        playing: isReady(s.sheet, s.session),
        ranAll: true,
      })),
    // Switching seed restarts the run.
    setSeed: (seedId) =>
      set((s) => ({ seedId: clampSeed(s.sheet, seedId), tick: 0, playing: false })),
    setTick: (tick) => set({ tick: Math.max(0, tick) }),
    play: () => set({ playing: true }),
    pause: () => set({ playing: false }),
    reset: () => set({ tick: 0, playing: false }),

    place: () => dispatch({ do: "place" }),
    setField: (name, value) => dispatch({ do: "setField", name, value }),
    setHandler: (on, action) => dispatch({ do: "setHandler", on, action }),
    setGate: (value) => dispatch({ do: "gateAccepted", value }),
    setPublish: (startTick, everyN) => dispatch({ do: "setPublish", startTick, everyN }),
    setCancel: (tick) => dispatch({ do: "setCancel", tick }),
    assignPattern: (job, pattern) => dispatch({ do: "assignPattern", job, pattern }),
    fileFinding: (job, code, on) => dispatch({ do: "fileFinding", job, code, on }),
  };
});
