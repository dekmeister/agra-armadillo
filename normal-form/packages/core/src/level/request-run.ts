// The request-run sim path (bonus 1-5 "Cancel Culture"). One ActionRequest-2
// conversation the requestee works QUEUED→PROCESSING→COMPLETED (the activity
// executes at COMPLETED) — unless the player-injected CANCEL is *received by the
// requestee strictly before* it commits COMPLETED, in which case the requestee
// transitions to CANCELED and the activity never runs.
//
// The CANCEL is a declarative plan knob (`cancelAt`, authored/replayable), not a
// live per-tick mutation — `core` stays pure. The knob is folded into the run and
// travels the seeded bus, so a `delay(CANCEL, +n)` seed can push it past the
// COMPLETED commit and lose the race (the lesson): "CANCEL is a request — the bus
// decides the race, and the response tells you who won."
//
// Parallel to `producer/runSeedOneWay`: shares the generalized bus
// (`scheduleGeneric`) and the declarative goal evaluator (`level/goal.ts`). Pure and
// deterministic — same sheet + same cancelAt + same seed ⇒ byte-identical log.
import { type BusItem, scheduleGeneric } from "../bus.ts";
import type { AllSeedsOneWayResult, OneWayRunResult } from "../producer/index.ts";
import type { Seed } from "../seeds.ts";
import { evaluateGoal, type WinSnapshot } from "./goal.ts";
import type { RunEvent } from "./runtime.ts";
import type { Sheet } from "./types.ts";

/** Default request/cancel travel time (requester ↔ requestee). */
const REQUEST_LATENCY = 1;

const EMPTY: ReadonlySet<string> = new Set();

/** Run one cancel plan against one seed on the request-run sheet (1-5). */
export function runSeedRequest(sheet: Sheet, cancelAt: number | null, seed: Seed): OneWayRunResult {
  const spec = sheet.request;
  if (!spec) {
    throw new Error(
      `runSeedRequest: sheet ${sheet.id} has no request spec (use runSeed / runSeedJobs)`,
    );
  }
  const latency = spec.latency ?? REQUEST_LATENCY;
  const requester = sheet.lifelines.find((l) => l.player)?.id ?? "requester";
  const requestee = sheet.lifelines.find((l) => !l.player)?.id ?? "requestee";

  // The requestee's progression, relative to receiving the opening request at `latency`.
  const qTick = latency + spec.queuedAt;
  const pTick = latency + spec.processingAt;
  const completeCommit = latency + spec.completesAt;

  // The CANCEL rides the seeded bus (keyed "CANCEL"): a `delay` pushes its receipt
  // later, a `drop` loses it entirely, a `dup` gets two — the earliest receipt wins.
  let cancelReceived: number | null = null;
  if (cancelAt !== null) {
    const items: BusItem<Record<string, never>>[] = [
      { key: "CANCEL", tick: cancelAt + latency, payload: {} },
    ];
    const delivered = scheduleGeneric<Record<string, never>>(items, seed);
    if (delivered.length > 0) cancelReceived = Math.min(...delivered.map((d) => d.tick));
  }

  // The bus decides the race: a CANCEL received strictly before the COMPLETED commit
  // aborts to CANCELED (no activity); at or after the commit it is a straggler the
  // terminal COMPLETED ignores.
  const canceledInTime = cancelReceived !== null && cancelReceived < completeCommit;
  const terminalState: "CANCELED" | "COMPLETED" = canceledInTime ? "CANCELED" : "COMPLETED";
  const terminalTick = canceledInTime ? (cancelReceived as number) : completeCommit;
  const activityTick = canceledInTime ? null : completeCommit;

  // Per-tick world-state timeline for the goal evaluator. `proofHeld` means the
  // requester holds the terminal response (whichever it is); `canceled`/`activityExecuted`
  // are the requestee's mutually-exclusive terminals.
  const runEnd =
    sheet.maxTicks ?? Math.max(terminalTick, activityTick ?? 0, cancelAt ?? 0, qTick, pTick);
  const timeline: WinSnapshot[] = [];
  for (let tick = 0; tick <= runEnd; tick++) {
    timeline.push({
      activityExecuted:
        activityTick !== null && tick >= activityTick ? new Set([requestee]) : EMPTY,
      proofHeld: tick >= terminalTick ? new Set([requester]) : EMPTY,
      statusShown: EMPTY,
      datumHeld: EMPTY,
      findingsFiled: EMPTY,
      canceled: terminalState === "CANCELED" && tick >= terminalTick ? new Set([requestee]) : EMPTY,
    });
  }

  const winAll = seed.win?.all ?? sheet.goal.win.all;
  const goalTick = evaluateGoal(winAll, timeline);
  const goalText = seed.goalText ?? sheet.goal.text;

  return {
    seedId: seed.id,
    pass: goalTick !== null,
    goalTick,
    log: buildRequestLog({
      cancelAt,
      qTick,
      pTick,
      terminalState,
      terminalTick,
      activityTick,
      goalTick,
      goalText,
    }),
  };
}

export function runAllSeedsRequest(sheet: Sheet, cancelAt: number | null): AllSeedsOneWayResult {
  const results = sheet.seeds.map((seed) => runSeedRequest(sheet, cancelAt, seed));
  return { results, allPass: results.every((r) => r.pass) };
}

interface LogArgs {
  readonly cancelAt: number | null;
  readonly qTick: number;
  readonly pTick: number;
  readonly terminalState: "CANCELED" | "COMPLETED";
  readonly terminalTick: number;
  readonly activityTick: number | null;
  readonly goalTick: number | null;
  readonly goalText: string;
}

/** A deterministic, tick-ordered run log for the replay / console. A state report is
 *  shown only if it precedes the terminal — a CANCEL that lands during QUEUED preempts
 *  PROCESSING, exactly as the requestee would. */
function buildRequestLog(a: LogArgs): RunEvent[] {
  const events: RunEvent[] = [];
  events.push({ tick: 0, kind: "request-sent", detail: "AnalysisRouteRequest NEW →" });
  if (a.cancelAt !== null) {
    events.push({
      tick: a.cancelAt,
      kind: "cancel-injected",
      detail: `CANCEL → (injected at tick ${a.cancelAt})`,
    });
  }
  if (a.qTick < a.terminalTick) {
    events.push({ tick: a.qTick, kind: "request-state", detail: "QUEUED" });
  }
  if (a.pTick < a.terminalTick) {
    events.push({ tick: a.pTick, kind: "request-state", detail: "PROCESSING" });
  }
  if (a.terminalState === "COMPLETED") {
    events.push({ tick: a.terminalTick, kind: "request-state", detail: "COMPLETED" });
    if (a.activityTick !== null) {
      events.push({
        tick: a.activityTick,
        kind: "activity-executed",
        detail: "the requestee ran the activity",
      });
    }
  } else {
    events.push({
      tick: a.terminalTick,
      kind: "request-state",
      detail: "CANCELED — activity not executed",
    });
  }
  if (a.goalTick !== null) {
    events.push({ tick: a.goalTick, kind: "goal-reached", detail: a.goalText });
  }
  return events.sort(
    (x, y) => x.tick - y.tick || x.kind.localeCompare(y.kind) || x.detail.localeCompare(y.detail),
  );
}
