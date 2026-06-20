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

// Route-plan upload/activation liturgy (levels 2.1 / 2.3). Each FA reply carries the new
// PlanActivationState / PlanExecutionState; the hint tells the player the next step, so the
// two message types (MA_RoutePlanMT = the route data, MA_MissionPlanActivationCommandMT = the
// protocol that uploads and activates it) and their order become self-teaching.
const LITURGY_HINTS: Record<string, Hint> = {
  READY_FOR_UPLOAD: {
    severity: "info",
    title: "Next: send the plan, then UPLOAD",
    body: "FA has opened a slot for this RoutePlanID. Now send the route itself (MA_RoutePlanMT) and then MA_MissionPlanActivationCommandMT with ActivationCommand UPLOAD to store it. The activation command is the protocol; the route plan is the data it uploads.",
  },
  UPLOADED: {
    severity: "info",
    title: "Next: PREPARE_FOR_ACTIVATION",
    body: "The plan is stored. Send MA_MissionPlanActivationCommandMT with ActivationCommand PREPARE_FOR_ACTIVATION to validate and arm it (FA replies READY_FOR_ACTIVATION).",
  },
  READY_FOR_ACTIVATION: {
    severity: "info",
    title: "Next: ACTIVATE",
    body: "The plan is armed. Send MA_MissionPlanActivationCommandMT with ActivationCommand ACTIVATE to commit it — FA then flies the route itself.",
  },
  ACTIVATED: {
    severity: "info",
    title: "Route is live",
    body: "FA accepted activation and is now flying the legs. Watch RoutePlanExecutionStatusMT report EXECUTING → COMPLETE; you don't send flight commands — the route flies itself.",
  },
  EXECUTING: {
    severity: "info",
    title: "FA is flying the route",
    body: "The route is running. FA steers the legs to the terminal loiter and will report COMPLETE on arrival. No further command is needed unless the route is canceled.",
  },
};

export function hintFor(kind: BadgeKind, reason?: string): Hint | null {
  // Liturgy progress hints fire on the accepted/pending FA replies whose detail is a known
  // PlanActivation/PlanExecution state (other accepted messages — e.g. control APPROVED —
  // carry no such reason and fall through to null).
  if ((kind === "accepted" || kind === "pending") && reason && LITURGY_HINTS[reason]) {
    return LITURGY_HINTS[reason];
  }
  if (kind === "ignored") {
    return {
      severity: "info",
      title: "Why was this ignored?",
      body: "FA always retains control and only listens to its SecondaryController. You sent this command before holding secondary control of the capability, so FA silently dropped it (it isn't listening — there is no NACK). Acquire control first: send MA_ControlRequestMT with RequestType ACQUIRE, wait for MA_ControlRequestStatusMT APPROVED, and confirm you appear as SecondaryController in the next ControlStatusMT.",
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
