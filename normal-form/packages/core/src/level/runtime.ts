// Sheet runtime: run one handler-machine against one seed, tick by tick, and judge
// the goal by world-state (never "message sent"). The command is sent at tick 0 and
// received by SystemB at tick 1 (COMMAND_LATENCY); SystemB schedules its status
// emissions, the seeded bus turns them into deliveries, and the machine reacts.
// Same sheet + same machine + same seed ⇒ byte-identical log (determinism rule).
import { type Delivery, scheduleDeliveries } from "../bus.ts";
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
    | "command-retried"
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
    | "status-shown"
    // classification sheet (0-3):
    | "finding-filed"
    // request-pattern (`-2`) job progression (1-4): QUEUED / PROCESSING / COMPLETED:
    | "request-state"
    // request-run sheet (bonus 1-5): the opening ActionRequest-2 and the player's
    // injected CANCEL:
    | "request-sent"
    | "cancel-injected";
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

/** Determinism guard: retries are budget-bounded, so this cap is only ever hit by a
 *  misconfigured sheet — it keeps the reactive loop total. */
const MAX_RUN_TICKS = 128;

const deliveryEnd = (deliveries: readonly Delivery[], activityTick: number | null): number =>
  deliveries.reduce((m, d) => Math.max(m, d.tick), activityTick ?? 0);

export function runSeed(sheet: Sheet, machine: Machine, seed: Seed): RunResult {
  if (!sheet.opening || !sheet.requestee) {
    throw new Error(`runSeed: sheet ${sheet.id} is not a Command-2 sheet (use runSeedOneWay)`);
  }
  const log: RunEvent[] = [];
  const openingId = sheet.opening.commandId;
  const command: CommandMessage = {
    type: "TaskCommand",
    commandId: openingId,
    commandState: sheet.opening.commandState,
  };
  log.push({ tick: 0, kind: "command-sent", detail: `TaskCommand ${openingId}` });

  // A seed may override the commandee's behaviour (terse / rejecting) for this run.
  const requestee = seed.requestee ?? sheet.requestee;

  // Reactive rounds: attempt 0 is the opening command; every retry the machine emits
  // is a fresh command the commandee responds to. `activeCommandId` is the machine's
  // outstanding command — a status for any *retired* id reads not-correlated, which is
  // exactly the terminal-for-that-CommandID rule (sheet 1-3). Deliveries accumulate;
  // each round is scheduled through the same seed so its ops re-apply to the retry.
  let attempt = 0;
  let activeCommandId = openingId;
  const first = respond(requestee, command, COMMAND_LATENCY, attempt);
  const deliveries: Delivery[] = [...scheduleDeliveries(first.emissions, seed)];
  let activityTick: number | null = first.activityTick;
  let runEnd = sheet.maxTicks ?? deliveryEnd(deliveries, activityTick);

  // World-state clauses name parties by lifeline id: the requestee owns the
  // activity, the player-Commander owns the proof.
  const commanderId = sheet.lifelines.find((l) => l.player)?.id ?? "commander";
  const commandeeId = sheet.lifelines.find((l) => !l.player)?.id ?? "systemB";
  const winAll = sheet.goal.win.all;

  let ms = initialMachineState(machine);
  let activityExecuted = false;
  let goalTick: number | null = null;
  const timeline: WinSnapshot[] = [];
  const processed = new Set<number>(); // delivery indices already reacted (indices are stable — we only append)

  for (let tick = 0; tick <= Math.min(runEnd, MAX_RUN_TICKS); tick++) {
    if (activityTick !== null && tick === activityTick && !activityExecuted) {
      activityExecuted = true;
      log.push({ tick, kind: "activity-executed", detail: "SystemB performed the activity" });
    }

    for (let i = 0; i < deliveries.length; i++) {
      const d = deliveries[i]!;
      if (d.tick !== tick || processed.has(i)) continue;
      processed.add(i);

      const prevFault = ms.fault;
      const status = { type: "TaskCommandStatus", commandId: d.commandId, state: d.state } as const;
      const r = react(machine, ms, status, activeCommandId);
      ms = r.next;
      const tag = d.duplicate ? `${d.state} (dup)` : d.state;
      const reason = d.reason ? ` — ${d.reason}` : "";
      if (r.disposition === "acted") {
        log.push({
          tick,
          kind: "status-delivered",
          detail: `${tag}${reason} → ${ms.terminal ? "terminal" : "wait"}`,
        });
      } else {
        log.push({ tick, kind: "status-dropped", detail: `${tag}${reason} — ${r.disposition}` });
      }
      if (ms.fault && !prevFault) log.push({ tick, kind: "fault", detail: ms.fault });

      // The machine retried: the commandee responds to the fresh command and the old
      // CommandID is retired (its later deliveries now read not-correlated).
      for (const out of r.outbound) {
        attempt += 1;
        activeCommandId = out.commandId;
        log.push({ tick, kind: "command-retried", detail: `TaskCommand ${out.commandId} (retry)` });
        const rr = respond(requestee, out, tick + COMMAND_LATENCY, attempt);
        deliveries.push(...scheduleDeliveries(rr.emissions, seed));
        if (rr.activityTick !== null) activityTick = rr.activityTick;
        runEnd = sheet.maxTicks ?? Math.max(runEnd, deliveryEnd(deliveries, activityTick));
      }
    }

    // Record this tick's world-state, then judge the declarative goal.
    timeline.push({
      activityExecuted: activityExecuted ? new Set([commandeeId]) : EMPTY,
      proofHeld: ms.proofCount >= 1 ? new Set([commanderId]) : EMPTY,
      statusShown: EMPTY,
      datumHeld: EMPTY,
      findingsFiled: EMPTY,
      canceled: EMPTY,
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
