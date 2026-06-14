import { describe, expect, it } from "vitest";
import { approach, initVehicle, integrate, normalizeDeg, turnToward } from "@brain-swap/core";
import { testBody } from "./fixtures.ts";

describe("point-mass kinematics", () => {
  it("approach clamps to the max step and snaps on arrival", () => {
    expect(approach(0, 100, 20)).toBe(20);
    expect(approach(90, 100, 20)).toBe(100);
    expect(approach(100, 0, 20)).toBe(80);
  });

  it("turnToward takes the shortest direction and clamps to the turn rate", () => {
    expect(turnToward(0, 90, 5)).toBe(5); // turning right
    expect(turnToward(0, 270, 5)).toBe(355); // shorter to turn left through 360
    expect(turnToward(10, 12, 5)).toBe(12); // snap when within rate
    expect(normalizeDeg(-90)).toBe(270);
  });

  it("flies west on heading 270 (x decreases, y holds)", () => {
    let v = initVehicle({ x: 0, y: 0, altitude: 3000, heading: 270, speed: 0 });
    v = { ...v, target: { heading: 270, altitude: 3000, speed: 60 } };
    v = integrate(v, testBody.flight); // speed 0 -> 20 (accel limit)
    expect(v.speed).toBe(20);
    expect(v.x).toBeLessThan(0);
    expect(Math.abs(v.y)).toBeLessThan(1e-9);
  });

  it("honors the climb-rate limit toward a higher target", () => {
    let v = initVehicle({ x: 0, y: 0, altitude: 3000, heading: 0, speed: 0 });
    v = { ...v, target: { altitude: 3200 } };
    v = integrate(v, testBody.flight); // climb capped at 50/tick
    expect(v.altitude).toBe(3050);
  });
});
