// The requestee (SystemB / Commandee) is an engine configured per sheet, not a
// script per level (docs/04). It consumes a behavior config — which states it
// reports, at what offsets, and whether accepting executes the tasked activity —
// and turns one received command into a set of status emissions. Deterministic:
// no RNG, no clock. If a sheet needs bespoke respondent code, the sheet is wrong.
import type { Emission } from "../bus.ts";
import type { CommandMessage, CommandProcessingStateEnum } from "../types.ts";

export interface RequesteeReport {
  readonly report: CommandProcessingStateEnum;
  /** ticks after command receipt at which this status is emitted */
  readonly at: number;
  /** SystemB performs the tasked activity when it emits this report */
  readonly thenExecuteActivity?: boolean;
}

export interface RequesteeConfig {
  readonly onCommand: readonly RequesteeReport[];
  /** rejection rules (empty for 1-1: SystemB accepts anything well-formed) */
  readonly rejects: readonly unknown[];
}

export interface RequesteeResponse {
  readonly emissions: readonly Emission[];
  /** tick at which the tasked activity executes (SystemB world-state), or null */
  readonly activityTick: number | null;
}

/** React to one received command: schedule status emissions relative to receipt. */
export function respond(
  config: RequesteeConfig,
  command: CommandMessage,
  receiptTick: number,
): RequesteeResponse {
  const emissions: Emission[] = [];
  let activityTick: number | null = null;
  for (const r of config.onCommand) {
    const emitTick = receiptTick + r.at;
    emissions.push({ state: r.report, commandId: command.commandId, emitTick });
    if (r.thenExecuteActivity) activityTick = emitTick;
  }
  return { emissions, activityTick };
}
