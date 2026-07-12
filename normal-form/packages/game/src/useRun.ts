// Derived engine state for the run view. Pure and cheap — recomputed with useMemo
// keyed on the session + selected seed. The wired machine is built from the
// player's session; `ready` reflects the S3 validator gate (placed + clean).
//
// Two sim paths (WS-E): Command-2 sheets run the handler machine (`runSeed`), while
// one-way (`-1`) sheets run the publish plan (`runSeedOneWay`). Both fold into one
// `DerivedRun` so the play screen stays uniform — the board branches on which
// board model is present.
import {
  buildComposition,
  buildMachine,
  derivePublishPlan,
  type Machine,
  type OneWayRunResult,
  type RunResult,
  runAllSeeds,
  runAllSeedsOneWay,
  runSeed,
  runSeedOneWay,
  validate,
} from "@normal-form/core";
import { useMemo } from "react";
import { type BoardModel, type OneWayBoardModel, runFrames, runFramesOneWay } from "./frames.ts";
import { isOneWay } from "./sheet.ts";
import { useGameStore } from "./store.ts";

export interface DerivedRun {
  readonly machine: Machine;
  readonly result: RunResult | OneWayRunResult | null;
  /** Command-2 board model (null on one-way sheets) */
  readonly board: BoardModel | null;
  /** one-way fan-out board model (null on Command-2 sheets) */
  readonly oneWayBoard: OneWayBoardModel | null;
  /** last tick of the selected run (playback bound) */
  readonly endTick: number;
  /** per-seed pass verdicts (seed strip / console), from whichever sim path ran */
  readonly seedResults: readonly { readonly seedId: number; readonly pass: boolean }[];
  /** every seed passes — certification is pass/fail (scoring was cut, WS-B) */
  readonly allPass: boolean;
  /** RUN is unblocked: the pattern is placed and the composition validates clean */
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
    const base = {
      machine,
      result: null,
      board: null,
      oneWayBoard: null,
      endTick: 0,
      seedResults: [],
      allPass: false,
      ready,
    } satisfies DerivedRun;
    if (!seed) return base;

    if (isOneWay(sheet)) {
      const plan = derivePublishPlan(sheet, session.publish.startTick, session.publish.everyN);
      const result = runSeedOneWay(sheet, plan, seed);
      const oneWayBoard = runFramesOneWay(result, sheet);
      const all = runAllSeedsOneWay(sheet, plan);
      return {
        ...base,
        result,
        oneWayBoard,
        endTick: oneWayBoard.endTick,
        seedResults: all.results.map((r) => ({ seedId: r.seedId, pass: r.pass })),
        allPass: all.allPass,
      };
    }

    const result = runSeed(sheet, machine, seed);
    const board = runFrames(result);
    const all = runAllSeeds(sheet, machine);
    return {
      ...base,
      result,
      board,
      endTick: board.endTick,
      seedResults: all.results.map((r) => ({ seedId: r.seedId, pass: r.pass })),
      allPass: all.allPass,
    };
  }, [sheet, session, seedId]);
}
