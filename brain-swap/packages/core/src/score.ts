// The four Zachtronics metrics (docs/01): Ticks, Bus Traffic, Rejections, Brain Size.
// Computed from the message log + final world, deterministically.
import { brainSize as brainSizeOf } from "./brain/schema.ts";
import type { World } from "./world.ts";

export interface Score {
  /** Mission time. */
  readonly ticks: number;
  /** MA→FA messages sent (rewards partial updates / reuse). */
  readonly busTraffic: number;
  /** Rejected commands + sends ignored while not the controller (rewards reading the profile). */
  readonly rejections: number;
  /** States + transitions (elegance). */
  readonly brainSize: number;
}

export function scoreWorld(world: World): Score {
  let busTraffic = 0;
  let rejections = 0;
  for (const entry of world.log) {
    if (entry.from === "MA") busTraffic += 1;
    // Rejections (docs/01): commands ignored while not the controller, plus commands
    // FA rejected. Command rejections are carried in the status payload, not the
    // delivery disposition, so check both.
    if (entry.disposition.kind === "ignored-not-controller") {
      rejections += 1;
    } else if (
      entry.type === "MA_FlightCommandStatusMT" &&
      (entry.payload as { CommandProcessingState?: string }).CommandProcessingState === "REJECTED"
    ) {
      rejections += 1;
    }
  }
  return {
    ticks: world.tick,
    busTraffic,
    rejections,
    brainSize: world.scenario.brain ? brainSizeOf(world.scenario.brain) : 0,
  };
}

/**
 * Worst-case (per-metric maximum) across several runs of one brain. Used by the
 * 4.5 Type Certificate, where a single locked brain is graded by its weakest
 * showing across the airframe fleet. `brainSize` is identical across runs (same
 * brain) but max is harmless and keeps the reducer uniform.
 */
export function aggregateWorst(scores: readonly Score[]): Score {
  if (scores.length === 0) {
    return { ticks: 0, busTraffic: 0, rejections: 0, brainSize: 0 };
  }
  return scores.reduce((worst, s) => ({
    ticks: Math.max(worst.ticks, s.ticks),
    busTraffic: Math.max(worst.busTraffic, s.busTraffic),
    rejections: Math.max(worst.rejections, s.rejections),
    brainSize: Math.max(worst.brainSize, s.brainSize),
  }));
}
