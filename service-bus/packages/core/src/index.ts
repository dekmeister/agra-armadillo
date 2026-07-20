/**
 * @service-bus/core — deterministic, headless A-GRA DMS simulation.
 *
 * The whole game is `tick(state) -> state'` plus `apply(state, action)`, both pure
 * functions of `(scenario, seed)`. No DOM, no framework, no wall-clock — runs the
 * same in Node (parameter sweeps) and in the browser (the Svelte console).
 */

export {
  type CodexEntry,
  type CodexProvenance,
  type CodexStatus,
  KNOWN_MESSAGE_NAMES,
  LIFECYCLE_SOURCE,
  MESSAGE_CODEX,
  REFERENCE_MESSAGE_NAMES,
} from "./codex.ts";
export {
  type ElectionOutcome,
  electionCounterfactual,
  electionOutcome,
} from "./counterfactual.ts";
export { type ElectionStrategy, quorumOf, STRATEGIES } from "./election.ts";
export { apply, createInitialState, tick } from "./engine.ts";
export { blockProb, dispatchOrder, stepChannel } from "./link.ts";
export { adjudicate, adjudicateApproval, isTargetAuthority } from "./rbac.ts";
export {
  classesForLevel,
  emissionsForLevel,
  messagesEmittedBy,
  TAUGHT_PATHS,
  typesForLevel,
} from "./replay.ts";
export { Rng } from "./rng.ts";
export {
  buildPhase6,
  CAMPAIGN,
  DEFAULT_CONFIG,
  getScenario,
  SCENARIOS,
  type ScenarioDef,
  type ScenarioOpts,
  TUTORIAL_SEED,
} from "./scenario.ts";
export type * from "./types.ts";
