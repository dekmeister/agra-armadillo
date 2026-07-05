// Derived engine state for the run view. Pure and cheap — recomputed with useMemo
// keyed on the session + selected seed. The wired machine is built from the
// player's session; `ready` reflects the S3 validator gate (placed + clean).
import {
  type AllSeedsResult,
  buildComposition,
  buildMachine,
  type Machine,
  type RunResult,
  runAllSeeds,
  runSeed,
  validate,
} from "@normal-form/core";
import { useMemo } from "react";
import { type BoardModel, runFrames } from "./frames.ts";
import { useGameStore } from "./store.ts";

export interface DerivedRun {
  readonly machine: Machine;
  readonly result: RunResult | null;
  readonly board: BoardModel | null;
  /** last tick of the selected run (playback bound) */
  readonly endTick: number;
  readonly all: AllSeedsResult | null;
  /** every seed passes — certification is pass/fail (scoring was cut, WS-B) */
  readonly allPass: boolean;
  /** RUN is unblocked: the arrow is placed and the composition validates clean */
  readonly ready: boolean;
}

export function useRun(): DerivedRun {
  const sheet = useGameStore((s) => s.sheet);
  const session = useGameStore((s) => s.session);
  const seedId = useGameStore((s) => s.seedId);

  return useMemo<DerivedRun>(() => {
    const machine = buildMachine(session);
    const ready = session.placed && validate(sheet, buildComposition(sheet, session)).length === 0;
    const seed = sheet.seeds.find((s) => s.id === seedId);
    if (!seed) {
      return {
        machine,
        result: null,
        board: null,
        endTick: 0,
        all: null,
        allPass: false,
        ready,
      };
    }
    const result = runSeed(sheet, machine, seed);
    const board = runFrames(result);
    const all = runAllSeeds(sheet, machine);
    return { machine, result, board, endTick: board.endTick, all, allPass: all.allPass, ready };
  }, [sheet, session, seedId]);
}
