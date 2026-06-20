// Design tokens — mirror of the handoff tokens.ts / milspec.css :root.
// Hex values live ONLY here (and in theme.css as CSS vars). Components reference
// CSS classes/vars; Pixi (which needs numeric colors) imports `colorNum`.
import type { Disposition } from "@brain-swap/core";

export const color = {
  black: "#0a0d0a",
  panel: "#11150f",
  panel2: "#161b13",
  bezel: "#070a07",
  line: "#2c3325",
  line2: "#3c4632",
  olive: "#5d6b3f",
  oliveDim: "#3f4a2c",
  phos: "#c2cdb0",
  dim: "#7d876b",
  cyan: "#3fc6d6", // MA sender / cap.* references
  amber: "#e0a322", // FA sender / advertised + literal values
  green: "#8fd06a", // nominal
  ok: "#6fce8a", // accepted / pass
  caution: "#f2c200", // REJECTED (validator failure) only
  warn: "#e0483a", // REVOKED / fault only
} as const;

/** Pixi wants 0xRRGGBB numbers. */
export const colorNum = (hex: string): number => Number.parseInt(hex.slice(1), 16);

/** Visual badge kinds. A superset of core Disposition.kind: a delivered FA→MA status
 *  whose payload says ACCEPTED/APPROVED is shown as `accepted`; REJECTED-in-payload as
 *  `rejected`; CANCELED control as `revoked`. Caution/warn are reserved for the last two. */
export type BadgeKind = "delivered" | "pending" | "accepted" | "ignored" | "rejected" | "revoked";

export const BADGE_LABEL: Record<BadgeKind, string> = {
  delivered: "DELIVERED",
  pending: "PENDING",
  accepted: "ACCEPTED",
  ignored: "IGNORED — not secondary controller",
  rejected: "REJECTED",
  revoked: "REVOKED",
};

/**
 * Derive the visual badge from a log entry. The core `Disposition` only distinguishes
 * delivered / ignored-not-controller / rejected at the *bus* level; FA→MA status
 * messages carry their own ACCEPTED/REJECTED/CANCELED/APPROVED state in the payload,
 * which the log surfaces as the richer accepted/rejected/revoked/pending badges.
 */
export function badgeFor(
  disposition: Disposition,
  type: string,
  payload: unknown,
): { kind: BadgeKind; reason?: string } {
  if (disposition.kind === "ignored-not-controller") return { kind: "ignored" };
  if (disposition.kind === "rejected") return { kind: "rejected", reason: disposition.reason };

  const p = (payload ?? {}) as Record<string, unknown>;
  if (type === "MA_FlightCommandStatusMT") {
    const state = p.CommandProcessingState as string | undefined;
    if (state === "ACCEPTED") return { kind: "accepted" };
    if (state === "REJECTED") return { kind: "rejected", reason: p.ValidationResult as string };
    if (state === "CANCELED") return { kind: "revoked" };
    if (state === "RECEIVED") return { kind: "pending" };
  }
  if (type === "MA_ControlRequestStatusMT") {
    const state = p.ApprovalRequestProcessingState as string | undefined;
    if (state === "APPROVED") return { kind: "accepted" };
    if (state === "REJECTED") return { kind: "rejected" };
    if (state === "CANCELED") return { kind: "revoked" };
    if (state === "PENDING") return { kind: "pending" };
  }
  // Route-plan activation liturgy (levels 2.1 / 2.3): each reply carries the new
  // ActivationState — surfaced as the badge detail so the player can watch the handshake
  // walk READY_FOR_UPLOAD → UPLOADED → READY_FOR_ACTIVATION → ACTIVATED (or a *_FAILED).
  if (type === "MA_MissionPlanActivationCommandStatusMT") {
    const state = p.ActivationState as string | undefined;
    const status = p.CommandStatus as string | undefined;
    if (status === "COMPLETED") return { kind: "accepted", reason: state };
    if (status === "FAILED") return { kind: "rejected", reason: state };
  }
  // Route execution progress (levels 2.1 / 2.3): COMPLETE is the win, EXECUTING is in
  // progress, CANCELED/SUPERCEDED is a revocation, FAILED is a rejection.
  if (type === "RoutePlanExecutionStatusMT") {
    const state = p.PlanExecutionState as string | undefined;
    if (state === "COMPLETE") return { kind: "accepted", reason: state };
    if (state === "EXECUTING" || state === "PENDING") return { kind: "pending", reason: state };
    if (state === "CANCELED" || state === "SUPERCEDED") return { kind: "revoked", reason: state };
    if (state === "FAILED") return { kind: "rejected", reason: state };
  }
  // Curve following (level 2.4): CURVE_COMPLETED is the win; the earlier phases are pending.
  if (type === "MA_FlightActivityMT" && typeof p.CurveStatus === "string") {
    if (p.CurveStatus === "CURVE_COMPLETED") return { kind: "accepted", reason: p.CurveStatus };
    return { kind: "pending", reason: p.CurveStatus };
  }
  return { kind: "delivered" };
}
