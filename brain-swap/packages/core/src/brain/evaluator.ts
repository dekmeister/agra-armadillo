// Tiny guard/value evaluator. NO eval(), no general scripting (docs/04) — this keeps
// brains pure data and the sim deterministic. Supports exactly the MVP subset:
// equality/comparison guards on a triggering-message field, and value references
// (literal | msg.<field> | cap.<field>) for send-field templates.
import type { CompareOp, Guard, Literal, ValueExpr } from "./schema.ts";

export interface EvalContext {
  /** Payload of the message that triggered the transition. */
  readonly trigger: Readonly<Record<string, unknown>>;
  /** Controlled-capability fields exposed to `cap.*` refs (CapabilityID, MaxAltitude, …). */
  readonly cap: Readonly<Record<string, unknown>>;
}

function isLiteral(v: ValueExpr): v is Literal {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

export function resolveValue(expr: ValueExpr, ctx: EvalContext): unknown {
  if (isLiteral(expr)) return expr;
  if ("msg" in expr) return ctx.trigger[expr.msg];
  if ("cap" in expr) return ctx.cap[expr.cap];
  return undefined;
}

function compare(op: CompareOp, lhs: unknown, rhs: unknown): boolean {
  switch (op) {
    case "==":
      return lhs === rhs;
    case "!=":
      return lhs !== rhs;
    case "<":
    case "<=":
    case ">":
    case ">=": {
      if (typeof lhs !== "number" || typeof rhs !== "number") return false;
      if (op === "<") return lhs < rhs;
      if (op === "<=") return lhs <= rhs;
      if (op === ">") return lhs > rhs;
      return lhs >= rhs;
    }
  }
}

/** Evaluate an optional guard. Absent guard ⇒ always true. */
export function evaluateGuard(guard: Guard | undefined, ctx: EvalContext): boolean {
  if (!guard) return true;
  const lhs = ctx.trigger[guard.field];
  const rhs = resolveValue(guard.value, ctx);
  return compare(guard.op, lhs, rhs);
}

/** Build a send payload by resolving each field template against the context. */
export function buildSendPayload(
  fields: Readonly<Record<string, ValueExpr>>,
  ctx: EvalContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, expr] of Object.entries(fields)) {
    out[key] = resolveValue(expr, ctx);
  }
  return out;
}
