// Mission Systems (MS) engine — data-driven from an MsBodyDef, never scripted per
// level (the MS analogue of fa/engine.ts). Implements:
//   • Status Service (MS Vol §1.2.9): SubsystemStatusMT / ServiceStatusMT heartbeat +
//     on-demand SubsystemStatusDataRequestMT (the 3.1 foundation).
//   • Sensor Tasking (MS Vol §1.2.8): MA_AMTI_CapabilityMT advert → AMTI_CommandMT →
//     AMTI_CommandStatusMT → AMTI_ActivityMT → EntityMT tracks (3.2 / 3.5).
//   • Weapon Employment (MS Vol §1.2.10): StrikeCapabilityMT advert → MA_TaskMT →
//     MA_TaskStatusMT → MA_TaskCommandMT → StrikeConsentRequestMT → consent reply →
//     MA_StrikeActivityMT (3.3 / 3.4).
//   • Dynamic Launch Zone (MS Vol §1.2.10.3): DLZ_RequestMT → DLZ_RequestStatusMT →
//     DLZ_MT (3.4); the strike completes only when the FA vehicle is inside the zone.
//
// Unlike FA, MS is not safety-critical: it does NOT validate/REJECT well-formed commands
// (the MS interface has no Airworthiness Boundary). An invalid command is a no-op or a
// CANCELED status — the feedback loop is task status, not a validator gate (lie #20).
//
// Pure functions over an immutable MsState record (no class, no RNG, no wall-clock) —
// same scenario ⇒ identical message log every run (CLAUDE.md rule #3). Time-driven
// emissions (activity transitions, tracks, consent requests, faults) are scheduled on
// absolute ticks and produced in msPublish; inbound MA→MS messages are handled in
// msHandleInbound.
import { findSensor, type MsBodyDef, subsystemStateAt } from "../body.ts";
import { DELIVERED, type Disposition, type Message, msg } from "../types.ts";
import type { VehicleState } from "../vehicle/pointmass.ts";

/** A sensor task latched by a valid AMTI_CommandMT (keyed by CapabilityID). */
export interface MsSensorTaskState {
  readonly state: "RECEIVED" | "ACCEPTED" | "ACTIVE" | "COMPLETED" | "CANCELED";
  /** Absolute tick the activity reaches ACTIVE (accept tick + activeDelayTicks). */
  readonly activeAtTick: number;
  /** Index into the sensor's tracks[] of the next EntityMT to report. */
  readonly nextTrackIdx: number;
}

/** A strike task latched by MA_TaskMT (keyed by TaskID). */
export interface MsStrikeTaskState {
  readonly capabilityId: string;
  readonly phase: "tasked" | "commanded" | "consent-requested" | "approved" | "completed";
  /** ActivityStateEnum literal of the strike activity (DISABLED until ENABLED). */
  readonly activityState: string;
  /** Absolute tick to emit StrikeConsentRequestMT (>=0 once EXECUTE accepted, else -1). */
  readonly consentAtTick: number;
  /** Absolute tick to reach COMPLETED (>=0 once consent approved, else -1). */
  readonly completeAtTick: number;
}

export interface MsState {
  readonly booted: boolean;
  /** SubsystemID -> current state (driven by the body's deterministic timeline). */
  readonly subsystemState: Readonly<Record<string, string>>;
  /** Ticks since the last heartbeat publication (toward publish.statusIntervalTicks). */
  readonly statusTicker: number;
  /** SubsystemID -> the state captured by the most recent on-demand status reply. */
  readonly onDemandConfirmed: Readonly<Record<string, string>>;
  /** CapabilityID -> sensor task state (3.2 / 3.5). */
  readonly sensorTasks: Readonly<Record<string, MsSensorTaskState>>;
  /** Total EntityMT tracks reported so far — the ms-track win counter. */
  readonly entitiesReported: number;
  /** EntityID -> reported position, for the tactical-map overlay (3.2). */
  readonly tracks: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
  /** TaskID -> strike task state (3.3 / 3.4). */
  readonly strikeTasks: Readonly<Record<string, MsStrikeTaskState>>;
  /** DLZ_RequestID -> computed zone (ranges + target centre, for the map overlay) (3.4). */
  readonly dlz: Readonly<
    Record<
      string,
      {
        readonly min: number;
        readonly optimal: number;
        readonly max: number;
        readonly target: { readonly x: number; readonly y: number };
      }
    >
  >;
}

export function initMsState(msBody: MsBodyDef): MsState {
  const subsystemState: Record<string, string> = {};
  for (const sub of msBody.subsystems) {
    subsystemState[sub.id] = subsystemStateAt(sub, 0);
  }
  return {
    booted: true,
    subsystemState,
    statusTicker: 0,
    onDemandConfirmed: {},
    sensorTasks: {},
    entitiesReported: 0,
    tracks: {},
    strikeTasks: {},
    dlz: {},
  };
}

// --- message builders -------------------------------------------------------

function subsystemStatus(subsystemId: string, state: string): Message {
  return msg("SubsystemStatusMT", "MS", "MA", {
    SubsystemID: subsystemId,
    SubsystemState: state as "INITIALIZATION" | "STANDBY" | "OPERATE" | "DEGRADED",
  });
}

function serviceStatus(serviceId: string, state: string): Message {
  return msg("ServiceStatusMT", "MS", "MA", {
    ServiceID: serviceId,
    ServiceState: state as "NORMAL" | "DEGRADED" | "INITIALIZING" | "INOPERABLE",
  });
}

/** Messages MS publishes at boot (enqueued tick 0, delivered tick 1): the heartbeat plus
 *  any sensor capability advertisements and weapon-store inventory. */
export function msBootMessages(msBody: MsBodyDef): Message[] {
  const out: Message[] = [];
  for (const sub of msBody.subsystems) {
    out.push(subsystemStatus(sub.id, subsystemStateAt(sub, 0)));
  }
  for (const svc of msBody.services) {
    out.push(serviceStatus(svc.id, svc.state));
  }
  for (const sensor of msBody.sensors ?? []) {
    out.push(
      msg("MA_AMTI_CapabilityMT", "MS", "MA", {
        CapabilityID: sensor.capabilityId,
        CapabilityType: sensor.capabilityType as "VOLUME" | "TRACK",
      }),
    );
  }
  for (const store of msBody.stores ?? []) {
    out.push(
      msg("StrikeCapabilityMT", "MS", "MA", {
        CapabilityID: store.capabilityId,
        StoreType: store.storeType,
        StoreQuantity: store.storeQuantity,
      }),
    );
    out.push(
      msg("StrikeCapabilityStatusMT", "MS", "MA", {
        CapabilityID: store.capabilityId,
        StoreState: "READY" as "READY" | "ARMED" | "AWAY",
      }),
    );
  }
  return out;
}

// --- per-tick phases --------------------------------------------------------

/** Phase A (before inbound): apply each subsystem's deterministic state timeline for
 *  this tick (the OPERATE warm-up + any scheduled DEGRADED fault — the 3.5 model). */
export function msAdvanceState(msBody: MsBodyDef, ms: MsState, tick: number): MsState {
  const subsystemState: Record<string, string> = {};
  let changed = false;
  for (const sub of msBody.subsystems) {
    const next = subsystemStateAt(sub, tick);
    subsystemState[sub.id] = next;
    if (ms.subsystemState[sub.id] !== next) changed = true;
  }
  if (!changed) return ms;
  return { ...ms, subsystemState };
}

export interface MsInboundResult {
  readonly ms: MsState;
  readonly outbound: Message[];
  readonly disposition: Disposition;
}

/** Phase B: MS processes one inbound message from MA. No validate/REJECT path — an
 *  invalid command is a no-op or a CANCELED status, never a REJECTED gate (lie #20). */
export function msHandleInbound(
  msBody: MsBodyDef,
  ms: MsState,
  message: Message,
  tick: number,
): MsInboundResult {
  switch (message.type) {
    case "SubsystemStatusDataRequestMT":
      return handleStatusRequest(ms, message);
    case "AMTI_CommandMT":
      return handleAmtiCommand(msBody, ms, message, tick);
    case "MA_TaskMT":
      return handleTask(msBody, ms, message);
    case "MA_TaskCommandMT":
      return handleTaskCommand(msBody, ms, message, tick);
    case "StrikeConsentRequestStatusMT":
      return handleConsentReply(msBody, ms, message, tick);
    case "DLZ_RequestMT":
      return handleDlzRequest(msBody, ms, message);
    default:
      return { ms, outbound: [], disposition: DELIVERED };
  }
}

/** On-demand status: latch the subsystem's current state and reply with a fresh
 *  SubsystemStatusMT. Unknown SubsystemID just yields no reply (DELIVERED). */
function handleStatusRequest(ms: MsState, message: Message): MsInboundResult {
  const req = message.payload as { SubsystemID: string };
  const state = ms.subsystemState[req.SubsystemID];
  if (state === undefined) return { ms, outbound: [], disposition: DELIVERED };
  return {
    ms: { ...ms, onDemandConfirmed: { ...ms.onDemandConfirmed, [req.SubsystemID]: state } },
    outbound: [subsystemStatus(req.SubsystemID, state)],
    disposition: DELIVERED,
  };
}

/** Sensor tasking. A NEW command referencing an advertised CapabilityID whose interval
 *  has not yet passed (EndTimeWindow > tick) is RECEIVED and scheduled. An invalid one
 *  (unknown capability, or an interval already passed) is CANCELED — MS just doesn't do
 *  it (lie #20). CANCEL stops an active task. */
function handleAmtiCommand(
  msBody: MsBodyDef,
  ms: MsState,
  message: Message,
  tick: number,
): MsInboundResult {
  const p = message.payload as {
    CommandID: string;
    CapabilityID: string;
    CommandState: string;
    EndTimeWindow?: number;
  };
  const sensor = findSensor(msBody, p.CapabilityID);

  if (p.CommandState === "CANCEL") {
    const existing = ms.sensorTasks[p.CapabilityID];
    const next: MsSensorTaskState | undefined = existing
      ? { ...existing, state: "CANCELED" }
      : undefined;
    const sensorTasks = next ? { ...ms.sensorTasks, [p.CapabilityID]: next } : ms.sensorTasks;
    return {
      ms: { ...ms, sensorTasks },
      outbound: [commandStatus(p.CommandID, "CANCELED")],
      disposition: DELIVERED,
    };
  }

  const windowPassed = p.EndTimeWindow !== undefined && p.EndTimeWindow <= tick;
  if (!sensor || windowPassed) {
    // Not safety-critical: reflect a CANCELED status, schedule nothing.
    return { ms, outbound: [commandStatus(p.CommandID, "CANCELED")], disposition: DELIVERED };
  }
  const task: MsSensorTaskState = {
    state: "RECEIVED",
    activeAtTick: tick + sensor.activeDelayTicks,
    nextTrackIdx: 0,
  };
  return {
    ms: { ...ms, sensorTasks: { ...ms.sensorTasks, [p.CapabilityID]: task } },
    outbound: [commandStatus(p.CommandID, "RECEIVED")],
    disposition: DELIVERED,
  };
}

function commandStatus(commandId: string, state: string): Message {
  return msg("AMTI_CommandStatusMT", "MS", "MA", {
    CommandID: commandId,
    CommandProcessingState: state as "RECEIVED" | "ACCEPTED" | "REJECTED" | "CANCELED",
  });
}

/** Strike task description: assign the matching store's CapabilityID and reply
 *  MA_TaskStatusMT. A STRIKE task with no advertised store is a no-op. */
function handleTask(msBody: MsBodyDef, ms: MsState, message: Message): MsInboundResult {
  const p = message.payload as { TaskID: string; TaskType: string };
  const store = msBody.stores?.[0];
  if (!store) return { ms, outbound: [], disposition: DELIVERED };
  const task: MsStrikeTaskState = {
    capabilityId: store.capabilityId,
    phase: "tasked",
    activityState: "DISABLED",
    consentAtTick: -1,
    completeAtTick: -1,
  };
  return {
    ms: { ...ms, strikeTasks: { ...ms.strikeTasks, [p.TaskID]: task } },
    outbound: [
      msg("MA_TaskStatusMT", "MS", "MA", { TaskID: p.TaskID, CapabilityID: store.capabilityId }),
    ],
    disposition: DELIVERED,
  };
}

/** Strike execution order: a NEW MA_TaskCommandMT on a tasked strike is ACCEPTED and
 *  schedules the consent request. A command on no/unknown task is a no-op. */
function handleTaskCommand(
  msBody: MsBodyDef,
  ms: MsState,
  message: Message,
  tick: number,
): MsInboundResult {
  const p = message.payload as { TaskID: string; CommandState: string };
  const task = ms.strikeTasks[p.TaskID];
  if (!task || task.phase !== "tasked" || p.CommandState !== "NEW") {
    return { ms, outbound: [], disposition: DELIVERED };
  }
  const store = msBody.stores?.find((s) => s.capabilityId === task.capabilityId);
  const consentAtTick = tick + (store?.consentAfterTicks ?? 1);
  const next: MsStrikeTaskState = { ...task, phase: "commanded", consentAtTick };
  return {
    ms: { ...ms, strikeTasks: { ...ms.strikeTasks, [p.TaskID]: next } },
    outbound: [
      msg("MA_TaskCommandStatusMT", "MS", "MA", {
        TaskID: p.TaskID,
        CommandProcessingState: "ACCEPTED" as "RECEIVED" | "ACCEPTED" | "REJECTED",
      }),
    ],
    disposition: DELIVERED,
  };
}

/** Release consent: an APPROVED reply on a consent-requested strike arms it and schedules
 *  completion; a REJECTED reply (or consent on no pending task) leaves it withheld. */
function handleConsentReply(
  msBody: MsBodyDef,
  ms: MsState,
  message: Message,
  tick: number,
): MsInboundResult {
  const p = message.payload as { TaskID: string; ConsentState: string };
  const task = ms.strikeTasks[p.TaskID];
  if (!task || task.phase !== "consent-requested" || p.ConsentState !== "APPROVED") {
    return { ms, outbound: [], disposition: DELIVERED };
  }
  const store = msBody.stores?.find((s) => s.capabilityId === task.capabilityId);
  const completeAtTick = tick + (store?.strikeTicks ?? 1);
  // Arm the strike; the activity (ENABLED → COMPLETED) is driven by advanceStrikes.
  const next: MsStrikeTaskState = { ...task, phase: "approved", completeAtTick };
  return {
    ms: { ...ms, strikeTasks: { ...ms.strikeTasks, [p.TaskID]: next } },
    outbound: [],
    disposition: DELIVERED,
  };
}

function strikeActivity(taskId: string, state: string): Message {
  return msg("MA_StrikeActivityMT", "MS", "MA", {
    SubsystemID: "MS-WEAPON",
    TaskID: taskId,
    ActivityState: state as "ENABLED" | "ACTIVE_FULLY_CONSTRAINED" | "COMPLETED",
  });
}

/** DLZ request: return the deterministic zone from the body's DLZ model. */
function handleDlzRequest(msBody: MsBodyDef, ms: MsState, message: Message): MsInboundResult {
  const p = message.payload as { DLZ_RequestID: string };
  const z = msBody.dlz;
  if (!z) return { ms, outbound: [], disposition: DELIVERED };
  return {
    ms: {
      ...ms,
      dlz: {
        ...ms.dlz,
        [p.DLZ_RequestID]: { min: z.min, optimal: z.optimal, max: z.max, target: z.target },
      },
    },
    outbound: [
      msg("DLZ_RequestStatusMT", "MS", "MA", {
        DLZ_RequestID: p.DLZ_RequestID,
        CommandProcessingState: "ACCEPTED" as "RECEIVED" | "ACCEPTED",
      }),
      msg("DLZ_MT", "MS", "MA", {
        DLZ_RequestID: p.DLZ_RequestID,
        DLZ_ID: `DLZ-${p.DLZ_RequestID}`,
        RangeMinimum: z.min,
        RangeOptimal: z.optimal,
        RangeMaxAero: z.max,
      }),
    ],
    disposition: DELIVERED,
  };
}

/** Phase C (after inbound): heartbeat + all time-driven emissions. `tick`/`vehicle` drive
 *  the sensor activity/track schedule, the strike consent/activity timers, and the DEGRADED
 *  fault. */
export function msPublish(
  msBody: MsBodyDef,
  ms: MsState,
  tick: number,
  vehicle: VehicleState,
): { ms: MsState; outbound: Message[] } {
  const outbound: Message[] = [];
  let next = ms;

  next = advanceFaults(msBody, next, tick, outbound);
  next = advanceSensors(msBody, next, tick, outbound);
  next = advanceStrikes(msBody, next, tick, vehicle, outbound);
  next = advanceHeartbeat(msBody, next, outbound);

  return { ms: next, outbound };
}

/** Emit MA_FaultMT for any subsystem that transitions to DEGRADED this tick (3.5 — the
 *  same fault message type as FA, reused on the MS bus, lie #19). */
function advanceFaults(msBody: MsBodyDef, ms: MsState, tick: number, out: Message[]): MsState {
  for (const sub of msBody.subsystems) {
    const now = subsystemStateAt(sub, tick);
    const prev = subsystemStateAt(sub, tick - 1);
    if (now === "DEGRADED" && prev !== "DEGRADED") {
      out.push(
        msg("MA_FaultMT", "MS", "MA", {
          FaultID: `MS-FAULT-${sub.id}`,
          Severity: "CAUTION" as "NOMINAL" | "ADVISORY" | "CAUTION" | "WARNING" | "FAILED",
          FaultDescription: `${sub.id} degraded — sensor collection halted`,
          CapabilityID: msBody.sensors?.find((s) => s.subsystemId === sub.id)?.capabilityId,
        }),
      );
    }
  }
  return ms;
}

/** Drive each sensor task through RECEIVED → ACCEPTED (+ENABLED) → ACTIVE → tracks →
 *  COMPLETED. EntityMT only flows while the driving subsystem is OPERATE (the fault gate).
 *  The map-overlay `tracks` are latched here at emission; the ms-track win counter
 *  (`entitiesReported`) advances on *delivery* to MA (step.ts), so "received" is literal. */
function advanceSensors(msBody: MsBodyDef, ms: MsState, tick: number, out: Message[]): MsState {
  let sensorTasks = ms.sensorTasks;
  let tracks = ms.tracks;

  for (const sensor of msBody.sensors ?? []) {
    const task = sensorTasks[sensor.capabilityId];
    if (!task || task.state === "COMPLETED" || task.state === "CANCELED") continue;

    if (task.state === "RECEIVED") {
      out.push(commandStatus(`CMD-${sensor.capabilityId}`, "ACCEPTED"));
      out.push(amtiActivity(sensor.capabilityId, "ENABLED"));
      sensorTasks = { ...sensorTasks, [sensor.capabilityId]: { ...task, state: "ACCEPTED" } };
      continue;
    }

    if (task.state === "ACCEPTED" && tick >= task.activeAtTick) {
      out.push(amtiActivity(sensor.capabilityId, "ACTIVE_UNCONSTRAINED"));
      sensorTasks = { ...sensorTasks, [sensor.capabilityId]: { ...task, state: "ACTIVE" } };
    }

    const active = sensorTasks[sensor.capabilityId]!;
    if (active.state !== "ACTIVE") continue;

    // Collection halts while the driving subsystem is not OPERATE (the 3.5 fault).
    if (ms.subsystemState[sensor.subsystemId] !== "OPERATE") continue;

    let idx = active.nextTrackIdx;
    const emitAt = (i: number) => active.activeAtTick + (sensor.entityOffsets[i] ?? 0);
    while (idx < sensor.tracks.length && emitAt(idx) <= tick) {
      const trk = sensor.tracks[idx]!;
      out.push(
        msg("EntityMT", "MS", "MA", { EntityID: trk.entityId, Longitude: trk.x, Latitude: trk.y }),
      );
      tracks = { ...tracks, [trk.entityId]: { x: trk.x, y: trk.y } };
      idx += 1;
    }
    const completed = idx >= sensor.tracks.length;
    if (completed) out.push(amtiActivity(sensor.capabilityId, "COMPLETED"));
    sensorTasks = {
      ...sensorTasks,
      [sensor.capabilityId]: {
        ...active,
        nextTrackIdx: idx,
        state: completed ? "COMPLETED" : "ACTIVE",
      },
    };
  }

  if (sensorTasks === ms.sensorTasks) return ms;
  return { ...ms, sensorTasks, tracks };
}

/** Count an EntityMT delivered to MA toward the ms-track objective. Called from step()
 *  when an MS→MA track reaches MA, so the win reflects tracks *received*, not merely
 *  emitted (which would end the run a tick before the track appears in the log). */
export function msCountDeliveredEntity(ms: MsState): MsState {
  return { ...ms, entitiesReported: ms.entitiesReported + 1 };
}

function amtiActivity(capabilityId: string, state: string): Message {
  return msg("AMTI_ActivityMT", "MS", "MA", {
    CapabilityID: capabilityId,
    ActivityState: state as "ENABLED" | "ACTIVE_UNCONSTRAINED" | "COMPLETED",
  });
}

/** Drive each strike: at consentAtTick emit StrikeConsentRequestMT; once approved emit
 *  ENABLED then, at completeAtTick AND with the vehicle inside the DLZ, COMPLETED. */
function advanceStrikes(
  msBody: MsBodyDef,
  ms: MsState,
  tick: number,
  vehicle: VehicleState,
  out: Message[],
): MsState {
  let strikeTasks = ms.strikeTasks;
  for (const taskId of Object.keys(strikeTasks)) {
    const task = strikeTasks[taskId]!;

    if (task.phase === "commanded" && task.consentAtTick >= 0 && tick >= task.consentAtTick) {
      out.push(
        msg("StrikeConsentRequestMT", "MS", "MA", {
          SubsystemID: "MS-WEAPON",
          TaskID: taskId,
          ConsentState: "REQUESTED" as "REQUESTED" | "APPROVED" | "REJECTED",
        }),
      );
      strikeTasks = { ...strikeTasks, [taskId]: { ...task, phase: "consent-requested" } };
      continue;
    }

    if (task.phase === "approved" && task.activityState === "DISABLED") {
      // First publish after arming: announce ENABLED before completion.
      out.push(strikeActivity(taskId, "ENABLED"));
      strikeTasks = { ...strikeTasks, [taskId]: { ...task, activityState: "ENABLED" } };
      continue;
    }

    if (
      task.phase === "approved" &&
      task.activityState === "ENABLED" &&
      task.completeAtTick >= 0 &&
      tick >= task.completeAtTick
    ) {
      // The geometry gate: if the body has a DLZ, the vehicle must be within max range of
      // the target for the strike to complete (3.4). No DLZ ⇒ no gate (3.3).
      if (!withinDlz(msBody, vehicle)) continue;
      out.push(strikeActivity(taskId, "COMPLETED"));
      strikeTasks = {
        ...strikeTasks,
        [taskId]: { ...task, phase: "completed", activityState: "COMPLETED" },
      };
    }
  }
  if (strikeTasks === ms.strikeTasks) return ms;
  return { ...ms, strikeTasks };
}

/** True if the body has no DLZ gate, or the vehicle is within the DLZ max range of the
 *  target (the 3.4 pre-fire geometry check). */
function withinDlz(msBody: MsBodyDef, vehicle: VehicleState): boolean {
  const z = msBody.dlz;
  if (!z) return true;
  const dx = vehicle.x - z.target.x;
  const dy = vehicle.y - z.target.y;
  return Math.hypot(dx, dy) <= z.max;
}

/** The MS heartbeat: every `publish.statusIntervalTicks`, re-emit every subsystem and
 *  service status. */
function advanceHeartbeat(msBody: MsBodyDef, ms: MsState, out: Message[]): MsState {
  const interval = msBody.publish.statusIntervalTicks;
  const statusTicker = ms.statusTicker + 1;
  if (interval <= 0 || statusTicker < interval) return { ...ms, statusTicker };
  for (const sub of msBody.subsystems) {
    out.push(subsystemStatus(sub.id, ms.subsystemState[sub.id] ?? "INITIALIZATION"));
  }
  for (const svc of msBody.services) {
    out.push(serviceStatus(svc.id, svc.state));
  }
  return { ...ms, statusTicker: 0 };
}
