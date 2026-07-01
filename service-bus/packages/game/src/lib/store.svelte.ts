/**
 * The view-layer store: owns the live GameState for the SELECTED level, runs the 1 Hz
 * wall-clock loop (the ONLY place time lives — the core advances by integer ticks only),
 * and exposes player actions. UI selection state lives here too; sim state stays pure.
 *
 * The core is a pure function over PLAIN objects. `gs` is a Svelte `$state` proxy, so we
 * hand the core a `$state.snapshot` (a plain deep copy) every time — passing the proxy
 * into the engine's structuredClone would throw and freeze the board.
 */

import type { Action, ElectionMethod, GameState, QueuePolicy } from "@service-bus/core";
import { apply, createInitialState, getScenario, tick } from "@service-bus/core";
import { defaultLinkId, type Selection } from "./sim-adapter.ts";

/** Wall-clock length of one sim tick (ms). The core advances by integer ticks; the view
 * interpolates message positions across this window (see `renderFrac`). Single source of truth. */
const TICK_MS = 1000;

/** Only Phase 6 runs a WEZ deadline; others use `wezWindow` merely as a level length. */
function usesWez(scenarioId: string): boolean {
  return scenarioId === "phase6";
}

/** Build a level's opening state (on its curated tutorial seed), arming the WEZ if it has one. */
function build(scenarioId: string, seed?: number): GameState {
  const s0 = createInitialState(seed ?? getScenario(scenarioId).tutorialSeed, {
    scenarioId,
    config: { mode: "tutorial" },
  });
  // Arm the WEZ at mission start (Phase 6): with auto-pause the clock halts at each
  // decision point and while a menu is open, so the player gets reading time without
  // arm-on-first-click — and a "just resume through everything" run still faces a real
  // deadline. The countdown only advances on running ticks.
  return usesWez(scenarioId) ? apply(s0, { type: "arm" }) : s0;
}

class GameStore {
  scenarioId = $state("phase6");
  gs = $state<GameState>(build("phase6"));
  sel = $state<Selection>({ type: "link", id: "bad" });
  /** Fraction (0..1) of wall time from the last tick toward the next. The view reads
   * `gs.tick + renderFrac` to glide in-flight messages smoothly between integer ticks. */
  renderFrac = $state(0);
  #timer: ReturnType<typeof setInterval> | null = null;
  #raf: number | null = null;
  #lastTickAt = 0;

  /** Load a level (fresh) and focus a sensible default element. */
  load(scenarioId: string, seed?: number): void {
    this.stop();
    this.scenarioId = scenarioId;
    this.gs = build(scenarioId, seed);
    this.sel = { type: "link", id: defaultLinkId(this.gs) };
  }

  /** Plain (non-proxy) snapshot the pure core can safely clone. */
  #plain(): GameState {
    return $state.snapshot(this.gs) as GameState;
  }

  /**
   * Start the 1 Hz tick loop. The crisis unfolds on screen before the player acts. The
   * loop auto-pauses the instant the core raises a decision beat. Won't start while a
   * beat is pending (guards against a menu close racing an open decision point).
   */
  start(): void {
    if (this.#timer || this.gs.pendingBeat) return;
    this.#markTick();
    this.#timer = setInterval(() => {
      try {
        const s = this.#plain();
        if (s.outcome !== "pending") return;
        this.gs = tick(s);
        this.#markTick(); // reset the interpolation window so gs.tick + renderFrac stays continuous
        if (this.gs.pendingBeat) this.stop(); // halt on the decision point
      } catch (err) {
        console.error("tick failed", err);
        this.stop();
      }
    }, TICK_MS);
    this.#startRaf();
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    // Freeze tokens mid-glide (paused on a beat / menu / outcome) and stop burning frames.
    if (this.#raf !== null) cancelAnimationFrame(this.#raf);
    this.#raf = null;
  }

  /** Reset the wall-clock interpolation window at a tick boundary. */
  #markTick(): void {
    this.#lastTickAt = performance.now();
    this.renderFrac = 0;
  }

  /** Per-frame loop that advances `renderFrac` toward 1 across one tick's wall time. */
  #startRaf(): void {
    if (this.#raf !== null) return;
    const loop = (): void => {
      this.renderFrac = Math.min(1, (performance.now() - this.#lastTickAt) / TICK_MS);
      this.#raf = requestAnimationFrame(loop);
    };
    this.#raf = requestAnimationFrame(loop);
  }

  /** Dismiss the current decision point and resume the clock. */
  resume(): void {
    this.#act({ type: "acknowledgeBeat" });
    this.start();
  }

  #act(a: Action): void {
    this.gs = apply(this.#plain(), a);
  }

  /** Arm the WEZ on the first interaction (Phase 6 only; harmless elsewhere but skipped). */
  #armIfNeeded(): void {
    if (usesWez(this.scenarioId) && !this.gs.armed) this.#act({ type: "arm" });
  }

  select(type: "node" | "link" | "token", id: string): void {
    this.sel = { type, id };
    this.#armIfNeeded();
  }

  setPolicy(linkId: string, policy: QueuePolicy): void {
    this.#armIfNeeded();
    this.#act({ type: "setPolicy", linkId, policy });
  }

  // --- Phase 6 recovery affordances -----------------------------------------
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

  // --- Campaign-level affordances --------------------------------------------
  retry(): void {
    this.#act({ type: "retry" }); // L2: re-attempt unconfirmed reports
  }
  pickElection(method: ElectionMethod): void {
    this.#act({ type: "pickElection", method }); // L3/L7
  }
  shedTraffic(): void {
    this.#act({ type: "shedTraffic" }); // L5
  }
  handBack(): void {
    this.#act({ type: "handBack" }); // L7: QB → LRE authority
  }
  mergeTeam(): void {
    this.#act({ type: "mergeTeam" }); // L7: heal the split on command
  }

  /** Replay the current level from its opening state. */
  replay(): void {
    this.load(this.scenarioId);
  }
}

export const game = new GameStore();
