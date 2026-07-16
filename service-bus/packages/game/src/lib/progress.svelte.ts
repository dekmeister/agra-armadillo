/**
 * Per-level campaign progress, persisted in localStorage. A reactive singleton (mirrors
 * the `game` store pattern) so the picker map/chips and level card update the instant a
 * level is completed. Deliberately minimal: done/not-done only — no scores, medals, or
 * par times (an explicit owner decision, see PLAN_REVIEW "out of scope").
 *
 * View-layer only: the sim core stays pure and never touches storage. `App` records a win
 * by watching `game.gs.outcome`; nothing here runs during the tick loop.
 */

const KEY = "servicebus.progress";

/** The only completion state we track. Room to grow (e.g. per-variant) without a migration. */
export type LevelStatus = "won";
export type ProgressMap = Record<string, LevelStatus>;

/** Read the saved map, tolerating absent/corrupt storage (private-mode, cleared, hand-edited). */
function read(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: ProgressMap = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === "won") out[id] = "won";
    }
    return out;
  } catch {
    return {};
  }
}

class Progress {
  /** scenarioId -> status. Reassigned (not mutated) on write so `$state` reactivity fires. */
  map = $state<ProgressMap>(read());

  isWon(scenarioId: string): boolean {
    return this.map[scenarioId] === "won";
  }

  /** Mark a level completed and persist. Idempotent — safe to call every winning tick. */
  markWon(scenarioId: string): void {
    if (this.map[scenarioId] === "won") return;
    this.map = { ...this.map, [scenarioId]: "won" };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.map));
    } catch {
      // Storage unavailable (private mode / quota) — completion still reflects in-session.
    }
  }
}

export const progress = new Progress();
