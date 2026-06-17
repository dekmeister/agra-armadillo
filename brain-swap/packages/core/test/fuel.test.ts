import {
  type BodyProfile,
  type FlightModel,
  initWorld,
  integrate,
  makeScenario,
  run,
  type VehicleState,
  validateFlightCommand,
} from "@brain-swap/core";
import { describe, expect, it } from "vitest";

// Fuel/endurance core (Phase 3): deterministic burn in integrate(), fuel-out → failed
// in the sim, and FA's endurance pre-check in the validator. The Bingo golden covers
// the VIOLATION_ENDURANCE reject path end-to-end; this pins the burn math + fuel-out.

const flight: FlightModel = { maxTurnRateDeg: 6, maxClimbRate: 50, maxAccel: 20 };

function fuelBody(over: Partial<BodyProfile["fuel"] & object> = {}): BodyProfile {
  return {
    id: "fb",
    name: "FuelBird",
    capabilities: [
      {
        id: "FB-1",
        type: "HSA_CSA",
        profile: { minAltitude: 0, maxAltitude: 9000, minAirspeed: 10, maxAirspeed: 100 },
      },
    ],
    flight,
    control: { approvalLatencyTicks: 0 },
    publish: { positionIntervalTicks: 0, activityIntervalTicks: 0, navigationIntervalTicks: 5 },
    fuel: { capacity: 100, minBurn: 3, bestSpeed: 30, burnQuad: 0.01, ...over },
    start: { x: 0, y: 0, altitude: 3000, heading: 270, speed: 20 },
  };
}

describe("fuel burn (integrate)", () => {
  it("burns the U-curve minBurn + burnQuad*(speed-bestSpeed)^2 per tick, floored at zero", () => {
    const v: VehicleState = {
      x: 0,
      y: 0,
      altitude: 3000,
      heading: 270,
      speed: 10,
      target: null,
      fuel: 100,
    };
    const after = integrate(v, flight, fuelBody().fuel);
    expect(after.fuel).toBe(100 - (3 + 0.01 * (10 - 30) ** 2)); // 100 - 7 = 93
    // The minimum is at bestSpeed, not at the slowest speed: speed 30 burns less than speed 10.
    const atBest: VehicleState = { ...v, speed: 30 };
    expect(integrate(atBest, flight, fuelBody().fuel).fuel).toBe(100 - 3);
    const low: VehicleState = { ...v, fuel: 3 };
    expect(integrate(low, flight, fuelBody().fuel).fuel).toBe(0); // 3 - 7 floored at 0
  });

  it("a body with no fuel model never burns (fuel stays undefined)", () => {
    const noFuel: BodyProfile = { ...fuelBody(), fuel: undefined };
    const v: VehicleState = { x: 0, y: 0, altitude: 3000, heading: 270, speed: 30, target: null };
    expect(integrate(v, flight).fuel).toBeUndefined();
    expect(integrate(v, flight, noFuel.fuel).fuel).toBeUndefined();
  });
});

describe("fuel-out fails the run", () => {
  it("running dry before the objective ends the run as failed (not the tick budget)", () => {
    // Coasts west at start speed 20: burn = 3 + 0.01*(20-30)^2 = 4/tick, capacity 100 → dry ~tick 25.
    const body = fuelBody({ capacity: 100 });
    const level = {
      id: "fuel-out",
      title: "Fuel Out",
      body: "fb",
      capabilityId: "FB-1",
      objective: {
        kind: "reach-hold" as const,
        zone: { x: -100000, y: 0, radius: 100 },
        altitude: 3000,
        altitudeTolerance: 50,
        holdTicks: 5,
      },
      maxTicks: 1000,
    };
    const w = run(initWorld(makeScenario(body, { brain: null, level })), 1000);
    expect(w.outcome).toBe("failed");
    expect(w.vehicle.fuel).toBe(0);
    expect(w.tick).toBeLessThan(level.maxTicks); // failed by fuel-out, not the budget
  });
});

describe("endurance pre-check (validateFlightCommand)", () => {
  const body = fuelBody({
    capacity: 540,
    minBurn: 4,
    bestSpeed: 32,
    burnQuad: 0.02,
    minEnduranceTicks: 60,
  });
  const veh = (fuel: number): VehicleState => ({
    x: 0,
    y: 0,
    altitude: 3000,
    heading: 270,
    speed: 0,
    target: null,
    fuel,
  });
  const cmd = (Speed: number) => ({
    CommandID: "C",
    CommandState: "NEW" as const,
    CapabilityID: "FB-1",
    Heading: 270,
    Altitude: 3000,
    Speed,
  });

  it("rejects a command whose speed leaves less than the endurance reserve", () => {
    // burn(90) = 4 + 0.02*(58)^2 ≈ 71.3 → 540/71.3 ≈ 7.6 ticks < 60 → reject.
    const out = validateFlightCommand(body, cmd(90), undefined, veh(540));
    expect(out.accepted).toBe(false);
    expect(out.result).toBe("VIOLATION_ENDURANCE");
  });

  it("accepts a sustainable speed near the fuel-flow minimum", () => {
    // burn(40) = 4 + 0.02*(8)^2 = 5.28 → 540/5.28 ≈ 102 ticks ≥ 60 → accept.
    expect(validateFlightCommand(body, cmd(40), undefined, veh(540)).accepted).toBe(true);
  });

  it("makes no endurance judgement without a vehicle or a reserve setting", () => {
    expect(validateFlightCommand(body, cmd(90)).accepted).toBe(true); // no vehicle fuel context
    const noReserve = fuelBody({ minEnduranceTicks: undefined });
    expect(validateFlightCommand(noReserve, cmd(90), undefined, veh(540)).accepted).toBe(true);
  });
});
