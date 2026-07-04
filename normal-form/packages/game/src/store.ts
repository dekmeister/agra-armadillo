// UI state for the Blueprint screen. The player's editable work is a core
// `Session` (headless, pure) — the store folds edits into it via `applyAction`
// and records each into a replayable `script` (PLAN_MVP S5). The wired machine
// and the validated composition are derived from the session in the hooks. Phase
// / tick / seed can still be deep-linked from URL query for headless screenshots.

import type { CommandProcessingStateEnum } from "@normal-form/core";
import {
  applyAction,
  buildComposition,
  initialSession,
  type MachineAction,
  type PlayerAction,
  type Session,
  validate,
} from "@normal-form/core";
import { sheet_1_1 } from "@normal-form/levels";
import { create } from "zustand";

/** RUN is unblocked when the arrow is placed and the composition validates clean. */
function isReady(session: Session): boolean {
  return session.placed && validate(sheet_1_1, buildComposition(sheet_1_1, session)).length === 0;
}

export type Phase = "compose" | "handlers" | "run";

/** Handoff run speed: default 750ms, clamp 250–1500ms. */
export const RUN_SPEED_DEFAULT = 750;
export const RUN_SPEED_MIN = 250;
export const RUN_SPEED_MAX = 1500;

export interface GameState {
  phase: Phase;
  tick: number;
  playing: boolean;
  seedId: number;
  runSpeed: number;
  /** whether the seed strip has been run (RUN ALL / a seed click) — gates the
   *  ✔/✖ reveal so verdicts don't leak before the player asks for them. Reset
   *  on any edit that changes the machine/composition. */
  ranAll: boolean;

  /** the player's editable work (core reducer state) */
  session: Session;
  /** ordered record of every edit — the replayable solve script */
  script: PlayerAction[];

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
}

function readInitialView(): { phase: Phase; seedId: number; tick: number } {
  const q = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const phaseParam = q.get("phase");
  const phase: Phase = phaseParam === "handlers" || phaseParam === "run" ? phaseParam : "compose";
  const seedId = clampSeed(Number(q.get("seed")));
  const tick = Number.isFinite(Number(q.get("tick"))) ? Math.max(0, Number(q.get("tick"))) : 0;
  return { phase, seedId, tick };
}

function clampSeed(n: number): number {
  return n === 2 || n === 3 ? n : 1;
}

const view = readInitialView();

export const useGameStore = create<GameState>((set) => {
  // Fold an action into the session and record it for replay. Any edit changes
  // the machine/composition, so stale seed verdicts are hidden again (ranAll: false).
  const dispatch = (action: PlayerAction) =>
    set((s) => ({
      session: applyAction(s.session, action),
      script: [...s.script, action],
      ranAll: false,
    }));

  return {
    phase: view.phase,
    tick: view.tick,
    playing: false,
    seedId: view.seedId,
    runSpeed: RUN_SPEED_DEFAULT,
    ranAll: false,
    session: initialSession(sheet_1_1),
    script: [],

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
        seedId: clampSeed(seedId ?? s.seedId),
        tick: 0,
        playing: isReady(s.session),
        ranAll: true,
      })),
    // Switching seed restarts the run.
    setSeed: (seedId) => set({ seedId: clampSeed(seedId), tick: 0, playing: false }),
    setTick: (tick) => set({ tick: Math.max(0, tick) }),
    play: () => set({ playing: true }),
    pause: () => set({ playing: false }),
    reset: () => set({ tick: 0, playing: false }),

    place: () => dispatch({ do: "place" }),
    setField: (name, value) => dispatch({ do: "setField", name, value }),
    setHandler: (on, action) => dispatch({ do: "setHandler", on, action }),
    setGate: (value) => dispatch({ do: "gateAccepted", value }),
  };
});
