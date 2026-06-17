import {
  type BodyProfile,
  initWorld,
  injectMA,
  isSecondaryController,
  type LevelDef,
  type MessageLogEntry,
  makeScenario,
  msg,
  step,
  type World,
} from "@brain-swap/core";
import { describe, expect, it } from "vitest";

// AX-01-flavoured test body: instant approval, publication disabled so the golden
// handshake log is just the control-acquisition flow (VI §1.2.2.4 + §1.2.2.7).
const body: BodyProfile = {
  id: "test",
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

const acquire = msg("MA_ControlRequestMT", "MA", "FA", {
  RequestType: "ACQUIRE",
  CapabilityID: "MULE-01",
});

const project = (log: readonly MessageLogEntry[]): string[] =>
  log.map((e) => `t${e.tick} ${e.from}->${e.to} ${e.type} [${e.disposition.kind}]`);

function runHandshake(): World {
  let w = initWorld(makeScenario(body));
  w = step(w); // t1: FA boot advert + AVAILABLE delivered to MA
  w = injectMA(w, acquire); // MA requests control (enqueued t1, delivered t2)
  w = step(w); // t2: FA receives ACQUIRE, emits APPROVED + ControlStatus
  w = step(w); // t3: APPROVED + ControlStatus delivered to MA
  return w;
}

describe("control-acquisition handshake (golden log)", () => {
  it("reproduces Control Mode Authorization + Receive Control Request exactly", () => {
    const w = runHandshake();
    expect(project(w.log)).toEqual([
      "t1 FA->MA MA_FlightCapabilityMT [delivered]",
      "t1 FA->MA MA_FlightCapabilityStatusMT [delivered]",
      "t2 MA->FA MA_ControlRequestMT [delivered]",
      "t3 FA->MA MA_ControlRequestStatusMT [delivered]",
      "t3 FA->MA ControlStatusMT [delivered]",
    ]);
  });

  it("FA grants MA secondary control of the capability", () => {
    const w = runHandshake();
    expect(isSecondaryController(w.fa, "MULE-01")).toBe(true);

    const status = w.log.find((e) => e.type === "MA_ControlRequestStatusMT");
    expect(
      (status?.payload as { ApprovalRequestProcessingState: string })
        .ApprovalRequestProcessingState,
    ).toBe("APPROVED");
    const ctrl = w.log.find((e) => e.type === "ControlStatusMT");
    expect((ctrl?.payload as { SecondaryController?: string }).SecondaryController).toBe("MA");
  });

  it("a flight command sent before control is silently ignored (fidelity lie #8)", () => {
    let w = initWorld(makeScenario(body));
    w = step(w); // t1: boot delivered
    w = injectMA(
      w,
      msg("MA_FlightCommandMT", "MA", "FA", {
        CommandID: "CMD-1",
        CommandState: "NEW",
        CapabilityID: "MULE-01",
        Heading: 270,
        Altitude: 3000,
        Speed: 60,
      }),
    );
    w = step(w); // t2: FA receives the command while MA is not the controller
    w = step(w); // t3: confirm FA never answered

    const cmd = w.log.find((e) => e.type === "MA_FlightCommandMT");
    expect(cmd?.disposition.kind).toBe("ignored-not-controller");
    expect(w.log.some((e) => e.type === "MA_FlightCommandStatusMT")).toBe(false);
  });

  it("is deterministic: identical log across two independent runs", () => {
    expect(project(runHandshake().log)).toEqual(project(runHandshake().log));
  });
});

// Control Mode Authorization readiness (VI §1.2.2.4): a capability with a scheduled
// `capability-available` event boots TEMPORARILY_UNAVAILABLE and only goes AVAILABLE
// when the event fires; ACQUIRE before then is REJECTED (level 1.1 uses tick 12).
describe("delayed capability availability", () => {
  const delayedLevel: LevelDef = {
    id: "test-delay",
    title: "Delay",
    body: "test",
    capabilityId: "MULE-01",
    objective: { kind: "hold-control", holdTicks: 5 },
    events: [{ kind: "capability-available", tick: 3, capabilityId: "MULE-01" }],
    maxTicks: 50,
  };

  it("boots the capability TEMPORARILY_UNAVAILABLE until the event fires", () => {
    let w = initWorld(makeScenario(body, { level: delayedLevel }));
    w = step(w); // t1: boot status delivered
    const boot = w.log.find((e) => e.type === "MA_FlightCapabilityStatusMT");
    expect((boot?.payload as { Availability: string }).Availability).toBe(
      "TEMPORARILY_UNAVAILABLE",
    );

    w = step(w); // t2
    w = step(w); // t3: capability-available event fires (AVAILABLE enqueued, delivered t4)
    w = step(w); // t4: AVAILABLE delivered
    const avails = w.log.filter((e) => e.type === "MA_FlightCapabilityStatusMT");
    expect((avails.at(-1)?.payload as { Availability: string }).Availability).toBe("AVAILABLE");
  });

  it("REJECTS an ACQUIRE issued before the capability is AVAILABLE", () => {
    let w = initWorld(makeScenario(body, { level: delayedLevel }));
    w = step(w); // t1: boot delivered (still unavailable)
    w = injectMA(w, acquire); // enqueued t1, delivered t2 — before the t3 event
    w = step(w); // t2: FA receives ACQUIRE while unavailable
    w = step(w); // t3: REJECTED status delivered

    const status = w.log.find((e) => e.type === "MA_ControlRequestStatusMT");
    expect(
      (status?.payload as { ApprovalRequestProcessingState: string })
        .ApprovalRequestProcessingState,
    ).toBe("REJECTED");
    expect(isSecondaryController(w.fa, "MULE-01")).toBe(false);
  });

  it("APPROVES an ACQUIRE issued after the capability goes AVAILABLE", () => {
    let w = initWorld(makeScenario(body, { level: delayedLevel }));
    for (let i = 0; i < 4; i += 1) w = step(w); // through t4: AVAILABLE now delivered
    w = injectMA(w, acquire);
    w = step(w); // FA receives ACQUIRE (now available) → APPROVED
    w = step(w); // APPROVED delivered
    expect(isSecondaryController(w.fa, "MULE-01")).toBe(true);
    const status = w.log.find((e) => e.type === "MA_ControlRequestStatusMT");
    expect(
      (status?.payload as { ApprovalRequestProcessingState: string })
        .ApprovalRequestProcessingState,
    ).toBe("APPROVED");
  });
});
