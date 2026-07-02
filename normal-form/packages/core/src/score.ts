// The three Zachtronics metrics (docs/01, 05-mvp pars): Messages, Machine size,
// Ticks — reported as the worst case across a sheet's seeds. Computed
// deterministically from run results + the machine.

import type { RunResult } from "./level/runtime.ts";
import { runAllSeeds } from "./level/runtime.ts";
import type { Sheet } from "./level/types.ts";
import { type Machine, machineSize } from "./machine/schema.ts";

export interface Score {
  /** commands sent + terminal statuses acted upon (dups ignored post-terminal
   *  don't count); RECEIVED is intermediate, not counted — 1-1 reference = 2 */
  readonly messages: number;
  /** handler rules wired */
  readonly machineSize: number;
  /** tick the goal was reached */
  readonly ticks: number;
}

export function scoreRun(result: RunResult, machine: Machine): Score {
  return {
    messages: result.machine.commandsSent + result.machine.terminalActed,
    machineSize: machineSize(machine),
    ticks: result.goalTick ?? Number.POSITIVE_INFINITY,
  };
}

/** Per-metric worst (max) across seeds — the reported score for the sheet. */
export function aggregateWorst(scores: readonly Score[]): Score {
  return scores.reduce(
    (worst, s) => ({
      messages: Math.max(worst.messages, s.messages),
      machineSize: Math.max(worst.machineSize, s.machineSize),
      ticks: Math.max(worst.ticks, s.ticks),
    }),
    { messages: 0, machineSize: 0, ticks: 0 },
  );
}

export interface SheetOutcome {
  readonly allPass: boolean;
  readonly score: Score;
  readonly results: readonly RunResult[];
}

/** Run every seed and report pass/gate + worst-case score. */
export function evaluateSheet(sheet: Sheet, machine: Machine): SheetOutcome {
  const { results, allPass } = runAllSeeds(sheet, machine);
  const score = aggregateWorst(results.map((r) => scoreRun(r, machine)));
  return { allPass, score, results };
}
