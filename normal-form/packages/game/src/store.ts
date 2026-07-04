// UI state for the Blueprint screen. The player's editable work is a core
// `Session` (headless, pure) — the store folds edits into it via `applyAction`
// and records each into a replayable `script` (PLAN_MVP S5). The wired machine
// and the validated composition are derived from the session in the hooks. Phase
// / tick / seed can still be deep-linked from URL query for headless screenshots.

import type { CommandProcessingStateEnum } from "@normal-form/core";
import {
  applyAction,
  initialSession,
  type MachineAction,
  type PlayerAction,
  type Session,
} from "@normal-form/core";
import { sheet_1_1 } from "@normal-form/levels";
import { create } from "zustand";

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

  /** the player's editable work (core reducer state) */
  session: Session;
  /** ordered record of every edit — the replayable solve script */
  script: PlayerAction[];

  setPhase: (phase: Phase) => void;
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
  // Fold an action into the session and record it for replay.
  const dispatch = (action: PlayerAction) =>
    set((s) => ({ session: applyAction(s.session, action), script: [...s.script, action] }));

  return {
    phase: view.phase,
    tick: view.tick,
    playing: false,
    seedId: view.seedId,
    runSpeed: RUN_SPEED_DEFAULT,
    session: initialSession(sheet_1_1),
    script: [],

    // Switching phases resets tick and stops playback (handoff § Interactions).
    setPhase: (phase) => set({ phase, tick: 0, playing: false }),
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
