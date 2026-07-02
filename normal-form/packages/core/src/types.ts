// Shared sim types (headless, deterministic — no DOM, no RNG, no wall-clock).
import type { CommandProcessingStateEnum, CommandStateEnum } from "./messages/index.ts";

export type { CommandProcessingStateEnum, CommandStateEnum };

/** The two lifelines of the Command-2 pattern (UNIS §4.6 role names). */
export type Party = "commander" | "systemB";

/** A TaskCommand instance on the wire (Commander -> SystemB). */
export interface CommandMessage {
  readonly type: "TaskCommand";
  readonly commandId: string;
  readonly commandState: CommandStateEnum;
}

/** A TaskCommandStatus instance on the wire (SystemB -> Commander). */
export interface StatusMessage {
  readonly type: "TaskCommandStatus";
  readonly commandId: string;
  readonly state: CommandProcessingStateEnum;
}

/** Terminal command-processing states (SPC-001 §5.1.1 Table 5.1-2): once reported,
 *  the sequence ends. RECEIVED is the only non-terminal member. */
export const TERMINAL_STATES: ReadonlySet<CommandProcessingStateEnum> = new Set([
  "ACCEPTED",
  "REJECTED",
  "CANCELED",
]);

export function isTerminalState(s: CommandProcessingStateEnum): boolean {
  return TERMINAL_STATES.has(s);
}
