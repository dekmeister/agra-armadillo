// The app store (Zustand) — the one bridge between the deterministic core and React.
// It owns: the editable brain (core data) + UI-only node layout, the materialized
// timeline (World[]), the playhead/transport, selections, and persisted best scores.
// Every brain mutation rebuilds the timeline (docs/04: re-simulate 0→N, cheap here).
import { create } from "zustand";
import {
  type Brain,
  type BodyProfile,
  type LevelDef,
  makeScenario,
  type MessageTypeName,
  type Score,
  scoreWorld,
  type Transition,
  type World,
} from "@brain-swap/core";
import { ax01, level12, level12ReferenceBrain } from "@brain-swap/levels";
import { buildTimeline, finalFrame } from "./sim/timeline.ts";

export type View = "console" | "report" | "select" | "help" | "codex";
export type Mode = "EDIT" | "RUN";
export type Speed = 1 | 2 | 8;

const SAVE_KEY = (levelId: string) => `brain-swap:save:${levelId}`;
const BEST_KEY = "brain-swap:best";

/** A fresh, blank brain — one initial state, no transitions. The player builds up from here. */
export function starterBrain(): Brain {
  return { id: "player-brain", initial: "start", states: ["start"], transitions: [] };
}

export interface Layout {
  [stateId: string]: { x: number; y: number };
}

interface SavedSlot {
  brain: Brain;
  layout: Layout;
}

function loadSlot(levelId: string): SavedSlot | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY(levelId));
    if (!raw) return null;
    return JSON.parse(raw) as SavedSlot;
  } catch {
    return null;
  }
}

function loadBest(): Record<string, { score: Score; won: boolean }> {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw ? (JSON.parse(raw) as Record<string, { score: Score; won: boolean }>) : {};
  } catch {
    return {};
  }
}

/** Auto-layout for states without a saved position: a simple vertical-ish stagger. */
function autoLayout(states: readonly string[], existing: Layout): Layout {
  const out: Layout = { ...existing };
  let i = 0;
  for (const s of states) {
    if (!out[s]) {
      out[s] = { x: 40 + (i % 2) * 200, y: 30 + i * 110 };
    }
    i += 1;
  }
  return out;
}

interface StoreState {
  view: View;
  level: LevelDef;
  body: BodyProfile;
  brain: Brain;
  layout: Layout;

  timeline: World[];
  playhead: number;
  running: boolean;
  speed: Speed;
  mode: Mode;

  selectedLogIndex: number | null;
  selectedStateId: string | null;
  selectedTransitionIndex: number | null;
  showPeriodic: boolean;
  toggleShowPeriodic: () => void;

  bestScores: Record<string, { score: Score; won: boolean }>;

  // derived — returns the stable timeline[playhead] snapshot (safe in a selector).
  // Derive scores from this in render (scoreWorld), never inside a selector.
  world: () => World;

  // navigation
  setView: (v: View) => void;
  setMode: (m: Mode) => void;

  // transport
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stepOne: () => void;
  setSpeed: (s: Speed) => void;
  scrubTo: (tick: number) => void;

  // selection
  selectLog: (i: number | null) => void;
  selectState: (id: string | null) => void;
  selectTransition: (i: number | null) => void;

  // brain editing
  addState: (name: string) => void;
  renameState: (oldId: string, newId: string) => void;
  deleteState: (id: string) => void;
  setInitial: (id: string) => void;
  setNodePosition: (id: string, x: number, y: number) => void;
  addTransition: (from: string) => void;
  updateTransition: (index: number, patch: Partial<Transition>) => void;
  deleteTransition: (index: number) => void;

  // persistence / io
  loadReference: () => void;
  resetBrain: () => void;
  exportBrain: () => string;
  importBrain: (json: string) => boolean;
  recordResult: () => void;
}

function scenarioOf(s: Pick<StoreState, "body" | "brain" | "level">) {
  return makeScenario(s.body, { brain: s.brain, level: s.level });
}

export const useStore = create<StoreState>((set, get) => {
  const saved = loadSlot(level12.id);
  const initialBrain = saved?.brain ?? starterBrain();
  const initialLayout = autoLayout(initialBrain.states, saved?.layout ?? {});
  const initialTimeline = buildTimeline(makeScenario(ax01, { brain: initialBrain, level: level12 }));

  /** Recompute timeline from the current brain, reset playhead, persist the slot. */
  function rebuild(brain: Brain, layout: Layout) {
    const timeline = buildTimeline(makeScenario(get().body, { brain, level: get().level }));
    const nextLayout = autoLayout(brain.states, layout);
    try {
      localStorage.setItem(SAVE_KEY(get().level.id), JSON.stringify({ brain, layout: nextLayout }));
    } catch {
      /* ignore quota / private-mode */
    }
    set({ brain, layout: nextLayout, timeline, playhead: 0, running: false });
  }

  return {
    view: "console",
    level: level12,
    body: ax01,
    brain: initialBrain,
    layout: initialLayout,
    timeline: initialTimeline,
    playhead: 0,
    running: false,
    speed: 1,
    mode: "EDIT",
    selectedLogIndex: null,
    selectedStateId: null,
    selectedTransitionIndex: null,
    showPeriodic: true,
    bestScores: loadBest(),

    world: () => {
      const { timeline, playhead } = get();
      return timeline[Math.min(playhead, timeline.length - 1)]!;
    },

    setView: (v) => set({ view: v }),
    setMode: (m) => {
      if (m === "RUN") {
        // Re-materialize from the current brain and start playing from tick 0.
        const timeline = buildTimeline(scenarioOf(get()));
        set({ mode: "RUN", timeline, playhead: 0, running: true, selectedLogIndex: null });
      } else {
        set({ mode: "EDIT", running: false, playhead: 0 });
      }
    },

    play: () => {
      const { playhead, timeline } = get();
      if (playhead >= timeline.length - 1) set({ playhead: 0, running: true });
      else set({ running: true });
    },
    pause: () => set({ running: false }),
    togglePlay: () => (get().running ? get().pause() : get().play()),
    stepOne: () => {
      const { playhead, timeline } = get();
      set({ playhead: Math.min(playhead + 1, timeline.length - 1), running: false });
    },
    setSpeed: (s) => set({ speed: s }),
    scrubTo: (tick) => {
      const { timeline } = get();
      const clamped = Math.max(0, Math.min(tick, timeline.length - 1));
      const atEnd = clamped >= timeline.length - 1;
      set({ playhead: clamped, running: atEnd ? false : get().running });
    },

    selectLog: (i) => set({ selectedLogIndex: i }),
    toggleShowPeriodic: () => set((s) => ({ showPeriodic: !s.showPeriodic })),
    selectState: (id) =>
      set({ selectedStateId: id, selectedTransitionIndex: null }),
    selectTransition: (i) =>
      set({ selectedTransitionIndex: i, selectedStateId: null }),

    addState: (name) => {
      const id = name.trim();
      const { brain, layout } = get();
      if (!id || brain.states.includes(id)) return;
      rebuild({ ...brain, states: [...brain.states, id] }, layout);
      set({ selectedStateId: id });
    },
    renameState: (oldId, newIdRaw) => {
      const newId = newIdRaw.trim();
      const { brain, layout } = get();
      if (!newId || oldId === newId || brain.states.includes(newId) || !brain.states.includes(oldId))
        return;
      const states = brain.states.map((s) => (s === oldId ? newId : s));
      const transitions = brain.transitions.map((t) => ({
        ...t,
        from: t.from === oldId ? newId : t.from,
        ...(t.target === oldId ? { target: newId } : {}),
      }));
      const nextLayout: Layout = { ...layout };
      if (nextLayout[oldId]) {
        nextLayout[newId] = nextLayout[oldId]!;
        delete nextLayout[oldId];
      }
      rebuild(
        { ...brain, states, transitions, initial: brain.initial === oldId ? newId : brain.initial },
        nextLayout,
      );
      set({ selectedStateId: newId });
    },
    deleteState: (id) => {
      const { brain, layout } = get();
      if (brain.states.length <= 1) return;
      const states = brain.states.filter((s) => s !== id);
      const transitions = brain.transitions.filter((t) => t.from !== id && t.target !== id);
      const nextLayout: Layout = { ...layout };
      delete nextLayout[id];
      const initial = brain.initial === id ? states[0]! : brain.initial;
      rebuild({ ...brain, states, transitions, initial }, nextLayout);
      set({ selectedStateId: null });
    },
    setInitial: (id) => {
      const { brain, layout } = get();
      if (!brain.states.includes(id)) return;
      rebuild({ ...brain, initial: id }, layout);
    },
    setNodePosition: (id, x, y) => {
      const layout = { ...get().layout, [id]: { x, y } };
      set({ layout });
      try {
        localStorage.setItem(
          SAVE_KEY(get().level.id),
          JSON.stringify({ brain: get().brain, layout }),
        );
      } catch {
        /* ignore */
      }
    },
    addTransition: (from) => {
      const { brain, layout } = get();
      const firstType = (get().level.availableMessages?.[0] ?? "MA_FlightCapabilityStatusMT") as MessageTypeName;
      const t: Transition = { from, trigger: { messageType: firstType } };
      const transitions = [...brain.transitions, t];
      rebuild({ ...brain, transitions }, layout);
      set({ selectedTransitionIndex: transitions.length - 1, selectedStateId: null });
    },
    updateTransition: (index, patch) => {
      const { brain, layout } = get();
      const transitions = brain.transitions.map((t, i) => (i === index ? { ...t, ...patch } : t));
      rebuild({ ...brain, transitions }, layout);
      set({ selectedTransitionIndex: index });
    },
    deleteTransition: (index) => {
      const { brain, layout } = get();
      const transitions = brain.transitions.filter((_, i) => i !== index);
      rebuild({ ...brain, transitions }, layout);
      set({ selectedTransitionIndex: null });
    },

    loadReference: () => {
      rebuild(level12ReferenceBrain, {});
    },
    resetBrain: () => {
      rebuild(starterBrain(), {});
    },
    exportBrain: () => JSON.stringify(get().brain, null, 2),
    importBrain: (json) => {
      try {
        const parsed = JSON.parse(json) as Brain;
        if (!parsed || !Array.isArray(parsed.states) || !parsed.initial) return false;
        rebuild(parsed, {});
        return true;
      } catch {
        return false;
      }
    },
    recordResult: () => {
      const w = finalFrame(get().timeline);
      const score = scoreWorld(w);
      const won = w.outcome === "won";
      const levelId = get().level.id;
      const prev = get().bestScores[levelId];
      // Keep the best winning run by ticks; otherwise record the attempt only if none exists.
      let next = prev;
      if (won && (!prev || !prev.won || score.ticks < prev.score.ticks)) {
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
          /* ignore */
        }
      }
    },
  };
});
