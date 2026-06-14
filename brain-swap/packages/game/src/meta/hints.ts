// The "why was this ignored / rejected?" hint copy. This is GAME TEXT (teaching prose),
// not schema content — it explains the real VI semantics behind a disposition. Enum names
// quoted here are real (policed by the fidelity gate where they enter the catalog).
import type { BadgeKind } from "../ui/tokens.ts";

export interface Hint {
  title: string;
  body: string;
  severity: "info" | "warn";
}

const VALIDATION_HINTS: Record<string, string> = {
  PERFORMANCE_LIMIT_EXCEEDED:
    "The commanded value lies outside the body's advertised performance envelope. FA validates against exactly the profile it advertised in MA_FlightCapabilityMT — read the spec sheet and clamp your command (e.g. keep Altitude within MaxAltitude).",
  CAPABILITY_NOT_SUPPORTED:
    "The CapabilityID you commanded isn't an advertised, controllable capability on this body. Command the capability FA actually advertised (cap.CapabilityID).",
  VIOLATION_ENDURANCE:
    "FA rejected the command on endurance grounds — the body can't complete the task within its fuel/range. (Introduced in later levels.)",
  VIOLATION_GEOFENCE: "The commanded path crosses a geofence FA enforces. (Later levels.)",
  VIOLATION_TERRAIN: "The commanded path clips terrain FA enforces. (Later levels.)",
  VIOLATION_AIR_TRAFFIC: "FA rejected the command for air-traffic deconfliction. (Later levels.)",
  INVALID_WAYPOINT: "A waypoint in the command is invalid. (Waypoint levels.)",
  INVALID_CURVE: "A curve segment in the command is invalid. (Curve levels.)",
};

export function hintFor(kind: BadgeKind, reason?: string): Hint | null {
  if (kind === "ignored") {
    return {
      severity: "info",
      title: "Why was this ignored?",
      body:
        "FA always retains control and only listens to its SecondaryController. You sent this command before holding secondary control of the capability, so FA silently dropped it (it isn't listening — there is no NACK). Acquire control first: send MA_ControlRequestMT with RequestType ACQUIRE, wait for MA_ControlRequestStatusMT APPROVED, and confirm you appear as SecondaryController in the next ControlStatusMT.",
    };
  }
  if (kind === "rejected") {
    const detail = reason ? VALIDATION_HINTS[reason] : undefined;
    return {
      severity: "warn",
      title: "Why was this rejected?",
      body:
        detail ??
        "FA validated the command and refused it. Inspect the ValidationResult enum and adjust the command to satisfy the advertised envelope.",
    };
  }
  return null;
}
