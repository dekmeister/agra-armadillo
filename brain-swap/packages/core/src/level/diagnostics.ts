// After-action diagnostics: turn a finished run into a player-facing debrief
// (docs/01 "Scoring"). Two products, both derived purely from the deterministic
// final World + the recorded input script — NO dependency on the reference solution,
// and NO change to `step`/`World.log`/`scoreWorld`, so golden runs stay byte-stable:
//
//   • lesson   — the level's ONE teaching point + whether the player demonstrated it.
//   • events   — a chronological recap of the player's sends and FA's verdicts,
//                coloured by polarity. `points` is the seam for future authored,
//                per-level +/- scoring; derived defaults score 0.
//
// The lesson VERDICT is signal-based, not keyed on level id: a small set of universal
// "fault signals" (commanded before holding control, any command rejection, a no-fly
// breach, or — for the racetrack — blowing the bus-traffic par) decides `demonstrated`.
// The lesson TEXT is the level's authored `teaches` (surfaced here for the first time),
// with a per-kind fallback. Authored per-level events/overrides are the documented seam.
import { scoreWorld } from "../score.ts";
import type { ScriptedInput } from "../sim.ts";
import type { MessageLogEntry } from "../types.ts";
import type { Outcome, World } from "../world.ts";
import type { LevelDef, Objective } from "./types.ts";

export type EventPolarity = "positive" | "negative" | "neutral";

/** One moment in the after-action recap (a player send, an FA verdict, the outcome). */
export interface ScoredEvent {
  /** Stable id of the rule that produced it. */
  readonly id: string;
  /** Good play / mistake / FA-initiated-informational. Drives green/red/dim in the UI. */
  readonly polarity: EventPolarity;
  /** One-line, player-facing summary. */
  readonly label: string;
  /** Optional extra (rejection reason, fault description). */
  readonly detail?: string;
  /** Tick it occurred at, for chronological ordering. */
  readonly tick?: number;
  /** Points contributed — 0 for derived defaults; the hook for future per-level scoring. */
  readonly points: number;
  /** Optional VI §ref for the codex tie-in. */
  readonly viRef?: string;
}

/** The level's single lesson and whether this run demonstrated it. */
export interface LessonCheck {
  /** The level's one-line lesson (its `teaches`, or a per-kind fallback). */
  readonly lesson: string;
  /** Did the run demonstrate the lesson (won, cleanly)? */
  readonly demonstrated: boolean;
  /** One-line why / why-not, derived from the run's fault signals. */
  readonly note: string;
}

export interface Diagnostics {
  readonly outcome: Outcome;
  readonly won: boolean;
  readonly lesson: LessonCheck;
  /** Chronological recap (Option-B band 3). */
  readonly events: readonly ScoredEvent[];
  /** Sum of event points (0 until per-level events are authored). */
  readonly points: number;
}

type Payload = Record<string, unknown>;
const pay = (e: MessageLogEntry): Payload => e.payload as Payload;

/** The real `MA_ValidationResultEnum` rejection reasons (from the XSD / docs/02). */
type RejectionReason = string;

/** Every command rejection reason FA returned this run, in order. */
function rejectionReasons(log: readonly MessageLogEntry[]): RejectionReason[] {
  const reasons: RejectionReason[] = [];
  for (const e of log) {
    if (
      e.type === "MA_FlightCommandStatusMT" &&
      pay(e).CommandProcessingState === "REJECTED" &&
      typeof pay(e).ValidationResult === "string"
    ) {
      reasons.push(pay(e).ValidationResult as string);
    }
  }
  return reasons;
}

const hasIgnored = (log: readonly MessageLogEntry[]): boolean =>
  log.some((e) => e.disposition.kind === "ignored-not-controller");

/** An ACQUIRE FA refused — e.g. issued before the capability advertised AVAILABLE (1.1). */
const hasControlRejection = (log: readonly MessageLogEntry[]): boolean =>
  log.some(
    (e) =>
      e.type === "MA_ControlRequestStatusMT" &&
      pay(e).ApprovalRequestProcessingState === "REJECTED",
  );

// `step` collapses three distinct failures into outcome "failed" (sim.ts): a no-fly /
// threat breach (stops early), running the fuel dry, and hitting maxTicks. Tease them
// apart so the debrief names the real cause.
const timedOut = (world: World, level: LevelDef): boolean => world.tick >= level.maxTicks;
const flamedOut = (world: World): boolean =>
  world.vehicle.fuel !== undefined && world.vehicle.fuel <= 0;
const breached = (world: World, level: LevelDef): boolean =>
  world.outcome === "failed" && !flamedOut(world) && !timedOut(world, level);

// ---- Lesson ---------------------------------------------------------------

/** Per-kind fallback lesson text for levels that don't author a `teaches` line. */
function fallbackLesson(o: Objective): string {
  switch (o.kind) {
    case "hold-control":
      return "Acquire secondary control before you command — FA ignores commands until you hold control.";
    case "waypoint-sequence":
      return "Steer the circuit with single-field UPDATEs to keep bus traffic to a minimum.";
    case "reach-hold":
      return "Acquire control, command a valid vector, and read your position to know you've arrived.";
  }
}

/** A run fault, highest-priority first, with the one-line coaching note it produces. */
interface Fault {
  readonly note: string;
}

/** The fault signals present in this run, in priority order. Empty ⇒ a clean run. */
function faults(world: World, level: LevelDef): Fault[] {
  const log = world.log;
  const found: Fault[] = [];

  if (hasControlRejection(log)) {
    found.push({
      note: "Your ACQUIRE was REJECTED — wait for the capability to advertise AVAILABLE before requesting control.",
    });
  }
  if (hasIgnored(log)) {
    found.push({
      note: "You commanded before holding control — FA ignored it (not the controller).",
    });
  }
  for (const reason of rejectionReasons(log)) {
    found.push({ note: rejectionNote(reason) });
  }
  if (flamedOut(world)) {
    found.push({
      note: "You ran the tank dry — command a more efficient cruise to make the range.",
    });
  } else if (breached(world, level)) {
    found.push({ note: "You flew into a no-fly / threat zone — the run was aborted." });
  }
  // The racetrack's lesson is efficiency, not a rejection: resending full NEW commands
  // blows the bus-traffic par even on a winning run.
  if (level.objective.kind === "waypoint-sequence" && level.pars) {
    if (scoreWorld(world).busTraffic > level.pars.busTraffic) {
      found.push({
        note: "Resend only the changed field as an UPDATE — full NEW commands blow the bus-traffic par.",
      });
    }
  }
  return found;
}

function rejectionNote(reason: RejectionReason): string {
  switch (reason) {
    case "PERFORMANCE_LIMIT_EXCEEDED":
      return "Command rejected PERFORMANCE_LIMIT_EXCEEDED — clamp to the advertised envelope.";
    case "VIOLATION_ENDURANCE":
      return "Command rejected VIOLATION_ENDURANCE — slow to a sustainable cruise.";
    case "VIOLATION_AIR_TRAFFIC":
      return "Command rejected VIOLATION_AIR_TRAFFIC — yield and vector clear of the hazard.";
    case "VIOLATION_GEOFENCE":
      return "Command rejected VIOLATION_GEOFENCE — route around the restricted zone.";
    case "VIOLATION_TERRAIN":
      return "Command rejected VIOLATION_TERRAIN — clear the terrain.";
    case "CAPABILITY_NOT_SUPPORTED":
      return "Command rejected CAPABILITY_NOT_SUPPORTED — this body doesn't advertise that mode.";
    default:
      return `Command rejected ${reason}.`;
  }
}

function evaluateLesson(world: World, level: LevelDef): LessonCheck {
  const won = world.outcome === "won";
  const fs = faults(world, level);
  const demonstrated = won && fs.length === 0;
  const lesson = level.teaches ?? fallbackLesson(level.objective);

  let note: string;
  if (demonstrated) {
    note = "Clean run — lesson demonstrated.";
  } else if (won) {
    // Met the objective but not cleanly: lead with the first fault as the takeaway.
    note = `Objective met, but: ${fs[0]!.note}`;
  } else if (fs.length > 0) {
    note = fs[0]!.note;
  } else {
    note = "Objective not met — you ran out of time before satisfying the win condition.";
  }
  return { lesson, demonstrated, note };
}

// ---- Events (after-action recap) ------------------------------------------

/** Compact human summary of an MA→FA send for the recap line. */
function summarizeSend(e: MessageLogEntry): string {
  const p = pay(e);
  if (e.type === "MA_ControlRequestMT") {
    return `${p.RequestType ?? "?"} ${p.CapabilityID ?? ""}`.trim();
  }
  if (e.type === "MA_FlightCommandMT") {
    const parts: string[] = [`HSA ${p.CommandState ?? "?"}`];
    if (typeof p.Heading === "number") parts.push(`hdg ${p.Heading}`);
    if (typeof p.Course === "number") parts.push(`crs ${p.Course}`);
    if (typeof p.Altitude === "number") parts.push(`@${p.Altitude}`);
    if (typeof p.Speed === "number") parts.push(`spd ${p.Speed}`);
    return parts.join(" ");
  }
  return e.type;
}

/** Walk the log into a focused recap: the player's sends + FA's verdicts, no telemetry. */
function recap(world: World, level: LevelDef): ScoredEvent[] {
  const events: ScoredEvent[] = [];
  for (const e of world.log) {
    if (e.from === "MA") {
      const ignored = e.disposition.kind === "ignored-not-controller";
      events.push({
        id: ignored ? "send-ignored" : "send",
        polarity: ignored ? "negative" : "neutral",
        label: ignored ? `${summarizeSend(e)} — ignored (not the controller)` : summarizeSend(e),
        tick: e.tick,
        points: 0,
      });
      continue;
    }
    // FA verdicts worth surfacing (skip periodic telemetry + bare RECEIVED acks).
    if (e.type === "MA_ControlRequestStatusMT") {
      const state = pay(e).ApprovalRequestProcessingState as string | undefined;
      if (state === "PENDING") {
        events.push({
          id: "control-pending",
          polarity: "neutral",
          label: "Control request PENDING",
          tick: e.tick,
          points: 0,
        });
      } else if (state === "APPROVED") {
        events.push({
          id: "control-approved",
          polarity: "positive",
          label: "Control APPROVED",
          tick: e.tick,
          points: 0,
          viRef: "§1.2.2.7",
        });
      } else if (state === "REJECTED" || state === "CANCELED") {
        events.push({
          id: "control-denied",
          polarity: "negative",
          label: `Control ${state}`,
          tick: e.tick,
          points: 0,
        });
      }
    } else if (e.type === "MA_FlightCommandStatusMT") {
      const state = pay(e).CommandProcessingState as string | undefined;
      if (state === "ACCEPTED") {
        events.push({
          id: "command-accepted",
          polarity: "positive",
          label: "Command ACCEPTED",
          tick: e.tick,
          points: 0,
          viRef: "§1.2.2.2",
        });
      } else if (state === "REJECTED") {
        const reason = pay(e).ValidationResult as string | undefined;
        events.push({
          id: "command-rejected",
          polarity: "negative",
          label: "Command REJECTED",
          detail: reason,
          tick: e.tick,
          points: 0,
        });
      } else if (state === "CANCELED") {
        events.push({
          id: "command-canceled",
          polarity: "neutral",
          label: "Command CANCELED",
          tick: e.tick,
          points: 0,
        });
      }
    } else if (e.type === "MA_FaultMT") {
      const sev = pay(e).Severity as string | undefined;
      events.push({
        id: "fa-fault",
        polarity: "neutral",
        label: `FA fault · ${sev ?? "?"}`,
        detail: pay(e).FaultDescription as string | undefined,
        tick: e.tick,
        points: 0,
      });
    }
  }
  // Terminal verdict, naming the real failure cause.
  if (world.outcome === "won") {
    events.push({
      id: "objective-met",
      polarity: "positive",
      label: "Objective met",
      tick: world.tick,
      points: 0,
    });
  } else if (flamedOut(world)) {
    events.push({
      id: "run-flameout",
      polarity: "negative",
      label: "Flamed out — ran the tank dry",
      tick: world.tick,
      points: 0,
    });
  } else if (breached(world, level)) {
    events.push({
      id: "run-failed",
      polarity: "negative",
      label: "Run aborted — entered a no-fly / threat zone",
      tick: world.tick,
      points: 0,
    });
  } else {
    events.push({
      id: "run-timeout",
      polarity: "negative",
      label: "Out of time — objective not met",
      tick: world.tick,
      points: 0,
    });
  }
  return events;
}

/**
 * Build the after-action debrief for a finished run. Deterministic: the same World +
 * script + level always yields the same Diagnostics. `script` is accepted for the
 * future per-level scored-event seam; the derived defaults read only the World + level.
 */
export function evaluateDiagnostics(
  world: World,
  _script: readonly ScriptedInput[],
  level: LevelDef,
): Diagnostics {
  const events = recap(world, level);
  return {
    outcome: world.outcome,
    won: world.outcome === "won",
    lesson: evaluateLesson(world, level),
    events,
    points: events.reduce((sum, ev) => sum + ev.points, 0),
  };
}
