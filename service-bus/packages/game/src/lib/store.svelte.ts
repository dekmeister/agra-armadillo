/**
 * The view-layer store: owns the live GameState, runs the 1 Hz wall-clock loop
 * (the ONLY place time lives — the core advances by integer ticks only), and
 * exposes player actions. UI selection state lives here too; sim state stays pure.
 *
 * The core is a pure function over PLAIN objects. `gs` is a Svelte `$state` proxy,
 * so we hand the core a `$state.snapshot` (a plain deep copy) every time — passing
 * the proxy into the engine's structuredClone would throw and freeze the board.
 */

import type { Action, GameState, QueuePolicy } from "@service-bus/core";
import { apply, createInitialState, TUTORIAL_SEED, tick } from "@service-bus/core";
import type { Selection } from "./sim-adapter.ts";

function freshState(): GameState {
  // Arm the WEZ at mission start: with auto-pause the clock already halts at each
  // decision point (and while a menu is open), so the player gets reading time
  // without arm-on-first-click — and a "just resume through everything" run still
  // faces a real deadline. The countdown only advances on running ticks.
  return apply(createInitialState(TUTORIAL_SEED, { config: { mode: "tutorial" } }), {
    type: "arm",
  });
}

class GameStore {
  gs = $state<GameState>(freshState());
  sel = $state<Selection>({ type: "link", id: "bad" });
  #timer: ReturnType<typeof setInterval> | null = null;

  /** Plain (non-proxy) snapshot the pure core can safely clone. */
  #plain(): GameState {
    return $state.snapshot(this.gs) as GameState;
  }

  /**
   * Start the 1 Hz tick loop. The crisis unfolds on screen before the player acts.
   * The loop auto-pauses the instant the core raises a decision beat, so the player
   * reads the board and acts without the clock running them over. Won't start while
   * a beat is pending (guards against a menu close racing an open decision point).
   */
  start(): void {
    if (this.#timer || this.gs.pendingBeat) return;
    this.#timer = setInterval(() => {
      try {
        const s = this.#plain();
        if (s.outcome !== "pending") return;
        this.gs = tick(s);
        if (this.gs.pendingBeat) this.stop(); // halt on the decision point
      } catch (err) {
        console.error("tick failed", err);
        this.stop();
      }
    }, 1000);
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }

  /** Dismiss the current decision point and resume the clock. */
  resume(): void {
    this.#act({ type: "acknowledgeBeat" });
    this.start();
  }

  #act(a: Action): void {
    this.gs = apply(this.#plain(), a);
  }

  /** Arm the WEZ on the first interaction (gives reading time, matches the handoff). */
  #armIfNeeded(): void {
    if (!this.gs.armed) this.#act({ type: "arm" });
  }

  select(type: "node" | "link" | "token", id: string): void {
    this.sel = { type, id };
    this.#armIfNeeded();
  }

  setPolicy(linkId: string, policy: QueuePolicy): void {
    this.#armIfNeeded();
    this.#act({ type: "setPolicy", linkId, policy });
  }

  reroute(): void {
    this.#armIfNeeded();
    this.#act({ type: "reroute" });
  }

  rerequest(): void {
    this.#armIfNeeded();
    this.#act({ type: "rerequest" });
  }

  refreshCop(): void {
    this.#armIfNeeded();
    this.#act({ type: "refreshCop" });
  }

  replay(): void {
    this.gs = freshState();
    this.sel = { type: "link", id: "bad" };
  }
}

export const game = new GameStore();
