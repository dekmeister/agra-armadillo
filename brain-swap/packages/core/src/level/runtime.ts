// Level runtime: the world-state win predicate (docs/01 — never "message sent").
// Dispatches on the objective kind:
//   • reach-hold        — be in the zone & altitude band for holdTicks ticks (1.2/1.3/4.5).
//   • hold-control      — be the secondary controller of the capability for holdTicks ticks (1.1).
//   • waypoint-sequence — pass each waypoint in order; hold the final one (1.4).
// Orthogonal to the objective: entering any `level.avoid` circle or event-spawned
// `World.threats` zone fails the run (breach-check below the kind switch).

import { type FaState, isSecondaryController } from "../fa/engine.ts";
import type { MsState } from "../ms/engine.ts";
import { distance, type VehicleState } from "../vehicle/pointmass.ts";
import type { ActiveThreat } from "./events.ts";
import type { LevelDef, Waypoint, Zone } from "./types.ts";

export interface WinEvaluation {
  /** Whether the terminal win predicate holds this tick. */
  readonly satisfied: boolean;
  /** Updated consecutive-hold counter (toward objective.holdTicks). */
  readonly holdTicks: number;
  /** Updated next-waypoint index (waypoint-sequence only; carried unchanged otherwise). */
  readonly waypointIndex: number;
  /** Whether the objective is now met. */
  readonly won: boolean;
  /** Whether the vehicle has breached a no-fly / threat zone this tick (run fails). */
  readonly failed: boolean;
}

/** Objective-progress carried in the World between ticks. */
export interface Progress {
  readonly holdTicks: number;
  readonly waypointIndex: number;
}

/** In a zone (and, if the waypoint/objective specifies one, within the altitude band). */
function inZoneAtAltitude(
  vehicle: VehicleState,
  zone: { x: number; y: number; radius: number },
  altitude?: number,
  altitudeTolerance?: number,
): boolean {
  const inZone = distance(vehicle.x, vehicle.y, zone.x, zone.y) <= zone.radius;
  if (!inZone) return false;
  if (altitude === undefined) return true;
  return Math.abs(vehicle.altitude - altitude) <= (altitudeTolerance ?? 0);
}

function inWaypoint(vehicle: VehicleState, wp: Waypoint): boolean {
  return inZoneAtAltitude(vehicle, wp.zone, wp.altitude, wp.altitudeTolerance);
}

/** Reach-hold terminal predicate (kept exported for tooling / the reach-hold path). */
export function predicateHolds(level: LevelDef, vehicle: VehicleState): boolean {
  const o = level.objective;
  if (o.kind !== "reach-hold") return false;
  return inZoneAtAltitude(vehicle, o.zone, o.altitude, o.altitudeTolerance);
}

/** True if the vehicle is inside any no-fly / threat circle (breach = run fails). */
function breached(
  vehicle: VehicleState,
  level: LevelDef,
  threats: readonly ActiveThreat[],
): boolean {
  const zones: Zone[] = [...(level.avoid ?? []), ...threats.map((t) => t.zone)];
  return zones.some((z) => distance(vehicle.x, vehicle.y, z.x, z.y) <= z.radius);
}

export function evaluateWin(
  level: LevelDef,
  vehicle: VehicleState,
  fa: FaState,
  ms: MsState | null,
  progress: Progress,
  threats: readonly ActiveThreat[] = [],
): WinEvaluation {
  const failed = breached(vehicle, level, threats);
  const o = level.objective;
  switch (o.kind) {
    case "reach-hold": {
      const satisfied = inZoneAtAltitude(vehicle, o.zone, o.altitude, o.altitudeTolerance);
      const holdTicks = satisfied ? progress.holdTicks + 1 : 0;
      return {
        satisfied,
        holdTicks,
        waypointIndex: progress.waypointIndex,
        won: holdTicks >= o.holdTicks,
        failed,
      };
    }
    case "hold-control": {
      const satisfied = isSecondaryController(fa, level.capabilityId);
      const holdTicks = satisfied ? progress.holdTicks + 1 : 0;
      return {
        satisfied,
        holdTicks,
        waypointIndex: progress.waypointIndex,
        won: holdTicks >= o.holdTicks,
        failed,
      };
    }
    case "waypoint-sequence": {
      let waypointIndex = progress.waypointIndex;
      const last = o.waypoints.length - 1;
      // Advance through any non-final waypoints the vehicle currently satisfies.
      while (waypointIndex < last && inWaypoint(vehicle, o.waypoints[waypointIndex]!)) {
        waypointIndex += 1;
      }
      const onFinal = waypointIndex === last;
      const satisfied = onFinal && inWaypoint(vehicle, o.waypoints[last]!);
      const holdTicks = satisfied ? progress.holdTicks + 1 : 0;
      return { satisfied, holdTicks, waypointIndex, won: holdTicks >= o.holdTicks, failed };
    }
    case "ms-status": {
      // MS analogue of hold-control: the on-demand status reply must have latched the
      // subsystem at the required state (e.g. OPERATE). MS isn't safety-critical, so an
      // early request latches a non-OPERATE state and never satisfies (the 3.1 lesson).
      const satisfied = ms?.onDemandConfirmed[o.subsystemId] === o.requiredState;
      const holdTicks = satisfied ? progress.holdTicks + 1 : 0;
      return {
        satisfied,
        holdTicks,
        waypointIndex: progress.waypointIndex,
        won: holdTicks >= o.holdTicks,
        failed,
      };
    }
  }
}
