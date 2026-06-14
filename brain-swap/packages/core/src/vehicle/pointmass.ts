// Point-mass flight model (fidelity lie #6: 2D plane + altitude scalar). Integrates
// one tick in a single fixed step toward commanded targets, honoring the body's
// turn-rate / climb-rate / acceleration limits. Pure and deterministic — trig is
// fine; what's banned is RNG/wall-clock/DOM (see the core determinism test).
import type { FlightModel } from "../body.ts";

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
}

export function initVehicle(start: {
  x: number;
  y: number;
  altitude: number;
  heading: number;
  speed: number;
}): VehicleState {
  return { ...start, heading: normalizeDeg(start.heading), target: null };
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
  let diff = ((g - c + 540) % 360) - 180; // signed shortest delta in (-180, 180]
  if (Math.abs(diff) <= maxStep) return g;
  return normalizeDeg(c + Math.sign(diff) * maxStep);
}

/** Advance the vehicle one tick toward its target within the body's limits. */
export function integrate(v: VehicleState, flight: FlightModel): VehicleState {
  let { heading, speed, altitude } = v;
  const t = v.target;
  if (t) {
    if (t.heading !== undefined) heading = turnToward(heading, t.heading, flight.maxTurnRateDeg);
    if (t.speed !== undefined) speed = approach(speed, t.speed, flight.maxAccel);
    if (t.altitude !== undefined) altitude = approach(altitude, t.altitude, flight.maxClimbRate);
  }
  const rad = (heading * Math.PI) / 180;
  return {
    x: v.x + speed * Math.sin(rad),
    y: v.y + speed * Math.cos(rad),
    altitude,
    heading,
    speed,
    target: v.target,
  };
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}
