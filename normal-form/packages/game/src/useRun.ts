// Derived engine state for the run view. Pure and cheap — recomputed with useMemo
// keyed on the wired machine + selected seed. When no machine is wired (S4 without
// `?ref=1`), everything degrades to an empty/disabled run.
import {
  type AllSeedsResult,
  evaluateSheet,
  type Machine,
  type RunResult,
  runAllSeeds,
  runSeed,
  type Score,
} from "@normal-form/core";
import { sheet_1_1 } from "@normal-form/levels";
import { useMemo } from "react";
import { type BoardModel, runFrames } from "./frames.ts";
import { useGameStore } from "./store.ts";

export interface DerivedRun {
  readonly machine: Machine | null;
  /** the selected seed's run, or null when no machine is wired */
  readonly result: RunResult | null;
  readonly board: BoardModel | null;
  /** last tick of the selected run (playback bound), 0 when no machine */
  readonly endTick: number;
  readonly all: AllSeedsResult | null;
  readonly score: Score | null;
  readonly allPass: boolean;
}

export function useRun(): DerivedRun {
  const machine = useGameStore((s) => s.machine);
  const seedId = useGameStore((s) => s.seedId);

  return useMemo<DerivedRun>(() => {
    if (!machine) {
      return {
        machine: null,
        result: null,
        board: null,
        endTick: 0,
        all: null,
        score: null,
        allPass: false,
      };
    }
    const seed = sheet_1_1.seeds.find((s) => s.id === seedId);
    if (!seed) {
      return {
        machine,
        result: null,
        board: null,
        endTick: 0,
        all: null,
        score: null,
        allPass: false,
      };
    }
    const result = runSeed(sheet_1_1, machine, seed);
    const board = runFrames(result);
    const all = runAllSeeds(sheet_1_1, machine);
    const { score, allPass } = evaluateSheet(sheet_1_1, machine);
    return { machine, result, board, endTick: board.endTick, all, score, allPass };
  }, [machine, seedId]);
}
