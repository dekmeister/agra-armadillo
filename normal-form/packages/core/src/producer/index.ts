// The one-way (`-1`) producer sim path (WS-E). Status-1 / Data-1 have no response
// enum and are terminal-on-send, so the player's authored artifact is not a
// reactive handler machine but a *publish plan*: when to first publish and how
// often to republish. The producer fans each publication out to every consumer;
// the seeded bus drops/delays/reorders those publications; the goal is judged at
// the consumer (a status shown by a deadline, or a datum held continuously).
//
// Parallel to `level/runtime.ts` `runSeed` (Command-2) — it shares the generalized
// bus (`scheduleGeneric`) and the declarative goal evaluator (`level/goal.ts`).
// Pure and deterministic: same sheet + same plan + same seed ⇒ byte-identical log.
import { type BusItem, scheduleGeneric } from "../bus.ts";
import { evaluateGoal, filedKey, type WinSnapshot } from "../level/goal.ts";
import type { RunEvent } from "../level/runtime.ts";
import { correctPatternFor, type Job, type Sheet } from "../level/types.ts";
import type { Seed } from "../seeds.ts";
import type { Session } from "../session/index.ts";

/** Ticks between a publish and its receipt at a consumer (default). */
export const PUBLISH_LATENCY = 1;

const EMPTY: ReadonlySet<string> = new Set();

/** The player's artifact on a `-1` sheet: publish at `startTick`, then again every
 *  `everyN` ticks, `count` times total (`count: 1` ⇒ a single fire-and-forget). */
export interface PublishPlan {
  readonly id?: string;
  readonly startTick: number;
  readonly everyN: number;
  readonly count: number;
}

/** The producer-local ticks at which the plan publishes. */
export function publishTicks(plan: PublishPlan): number[] {
  const ticks: number[] = [];
  for (let i = 0; i < plan.count; i++) ticks.push(plan.startTick + i * plan.everyN);
  return ticks;
}

/** Safety cap on derived publish count (keeps the pure sim bounded). */
const MAX_PUBLISH_COUNT = 64;

/** Turn the two player knobs — first-publish tick + republish cadence — into a
 *  full plan, auto-filling `count` to cover the sheet's goal horizon. `everyN <= 0`
 *  means a single fire-and-forget (the default that leaves `-1` hold sheets broken).
 */
export function derivePublishPlan(sheet: Sheet, startTick: number, everyN: number): PublishPlan {
  const start = Math.max(0, Math.floor(startTick));
  if (everyN <= 0) return { startTick: start, everyN: 0, count: 1 };
  const step = Math.floor(everyN);
  const latency = sheet.oneway?.latency ?? PUBLISH_LATENCY;
  const horizon = goalHorizon(sheet);
  const count = Math.min(
    MAX_PUBLISH_COUNT,
    Math.max(1, Math.ceil((horizon + latency - start) / step) + 1),
  );
  return { startTick: start, everyN: step, count };
}

export interface OneWayRunResult {
  readonly seedId: number;
  readonly pass: boolean;
  /** first tick the goal world-state held, else null */
  readonly goalTick: number | null;
  readonly log: readonly RunEvent[];
}

interface PubPayload {
  readonly consumer: string;
  readonly send: number;
}

/** Does consumer with sorted `receipts` hold a fresh datum at tick `t`? A datum is
 *  held for `staleAfter` ticks after each receipt; a later receipt refreshes it. */
function heldAt(receipts: readonly number[], t: number, staleAfter: number): boolean {
  return receipts.some((r) => r <= t && t - r <= staleAfter);
}

/** The latest tick any goal clause cares about (deadline / interval end). */
function goalHorizon(sheet: Sheet): number {
  let max = 0;
  for (const c of sheet.goal.win.all) {
    if ("statusShownBy" in c) max = Math.max(max, c.statusShownBy.byTick);
    else if ("heldContinuously" in c) max = Math.max(max, c.heldContinuously.toTick);
  }
  return max;
}

/** Run one publish plan against one seed on a `-1` sheet. */
export function runSeedOneWay(sheet: Sheet, plan: PublishPlan, seed: Seed): OneWayRunResult {
  const latency = sheet.oneway?.latency ?? PUBLISH_LATENCY;
  // No staleness configured ⇒ a received datum is held indefinitely (deadline
  // goals never read `datumHeld`, so this only matters to hold goals, which set it).
  const staleAfter = sheet.oneway?.staleAfter ?? Number.POSITIVE_INFINITY;
  const consumers = sheet.lifelines.filter((l) => !l.player).map((l) => l.id);
  const ticks = publishTicks(plan);

  // Fan every publish out to every consumer; the bus keys them `s<send>:<consumer>`
  // so a seed can drop one link (`s0:c2`) or a whole broadcast (`s0`).
  const items: BusItem<PubPayload>[] = [];
  ticks.forEach((t, send) => {
    for (const consumer of consumers) {
      items.push({ key: `s${send}:${consumer}`, tick: t + latency, payload: { consumer, send } });
    }
  });
  const delivered = scheduleGeneric<PubPayload>(items, seed);

  // Per-consumer receipt ticks (sorted for deterministic staleness checks).
  const receipts = new Map<string, number[]>();
  for (const c of consumers) receipts.set(c, []);
  for (const d of delivered) receipts.get(d.payload.consumer)!.push(d.tick);
  for (const list of receipts.values()) list.sort((a, b) => a - b);

  const lastDelivery = delivered.reduce((m, d) => Math.max(m, d.tick), 0);
  const runEnd = sheet.maxTicks ?? Math.max(lastDelivery, goalHorizon(sheet));

  // Per-tick world-state timeline for the goal evaluator.
  const timeline: WinSnapshot[] = [];
  const shownSoFar = new Set<string>();
  for (let tick = 0; tick <= runEnd; tick++) {
    for (const [c, rs] of receipts) if (rs.some((r) => r <= tick)) shownSoFar.add(c);
    const datumHeld = new Set<string>();
    for (const [c, rs] of receipts) if (heldAt(rs, tick, staleAfter)) datumHeld.add(c);
    timeline.push({
      activityExecuted: EMPTY,
      proofHeld: EMPTY,
      statusShown: new Set(shownSoFar),
      datumHeld,
      findingsFiled: EMPTY,
    });
  }

  const goalTick = evaluateGoal(sheet.goal.win.all, timeline);
  return {
    seedId: seed.id,
    pass: goalTick !== null,
    goalTick,
    log: buildLog(sheet, plan, delivered, items, goalTick),
  };
}

export interface AllSeedsOneWayResult {
  readonly results: readonly OneWayRunResult[];
  readonly allPass: boolean;
}

export function runAllSeedsOneWay(sheet: Sheet, plan: PublishPlan): AllSeedsOneWayResult {
  const results = sheet.seeds.map((seed) => runSeedOneWay(sheet, plan, seed));
  return { results, allPass: results.every((r) => r.pass) };
}

/** A deterministic, tick-ordered run log for the replay / console. */
function buildLog(
  sheet: Sheet,
  plan: PublishPlan,
  delivered: readonly { tick: number; duplicate: boolean; payload: PubPayload }[],
  items: readonly BusItem<PubPayload>[],
  goalTick: number | null,
): RunEvent[] {
  const events: RunEvent[] = [];
  const consumers = sheet.lifelines.filter((l) => !l.player).map((l) => l.id);

  publishTicks(plan).forEach((t, send) => {
    events.push({
      tick: t,
      kind: "published",
      detail: `send #${send} → ${consumers.length} consumer(s)`,
    });
  });

  const deliveredKeys = new Set(delivered.map((d) => `s${d.payload.send}:${d.payload.consumer}`));
  for (const it of items) {
    if (!deliveredKeys.has(it.key)) {
      events.push({ tick: it.tick, kind: "datum-dropped", detail: it.key });
    }
  }
  for (const d of delivered) {
    const tag = d.duplicate ? " (dup)" : "";
    events.push({
      tick: d.tick,
      kind: "datum-delivered",
      detail: `${d.payload.consumer} ← send #${d.payload.send}${tag}`,
    });
  }
  if (goalTick !== null) {
    events.push({ tick: goalTick, kind: "goal-reached", detail: sheet.goal.text });
  }

  // Stable order: by tick, then by kind, then by detail (all pure strings).
  return events.sort(
    (a, b) => a.tick - b.tick || a.kind.localeCompare(b.kind) || a.detail.localeCompare(b.detail),
  );
}

// --- Classification sheet (0-3) sim path -----------------------------------
// A jobs sheet has no single composition or publish plan; the player's artifact is
// a per-job pattern assignment (+ filed findings). Each job whose ask is served by a
// `-1` primitive delivers to its party *iff* the correct pattern is assigned; the
// request job has no reachable `-1` world-state and is passed only by filing the
// wrong-palette finding. Parallel to `runSeedOneWay`, sharing the generalized bus +
// goal evaluator. Pure/deterministic: same sheet + same session + same seed ⇒
// byte-identical log.

interface JobPayload {
  readonly job: Job;
}

/** All filed-finding timeline keys for a session (constant across ticks). */
function filedKeys(session: Session): Set<string> {
  const keys = new Set<string>();
  for (const [job, codes] of Object.entries(session.filed)) {
    for (const code of codes) keys.add(filedKey(job, code));
  }
  return keys;
}

/** Run one job assignment against one seed on a classification sheet (0-3). */
export function runSeedJobs(sheet: Sheet, session: Session, seed: Seed): OneWayRunResult {
  const latency = sheet.oneway?.latency ?? PUBLISH_LATENCY;
  const jobs = sheet.jobs ?? [];

  // A job publishes to its party once, at `latency`, only when the correct pattern
  // is assigned (a wrong/absent pattern — or a trap job — delivers nothing).
  const items: BusItem<JobPayload>[] = [];
  for (const job of jobs) {
    const correct = correctPatternFor(job.ask);
    if (correct !== null && session.jobPatterns[job.id] === correct) {
      items.push({ key: job.id, tick: latency, payload: { job } });
    }
  }
  const delivered = scheduleGeneric<JobPayload>(items, seed);

  // Per-party receipts split by kind: status → a shown deadline, datum → a hold
  // (0-3 sets no `staleAfter`, so a received datum is held from receipt onward).
  const statusReceipts = new Map<string, number[]>();
  const datumReceipts = new Map<string, number[]>();
  for (const d of delivered) {
    const { job } = d.payload;
    const map = job.ask === "datum" ? datumReceipts : statusReceipts;
    (map.get(job.party) ?? map.set(job.party, []).get(job.party)!).push(d.tick);
  }

  const filed = filedKeys(session);
  const lastDelivery = delivered.reduce((m, d) => Math.max(m, d.tick), 0);
  const runEnd = sheet.maxTicks ?? Math.max(lastDelivery, goalHorizon(sheet));

  const timeline: WinSnapshot[] = [];
  for (let tick = 0; tick <= runEnd; tick++) {
    const statusShown = new Set<string>();
    for (const [party, rs] of statusReceipts) if (rs.some((r) => r <= tick)) statusShown.add(party);
    const datumHeld = new Set<string>();
    for (const [party, rs] of datumReceipts) if (rs.some((r) => r <= tick)) datumHeld.add(party);
    timeline.push({
      activityExecuted: EMPTY,
      proofHeld: EMPTY,
      statusShown,
      datumHeld,
      findingsFiled: filed,
    });
  }

  const goalTick = evaluateGoal(sheet.goal.win.all, timeline);
  return {
    seedId: seed.id,
    pass: goalTick !== null,
    goalTick,
    log: buildJobsLog(sheet, session, delivered, goalTick),
  };
}

export function runAllSeedsJobs(sheet: Sheet, session: Session): AllSeedsOneWayResult {
  const results = sheet.seeds.map((seed) => runSeedJobs(sheet, session, seed));
  return { results, allPass: results.every((r) => r.pass) };
}

/** A deterministic, tick-ordered run log for the 0-3 replay / console. */
function buildJobsLog(
  sheet: Sheet,
  session: Session,
  delivered: readonly { tick: number; payload: JobPayload }[],
  goalTick: number | null,
): RunEvent[] {
  const events: RunEvent[] = [];
  for (const d of delivered) {
    const { job } = d.payload;
    events.push({
      tick: d.tick,
      kind: job.ask === "datum" ? "datum-delivered" : "status-shown",
      detail: `${job.party} ← ${job.id} (${session.jobPatterns[job.id] ?? "—"})`,
    });
  }
  for (const [job, codes] of Object.entries(session.filed)) {
    for (const code of codes) {
      events.push({ tick: 0, kind: "finding-filed", detail: `${job}: ${code}` });
    }
  }
  if (goalTick !== null) {
    events.push({ tick: goalTick, kind: "goal-reached", detail: sheet.goal.text });
  }
  return events.sort(
    (a, b) => a.tick - b.tick || a.kind.localeCompare(b.kind) || a.detail.localeCompare(b.detail),
  );
}
