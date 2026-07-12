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

/** A rejection the commandee issues on the *first* attempt (sheet 1-3). REJECTED is
 *  terminal for that CommandID, so recovery is only a NEW command — the retry
 *  (attempt ≥ 1) is judged on `onCommand`. `reason` is a real `CannotComplyEnum`
 *  value surfaced on the REJECTED status's `CommandProcessingStateReason`. */
export interface RequesteeReject {
  readonly report: "REJECTED";
  readonly at: number;
  readonly reason: string;
}

export interface RequesteeConfig {
  readonly onCommand: readonly RequesteeReport[];
  /** first-attempt rejections; empty ⇒ the commandee accepts every attempt (1-1). */
  readonly rejects: readonly RequesteeReject[];
}

export interface RequesteeResponse {
  readonly emissions: readonly Emission[];
  /** tick at which the tasked activity executes (SystemB world-state), or null */
  readonly activityTick: number | null;
}

/** React to one received command: schedule status emissions relative to receipt.
 *  `attempt` is 0 for the sheet's opening command and increments per retry — the
 *  commandee rejects the first attempt (when configured) and judges the fresh retry
 *  on `onCommand`. Deterministic: no RNG, no clock. */
export function respond(
  config: RequesteeConfig,
  command: CommandMessage,
  receiptTick: number,
  attempt = 0,
): RequesteeResponse {
  if (attempt === 0 && config.rejects.length > 0) {
    const emissions: Emission[] = config.rejects.map((r) => ({
      state: r.report,
      commandId: command.commandId,
      emitTick: receiptTick + r.at,
      reason: r.reason,
    }));
    return { emissions, activityTick: null };
  }

  const emissions: Emission[] = [];
  let activityTick: number | null = null;
  for (const r of config.onCommand) {
    const emitTick = receiptTick + r.at;
    emissions.push({ state: r.report, commandId: command.commandId, emitTick });
    if (r.thenExecuteActivity) activityTick = emitTick;
  }
  return { emissions, activityTick };
}
