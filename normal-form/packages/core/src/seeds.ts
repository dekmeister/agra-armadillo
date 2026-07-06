// Seeds are authored disruption *schedules* (data), not PRNG seeds — determinism
// rule (PLAN_MVP ground rule #1). Each op is a spec-legal transport misbehavior
// drawn from UNIS §4 ("no assumption that messages come in any order or that there
// is guaranteed delivery"). Vocabulary: reorder / dup / delay / drop.
//
// An op targets a bus item by its abstract `key` (WS-E generalization). For the
// Command-2 path the key is the response state (`RECEIVED` / `ACCEPTED` / …); for
// the one-way (`-1`) path it names a publication link, `s<send>:<consumer>` (or a
// bare `s<send>` to name the whole broadcast — see `bus.ts` key matching). A key
// is a plain string so both paths share one op vocabulary and one bus.

/** Deliver `after` before `before` (no ordering assumption). */
export interface ReorderOp {
  readonly op: "reorder";
  readonly before: string;
  readonly after: string;
}

/** Deliver `msg` again `delay` ticks after its original delivery (duplicate). */
export interface DupOp {
  readonly op: "dup";
  readonly msg: string;
  readonly delay: number;
}

/** Deliver `msg` `by` ticks late (no timing assumption). */
export interface DelayOp {
  readonly op: "delay";
  readonly msg: string;
  readonly by: number;
}

/** Never deliver the item(s) named by `msg` (no guaranteed delivery). Scoped to
 *  `-1` patterns in the level design (fidelity lie #4); the first op that *removes*
 *  a pending rather than re-timing it. */
export interface DropOp {
  readonly op: "drop";
  readonly msg: string;
}

export type SeedOp = ReorderOp | DupOp | DelayOp | DropOp;

export interface Seed {
  readonly id: number;
  readonly label: string;
  readonly schedule: readonly SeedOp[];
}
