// Sheet runtime: run one handler-machine against one seed, tick by tick, and judge
// the goal by world-state (never "message sent"). The command is sent at tick 0 and
// received by SystemB at tick 1 (COMMAND_LATENCY); SystemB schedules its status
// emissions, the seeded bus turns them into deliveries, and the machine reacts.
// Same sheet + same machine + same seed ⇒ byte-identical log (determinism rule).
import { scheduleDeliveries } from "../bus.ts";
import { initialMachineState, type MachineState, react } from "../machine/interpreter.ts";
import type { Machine } from "../machine/schema.ts";
import { respond } from "../requestee/index.ts";
import type { Seed } from "../seeds.ts";
import type { CommandMessage } from "../types.ts";
import { goalHoldsAt, type WinSnapshot } from "./goal.ts";
import type { Sheet } from "./types.ts";

/** Ticks between the Commander sending the command and SystemB receiving it. */
export const COMMAND_LATENCY = 1;

export interface RunEvent {
  readonly tick: number;
  readonly kind:
    | "command-sent"
    | "activity-executed"
    | "status-delivered"
    | "status-dropped"
    | "goal-reached"
    | "fault"
    // one-way (`-1`) producer path (see producer/):
    | "published"
    | "datum-delivered"
    | "datum-stale"
    | "datum-dropped"
    | "status-shown";
  readonly detail: string;
}

const EMPTY: ReadonlySet<string> = new Set();

export interface RunResult {
  readonly seedId: number;
  readonly pass: boolean;
  /** first tick the goal world-state held (for the Ticks metric), else null */
  readonly goalTick: number | null;
  readonly fault: string | null;
  readonly activityExecuted: boolean;
  readonly machine: MachineState;
  readonly log: readonly RunEvent[];
}

export function runSeed(sheet: Sheet, machine: Machine, seed: Seed): RunResult {
  if (!sheet.opening || !sheet.requestee) {
    throw new Error(`runSeed: sheet ${sheet.id} is not a Command-2 sheet (use runSeedOneWay)`);
  }
  const log: RunEvent[] = [];
  const commandId = sheet.opening.commandId;
  const command: CommandMessage = {
    type: "TaskCommand",
    commandId,
    commandState: sheet.opening.commandState,
  };
  log.push({ tick: 0, kind: "command-sent", detail: `TaskCommand ${commandId}` });

  const receiptTick = COMMAND_LATENCY;
  const { emissions, activityTick } = respond(sheet.requestee, command, receiptTick);
  const deliveries = scheduleDeliveries(emissions, seed);

  const lastDelivery = deliveries.reduce((m, d) => Math.max(m, d.tick), 0);
  const runEnd = sheet.maxTicks ?? Math.max(lastDelivery, activityTick ?? 0);

  // World-state clauses name parties by lifeline id: the requestee owns the
  // activity, the player-Commander owns the proof.
  const commanderId = sheet.lifelines.find((l) => l.player)?.id ?? "commander";
  const commandeeId = sheet.lifelines.find((l) => !l.player)?.id ?? "systemB";
  const winAll = sheet.goal.win.all;

  let ms = initialMachineState(machine);
  let activityExecuted = false;
  let goalTick: number | null = null;
  const timeline: WinSnapshot[] = [];

  for (let tick = 0; tick <= runEnd; tick++) {
    if (activityTick !== null && tick === activityTick && !activityExecuted) {
      activityExecuted = true;
      log.push({ tick, kind: "activity-executed", detail: "SystemB performed the activity" });
    }

    for (const d of deliveries.filter((x) => x.tick === tick)) {
      const prevFault = ms.fault;
      const status = { type: "TaskCommandStatus", commandId: d.commandId, state: d.state } as const;
      const r = react(machine, ms, status, commandId);
      ms = r.next;
      const tag = d.duplicate ? `${d.state} (dup)` : d.state;
      if (r.disposition === "acted") {
        log.push({
          tick,
          kind: "status-delivered",
          detail: `${tag} → ${ms.terminal ? "terminal" : "wait"}`,
        });
      } else {
        log.push({ tick, kind: "status-dropped", detail: `${tag} — ${r.disposition}` });
      }
      if (ms.fault && !prevFault) log.push({ tick, kind: "fault", detail: ms.fault });
    }

    // Record this tick's world-state, then judge the declarative goal.
    timeline.push({
      activityExecuted: activityExecuted ? new Set([commandeeId]) : EMPTY,
      proofHeld: ms.proofCount >= 1 ? new Set([commanderId]) : EMPTY,
      statusShown: EMPTY,
      datumHeld: EMPTY,
    });
    if (goalTick === null && goalHoldsAt(winAll, timeline, tick)) {
      goalTick = tick;
      log.push({ tick, kind: "goal-reached", detail: sheet.goal.text });
    }
  }

  const pass = goalTick !== null && ms.fault === null;
  return { seedId: seed.id, pass, goalTick, fault: ms.fault, activityExecuted, machine: ms, log };
}

export interface AllSeedsResult {
  readonly results: readonly RunResult[];
  readonly allPass: boolean;
}

export function runAllSeeds(sheet: Sheet, machine: Machine): AllSeedsResult {
  const results = sheet.seeds.map((seed) => runSeed(sheet, machine, seed));
  return { results, allPass: results.every((r) => r.pass) };
}
