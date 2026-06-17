// Brain = data (docs/04). A brain is a visual state machine serialized as JSON.
// This is the MVP subset (docs/05): one message-type trigger + at most one field
// guard per transition; actions are `send` (with a field template) and the implicit
// `goto` carried by the transition's `target`. No timers, variables, or blocks yet.
import type { MessageTypeName } from "../messages/index.ts";

export type CompareOp = "==" | "!=" | "<" | "<=" | ">" | ">=";

export type Literal = string | number | boolean;

/**
 * A value used in a guard RHS or a send-field template. The MVP evaluator resolves:
 *   literal           — a constant
 *   { msg: <field> }  — a field of the triggering message
 *   { cap: <field> }  — a field of the level's controlled capability (e.g. CapabilityID)
 */
export type ValueExpr = Literal | { readonly msg: string } | { readonly cap: string };

/** One optional field guard: <triggering message field> <op> <value>. */
export interface Guard {
  readonly field: string;
  readonly op: CompareOp;
  readonly value: ValueExpr;
}

/** Send-action: emit `message` to FA, populating `fields` from the template. */
export interface SendAction {
  readonly kind: "send";
  readonly message: MessageTypeName;
  readonly fields: Readonly<Record<string, ValueExpr>>;
}

export type Action = SendAction;

export interface Transition {
  readonly from: string;
  readonly trigger: { readonly messageType: MessageTypeName };
  readonly guard?: Guard;
  readonly actions?: readonly Action[];
  /** Next state (the visual machine's "goto"). Omit to stay in the same state. */
  readonly target?: string;
}

export interface Brain {
  readonly id?: string;
  readonly initial: string;
  readonly states: readonly string[];
  readonly transitions: readonly Transition[];
}

/** Brain size metric (docs/01): states + transitions. */
export function brainSize(brain: Brain): number {
  return brain.states.length + brain.transitions.length;
}
