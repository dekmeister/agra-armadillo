/**
 * @service-bus/core — deterministic, headless A-GRA DMS simulation.
 *
 * The whole game is `tick(state) -> state'` plus `apply(state, action)`, both pure
 * functions of `(scenario, seed)`. No DOM, no framework, no wall-clock — runs the
 * same in Node (parameter sweeps) and in the browser (the Svelte console).
 */

export { type ElectionMethod, type ElectionStrategy, STRATEGIES } from "./election.ts";
export { apply, createInitialState, tick } from "./engine.ts";
export { blockProb, dispatchOrder, stepChannel } from "./link.ts";
export { adjudicateApproval, isTargetAuthority } from "./rbac.ts";
export { Rng } from "./rng.ts";
export { buildPhase6, DEFAULT_CONFIG, type ScenarioOpts } from "./scenario.ts";
export type * from "./types.ts";
