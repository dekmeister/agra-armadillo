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
import { apply, createInitialState, tick } from "@service-bus/core";
import type { Selection } from "./sim-adapter.ts";

/** Demo seed: under FIFO this stalls and misses the WEZ; EDF/Class/reroute recover. */
const SEED = 3;

function freshState(): GameState {
  return createInitialState(SEED);
}

class GameStore {
  gs = $state<GameState>(freshState());
  sel = $state<Selection>({ type: "link", id: "bad" });
  #timer: ReturnType<typeof setInterval> | null = null;

  /** Plain (non-proxy) snapshot the pure core can safely clone. */
  #plain(): GameState {
    return $state.snapshot(this.gs) as GameState;
  }

  /** Start the 1 Hz tick loop. The crisis unfolds on screen before the player acts. */
  start(): void {
    if (this.#timer) return;
    this.#timer = setInterval(() => {
      try {
        const s = this.#plain();
        if (s.outcome === "pending") this.gs = tick(s);
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
