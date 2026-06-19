// Mission Systems (MS) engine — data-driven from an MsBodyDef, never scripted per
// level (the MS analogue of fa/engine.ts). Implements the Tier-2 Status Service:
//   • Capability Heartbeat (MS Vol §1.2.9.1/§1.2.9.4): MS publishes each subsystem's
//     SubsystemStatusMT and each service's ServiceStatusMT, at boot and periodically.
//   • On-Demand Subsystem Status (MS Vol §1.2.9.5): MA sends SubsystemStatusDataRequestMT;
//     MS replies with a fresh SubsystemStatusMT reflecting the subsystem's current state.
//
// Unlike FA, MS is not safety-critical: it does NOT validate/REJECT well-formed commands
// (fidelity: the MS interface has no Airworthiness Boundary). An early request simply
// reflects the current (non-OPERATE) state — the feedback loop is status, not a gate.
//
// Pure functions over an immutable MsState record (no class, no RNG, no wall-clock) —
// same scenario ⇒ identical message log every run (CLAUDE.md rule #3).
import { type MsBodyDef, subsystemStateAt } from "../body.ts";
import { DELIVERED, type Disposition, type Message, msg } from "../types.ts";

export interface MsState {
  readonly booted: boolean;
  /** SubsystemID -> current state (driven by the body's deterministic timeline). */
  readonly subsystemState: Readonly<Record<string, string>>;
  /** Ticks since the last heartbeat publication (toward publish.statusIntervalTicks). */
  readonly statusTicker: number;
  /** SubsystemID -> the state captured by the most recent on-demand status reply.
   *  The MS analogue of FA's secondaryControllers latch — read by ms-status objectives. */
  readonly onDemandConfirmed: Readonly<Record<string, string>>;
}

export function initMsState(msBody: MsBodyDef): MsState {
  const subsystemState: Record<string, string> = {};
  for (const sub of msBody.subsystems) {
    subsystemState[sub.id] = subsystemStateAt(sub, 0);
  }
  return { booted: true, subsystemState, statusTicker: 0, onDemandConfirmed: {} };
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

/** Messages MS publishes at boot (enqueued tick 0, delivered tick 1): one
 *  SubsystemStatusMT per subsystem + one ServiceStatusMT per service. */
export function msBootMessages(msBody: MsBodyDef): Message[] {
  const out: Message[] = [];
  for (const sub of msBody.subsystems) {
    out.push(subsystemStatus(sub.id, subsystemStateAt(sub, 0)));
  }
  for (const svc of msBody.services) {
    out.push(serviceStatus(svc.id, svc.state));
  }
  return out;
}

// --- per-tick phases --------------------------------------------------------

/** Phase A (before inbound): apply each subsystem's deterministic state timeline for
 *  this tick (the OPERATE warm-up; the MS analogue of FA's capability-available). */
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

/** Phase B: MS processes one inbound message from MA. The on-demand status request
 *  latches the subsystem's current state and replies with a fresh SubsystemStatusMT.
 *  No validate/REJECT path — an unknown SubsystemID just yields no reply (DELIVERED). */
export function msHandleInbound(_msBody: MsBodyDef, ms: MsState, message: Message): MsInboundResult {
  if (message.type === "SubsystemStatusDataRequestMT") {
    const req = message.payload as { SubsystemID: string };
    const state = ms.subsystemState[req.SubsystemID];
    if (state === undefined) {
      return { ms, outbound: [], disposition: DELIVERED };
    }
    return {
      ms: { ...ms, onDemandConfirmed: { ...ms.onDemandConfirmed, [req.SubsystemID]: state } },
      outbound: [subsystemStatus(req.SubsystemID, state)],
      disposition: DELIVERED,
    };
  }
  return { ms, outbound: [], disposition: DELIVERED };
}

/** Phase C (after inbound): the MS heartbeat. Every `publish.statusIntervalTicks`,
 *  re-emit every subsystem's SubsystemStatusMT and every service's ServiceStatusMT. */
export function msPublish(msBody: MsBodyDef, ms: MsState): { ms: MsState; outbound: Message[] } {
  const interval = msBody.publish.statusIntervalTicks;
  const statusTicker = ms.statusTicker + 1;
  if (interval <= 0 || statusTicker < interval) {
    return { ms: { ...ms, statusTicker }, outbound: [] };
  }
  const outbound: Message[] = [];
  for (const sub of msBody.subsystems) {
    outbound.push(subsystemStatus(sub.id, ms.subsystemState[sub.id] ?? "INITIALIZATION"));
  }
  for (const svc of msBody.services) {
    outbound.push(serviceStatus(svc.id, svc.state));
  }
  return { ms: { ...ms, statusTicker: 0 }, outbound };
}
