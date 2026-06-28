/**
 * Shared test harness: run a scenario deterministically with a scheduled action
 * map. Actions keyed at tick 0 are applied before the first tick (e.g. `arm`);
 * actions keyed at tick N are applied immediately after tick N advances.
 */
import { apply, createInitialState, tick } from "../src/index.ts";
import type { ScenarioOpts } from "../src/scenario.ts";
import type { Action, GameState } from "../src/types.ts";

export interface RunOpts {
  seed: number;
  scenario?: ScenarioOpts;
  actions?: Record<number, Action[]>;
  maxTicks?: number;
}

export function run(opts: RunOpts): GameState {
  const actions = opts.actions ?? {};
  let s = createInitialState(opts.seed, opts.scenario);
  for (const a of actions[0] ?? []) s = apply(s, a);

  const maxTicks = opts.maxTicks ?? 40;
  for (let t = 1; t <= maxTicks; t++) {
    s = tick(s);
    for (const a of actions[s.tick] ?? []) s = apply(s, a);
    if (s.outcome !== "pending") break;
  }
  return s;
}

/** Win-rate over a band of seeds under a fixed action schedule. */
export function winRate(makeActions: () => Record<number, Action[]>, seeds = 300): number {
  let wins = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    if (run({ seed, actions: makeActions() }).outcome === "win") wins++;
  }
  return wins / seeds;
}
