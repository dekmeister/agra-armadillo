/**
 * Deterministic level replay — the shared harness the drift guards are built on.
 *
 * Several tests need the same thing: "play level N on its tutorial seed and tell me
 * what actually flew". WP3's codex guard grew that loop first; WP5's picker-honesty
 * guard needs it too, and a second copy would be a second thing to keep in step. So it
 * lives here, in the pure core, where both can import it.
 *
 * Mostly test/tooling infrastructure, living in the deterministic module because it is
 * nothing but `tick`. `TAUGHT_PATHS` is the exception since WP6.2: the debrief's per-level
 * counterfactual replays it at runtime, so an entry here is now player-visible.
 */
import { apply, createInitialState, tick } from "./engine.ts";
import type { Action, GameState, InterfaceClass, MessageType } from "./types.ts";

/**
 * The taught action for each level — the choice its Help text tells the player to make,
 * matching the winning paths locked in tutorial-seeds.test.ts. Needed because some
 * traffic only exists downstream of a decision: the election messages (L3, L7) are never
 * emitted under passive play, since passivity is precisely the losing "never elect"
 * branch. A guard built from passive play alone would wrongly conclude
 * MA_LeaderUpdateRequestMT is dead code.
 *
 * Each entry is a *factory* so every replay gets fresh closure state.
 */
export const TAUGHT_PATHS: Record<string, () => (s: GameState) => Action | null> = {
  /**
   * L2: re-attempt every report that lands in FAIL_MISSING_ACK. Added with WP6.2 so the
   * level can state a counterfactual on loss — and it closes a real hole in the drift
   * guards too, which until now only ever saw L2's passive traffic and never the reports
   * the retry path re-dispatches.
   */
  phase2: () => (s) =>
    s.pendingBeat?.id === "missing-ack-intro" ||
    Object.values(s.messages).some((m) => m.state === "FAIL_MISSING_ACK")
      ? { type: "retry" }
      : null,
  phase3: () => {
    let picked = false;
    return () => {
      if (picked) return null;
      picked = true;
      return { type: "pickElection", method: "static" };
    };
  },
  phase4: () => {
    let set = false;
    return () => {
      if (set) return null;
      set = true;
      return { type: "setPolicy", linkId: "form2", policy: "class" };
    };
  },
  phase5: () => {
    let shed = false;
    return (s) => {
      if (!shed && s.pendingBeat?.id === "cop-starvation") {
        shed = true;
        return { type: "shedTraffic" };
      }
      // Second half of L5's lesson: resume the bulk once the picture has recovered.
      if (shed && s.pendingBeat?.id === "bulk-resume") return { type: "resumeTraffic" };
      return null;
    };
  },
  phase6: () => {
    let rerouted = false;
    return (s) => {
      if (!rerouted && s.pendingBeat?.id === "missing-ack") {
        rerouted = true;
        return { type: "reroute" };
      }
      return null;
    };
  },
  phase7: () => {
    let merged = false;
    return (s) => {
      if (s.pendingBeat?.id === "authority-handback") return { type: "handBack" };
      if (s.pendingBeat?.id === "split-brain") return { type: "pickElection", method: "static" };
      if (!merged && s.election?.leader && s.partition) {
        merged = true;
        return { type: "mergeTeam" };
      }
      return null;
    };
  },
};

/**
 * Play a level on a seed under a per-tick action chooser, acknowledging beats so the
 * clock keeps moving, and return every message spawned along the way.
 */
export function messagesEmittedBy(
  scenarioId: string,
  seed: number,
  choose: (s: GameState) => Action | null,
  maxTicks = 60,
): { type: MessageType; cls: InterfaceClass }[] {
  let s: GameState = createInitialState(seed, { scenarioId });
  const seen: { type: MessageType; cls: InterfaceClass }[] = [];
  const collect = () => {
    for (const m of Object.values(s.messages)) seen.push({ type: m.type, cls: m.cls });
  };
  collect();
  for (let t = 1; t <= maxTicks && s.outcome === "pending"; t++) {
    s = tick(s);
    const a = choose(s);
    if (a) s = apply(s, a);
    if (s.pendingBeat) s = apply(s, { type: "acknowledgeBeat" });
    collect();
  }
  return seen;
}

/**
 * Everything a level can put on the wire: passive play unioned with the taught path.
 * Both matter — passive covers baseline/background traffic a quick winning run may skip,
 * the taught path covers decision-gated traffic.
 */
export function emissionsForLevel(
  scenarioId: string,
  seed: number,
): { type: MessageType; cls: InterfaceClass }[] {
  const all = messagesEmittedBy(scenarioId, seed, () => null);
  const taught = TAUGHT_PATHS[scenarioId];
  if (taught) all.push(...messagesEmittedBy(scenarioId, seed, taught()));
  return all;
}

/** The distinct message types a level emits (passive + taught). */
export function typesForLevel(scenarioId: string, seed: number): Set<MessageType> {
  return new Set(emissionsForLevel(scenarioId, seed).map((m) => m.type));
}

/**
 * The distinct interface classes a level actually puts on the wire — the machine-checkable
 * truth behind the Levels picker's `interfaces` claim (WP5.6).
 */
export function classesForLevel(scenarioId: string, seed: number): Set<InterfaceClass> {
  return new Set(emissionsForLevel(scenarioId, seed).map((m) => m.cls));
}
