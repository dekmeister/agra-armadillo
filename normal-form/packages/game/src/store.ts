// Minimal UI state for the Blueprint screen (handoff § State Management): phase,
// tick, playing, seedId, the wired machine, and run speed. Everything else on
// screen is level data (from @normal-form/levels) or derived from the pure
// engine (see useRun in RunView). Initial state is seeded from URL query params
// so headless screenshots can deep-link a specific frame
// (?phase=run&seed=2&tick=5&ref=1).
import type { Machine } from "@normal-form/core";
import { create } from "zustand";
import { REFERENCE_MACHINE } from "./dev/refMachine.ts";

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
  /** the wired handler machine; null until HANDLERS editing (S5). `?ref=1` loads
   *  the dev reference machine so the run view is drivable in S4. */
  machine: Machine | null;
  runSpeed: number;

  setPhase: (phase: Phase) => void;
  setSeed: (seedId: number) => void;
  setTick: (tick: number) => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
}

function readInitialState(): {
  phase: Phase;
  seedId: number;
  tick: number;
  machine: Machine | null;
} {
  const q = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const phaseParam = q.get("phase");
  const phase: Phase = phaseParam === "handlers" || phaseParam === "run" ? phaseParam : "compose";
  const seedId = clampSeed(Number(q.get("seed")));
  const tick = Number.isFinite(Number(q.get("tick"))) ? Math.max(0, Number(q.get("tick"))) : 0;
  // Dev affordance (removed in S5): load the reference machine to drive RUN
  // before HANDLERS editing exists.
  const machine = q.get("ref") === "1" ? REFERENCE_MACHINE : null;
  return { phase, seedId, tick, machine };
}

function clampSeed(n: number): number {
  return n === 2 || n === 3 ? n : 1;
}

const init = readInitialState();

export const useGameStore = create<GameState>((set) => ({
  phase: init.phase,
  tick: init.tick,
  playing: false,
  seedId: init.seedId,
  machine: init.machine,
  runSpeed: RUN_SPEED_DEFAULT,

  // Switching phases resets tick and stops playback (handoff § Interactions).
  setPhase: (phase) => set({ phase, tick: 0, playing: false }),
  // Switching seed restarts the run.
  setSeed: (seedId) => set({ seedId: clampSeed(seedId), tick: 0, playing: false }),
  setTick: (tick) => set({ tick: Math.max(0, tick) }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  reset: () => set({ tick: 0, playing: false }),
}));
