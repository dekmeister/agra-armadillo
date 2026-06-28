/**
 * Headless parameter-sweep harness — the "RF sandbox".
 *
 * Runs the deterministic core over a band of seeds under a chosen recovery
 * strategy and emits a CSV of {seed, outcome, completionTick, failReason}.
 * Because the sim is a pure function of (scenario, seed), the same invocation
 * reproduces byte-identically — so you can sweep p_loss / burstiness / policy and
 * plot outcome distributions without a browser in the loop.
 *
 * Usage:
 *   npm run sweep -- scenarios/phase6.json --seeds 1000 --strategy edf --at 4
 *   npm run sweep -- scenarios/phase6.json --seed 1..200 --strategy reroute
 *   npm run sweep -- scenarios/phase6.json --compare --seeds 500
 *
 * Strategies: none|fifo (do nothing) · edf · class · reroute · rerequest.
 * CSV goes to stdout; a summary goes to stderr.
 */
import { readFileSync } from "node:fs";
import type { Action, GameState, QueuePolicy } from "@service-bus/core";
import { apply, createInitialState, tick } from "@service-bus/core";

type Strategy = "none" | "fifo" | "edf" | "class" | "reroute" | "rerequest";
const STRATEGIES: Strategy[] = ["none", "edf", "class", "reroute", "rerequest"];

interface Args {
  scenarioPath: string | null;
  seedLo: number;
  seedHi: number;
  strategy: Strategy;
  at: number;
  maxTicks: number;
  compare: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    scenarioPath: null,
    seedLo: 1,
    seedHi: 200,
    strategy: "none",
    at: 4,
    maxTicks: 60,
    compare: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;
    if (!arg.startsWith("--") && arg.endsWith(".json")) {
      a.scenarioPath = arg;
    } else if (arg === "--compare") {
      a.compare = true;
    } else if (arg === "--seeds") {
      a.seedHi = Number(argv[++i]);
      a.seedLo = 1;
    } else if (arg === "--seed") {
      const [lo, hi] = String(argv[++i]).split("..");
      a.seedLo = Number(lo);
      a.seedHi = hi === undefined ? Number(lo) : Number(hi);
    } else if (arg === "--strategy") {
      a.strategy = argv[++i] as Strategy;
    } else if (arg === "--at") {
      a.at = Number(argv[++i]);
    } else if (arg === "--max") {
      a.maxTicks = Number(argv[++i]);
    }
  }
  return a;
}

function loadConfig(path: string | null): Record<string, unknown> {
  if (!path) return {};
  const raw = JSON.parse(readFileSync(path, "utf8")) as { config?: Record<string, unknown> };
  return raw.config ?? {};
}

function recoveryAction(strategy: Strategy): Action | null {
  switch (strategy) {
    case "edf":
      return { type: "setPolicy", linkId: "bad", policy: "edf" as QueuePolicy };
    case "class":
      return { type: "setPolicy", linkId: "bad", policy: "class" as QueuePolicy };
    case "reroute":
      return { type: "reroute" };
    case "rerequest":
      return { type: "rerequest" };
    default:
      return null;
  }
}

interface Result {
  seed: number;
  outcome: GameState["outcome"];
  completionTick: number;
  failReason: string;
}

function runOne(
  seed: number,
  config: Record<string, unknown>,
  strategy: Strategy,
  at: number,
  maxTicks: number,
): Result {
  let s = createInitialState(seed, { config });
  s = apply(s, { type: "arm" });
  const action = recoveryAction(strategy);

  for (let t = 1; t <= maxTicks; t++) {
    s = tick(s);
    if (action && s.tick === at) s = apply(s, action);
    if (s.outcome !== "pending") break;
  }
  return {
    seed,
    outcome: s.outcome,
    completionTick: s.tick,
    failReason: s.failReason ?? "",
  };
}

function sweep(args: Args, config: Record<string, unknown>, strategy: Strategy): Result[] {
  const out: Result[] = [];
  for (let seed = args.seedLo; seed <= args.seedHi; seed++) {
    out.push(runOne(seed, config, strategy, args.at, args.maxTicks));
  }
  return out;
}

function winRate(results: Result[]): number {
  return results.filter((r) => r.outcome === "win").length / results.length;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.scenarioPath);

  if (args.compare) {
    process.stderr.write(
      `Comparing strategies over seeds ${args.seedLo}..${args.seedHi} (recovery @ tick ${args.at}):\n`,
    );
    process.stdout.write("strategy,win_rate,wins,n\n");
    for (const strat of STRATEGIES) {
      const r = sweep(args, config, strat);
      const wins = r.filter((x) => x.outcome === "win").length;
      process.stdout.write(`${strat},${winRate(r).toFixed(3)},${wins},${r.length}\n`);
    }
    return;
  }

  const results = sweep(args, config, args.strategy);
  process.stdout.write("seed,outcome,completion_tick,fail_reason\n");
  for (const r of results) {
    process.stdout.write(`${r.seed},${r.outcome},${r.completionTick},"${r.failReason}"\n`);
  }
  process.stderr.write(
    `\n${args.strategy}: win rate ${(winRate(results) * 100).toFixed(1)}% over ${results.length} seeds (recovery @ tick ${args.at}).\n`,
  );
}

main();
