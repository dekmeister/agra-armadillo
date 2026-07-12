// WS-E E2 playtest (headless, deterministic): the one-way (`-1`) sheets are
// playable end-to-end. It drives the *real* store actions the UI dispatches
// (selectSheet / place / setField / setPublish) against the *real* core sim
// (validate + runAllSeedsOneWay), proving the arrives-broken → fix → certify loop
// for both W0 sheets, and asserts the content the one-way panels render from plus a
// mount smoke of those panels.
//
// Why the panels aren't rendered *after* mutating the store: zustand v5's
// `useSyncExternalStore` server snapshot is `getInitialState()`, so under
// `renderToString` every hook reads the store's *initial* state and never sees a
// runtime mutation (verified: `getState()` returns the mutation but the hook does
// not). Rendering the live play screen is therefore the job of the mandated browser
// playtest (`/verify`); here we assert the pure derivations the components render
// from (`primaryBinding` → publication name, the lifeline fan-out → consumer count),
// which are exactly the strings the board header / publish-plan label emit.
import {
  buildComposition,
  derivePublishPlan,
  runAllSeedsOneWay,
  type Sheet,
  validate,
} from "@normal-form/core";
import { getSheet } from "@normal-form/levels";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Board } from "../src/Board.tsx";
import { Inspector } from "../src/Inspector.tsx";
import { primaryBinding } from "../src/sheet.ts";
import { useGameStore } from "../src/store.ts";

/** Re-read the store after dispatching actions (they mutate the singleton). */
const s = () => useGameStore.getState();
const findingsCount = () => validate(s().sheet, buildComposition(s().sheet, s().session)).length;
const certifies = (startTick: number, everyN: number) =>
  runAllSeedsOneWay(s().sheet, derivePublishPlan(s().sheet, startTick, everyN)).allPass;
/** Consumer lifelines drive the fan-out columns + the "→ N consumers" header. */
const consumerCount = (sheet: Sheet) => sheet.lifelines.filter((l) => !l.player).length;

describe("W0 0-1 Hello, Bus — Status-1 deadline", () => {
  it("publish-plan editor + fan-out board mount; composing beats the tick-4 deadline", () => {
    s().selectSheet("0-1");
    s().place();
    s().setPhase("handlers");

    // The one-way play-screen panels mount on real sheet data without throwing.
    expect(() => renderToString(createElement(Board))).not.toThrow();
    expect(() => renderToString(createElement(Inspector))).not.toThrow();

    // The board header / publish-plan label render Status-1 → SubsystemStatus,
    // producer → 1 consumer.
    const sheet = getSheet("0-1");
    if (!sheet) throw new Error("sheet 0-1 not registered");
    expect(primaryBinding(sheet).publication).toBe("SubsystemStatus");
    expect(consumerCount(sheet)).toBe(1);

    // Arrives broken: missing SystemID, blank Timestamp, LIVE ≠ EXERCISE.
    expect(findingsCount()).toBeGreaterThan(0);

    s().setField("SystemID", "SYS-ALPHA");
    s().setField("Timestamp", "2026-07-06T10:00:00Z");
    s().setField("Mode", "EXERCISE");
    expect(findingsCount()).toBe(0);

    // The default single fire-and-forget still beats the tick-4 deadline.
    expect(certifies(s().session.publish.startTick, s().session.publish.everyN)).toBe(true);
  });
});

describe("W0 0-2 Fire and Forget — Data-1 hold + republication", () => {
  it("Data-1 fan-out to 3 consumers; single send goes stale, periodic republish certifies", () => {
    s().selectSheet("0-2");
    s().place();

    // The fan-out board renders Data-1 → 3 consumers (the header + one column each).
    const sheet = getSheet("0-2");
    if (!sheet) throw new Error("sheet 0-2 not registered");
    expect(primaryBinding(sheet).publication).toBe("Entity");
    expect(consumerCount(sheet)).toBe(3);

    // Compose beat: a blank Timestamp blocks RUN until fixed.
    expect(findingsCount()).toBeGreaterThan(0);
    s().setField("Timestamp", "2026-07-06T10:00:00Z");
    expect(findingsCount()).toBe(0);

    // The default single fire-and-forget goes stale across 6–12 → fails.
    expect(certifies(s().session.publish.startTick, s().session.publish.everyN)).toBe(false);

    // Republishing every tick from t4 keeps all three consumers fresh → certifies.
    s().setPublish(4, 1);
    expect(certifies(4, 1)).toBe(true);
  });
});
