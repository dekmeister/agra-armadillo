import { describe, expect, it } from "vitest";
import {
  type MA_FlightCommandMT,
  injectMA,
  initWorld,
  makeScenario,
  msg,
  step,
  validateFlightCommand,
  type World,
} from "@brain-swap/core";
import { testBody } from "./fixtures.ts";

const command = (over: Partial<MA_FlightCommandMT>): MA_FlightCommandMT => ({
  CommandID: "CMD-1",
  CommandState: "NEW",
  CapabilityID: "MULE-01",
  Heading: 270,
  Altitude: 3000,
  Speed: 60,
  ...over,
});

describe("FA command validator", () => {
  it("accepts an in-envelope HSA command and yields a vehicle target", () => {
    const out = validateFlightCommand(testBody, command({}));
    expect(out.accepted).toBe(true);
    expect(out.result).toBe("FLIGHT_COMMAND_VALID");
    expect(out.target).toEqual({ heading: 270, altitude: 3000, speed: 60 });
  });

  it("rejects an over-ceiling altitude with PERFORMANCE_LIMIT_EXCEEDED", () => {
    const out = validateFlightCommand(testBody, command({ Altitude: 20000 }));
    expect(out).toEqual({ accepted: false, result: "PERFORMANCE_LIMIT_EXCEEDED" });
  });

  it("rejects an over-speed command with PERFORMANCE_LIMIT_EXCEEDED", () => {
    const out = validateFlightCommand(testBody, command({ Speed: 500 }));
    expect(out.accepted).toBe(false);
    expect(out.result).toBe("PERFORMANCE_LIMIT_EXCEEDED");
  });

  it("rejects an unknown capability with CAPABILITY_NOT_SUPPORTED", () => {
    const out = validateFlightCommand(testBody, command({ CapabilityID: "BAD-CAP" }));
    expect(out).toEqual({ accepted: false, result: "CAPABILITY_NOT_SUPPORTED" });
  });
});

// Drive a world through the handshake, then send one command; return the world after
// FA has answered it.
function acquireThenCommand(cmd: MA_FlightCommandMT): World {
  let w = initWorld(makeScenario(testBody));
  w = step(w); // t1: boot delivered
  w = injectMA(w, msg("MA_ControlRequestMT", "MA", "FA", { RequestType: "ACQUIRE", CapabilityID: "MULE-01" }));
  w = step(w); // t2: ACQUIRE processed, APPROVED + ControlStatus emitted
  w = step(w); // t3: control granted on MA side
  w = injectMA(w, msg("MA_FlightCommandMT", "MA", "FA", cmd));
  w = step(w); // t4: FA receives + validates the command, emits status
  w = step(w); // t5: command status delivered to MA (logged on delivery)
  return w;
}

describe("FA validation through the sim", () => {
  it("an ACCEPTED command sets the vehicle target and moves it toward the target", () => {
    let w = acquireThenCommand(command({}));
    const status = w.log.find((e) => e.type === "MA_FlightCommandStatusMT");
    expect((status?.payload as { CommandProcessingState: string }).CommandProcessingState).toBe("ACCEPTED");
    expect(w.vehicle.target).toEqual({ heading: 270, altitude: 3000, speed: 60 });

    const before = w.vehicle.x;
    w = step(w);
    expect(w.vehicle.x).toBeLessThan(before); // flying west
  });

  it("an over-ceiling command is REJECTED with the right enum and leaves the vehicle uncommanded", () => {
    const w = acquireThenCommand(command({ Altitude: 20000 }));
    const status = w.log.find((e) => e.type === "MA_FlightCommandStatusMT");
    expect((status?.payload as { CommandProcessingState: string }).CommandProcessingState).toBe("REJECTED");
    expect((status?.payload as { ValidationResult: string }).ValidationResult).toBe("PERFORMANCE_LIMIT_EXCEEDED");
    expect(w.vehicle.target).toBeNull();
  });
});
