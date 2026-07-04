// Turn the engine's pure RunResult into a board model the SVG renders. The UI
// derives frames from engine output — it never re-scripts the sim (PLAN_MVP S4).
// Each response arrow sits at the tick it was delivered (the vertical time axis),
// so reorder/dup seeds render as real out-of-order / repeated arrows rather than
// fixed tracks.
import type { CommandProcessingStateEnum, RunEvent, RunResult } from "@normal-form/core";
import { ENUM_COLOR, ZONE } from "./tokens.ts";

export interface ArrowFrame {
  readonly key: string;
  readonly dir: "request" | "response";
  /** vertical position on the time ruler */
  readonly tick: number;
  readonly label: string;
  readonly color: string;
  readonly state?: CommandProcessingStateEnum;
  /** dashed shaft (unset placeholder, or a delivery the machine ignored) */
  readonly dashed?: boolean;
  /** dimmed (a post-terminal / uncorrelated delivery that was dropped) */
  readonly muted?: boolean;
  /** ✔ glyph — the terminal ACCEPTED that certifies proof */
  readonly check?: boolean;
}

export interface BoardModel {
  readonly arrows: readonly ArrowFrame[];
  readonly endTick: number;
  readonly goalTick: number | null;
  readonly fault: { readonly tick: number; readonly detail: string } | null;
  /** tick SystemB performed the tasked activity (world-state), for a lifeline mark */
  readonly activityTick: number | null;
}

const ENUM_NAMES: readonly CommandProcessingStateEnum[] = [
  "RECEIVED",
  "ACCEPTED",
  "REJECTED",
  "CANCELED",
];

function stateOf(detail: string): CommandProcessingStateEnum | undefined {
  return ENUM_NAMES.find((n) => detail.includes(n));
}

function responseLabel(state: CommandProcessingStateEnum, dup: boolean, check: boolean): string {
  const suffix = dup ? " (dup)" : check ? " ✔" : "";
  return `← ${state}${suffix}`;
}

/** Build the board model for a single seed's run. */
export function runFrames(result: RunResult): BoardModel {
  const arrows: ArrowFrame[] = [];
  let goalTick: number | null = null;
  let fault: BoardModel["fault"] = null;
  let activityTick: number | null = null;
  let endTick = 0;
  let i = 0;

  for (const ev of result.log as readonly RunEvent[]) {
    endTick = Math.max(endTick, ev.tick);
    switch (ev.kind) {
      case "command-sent":
        arrows.push({
          key: `req-${i}`,
          dir: "request",
          tick: ev.tick,
          label: "TaskCommand →",
          color: ZONE.oneWay,
        });
        break;
      case "status-delivered":
      case "status-dropped": {
        const state = stateOf(ev.detail);
        if (!state) break;
        const dup = ev.detail.includes("(dup)");
        const dropped = ev.kind === "status-dropped";
        const check = !dropped && state === "ACCEPTED" && ev.detail.includes("terminal");
        arrows.push({
          key: `res-${i}`,
          dir: "response",
          tick: ev.tick,
          label: responseLabel(state, dup, check),
          color: ENUM_COLOR[state],
          state,
          dashed: dropped,
          muted: dropped,
          check,
        });
        break;
      }
      case "activity-executed":
        activityTick = ev.tick;
        break;
      case "goal-reached":
        if (goalTick === null) goalTick = ev.tick;
        break;
      case "fault":
        if (!fault) fault = { tick: ev.tick, detail: ev.detail };
        break;
    }
    i++;
  }

  return { arrows, endTick, goalTick, fault, activityTick };
}
