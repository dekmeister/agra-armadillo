// Disposition badge (handoff "two tweaks", #2: alert colors are strictly semantic).
// Driven by the visual BadgeKind derived in tokens.ts#badgeFor. Caution-yellow and
// warning-red are reserved for `rejected` and `revoked` respectively — that invariant
// lives in the CSS (.badge.*) and the BADGE_LABEL map, never at call sites.
import { BADGE_LABEL, type BadgeKind } from "./tokens.ts";

export function DispositionBadge({ kind, reason }: { kind: BadgeKind; reason?: string }) {
  // The real enum detail is appended inline — for rejected/revoked it's the ValidationResult;
  // for accepted/pending it's the new protocol state (e.g. an activation liturgy's
  // ActivationState or a route's PlanExecutionState), so the handshake reads itself in the
  // log. It inherits the badge's foreground (black/white on the filled chip) to stay legible.
  const showReason =
    reason &&
    (kind === "rejected" || kind === "revoked" || kind === "accepted" || kind === "pending");
  return (
    <span className={`badge ${kind}`}>
      {BADGE_LABEL[kind]}
      {showReason ? ` · ${reason}` : null}
    </span>
  );
}
