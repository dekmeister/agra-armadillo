/**
 * View-model derivations (WP4.1 / WP4.5a).
 *
 * The headline assertion is the reroute one: taking the CORRECT recovery action must
 * clear the red MISSING-ACK alarm and keep it clear. Before WP4, `"missing"` was the
 * fallback branch of `heroReply`, so a reply flying happily down the relay path kept its
 * red spinning-"?" treatment — the reward for the right decision was an unchanged alarm.
 */
import type { Action, GameState } from "@service-bus/core";
import { apply, createInitialState, SCENARIOS, tick } from "@service-bus/core";
import { describe, expect, it } from "vitest";
import { heroReply, highlightFor, linkView } from "../src/lib/sim-adapter.ts";

const PHASE6 = SCENARIOS.phase6;

/** Advance phase 6 on its tutorial seed, applying actions at the given ticks. */
function run(actions: Record<number, Action[]> = {}, maxTicks = 30): GameState[] {
  let s = createInitialState(PHASE6?.tutorialSeed ?? 1412, { scenarioId: "phase6" });
  s = apply(s, { type: "arm" });
  const frames: GameState[] = [s];
  for (let t = 1; t <= maxTicks; t++) {
    s = tick(s);
    for (const a of actions[s.tick] ?? []) s = apply(s, a);
    frames.push(s);
    if (s.outcome !== "pending") break;
  }
  return frames;
}

describe("heroReply ack state", () => {
  it("shows MISSING ACK on a stalled reply", () => {
    const frames = run();
    const missing = frames.filter((f) => heroReply(f)?.ack === "missing");
    expect(missing.length, "the stalled-reply alarm never appears").toBeGreaterThan(0);
  });

  it("clears the alarm the moment the reply is rerouted — and keeps it clear", () => {
    const frames = run({ 13: [{ type: "reroute" }] });
    const after = frames.slice(14);
    expect(after.length).toBeGreaterThan(0);

    const rerouted = after.filter((f) => heroReply(f)?.ack === "rerouted");
    expect(rerouted.length, "the rerouted state never appears").toBeGreaterThan(0);
    expect(rerouted[0] && heroReply(rerouted[0])?.label).toBe("REROUTED · EN ROUTE");

    // The invariant that WP4.1 exists for: no red alarm on a recovering reply.
    for (const f of after) {
      const h = heroReply(f);
      if (!h || f.outcome === "loss") continue;
      expect(h.ack, `reply reverted to MISSING ACK at T+${f.tick} after a reroute`).not.toBe(
        "missing",
      );
    }
  });

  it("still reports delivery and failure correctly", () => {
    const won = run({ 13: [{ type: "reroute" }] }).at(-1);
    if (won?.outcome === "win") expect(heroReply(won)?.ack).toBe("sent");
    const lost = run().at(-1);
    if (lost?.outcome === "loss") expect(heroReply(lost)?.ack).toBe("fail");
  });
});

describe("selection highlights", () => {
  it("highlights every link along its own rail path, on every board", () => {
    for (const id of Object.keys(SCENARIOS)) {
      const gs = createInitialState(1, { scenarioId: id });
      for (const l of Object.values(gs.links)) {
        const hl = highlightFor(gs, { type: "link", id: l.id });
        expect(hl?.kind, `${id}/${l.id} is not highlighted as a rail`).toBe("rail");
        // Anti-drift: the glow must trace the SAME path the rail is drawn along, or the
        // highlight slowly stops meaning "this link".
        if (hl?.kind === "rail") {
          expect(hl.d, `${id}/${l.id} highlight path != rail path`).toBe(linkView(gs, l.id)?.d);
          expect(hl.width).toBe(linkView(gs, l.id)?.width);
        }
      }
    }
  });

  it("rings nodes and defers tokens to the view", () => {
    const gs = createInitialState(1, { scenarioId: "phase6" });
    expect(highlightFor(gs, { type: "node", id: "qb" })?.kind).toBe("circle");
    expect(highlightFor(gs, { type: "token", id: "whatever" })).toBeNull();
    expect(highlightFor(gs, null)).toBeNull();
  });
});

/**
 * The Objective card's status pill (WP4 deferral → WP6.4).
 *
 * WP4 fixed the *token* so a rerouted reply stopped wearing the red MISSING-ACK treatment,
 * but left the Objective card reading STALLED — same complaint, different surface, and it
 * was explicitly handed to WP6. The pairing here is deliberate: both assertions must hold,
 * or the board and the card are telling the player different stories again.
 */
describe("objective status", () => {
  it("reads STALLED while the reply is stuck on the BAD link", () => {
    const frames = run();
    expect(
      frames.some((f) => f.objective === "stalled"),
      "STALLED never appears — the alarm has gone dead, not quiet",
    ).toBe(true);
  });

  it("clears STALLED once the reply is rerouted onto the clean relay", () => {
    const frames = run({ 13: [{ type: "reroute" }] });
    const after = frames.slice(14).filter((f) => f.outcome === "pending");
    expect(after.length).toBeGreaterThan(0);
    expect(
      after.every((f) => f.objective !== "stalled"),
      "the card still says STALLED after the correct recovery",
    ).toBe(true);
  });
});
