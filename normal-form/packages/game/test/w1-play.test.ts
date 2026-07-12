// WS-F playtest (headless, deterministic): the new World 1 sheets 1-2, 1-3, and 1-4
// are playable end-to-end through the *real* store actions the UI dispatches
// (selectSheet / place / setField / setHandler / setGate / assignPattern) against the
// *real* core sim. It proves the arrives-broken → fix → certify loop and that the
// guaranteed lesson (a naive choice *must* fail first) holds — the same contract
// w0-play.test.ts pins for World 0.
//
// As in w0-play, the play screen is not rendered after mutating the store (zustand v5
// SSR reads initial state); we assert the pure derivations + a mount smoke instead.
import {
  buildComposition,
  buildMachine,
  runAllSeeds,
  runAllSeedsJobs,
  runSeed,
  validate,
} from "@normal-form/core";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Board } from "../src/Board.tsx";
import { runFrames } from "../src/frames.ts";
import { Inspector } from "../src/Inspector.tsx";
import { useGameStore } from "../src/store.ts";

const s = () => useGameStore.getState();
const findingsCount = () => validate(s().sheet, buildComposition(s().sheet, s().session)).length;
/** Does the player's own wired machine certify on every seed? */
const certifies = () => runAllSeeds(s().sheet, buildMachine(s().session)).allPass;

describe("W1 1-2 Skipping the Pleasantries — RECEIVED is a courtesy", () => {
  it("the pre-checked gate fails the terse seed; ungating + wiring certifies", () => {
    s().selectSheet("1-2");
    s().place();

    // The Command-2 board + inspector mount on real sheet data without throwing.
    expect(() => renderToString(createElement(Board))).not.toThrow();
    expect(() => renderToString(createElement(Inspector))).not.toThrow();

    // Arrives broken: missing SystemID blocks RUN until filled.
    expect(findingsCount()).toBeGreaterThan(0);
    s().setField("SystemID", "SYS-ALPHA");

    // Wire the naive machine — but the gate ships ON (require RECEIVED first).
    s().setHandler("RECEIVED", "wait");
    s().setHandler("ACCEPTED", "terminal");
    expect(s().session.gateAccepted).toBe(true);
    // The terse seed (no RECEIVED) hangs a gated machine — the guaranteed lesson.
    expect(certifies()).toBe(false);

    // Remove the inherited ordering assumption → all three seeds pass.
    s().setGate(false);
    expect(certifies()).toBe(true);
  });
});

describe("W1 1-3 Rejection Letter — REJECTED kills the CommandID", () => {
  it("a machine that doesn't retry never runs the activity; retry-as-NEW certifies", () => {
    s().selectSheet("1-3");
    s().place();

    expect(() => renderToString(createElement(Board))).not.toThrow();
    expect(() => renderToString(createElement(Inspector))).not.toThrow();

    s().setField("SystemID", "SYS-BRAVO");
    s().setGate(false);

    // Wire RECEIVED/ACCEPTED but leave REJECTED unhandled: the first command is
    // rejected and the activity never runs.
    s().setHandler("RECEIVED", "wait");
    s().setHandler("ACCEPTED", "terminal");
    expect(certifies()).toBe(false);

    // Retry-as-NEW recovers the rejection → certifies on all seeds.
    s().setHandler("REJECTED", "retry");
    expect(certifies()).toBe(true);

    // The board renders the retry round: two request arrows (opening + the ↻ retry)
    // plus the retry's response arrows — the log-driven frames handle the new event.
    const seed1 = s().sheet.seeds[0]!;
    const model = runFrames(runSeed(s().sheet, buildMachine(s().session), seed1));
    const requests = model.arrows.filter((a) => a.dir === "request");
    expect(requests).toHaveLength(2);
    expect(requests.some((a) => a.label.includes("↻"))).toBe(true);
    expect(model.goalTick).not.toBeNull();
  });
});

describe("W1 1-4 Request Is Not Command — classification of the -2 patterns", () => {
  it("Command-2 on a request job dead-ends it; the right -2 patterns certify", () => {
    s().selectSheet("1-4");

    // The jobs board + triage editor mount on real -2 sheet data without throwing.
    expect(() => renderToString(createElement(Board))).not.toThrow();
    expect(() => renderToString(createElement(Inspector))).not.toThrow();

    const jobsCertify = () => runAllSeedsJobs(s().sheet, s().session).allPass;

    // Arrives unsolved: nothing classified.
    expect(jobsCertify()).toBe(false);

    // A command is not a request: Command-2 on the data job dead-ends it.
    s().assignPattern("j1", "Command-2");
    s().assignPattern("j2", "ActionRequest-2");
    expect(jobsCertify()).toBe(false);

    // Classify both correctly → the data returns and the analysis runs on all seeds.
    s().assignPattern("j1", "DataRequest-2");
    expect(jobsCertify()).toBe(true);
  });
});
