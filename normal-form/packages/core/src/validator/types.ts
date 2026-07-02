// The compose-gate types. `validate(sheet, composition) → Finding[]` is pure;
// each Finding's text is sourced from the policed catalog (FINDINGS), never from
// string literals here (PLAN_MVP S3).
import type { Machine } from "../machine/schema.ts";

/** The player's in-progress work on the board, judged by the validator. */
export interface Composition {
  /** the placed pattern, e.g. "Command-2" */
  readonly pattern: string;
  /** concrete message types bound to the pattern's request/response arrows */
  readonly binding: { readonly request: string; readonly response: string };
  /** pattern role → bound lifeline id (empty/absent = unbound) */
  readonly roles: {
    readonly commander?: string | null;
    readonly commandee?: string | null;
  };
  /** envelope + command field values (SystemID, Timestamp, …, CommandID, CommandState) */
  readonly fields: Readonly<Record<string, string | null>>;
  /** the handler machine (for V10 — a terminal handler must exist) */
  readonly machine?: Machine;
}

/** A validator finding, rendered verbatim in the console (a core mechanic). */
export interface Finding {
  /** catalog finding id (V1-systemid, …) */
  readonly id: string;
  /** honest prefix + number: `ENV HeaderType`, `RQMT USTD-000436`, `CERT …`, `READY` */
  readonly code: string;
  /** the game-facing one-liner */
  readonly message: string;
  /** document + section */
  readonly docRef: string;
  /** the standard's verbatim text (absent for game-rule findings) */
  readonly quote?: string;
  /** the composition field the finding is about, if any */
  readonly field?: string;
}
