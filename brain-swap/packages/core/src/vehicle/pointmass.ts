// Point-mass flight model (fidelity lie #6: 2D plane + altitude scalar). Integrates
// one tick in a single fixed step toward commanded targets, honoring the body's
// turn-rate / climb-rate / acceleration limits. Pure and deterministic — trig is
// fine; what's banned is RNG/wall-clock/DOM (see the core determinism test).
import { type FlightModel, type FuelModel, fuelBurnAt, type VehicleStart } from "../body.ts";

/** Commanded HSA targets (any subset). Undefined fields are "hold current". */
export interface FlightTarget {
  readonly heading?: number;
  readonly altitude?: number;
  readonly speed?: number;
}

export interface VehicleState {
  /** Plane coordinates (m). Reported as Longitude(x)/Latitude(y) — fidelity lie #6/#4. */
  readonly x: number;
  readonly y: number;
  readonly altitude: number; // m
  readonly heading: number; // deg, 0 = +y (north), 90 = +x (east)
  readonly speed: number; // m per tick
  readonly target: FlightTarget | null;
  /** Remaining fuel (kg); undefined on bodies without a fuel model. */
  readonly fuel?: number;
}

export function initVehicle(start: VehicleStart, fuelCapacity?: number): VehicleState {
  const fuel = start.fuel ?? fuelCapacity;
  return {
    x: start.x,
    y: start.y,
    altitude: start.altitude,
    heading: normalizeDeg(start.heading),
    speed: start.speed,
    target: null,
    ...(fuel !== undefined ? { fuel } : {}),
  };
}

export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/** Move `current` toward `goal` by at most `maxStep` (linear, clamped). */
export function approach(current: number, goal: number, maxStep: number): number {
  const delta = goal - current;
  if (Math.abs(delta) <= maxStep) return goal;
  return current + Math.sign(delta) * maxStep;
}

/** Turn from `current` heading toward `goal`, shortest direction, clamped to `maxStep` deg. */
export function turnToward(current: number, goal: number, maxStep: number): number {
  const c = normalizeDeg(current);
  const g = normalizeDeg(goal);
  const diff = ((g - c + 540) % 360) - 180; // signed shortest delta in (-180, 180]
  if (Math.abs(diff) <= maxStep) return g;
  return normalizeDeg(c + Math.sign(diff) * maxStep);
}

/** Advance the vehicle one tick toward its target within the body's limits. Burns
 *  fuel when the body has a fuel model (the U-shaped `fuelBurnAt` curve), floored at
 *  0. Bodies without a fuel model (vehicle.fuel undefined) never burn. */
export function integrate(v: VehicleState, flight: FlightModel, fuel?: FuelModel): VehicleState {
  let { heading, speed, altitude } = v;
  const t = v.target;
  if (t) {
    if (t.heading !== undefined) heading = turnToward(heading, t.heading, flight.maxTurnRateDeg);
    if (t.speed !== undefined) speed = approach(speed, t.speed, flight.maxAccel);
    if (t.altitude !== undefined) altitude = approach(altitude, t.altitude, flight.maxClimbRate);
  }
  const rad = (heading * Math.PI) / 180;
  const next: VehicleState = {
    x: v.x + speed * Math.sin(rad),
    y: v.y + speed * Math.cos(rad),
    altitude,
    heading,
    speed,
    target: v.target,
  };
  if (fuel !== undefined && v.fuel !== undefined) {
    return { ...next, fuel: Math.max(0, v.fuel - fuelBurnAt(fuel, speed)) };
  }
  return v.fuel !== undefined ? { ...next, fuel: v.fuel } : next;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** True if a point advancing from (x,y) along `heading` at `speed` is in, or enters
 *  within `ticks`, the circle `zone`. Straight-line projection (deterministic). */
export function pathEntersZone(
  x: number,
  y: number,
  heading: number,
  speed: number,
  zone: { x: number; y: number; radius: number },
  ticks: number,
): boolean {
  const rad = (heading * Math.PI) / 180;
  const dx = Math.sin(rad) * speed;
  const dy = Math.cos(rad) * speed;
  for (let k = 0; k <= ticks; k += 1) {
    if (distance(x + dx * k, y + dy * k, zone.x, zone.y) <= zone.radius) return true;
  }
  return false;
}

/** Heading (deg) pointing from a zone center straight out to (x,y) — i.e. directly
 *  away from the zone (FA's collision-avoidance escape vector). */
export function headingAwayFrom(x: number, y: number, zone: { x: number; y: number }): number {
  return normalizeDeg((Math.atan2(x - zone.x, y - zone.y) * 180) / Math.PI);
}

/** Heading (deg) pointing from (fromX,fromY) toward (toX,toY) — 0 = +y (north),
 *  90 = +x (east). Used by FA route/curve steering to fly to a point. */
export function bearingTo(fromX: number, fromY: number, toX: number, toY: number): number {
  return normalizeDeg((Math.atan2(toX - fromX, toY - fromY) * 180) / Math.PI);
}
