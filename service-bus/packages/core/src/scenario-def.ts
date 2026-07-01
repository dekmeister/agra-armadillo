/**
 * The ScenarioDef seam — the contract every level plugs into.
 *
 * The engine (`tick` / `apply` / `createInitialState`) is scenario-agnostic: it owns
 * the generic mechanics (Gilbert–Elliott channel stepping, arrival resolution with
 * the ack-loss roll, queue dispatch under the link policy, COP decay, the
 * raise-at-most-once decision-beat plumbing) and delegates everything level-specific
 * to a ScenarioDef resolved from `state.scenarioId`. Phase 6 is the reference
 * implementation; new levels are new descriptors, not new engine branches.
 */
import type { Action, Beat, BeatId, GameState, Message, Role, ScenarioConfig } from "./types.ts";

export interface ScenarioOpts {
  /** Which level to build. Defaults to "phase6" (back-compat with the MVP slice). */
  scenarioId?: string;
  /** Override a key node's role to demonstrate misrouting to a non-authority (RBAC tests). */
  qbRole?: Role;
  config?: Partial<ScenarioConfig>;
}

export interface ScenarioDef {
  /** Stable id, e.g. "phase6" — matches `GameState.scenarioId`. */
  id: string;
  /** 1..8 OV-1 phase number (campaign order). */
  phase: number;
  title: string;
  /** Scenario-level tunables; merged with `opts.config` at build time. */
  defaultConfig: ScenarioConfig;
  /**
   * The curated seed the view loads for this level: one where passive play loses (or
   * merely observes) and the taught action wins, so the lesson lands deterministically.
   * Loss-free levels are seed-independent, so any fixed seed works; L2 (stochastic) is
   * scanned. Locked by test/tutorial-seeds.test.ts.
   */
  tutorialSeed: number;

  /** Build the initial topology + GameState (no demand yet). Must set `scenarioId`. */
  build(seed: number, opts: ScenarioOpts): GameState;
  /** Seed the opening demand (backlogs, the headline interaction) after `build`. */
  seedDemand(s: GameState): void;

  /** Per-tick hooks, run in the engine's fixed pipeline order. All optional but `evaluateOutcome`. */
  fireContingency?(s: GameState): void;
  generateDemand?(s: GameState): void;
  /** Effects when a message is delivered end-to-end (e.g. RBAC adjudication, COP refresh). */
  onDelivered?(s: GameState, msg: Message): void;
  /** Effects when a leg fails its ack (FAIL_MISSING_ACK) — e.g. auto-retry + a beat. */
  onLegFailed?(s: GameState, msg: Message): void;
  evaluateOutcome(s: GameState): void;
  /** Standing-condition beats re-checked each tick. */
  checkStandingBeats?(s: GameState): void;

  /** Called once when the player arms the deadline window (generic arm sets `wezDeadlineTick`). */
  onArm?(s: GameState): void;
  /** Handle a scenario-specific action; return true if handled. Generic actions stay in the engine. */
  applyAction?(s: GameState, action: Action): boolean;

  /** This level's decision beats, keyed by id. */
  beats: Partial<Record<BeatId, Omit<Beat, "tick">>>;
}
