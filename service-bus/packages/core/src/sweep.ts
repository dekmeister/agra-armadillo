/**
 * The headless strategy sweep — and the one result the game most wants to show a player.
 *
 * `tools/run-sweep.ts` has always been able to answer "how often does each recovery
 * strategy actually work?", but the answer only ever reached a terminal. It is the closest
 * thing the game has to a proof of its own thesis: that routing and queue discipline get a
 * deadline-critical reply through, and that *retrying onto the same degraded link* — the
 * intuitive move — is the worst thing you can do. WP6.5 puts it in front of the player.
 *
 * The per-seed loop lives here rather than in the CLI so the tool, the debrief and the
 * regression test are all reading the same implementation.
 *
 * IMPORTANT: these rates describe *this simulation's* Gilbert–Elliott model, not A-GRA.
 * They are a property of the game's tuning, and any copy rendering them must say so.
 */
import { apply, createInitialState, tick } from "./engine.ts";
import type { Action, GameState, QueuePolicy } from "./types.ts";

export type Strategy = "none" | "edf" | "class" | "reroute" | "rerequest";

export const SWEEP_STRATEGIES: Strategy[] = ["none", "edf", "class", "reroute", "rerequest"];

/** The single recovery action each strategy takes, or null for "do nothing" (FIFO). */
export function recoveryAction(strategy: Strategy): Action | null {
  switch (strategy) {
    case "edf":
      return { type: "setPolicy", linkId: "bad", policy: "edf" as QueuePolicy };
    case "class":
      return { type: "setPolicy", linkId: "bad", policy: "class" as QueuePolicy };
    case "reroute":
      return { type: "reroute" };
    case "rerequest":
      return { type: "rerequest" };
    default:
      return null;
  }
}

export interface SweepResult {
  seed: number;
  outcome: GameState["outcome"];
  completionTick: number;
  failReason: string;
}

export interface SweepOpts {
  config?: Record<string, unknown>;
  /** Tick at which the strategy's single recovery action is applied. */
  at?: number;
  maxTicks?: number;
}

/** Play one seed under one strategy. Pure — same (seed, strategy) always agrees. */
export function runOne(seed: number, strategy: Strategy, opts: SweepOpts = {}): SweepResult {
  const { config = {}, at = 4, maxTicks = 60 } = opts;
  let s = createInitialState(seed, { config });
  s = apply(s, { type: "arm" });
  const action = recoveryAction(strategy);

  for (let t = 1; t <= maxTicks; t++) {
    s = tick(s);
    if (action && s.tick === at) s = apply(s, action);
    if (s.outcome !== "pending") break;
  }
  return {
    seed,
    outcome: s.outcome,
    completionTick: s.tick,
    failReason: s.failReason ?? "",
  };
}

/** Play a band of seeds under one strategy. */
export function sweep(
  strategy: Strategy,
  seedLo: number,
  seedHi: number,
  opts: SweepOpts = {},
): SweepResult[] {
  const out: SweepResult[] = [];
  for (let seed = seedLo; seed <= seedHi; seed++) out.push(runOne(seed, strategy, opts));
  return out;
}

export function winRate(results: SweepResult[]): number {
  return results.filter((r) => r.outcome === "win").length / results.length;
}

/** Win rate for one strategy over seeds 1..seeds. */
export function strategyWinRate(strategy: Strategy, seeds: number, opts: SweepOpts = {}): number {
  return winRate(sweep(strategy, 1, seeds, opts));
}

/** Seed band the published rates below were measured over. */
export const SWEEP_SEEDS = 500;

/**
 * Phase 6 recovery strategies, by measured win rate.
 *
 * Reproduce with:
 *   npm run sweep -- scenarios/phase6.json --compare --seeds 500
 *
 * These are exact, not approximate — the sim is deterministic, so `test/sweep.test.ts`
 * re-runs the whole sweep and asserts equality rather than a tolerance band. Before WP6.5
 * these numbers lived only as prose in the README with nothing checking them.
 *
 * `edf` and `class` tie at 0.894 on this tuning and are shown as one row: both float the
 * deadline-critical reply ahead of routine traffic, which is the lesson.
 */
export const STRATEGY_WIN_RATES: { strategy: Strategy; label: string; rate: number }[] = [
  { strategy: "reroute", label: "Reroute via a relay platform's DMS", rate: 0.958 },
  { strategy: "class", label: "Re-prioritise the link (Class / EDF)", rate: 0.894 },
  { strategy: "none", label: "Do nothing (FIFO)", rate: 0.294 },
  { strategy: "rerequest", label: "Re-request on the same link", rate: 0.224 },
];
