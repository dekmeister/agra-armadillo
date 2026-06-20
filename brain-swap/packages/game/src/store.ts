// The app store (Zustand) — the one bridge between the deterministic core and React.
// Realtime mode: the player IS the MA brain. There is no state machine; the player
// injects MA→FA messages by hand and the live edge of the timeline advances tick by
// tick. A session is a recorded input script (core's ScriptedInput[]) — replaying it
// reproduces the run exactly (docs/04, CLAUDE.md rule #3). The store owns: the growing
// timeline (World[]), the playhead/transport, the recorded script + pending (composed
// but not-yet-injected) inputs, the composer flag, selections, and persisted best scores.

import {
  type BodyProfile,
  extractScript,
  initWorld,
  injectMA,
  type LevelDef,
  type Message,
  makeScenario,
  run,
  type Scenario,
  type Score,
  type ScriptedInput,
  scoreWorld,
  step,
  type World,
} from "@brain-swap/core";
import { bodyById, levelById, msBodyById } from "@brain-swap/levels";
import { create } from "zustand";
import { isTutorialLevel } from "./meta/levelCatalog.ts";
import { finalFrame } from "./sim/timeline.ts";

const DEFAULT_LEVEL_ID = "1.2";

export type View = "console" | "report" | "select" | "help" | "codex";
export type Speed = 1 | 2 | 8;

const BEST_KEY = "brain-swap:best";

/** A bounded ceiling so a level without maxTicks can't grow the timeline forever. */
const HARD_CEILING = 1000;

function loadBest(): Record<string, { score: Score; won: boolean }> {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw ? (JSON.parse(raw) as Record<string, { score: Score; won: boolean }>) : {};
  } catch {
    return {};
  }
}

interface StoreState {
  view: View;
  level: LevelDef;
  body: BodyProfile;

  // The live, growing run. timeline[i] is the world at tick i; the live edge is the
  // last frame. playhead is what the UI renders (== live edge while running; can be
  // scrubbed back to review past ticks).
  timeline: World[];
  playhead: number;
  running: boolean;
  speed: Speed;

  // Realtime session: every committed MA→FA input (for replay/scoring) + inputs the
  // player composed but the sim hasn't injected yet, and whether the composer is open
  // (which pauses the clock).
  script: ScriptedInput[];
  pendingInputs: Message[];
  composing: boolean;
  /** Next CommandID sequence number to prefill in the composer (CMD-1, CMD-2, …). */
  commandSeq: number;

  // Tutorial demo: a guided, watch-only level. `demoScript` is the reference
  // solution derived headlessly on select; `advanceLive` injects it as the live
  // edge advances so pressing Play replays the solve. While `tutorial` is true the
  // compose affordances are disabled (the player only watches).
  tutorial: boolean;
  demoScript: ScriptedInput[];

  selectedLogIndex: number | null;
  showPeriodic: boolean;
  toggleShowPeriodic: () => void;

  bestScores: Record<string, { score: Score; won: boolean }>;

  // derived — the stable timeline[playhead] snapshot (safe in a selector). Derive
  // scores from this in render (scoreWorld), never inside a selector.
  world: () => World;

  // navigation
  setView: (v: View) => void;
  selectLevel: (levelId: string) => void;

  // transport
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  restart: () => void;
  stepOne: () => void;
  setSpeed: (s: Speed) => void;
  scrubTo: (tick: number) => void;
  /** Advance the live sim by n ticks: inject pending inputs at the live edge, then step. */
  advanceLive: (nTicks: number) => void;

  // composer (the player composing a message to send)
  openComposer: () => void;
  cancelComposer: () => void;
  submitComposer: (message: Message) => void;

  // selection
  selectLog: (i: number | null) => void;

  recordResult: () => void;
}

/** Resolve a level's optional MS body (null for FA-only levels). */
function msBodyOf(level: LevelDef) {
  return level.msBody ? msBodyById(level.msBody) : null;
}

function scenarioOf(s: Pick<StoreState, "body" | "level">): Scenario {
  return makeScenario(s.body, { brain: null, level: s.level, msBody: msBodyOf(s.level) });
}

function maxStepsFor(level: LevelDef): number {
  return level.maxTicks ?? HARD_CEILING;
}

/**
 * Derive a tutorial level's watch-only demo script: run the reference brain
 * headlessly and extract the MA→FA inputs it sent. Pure (no DOM / RNG / clock —
 * CLAUDE.md rule #3). The store injects these via `injectMA` as the live edge
 * advances, exactly as a player's recorded session would replay.
 */
function deriveDemoScript(levelId: string): ScriptedInput[] {
  if (!isTutorialLevel(levelId)) return [];
  const bundle = levelById(levelId);
  if (!bundle) return [];
  const { level, referenceBrain } = bundle;
  const scenario = makeScenario(bodyById(level.body), {
    brain: referenceBrain,
    level,
    msBody: msBodyOf(level),
  });
  return extractScript([run(initWorld(scenario), maxStepsFor(level))]);
}

export const useStore = create<StoreState>((set, get) => {
  const initialLevel = levelById(DEFAULT_LEVEL_ID)!.level;
  const initialBody = bodyById(initialLevel.body);
  const initialTimeline = [
    initWorld(
      makeScenario(initialBody, {
        brain: null,
        level: initialLevel,
        msBody: msBodyOf(initialLevel),
      }),
    ),
  ];

  return {
    view: "console",
    level: initialLevel,
    body: initialBody,

    timeline: initialTimeline,
    playhead: 0,
    running: false,
    speed: 1,

    script: [],
    pendingInputs: [],
    composing: false,
    commandSeq: 1,

    tutorial: isTutorialLevel(DEFAULT_LEVEL_ID),
    demoScript: deriveDemoScript(DEFAULT_LEVEL_ID),

    selectedLogIndex: null,
    showPeriodic: false,
    bestScores: loadBest(),

    world: () => {
      const { timeline, playhead } = get();
      return timeline[Math.min(playhead, timeline.length - 1)]!;
    },

    setView: (v) => set({ view: v }),

    selectLevel: (levelId) => {
      const bundle = levelById(levelId);
      if (!bundle) return;
      const { level } = bundle;
      const body = bodyById(level.body);
      set({
        level,
        body,
        timeline: [initWorld(makeScenario(body, { brain: null, level, msBody: msBodyOf(level) }))],
        playhead: 0,
        running: false,
        script: [],
        pendingInputs: [],
        composing: false,
        commandSeq: 1,
        tutorial: isTutorialLevel(levelId),
        demoScript: deriveDemoScript(levelId),
        view: "console",
        selectedLogIndex: null,
      });
    },

    play: () => {
      const { timeline } = get();
      const final = timeline[timeline.length - 1]!;
      if (final.outcome !== "running") {
        // Session ended — start a fresh run.
        get().restart();
        set({ running: true });
      } else {
        // Resume live (snap the view back to the live edge if it was scrubbed).
        set({ running: true, playhead: timeline.length - 1 });
      }
    },
    pause: () => set({ running: false }),
    togglePlay: () => (get().running ? get().pause() : get().play()),
    restart: () => {
      set({
        timeline: [initWorld(scenarioOf(get()))],
        playhead: 0,
        running: false,
        script: [],
        pendingInputs: [],
        composing: false,
        commandSeq: 1,
        selectedLogIndex: null,
      });
    },
    stepOne: () => get().advanceLive(1),
    setSpeed: (s) => set({ speed: s }),
    scrubTo: (tick) => {
      const { timeline } = get();
      const clamped = Math.max(0, Math.min(tick, timeline.length - 1));
      set({ playhead: clamped, running: false });
    },

    advanceLive: (nTicks) => {
      const state = get();
      if (state.composing) return;
      const frames = state.timeline;
      let w = frames[frames.length - 1]!;
      if (w.outcome !== "running") {
        if (state.running) set({ running: false });
        return;
      }
      const cap = maxStepsFor(state.level);
      let script = state.script;
      let pending = state.pendingInputs;
      let next = frames; // becomes a fresh array on first append
      const demo = state.demoScript;
      let stepped = 0;
      for (let k = 0; k < nTicks && w.outcome === "running" && w.tick < cap; k += 1) {
        if (pending.length > 0) {
          for (const m of pending) {
            script = script === state.script ? [...script] : script;
            script.push({ tick: w.tick, message: m });
            w = injectMA(w, m);
          }
          pending = [];
        }
        // Tutorial demo: inject the reference solution's inputs for this tick. Record
        // them in `script` too (like the player's own sends) so the after-action recap
        // reads the demo's exchange, and replaying the session reproduces the solve.
        for (const input of demo) {
          if (input.tick === w.tick) {
            script = script === state.script ? [...script] : script;
            script.push({ tick: w.tick, message: input.message });
            w = injectMA(w, input.message);
          }
        }
        w = step(w);
        next = next === frames ? [...frames] : next;
        next.push(w);
        stepped += 1;
      }
      if (stepped === 0) return;
      const terminal = w.outcome !== "running" || w.tick >= cap;
      set({
        timeline: next,
        script,
        pendingInputs: pending,
        playhead: next.length - 1,
        running: terminal ? false : state.running,
      });
      if (terminal) get().recordResult();
    },

    openComposer: () =>
      set((s) => ({ composing: true, running: false, playhead: s.timeline.length - 1 })),
    cancelComposer: () => set({ composing: false }),
    submitComposer: (message) =>
      set((s) => ({
        pendingInputs: [...s.pendingInputs, message],
        composing: false,
        running: true,
        // Any command carrying a CommandID (flight command, route activation command, …)
        // consumes one; bump the prefill counter so the next compose gets a fresh CMD-N.
        commandSeq:
          message.payload && "CommandID" in (message.payload as object)
            ? s.commandSeq + 1
            : s.commandSeq,
      })),

    selectLog: (i) => set({ selectedLogIndex: i }),
    toggleShowPeriodic: () => set((s) => ({ showPeriodic: !s.showPeriodic })),

    recordResult: () => {
      const w = finalFrame(get().timeline);
      const score = scoreWorld(w);
      const won = w.outcome === "won";
      const levelId = get().level.id;
      const prev = get().bestScores[levelId];
      // Keep the best winning run by ticks; otherwise record the attempt only if none exists.
      let next = prev;
      if (won && (!prev?.won || score.ticks < prev.score.ticks)) {
        next = { score, won: true };
      } else if (!prev) {
        next = { score, won };
      }
      if (next !== prev) {
        const bestScores = { ...get().bestScores, [levelId]: next! };
        set({ bestScores });
        try {
          localStorage.setItem(BEST_KEY, JSON.stringify(bestScores));
        } catch {
          /* ignore quota / private-mode */
        }
      }
    },
  };
});
