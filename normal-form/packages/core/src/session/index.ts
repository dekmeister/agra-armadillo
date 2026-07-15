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

/** The player's publish-plan knobs on a `-1` sheet: first-publish tick + republish
 *  cadence (`everyN <= 0` ⇒ a single fire-and-forget). `count` is derived from the
 *  sheet's goal horizon at run time (see core `derivePublishPlan`). */
export interface PublishKnobs {
  readonly startTick: number;
  readonly everyN: number;
}

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
  | { readonly do: "gateAccepted"; readonly value: boolean }
  | { readonly do: "setPublish"; readonly startTick: number; readonly everyN: number }
  // Request-run sheet (bonus 1-5): inject a CANCEL at `tick` (null = no cancel).
  | { readonly do: "setCancel"; readonly tick: number | null }
  // Classification sheet (0-3): assign a palette pattern to a job (null clears it).
  | { readonly do: "assignPattern"; readonly job: string; readonly pattern: string | null }
  // Classification sheet (0-3): file/unfile a certification finding on a job.
  | {
      readonly do: "fileFinding";
      readonly job: string;
      readonly code: string;
      readonly on: boolean;
    };

export interface Session {
  readonly placed: boolean;
  readonly fields: Readonly<Record<string, string | null>>;
  readonly handlers: Readonly<Partial<Record<CommandProcessingStateEnum, MachineAction>>>;
  /** ACCEPTED is armed only after RECEIVED (2-state hard-sequence) when true */
  readonly gateAccepted: boolean;
  /** one-way (`-1`) publish-plan knobs (ignored on Command-2 sheets) */
  readonly publish: PublishKnobs;
  /** request-run sheet (bonus 1-5): the tick to inject CANCEL, or null for no cancel.
   *  A plan knob folded into the deterministic run (core stays pure — not a live
   *  per-tick mutation). Ignored on all other paths. */
  readonly cancelAt: number | null;
  /** classification sheet (0-3): job id → the pattern the player assigned it */
  readonly jobPatterns: Readonly<Record<string, string>>;
  /** classification sheet (0-3): job id → the finding codes filed on it */
  readonly filed: Readonly<Record<string, readonly string[]>>;
}

/** The starting publish plan: a single fire-and-forget. On a `-1` hold sheet this
 *  is deliberately too weak (it goes stale), so the sheet "arrives broken". */
export const DEFAULT_PUBLISH: PublishKnobs = { startTick: 1, everyN: 0 };

export function initialSession(sheet: Sheet): Session {
  return {
    placed: false,
    fields: { ...sheet.compose.initialFields },
    handlers: {},
    // Ships ON as an inherited "sequential handler template" (05-mvp amendment 2)
    // so seed ② is a guaranteed kill the player must discover and remove.
    // Generalizing this one global flag into a per-rule "only after X" qualifier
    // is deferred to WS-F.
    gateAccepted: true,
    publish: DEFAULT_PUBLISH,
    // Request-run sheet ships with the sheet's (deliberately broken) default cancel —
    // null (no cancel) lets the activity run so the sheet "arrives broken" (1-5).
    cancelAt: sheet.request?.defaultCancelAt ?? null,
    jobPatterns: {},
    filed: {},
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
    case "setPublish":
      return { ...session, publish: { startTick: action.startTick, everyN: action.everyN } };
    case "setCancel":
      return { ...session, cancelAt: action.tick };
    case "assignPattern": {
      const jobPatterns = { ...session.jobPatterns };
      if (action.pattern === null) delete jobPatterns[action.job];
      else jobPatterns[action.job] = action.pattern;
      return { ...session, jobPatterns };
    }
    case "fileFinding": {
      const current = session.filed[action.job] ?? [];
      const has = current.includes(action.code);
      // Toggle: file adds the code (idempotent), unfile removes it.
      const next = action.on
        ? has
          ? current
          : [...current, action.code]
        : current.filter((c) => c !== action.code);
      const filed = { ...session.filed };
      if (next.length === 0) delete filed[action.job];
      else filed[action.job] = next;
      return { ...session, filed };
    }
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
