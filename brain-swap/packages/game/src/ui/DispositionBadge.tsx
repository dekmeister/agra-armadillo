// Disposition badge (handoff "two tweaks", #2: alert colors are strictly semantic).
// Driven by the visual BadgeKind derived in tokens.ts#badgeFor. Caution-yellow and
// warning-red are reserved for `rejected` and `revoked` respectively — that invariant
// lives in the CSS (.badge.*) and the BADGE_LABEL map, never at call sites.
import { BADGE_LABEL, type BadgeKind } from "./tokens.ts";

export function DispositionBadge({ kind, reason }: { kind: BadgeKind; reason?: string }) {
  // For rejected/revoked the real ValidationResult enum is appended inline — it inherits
  // the badge's foreground (black/white on the filled chip) so it stays legible.
  const showReason = reason && (kind === "rejected" || kind === "revoked");
  return (
    <span className={`badge ${kind}`}>
      {BADGE_LABEL[kind]}
      {showReason ? ` · ${reason}` : null}
    </span>
  );
}
