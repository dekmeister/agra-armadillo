/**
 * A-GRA RBAC: authority is checked at the *destination* — arrival != effect.
 *
 * Five roles (Admin / QB / AVC / LRE / Observer). The strike-approval gate is the
 * Target-Authority gate: only the QB may approve weapon employment
 * (MA_ApprovalRequestMT -> QB -> MA_ApprovalRequestStatusMT(APPROVED)). A request
 * that arrives at any other role is REJECTED / CannotComply. This is the teaching
 * beat: routing a message to a node does not make that node authorised.
 *
 * [S] Full ROE / WEZ / Identity-Matrix / Target-Custody / geozone machinery is
 * collapsed to this single Target-Authority gate (see docs/01).
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
