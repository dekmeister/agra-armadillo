// Display formatting for brain guard/value expressions (Brain is core data; these are
// purely for the editor/canvas UI). A ValueExpr is a literal, { msg } or { cap }.
import type { Guard, ValueExpr } from "@brain-swap/core";

export function formatValueExpr(v: ValueExpr): string {
  if (v && typeof v === "object") {
    if ("msg" in v) return `msg.${v.msg}`;
    if ("cap" in v) return `cap.${v.cap}`;
  }
  return String(v);
}

export function formatGuard(guard?: Guard): string | undefined {
  if (!guard) return undefined;
  return `${guard.field} ${guard.op} ${formatValueExpr(guard.value)}`;
}

/** Compact guard label for the edge chip, e.g. "==APPROVED". */
export function shortGuard(guard?: Guard): string | undefined {
  if (!guard) return undefined;
  return `${guard.op}${formatValueExpr(guard.value)}`;
}

/** Parse a text literal into the JSON value the schema expects (number / boolean / string). */
export function parseLiteral(text: string): string | number | boolean {
  const t = text.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t !== "" && !Number.isNaN(Number(t))) return Number(t);
  return text;
}
