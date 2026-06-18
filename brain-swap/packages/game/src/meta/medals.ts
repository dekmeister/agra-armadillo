// Medal thresholds vs par, shared by Level Select and the After-Action Debrief.
// gold ≤ par, silver ≤ 1.5×par (or par+1), else unearned. Presentation helper —
// scoring (scoreWorld / LevelPars) stays in @brain-swap/core.
import type { LevelPars, Score } from "@brain-swap/core";

export type Medal = "gold" | "silver" | "none";

function medal(value: number, par: number): Medal {
  if (value <= par) return "gold";
  if (value <= Math.max(par * 1.5, par + 1)) return "silver";
  return "none";
}

/** Per-metric medals for the three scored metrics (Ticks / Bus / Rejections). */
export function medals(
  score: Score | undefined,
  pars: LevelPars | undefined,
): { t: Medal; b: Medal; r: Medal } {
  if (!score || !pars) return { t: "none", b: "none", r: "none" };
  return {
    t: medal(score.ticks, pars.ticks),
    b: medal(score.busTraffic, pars.busTraffic),
    r: medal(score.rejections, pars.rejections),
  };
}
