// The player's editable work as headless, deterministic domain logic (PLAN_MVP
// S5). A Session is the reduced result of an ordered PlayerAction script; the UI
// (packages/game store) and the replay golden share this one reducer, so a
// recorded solve replays to a byte-identical machine + composition without a DOM.
// buildMachine turns the flat per-enum editor (plus the "require RECEIVED first"
// gate) into a Machine — the gate reproduces the 2-state hard-sequencing shape
// (test/reference/neg-hardseq.json) the seed-② bus punishes.
import type { Sheet } from "../level/types.ts";
import type { Machine, MachineAction, Rule } from "../machine/schema.ts";
import type { CommandProcessingStateEnum } from "../types.ts";
import { initialComposition } from "../validator/index.ts";
import type { Composition } from "../validator/types.ts";

/** One recorded player edit. The ordered list is the replayable solve script. */
export type PlayerAction =
  | { readonly do: "place" }
  | { readonly do: "setField"; readonly name: string; readonly value: string | null }
  | {
      readonly do: "setHandler";
      readonly on: CommandProcessingStateEnum;
      /** null clears the rule for `on` (the editor's "unset") */
      readonly action: MachineAction | null;
    }
  | { readonly do: "gateAccepted"; readonly value: boolean };

export interface Session {
  readonly placed: boolean;
  readonly fields: Readonly<Record<string, string | null>>;
  readonly handlers: Readonly<Partial<Record<CommandProcessingStateEnum, MachineAction>>>;
  /** ACCEPTED is armed only after RECEIVED (2-state hard-sequence) when true */
  readonly gateAccepted: boolean;
}

export function initialSession(sheet: Sheet): Session {
  return {
    placed: false,
    fields: { ...sheet.compose.initialFields },
    handlers: {},
    gateAccepted: false,
  };
}

/** Pure reducer: fold one action into the session. */
export function applyAction(session: Session, action: PlayerAction): Session {
  switch (action.do) {
    case "place":
      return { ...session, placed: true };
    case "setField":
      return { ...session, fields: { ...session.fields, [action.name]: action.value } };
    case "setHandler": {
      const handlers = { ...session.handlers };
      if (action.action === null) delete handlers[action.on];
      else handlers[action.on] = action.action;
      return { ...session, handlers };
    }
    case "gateAccepted":
      return { ...session, gateAccepted: action.value };
  }
}

// Emit rules in enum order so the machine (and its size) is stable across runs.
const HANDLER_ORDER: readonly CommandProcessingStateEnum[] = ["RECEIVED", "ACCEPTED", "REJECTED"];

/** Build the handler Machine from the flat editor + gate toggle. */
export function buildMachine(session: Session): Machine {
  const gated = session.gateAccepted;
  const rules: Rule[] = [];
  for (const on of HANDLER_ORDER) {
    const action = session.handlers[on];
    if (action === undefined) continue;
    // Gated: ACCEPTED is armed in s1, reached only after RECEIVED moves s0 -> s1.
    const from = gated && on === "ACCEPTED" ? "s1" : "s0";
    const rule: Rule = { from, on, action };
    const target = gated && on === "RECEIVED" ? "s1" : undefined;
    rules.push({
      ...rule,
      ...(target ? { target } : {}),
      ...(action === "retry" ? { budget: 1 } : {}),
    });
  }
  return { id: "player", initial: "s0", states: gated ? ["s0", "s1"] : ["s0"], rules };
}

/** Build the composition the validator judges from the current session. */
export function buildComposition(sheet: Sheet, session: Session): Composition {
  const machine = buildMachine(session);
  if (!session.placed) {
    return {
      pattern: "",
      binding: { request: "", response: "" },
      roles: { commander: null, commandee: null },
      fields: session.fields,
      machine,
    };
  }
  return { ...initialComposition(sheet, machine), fields: session.fields };
}

/** Replay an ordered solve script to its session, machine, and composition. */
export function replayScript(
  sheet: Sheet,
  script: readonly PlayerAction[],
): { session: Session; machine: Machine; composition: Composition } {
  const session = script.reduce(applyAction, initialSession(sheet));
  return { session, machine: buildMachine(session), composition: buildComposition(sheet, session) };
}
