import type { BodyProfile } from "@brain-swap/core";

/** AX-01-flavoured trainer body used across core tests: instant approval, wide envelope. */
export const testBody: BodyProfile = {
  id: "test-mule",
  name: "Test Mule",
  capabilities: [
    {
      id: "MULE-01",
      type: "HSA_CSA",
      profile: { minAltitude: 0, maxAltitude: 12000, minAirspeed: 20, maxAirspeed: 140 },
    },
  ],
  flight: { maxTurnRateDeg: 5, maxClimbRate: 50, maxAccel: 20 },
  control: { approvalLatencyTicks: 0 },
  publish: { positionIntervalTicks: 0, activityIntervalTicks: 0 },
  start: { x: 0, y: 0, altitude: 3000, heading: 270, speed: 0 },
};
