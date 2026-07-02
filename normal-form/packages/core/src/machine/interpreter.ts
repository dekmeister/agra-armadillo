// Handler-machine interpreter. On each status delivered to the Commander it
// enforces, in order: correlation by CommandID (a status that isn't yours is
// ignored), the terminal-state rule (once terminal, further deliveries are
// ignored — UNIS §4.6.2), then the state's rule for the status enum. Acting on a
// second ACCEPTED (holding proof twice) is the seed-③ fault: the tasked activity
// is performed once, so certifying it twice is wrong.
import type { CommandMessage, StatusMessage } from "../types.ts";
import { type Machine, ruleFor } from "./schema.ts";

export interface MachineState {
  readonly state: string;
  /** the machine reported a terminal state and stopped listening */
  readonly terminal: boolean;
  /** ACCEPTED statuses acted upon (proof of the tasked activity) */
  readonly proofCount: number;
  /** TaskCommands sent (initial + retries) */
  readonly commandsSent: number;
  /** terminal responses acted upon (ACCEPTED/REJECTED/CANCELED) — messages metric */
  readonly terminalActed: number;
  /** non-null once a correctness fault is detected (fails the seed) */
  readonly fault: string | null;
}

export type Disposition =
  | "not-correlated" // wrong CommandID — not ours
  | "post-terminal" // dropped by the terminal-state rule
  | "unhandled" // no rule armed in the current state
  | "acted"; // a rule fired

export interface Reaction {
  readonly next: MachineState;
  readonly disposition: Disposition;
  /** commands to send this tick (retry) */
  readonly outbound: readonly CommandMessage[];
}

export function initialMachineState(machine: Machine): MachineState {
  return {
    state: machine.initial,
    terminal: false,
    proofCount: 0,
    commandsSent: 1, // the sheet's opening TaskCommand
    terminalActed: 0,
    fault: null,
  };
}

const TERMINAL = new Set(["ACCEPTED", "REJECTED", "CANCELED"]);

/** Process one delivered status against the machine. Pure. */
export function react(
  machine: Machine,
  ms: MachineState,
  status: StatusMessage,
  myCommandId: string,
): Reaction {
  const noop = (disposition: Disposition): Reaction => ({ next: ms, disposition, outbound: [] });

  if (status.commandId !== myCommandId) return noop("not-correlated");
  if (ms.terminal) return noop("post-terminal");

  const rule = ruleFor(machine, ms.state, status.state);
  if (!rule) return noop("unhandled");

  const gainedProof = status.state === "ACCEPTED";
  const proofCount = ms.proofCount + (gainedProof ? 1 : 0);
  const terminalActed = ms.terminalActed + (TERMINAL.has(status.state) ? 1 : 0);
  const fault =
    ms.fault ??
    (proofCount > 1
      ? "double-proof: acted on a duplicate ACCEPTED after already holding proof (UNIS §4.6.2 terminal-state rule)"
      : null);

  const outbound: CommandMessage[] = [];
  let commandsSent = ms.commandsSent;
  let terminal: boolean = ms.terminal;

  if (rule.action === "terminal") {
    terminal = true;
  } else if (rule.action === "retry" && (rule.budget ?? 0) > 0) {
    // A retry is a NEW command with a fresh UUID (terminal states ignore UPDATEs).
    // Deterministic id derivation — no RNG.
    commandsSent += 1;
    outbound.push({
      type: "TaskCommand",
      commandId: `${myCommandId}#retry${commandsSent - 1}`,
      commandState: "NEW",
    });
  }

  return {
    next: {
      state: rule.target ?? ms.state,
      terminal,
      proofCount,
      commandsSent,
      terminalActed,
      fault,
    },
    disposition: "acted",
    outbound,
  };
}
