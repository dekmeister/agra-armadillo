/**
 * A-GRA RBAC: authority is checked at the *destination* — arrival != effect.
 *
 * Five roles (Admin / QB / AVC / LRE / Observer). The strike-approval gate is the
 * Target-Authority gate: only the QB may approve weapon employment
 * (MA_ApprovalRequestMT -> QB -> MA_ApprovalRequestStatusMT(APPROVED)). A request
 * that arrives at any other role is REJECTED / CannotComply. This is the teaching
 * beat: routing a message to a node does not make that node authorised.
 *
 * PROVENANCE. The *gate* is sourced, the *role set* is not — do not conflate them.
 * Sourced (XSD): the Target Authority itself, via MA_RulesOfEngagementMDT's
 * TargetAuthorityCriteria field, which "specifies who is authorized to approve or set
 * something as a Target"; the approval request naming an Approver role "allowed to
 * approve" plus a RespondBy deadline; ApprovalStatusEnum's APPROVED/REJECTED; and
 * CannotComplyEnum's INELIGIBLE_CONTROL_SOURCE, whose annotation is precisely this
 * rejection ("the source of the action isn't eligible and/or hasn't been granted
 * permission to control"). Unsourced: that the five roles below are A-GRA's set, and
 * that an AVC specifically may not hold release authority (VERIFY C1, C2, C7) — the
 * XSD models roles as configured data, not an enum, so only the absent C2 Volume can
 * settle it. TargetAuthorityCriteria says who *may* be authorised without excluding
 * anyone, so it does not decide C7 either way.
 *
 * [S] Full ROE / WEZ / Identity-Matrix / Target-Custody / geozone machinery is
 * collapsed to this single Target-Authority gate (see docs/01). Also omitted: the
 * StrikeConsentRequestMT round trip that a real ROE with StrikeConsentRequired=TRUE
 * would demand before each strike executes.
 */
import type { ApprovalStatus, Role } from "./types.ts";

/**
 * The generic destination gate: authority is contextual. A request that requires
 * role `required` succeeds only if it arrived at a node declaring that role — arrival
 * != effect. Different interaction kinds require different roles (QB for strike
 * approval, LRE for takeoff/landing/RTB), so callers pass the role the *kind* demands.
 */
export function adjudicate(role: Role, required: Role): ApprovalStatus {
  return role === required ? "APPROVED" : "REJECTED";
}

/** Can this role act as Target Authority for weapon-employment approval? */
export function isTargetAuthority(role: Role): boolean {
  return role === "QB";
}

/**
 * Adjudicate a strike-approval request that has arrived at a node with `role`.
 * Returns the status the destination would emit in MA_ApprovalRequestStatusMT.
 * QB-specialised wrapper over `adjudicate` (keeps Phase 6 + its tests byte-identical).
 */
export function adjudicateApproval(role: Role): ApprovalStatus {
  return adjudicate(role, "QB");
}
