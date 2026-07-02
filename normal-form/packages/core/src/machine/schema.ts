// The handler-machine is data (docs/04): a small reactive state machine attached
// to the response message, keyed on CommandProcessingStateEnum. MVP vocabulary is
// the minimum honest set — wait / terminal / retry(n) (docs/02 lie #5). The
// correct 1-1 machine is single-state (order-independent); a multi-state machine
// that gates ACCEPTED behind RECEIVED is the classic sequencing footgun the bus
// punishes (seed ②).
import type { CommandProcessingStateEnum } from "../types.ts";

export type MachineAction = "wait" | "terminal" | "retry";

export interface Rule {
  /** state this rule is armed in */
  readonly from: string;
  /** the response enum that triggers it */
  readonly on: CommandProcessingStateEnum;
  readonly action: MachineAction;
  /** next state (omit to stay); a `wait` that `goto`s another state is how a
   *  machine hard-sequences RECEIVED→ACCEPTED */
  readonly target?: string;
  /** retry budget for `action: "retry"` (a game rule — docs/02 lie #5) */
  readonly budget?: number;
}

export interface Machine {
  readonly id?: string;
  readonly initial: string;
  readonly states: readonly string[];
  readonly rules: readonly Rule[];
}

/** Machine-size metric = handler rules wired (05-mvp: 1-1 is 3 — RECEIVED,
 *  ACCEPTED, REJECTED). States are structure, not counted this sheet. */
export function machineSize(machine: Machine): number {
  return machine.rules.length;
}

/** The rule armed in `state` for response `on`, if any (first-match). */
export function ruleFor(
  machine: Machine,
  state: string,
  on: CommandProcessingStateEnum,
): Rule | undefined {
  return machine.rules.find((r) => r.from === state && r.on === on);
}
