// Brain interpreter: on each message delivered to MA, find the first matching
// transition out of the current state (by trigger message type + guard), run its
// send actions, and move to its target state. First-match-wins keeps it deterministic.
import { type Message } from "../types.ts";
import { buildSendPayload, type EvalContext, evaluateGuard } from "./evaluator.ts";
import type { Brain } from "./schema.ts";

export interface BrainReaction {
  readonly nextState: string;
  readonly outbound: Message[];
}

export function reactToMessage(
  brain: Brain,
  currentState: string,
  message: Message,
  cap: Readonly<Record<string, unknown>>,
): BrainReaction {
  const ctx: EvalContext = {
    trigger: message.payload as Readonly<Record<string, unknown>>,
    cap,
  };
  for (const t of brain.transitions) {
    if (t.from !== currentState) continue;
    if (t.trigger.messageType !== message.type) continue;
    if (!evaluateGuard(t.guard, ctx)) continue;

    const outbound: Message[] = [];
    for (const action of t.actions ?? []) {
      const payload = buildSendPayload(action.fields, ctx);
      // The interpreter is the dynamic data->message boundary; payload shape is
      // governed by the catalog/send-form, not the static type system here.
      outbound.push({ type: action.message, from: "MA", to: "FA", payload } as Message);
    }
    return { nextState: t.target ?? currentState, outbound };
  }
  return { nextState: currentState, outbound: [] };
}
