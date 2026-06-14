// Level runtime: the world-state win predicate (docs/01 — never "message sent").
// For 1.2: be inside the objective zone AND within the altitude band for
// `objective.holdTicks` consecutive ticks.
import { distance, type VehicleState } from "../vehicle/pointmass.ts";
import type { LevelDef } from "./types.ts";

export interface WinEvaluation {
  /** Whether the win predicate holds this tick (in-zone & at-altitude). */
  readonly satisfied: boolean;
  /** Updated consecutive-hold counter. */
  readonly holdTicks: number;
  /** Whether the objective is now met (held long enough). */
  readonly won: boolean;
}

export function predicateHolds(level: LevelDef, vehicle: VehicleState): boolean {
  const { zone, altitude, altitudeTolerance } = level.objective;
  const inZone = distance(vehicle.x, vehicle.y, zone.x, zone.y) <= zone.radius;
  const atAltitude = Math.abs(vehicle.altitude - altitude) <= altitudeTolerance;
  return inZone && atAltitude;
}

export function evaluateWin(
  level: LevelDef,
  vehicle: VehicleState,
  priorHoldTicks: number,
): WinEvaluation {
  const satisfied = predicateHolds(level, vehicle);
  const holdTicks = satisfied ? priorHoldTicks + 1 : 0;
  return { satisfied, holdTicks, won: holdTicks >= level.objective.holdTicks };
}
