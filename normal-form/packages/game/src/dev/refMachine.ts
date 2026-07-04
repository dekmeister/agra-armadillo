// DEV-ONLY. A copy of the S2 reference machine (packages/core/test/reference/
// ref-1-1.json) so the S4 run view is drivable *before* HANDLERS editing exists.
// Loaded solely on the `?ref=1` branch in store.ts and REMOVED in S5, when the
// player's own wired machine supplies this — the reference is test-only again
// (PLAN_MVP S4 exit / S5 build). Do not reference this outside the ?ref path.
import type { Machine } from "@normal-form/core";

export const REFERENCE_MACHINE: Machine = {
  id: "ref-1-1",
  initial: "s0",
  states: ["s0"],
  rules: [
    { from: "s0", on: "RECEIVED", action: "wait" },
    { from: "s0", on: "ACCEPTED", action: "terminal" },
    { from: "s0", on: "REJECTED", action: "retry", budget: 1 },
  ],
};
