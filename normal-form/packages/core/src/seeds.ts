// Seeds are authored disruption *schedules* (data), not PRNG seeds — determinism
// rule (PLAN_MVP ground rule #1). Each op is a spec-legal transport misbehavior
// drawn from UNIS §4 ("no assumption that messages come in any order or that there
// is guaranteed delivery"). MVP vocabulary: reorder / dup / delay. (drop and
// scheduled straggle are post-MVP; seed ③'s "duplicate after terminal" is `dup`.)
import type { CommandProcessingStateEnum } from "./messages/index.ts";

/** Deliver `after` before `before` (no ordering assumption). */
export interface ReorderOp {
  readonly op: "reorder";
  readonly before: CommandProcessingStateEnum;
  readonly after: CommandProcessingStateEnum;
}

/** Deliver `msg` again `delay` ticks after its original delivery (duplicate). */
export interface DupOp {
  readonly op: "dup";
  readonly msg: CommandProcessingStateEnum;
  readonly delay: number;
}

/** Deliver `msg` `by` ticks late (no timing assumption). */
export interface DelayOp {
  readonly op: "delay";
  readonly msg: CommandProcessingStateEnum;
  readonly by: number;
}

export type SeedOp = ReorderOp | DupOp | DelayOp;

export interface Seed {
  readonly id: number;
  readonly label: string;
  readonly schedule: readonly SeedOp[];
}
