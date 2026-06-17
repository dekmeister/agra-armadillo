// Deterministic mission events: scheduled, data-driven mid-mission changes to the
// world (CLAUDE.md rule #3 — no RNG, no Date, no wall-clock). An event is keyed on
// an integer `tick`; it fires in the step that advances the world to that tick, in
// Phase A′ (between approval advance and inbound delivery in sim.ts) so the inbound
// commands delivered *this* tick are already validated against the new envelope.
//
// Events emit only existing catalog messages — re-advertising the (possibly tighter)
// envelope with `MA_FlightCapabilityMT` and signalling availability changes with
// `MA_FlightCapabilityStatusMT`. No new message types (no catalog/fidelity work).
//
// The threat fields are foundation for later phases (spatial avoidance / moving
// pop-ups); in this phase a spawned threat is recorded in `World.threats` only.
import { type BodyProfile, type CapabilityProfile, findCapability } from "../body.ts";
import type { FaState } from "../fa/engine.ts";
import { type Message, msg } from "../types.ts";
import type { Zone } from "./types.ts";

/** A threat zone present in the world (rendered + breach-checked in later phases). */
export interface ActiveThreat {
  readonly id: string;
  readonly zone: Zone;
  /** Optional per-tick drift (m/tick); advanced by the integrator in a later phase. */
  readonly velocity?: { readonly vx: number; readonly vy: number };
}

/** Tighten (or otherwise change) a capability's advertised envelope mid-mission. */
export interface DegradeEnvelopeEvent {
  readonly kind: "degrade-envelope";
  readonly tick: number;
  readonly capabilityId: string;
  readonly minAltitude?: number;
  readonly maxAltitude?: number;
  readonly minAirspeed?: number;
  readonly maxAirspeed?: number;
}

/** Mark a capability unavailable; FA stops accepting commands on it until re-acquired. */
export interface CapabilityUnavailableEvent {
  readonly kind: "capability-unavailable";
  readonly tick: number;
  readonly capabilityId: string;
  readonly reason: "TEMPORARILY_UNAVAILABLE" | "UNAVAILABLE";
}

/** Make a capability available: FA advertises AVAILABLE and starts honouring ACQUIRE.
 *  A capability that has one of these scheduled boots TEMPORARILY_UNAVAILABLE (see
 *  `initWorld`) — modelling Control Mode Authorization readiness (VI §1.2.2.4): FA
 *  signals ready only when it is, and ACQUIRE before then is REJECTED. */
export interface CapabilityAvailableEvent {
  readonly kind: "capability-available";
  readonly tick: number;
  readonly capabilityId: string;
}

/** Introduce a threat zone (optionally moving) into the world. */
export interface SpawnThreatEvent {
  readonly kind: "spawn-threat";
  readonly tick: number;
  readonly threatId: string;
  readonly zone: Zone;
  readonly velocity?: { readonly vx: number; readonly vy: number };
}

/** Remove a previously spawned threat. */
export interface DespawnThreatEvent {
  readonly kind: "despawn-threat";
  readonly tick: number;
  readonly threatId: string;
}

export type MissionEvent =
  | DegradeEnvelopeEvent
  | CapabilityUnavailableEvent
  | CapabilityAvailableEvent
  | SpawnThreatEvent
  | DespawnThreatEvent;

/** The mutable mission-overlay carried in the World alongside FA/vehicle state. */
export interface EventOverlay {
  /** capabilityId -> current effective profile (absent = body's static profile). */
  readonly dynamicEnvelope: Readonly<Record<string, CapabilityProfile>>;
  readonly threats: readonly ActiveThreat[];
}

/** Advance moving threats one tick by their velocity (immutable copy). Threats with
 *  no velocity are left as-is; an all-static list is returned unchanged. */
export function advanceThreats(threats: readonly ActiveThreat[]): readonly ActiveThreat[] {
  if (!threats.some((t) => t.velocity)) return threats;
  return threats.map((t) =>
    t.velocity ? { ...t, zone: { ...t.zone, x: t.zone.x + t.velocity.vx, y: t.zone.y + t.velocity.vy } } : t,
  );
}

/** Stable per-event id for deterministic ordering of events that share a tick. */
function eventId(e: MissionEvent): string {
  switch (e.kind) {
    case "degrade-envelope":
    case "capability-unavailable":
    case "capability-available":
      return e.capabilityId;
    case "spawn-threat":
    case "despawn-threat":
      return e.threatId;
  }
}

const KIND_ORDER: Record<MissionEvent["kind"], number> = {
  "degrade-envelope": 0,
  "capability-unavailable": 1,
  "capability-available": 2,
  "spawn-threat": 3,
  "despawn-threat": 4,
};

/** Drop undefined fields so the stored profile / payload stays a clean object. */
function pruneProfile(p: CapabilityProfile): CapabilityProfile {
  return {
    ...(p.minAltitude !== undefined ? { minAltitude: p.minAltitude } : {}),
    ...(p.maxAltitude !== undefined ? { maxAltitude: p.maxAltitude } : {}),
    ...(p.minAirspeed !== undefined ? { minAirspeed: p.minAirspeed } : {}),
    ...(p.maxAirspeed !== undefined ? { maxAirspeed: p.maxAirspeed } : {}),
  };
}

function advertFor(capId: string, type: string, p: CapabilityProfile): Message {
  return msg("MA_FlightCapabilityMT", "FA", "MA", {
    CapabilityID: capId,
    CapabilityType: type as "HSA_CSA",
    ...(p.minAltitude !== undefined ? { MinAltitude: p.minAltitude } : {}),
    ...(p.maxAltitude !== undefined ? { MaxAltitude: p.maxAltitude } : {}),
    ...(p.minAirspeed !== undefined ? { MinAirspeed: p.minAirspeed } : {}),
    ...(p.maxAirspeed !== undefined ? { MaxAirspeed: p.maxAirspeed } : {}),
  });
}

/**
 * Apply every mission event scheduled for `tick`, in deterministic order. Pure:
 * returns the updated FA state (availability), the updated overlay (envelope +
 * threats), and the messages FA publishes as a result (enqueued by the caller like
 * any Phase A/C outbound). No-op (and returns the inputs unchanged) when nothing is
 * scheduled, so the common eventless level pays nothing.
 */
export function applyEvents(
  events: readonly MissionEvent[] | undefined,
  tick: number,
  ctx: { body: BodyProfile; fa: FaState; overlay: EventOverlay },
): { fa: FaState; overlay: EventOverlay; outbound: Message[] } {
  const { body, fa, overlay } = ctx;
  if (!events || events.length === 0) return { fa, overlay, outbound: [] };

  const due = events
    .filter((e) => e.tick === tick)
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || eventId(a).localeCompare(eventId(b)));
  if (due.length === 0) return { fa, overlay, outbound: [] };

  let dynamicEnvelope = overlay.dynamicEnvelope;
  let threats = overlay.threats;
  let unavailableCaps = fa.unavailableCaps;
  let secondaryControllers = fa.secondaryControllers;
  const outbound: Message[] = [];

  for (const e of due) {
    switch (e.kind) {
      case "degrade-envelope": {
        const cap = findCapability(body, e.capabilityId);
        if (!cap) break; // defensive: unknown capability — nothing to re-advertise
        const base = dynamicEnvelope[e.capabilityId] ?? cap.profile;
        const merged = pruneProfile({
          minAltitude: e.minAltitude ?? base.minAltitude,
          maxAltitude: e.maxAltitude ?? base.maxAltitude,
          minAirspeed: e.minAirspeed ?? base.minAirspeed,
          maxAirspeed: e.maxAirspeed ?? base.maxAirspeed,
        });
        dynamicEnvelope = { ...dynamicEnvelope, [e.capabilityId]: merged };
        outbound.push(advertFor(e.capabilityId, cap.type, merged));
        break;
      }
      case "capability-unavailable": {
        unavailableCaps = { ...unavailableCaps, [e.capabilityId]: e.reason };
        // FA can't honour control of a capability it has pulled — drop MA as
        // secondary controller; the player must re-acquire once it returns.
        if (e.capabilityId in secondaryControllers) {
          const next = { ...secondaryControllers };
          delete next[e.capabilityId];
          secondaryControllers = next;
        }
        outbound.push(
          msg("MA_FlightCapabilityStatusMT", "FA", "MA", {
            CapabilityID: e.capabilityId,
            Availability: e.reason,
          }),
        );
        break;
      }
      case "capability-available": {
        if (e.capabilityId in unavailableCaps) {
          const next = { ...unavailableCaps };
          delete next[e.capabilityId];
          unavailableCaps = next;
        }
        outbound.push(
          msg("MA_FlightCapabilityStatusMT", "FA", "MA", {
            CapabilityID: e.capabilityId,
            Availability: "AVAILABLE",
          }),
        );
        break;
      }
      case "spawn-threat": {
        threats = [
          ...threats,
          { id: e.threatId, zone: e.zone, ...(e.velocity ? { velocity: e.velocity } : {}) },
        ];
        break;
      }
      case "despawn-threat": {
        threats = threats.filter((t) => t.id !== e.threatId);
        break;
      }
    }
  }

  const nextFa =
    unavailableCaps === fa.unavailableCaps && secondaryControllers === fa.secondaryControllers
      ? fa
      : { ...fa, unavailableCaps, secondaryControllers };
  return { fa: nextFa, overlay: { dynamicEnvelope, threats }, outbound };
}
