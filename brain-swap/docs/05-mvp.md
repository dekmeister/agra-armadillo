# MVP — First Playable

**Target: level 1.2 "First Valid HSA Command", playable end-to-end in the browser,
including the control-acquisition handshake.** The handshake is in scope because
"FA always retains control" is the game's soul — the MVP must deliver the moment
where your premature `MA_FlightCommandMT` is visibly ignored, and the moment where
your first valid command is ACCEPTED and the aircraft turns.

## In scope

**Messages (9 types, Tier 1 catalog):**
`MA_FlightCapabilityMT` (HSA profile only), `MA_FlightCapabilityStatusMT`,
`MA_ControlRequestMT`, `MA_ControlRequestStatusMT`, `ControlStatusMT`,
`MA_FlightCommandMT` (HSA_CSA payload: Altitude / Speed / Direction.Heading),
`MA_FlightCommandStatusMT` (ACCEPTED/REJECTED + ValidationResult),
`MA_FlightActivityMT`, `MA_PositionReportDetailedMT`.

**Sim core:** in-order bus (1-tick delivery); point-mass aircraft (heading-rate,
speed, climb limits from the body profile); FA engine with: capability
advertise/ready at boot, ACQUIRE→APPROVED flow, ignore-if-not-controller,
validator checks for `PERFORMANCE_LIMIT_EXCEEDED` and `CAPABILITY_NOT_SUPPORTED`
(wrong CapabilityID); periodic `MA_PositionReportDetailedMT` and
`MA_FlightActivityMT` publication.

**Brain editor (the minimum honest version):** add/rename/delete states; mark
initial state; transitions with one message-type trigger + up to one field guard
(field dropdown / operator / value); actions: send (form showing required fields,
values = literals or `cap.*` references or fields captured from the triggering
message) and goto. No timers, no variables, no blocks, no expressions yet.

**Run view:** Pixi map (objective zone, aircraft, trail), play/pause/step/2×/8×,
scrubbable message log with disposition badges (delivered / **ignored — not
secondary controller** / rejected: reason), payload inspector, live brain-state
highlight.

**Win + score:** enter-and-hold zone at commanded altitude for 10 ticks; score
panel with the four metrics (no histograms); retry loop.

**Fidelity CI:** `check-fidelity.ts` running against the local References XSD from
day one — the catalog is born policed.

## Explicitly deferred (next slices, in order)

1. Level 1.1 + 1.3 (split the handshake teaching out; envelope rejection level) —
   mostly level data once MVP ships.
2. Heartbeats, timers in the brain model.
3. Interaction blocks (needed before world 2's upload liturgy).
4. Variables + expression evaluator (needed for 1.4 partial-update par).
5. Wind, fuel, best-effort counter-offer (rest of world 1).
6. Histograms, save slots, brain export/import.
7. Waypoint/route state machine, then curves, then swap world.

## Build order (7 steps, each independently verifiable)

1. **Catalog + fidelity CI.** Tier-1 YAML catalog with VI Volume table citations;
   codegen to TS; CI green against the real XSD.
2. **Bus + FA handshake headless.** vitest: scripted message sequences reproduce
   the Control Mode Authorization and Receive Control Request flows exactly
   (golden logs).
3. **Vehicle + validator headless.** HSA command moves the point-mass; envelope
   violations reject with the right enum.
4. **Brain interpreter headless.** The reference solution brain (JSON, written by
   hand) passes level 1.2 in a golden-run test. *The game is now provably solvable
   before any UI exists.*
5. **Run view.** Load reference brain, watch it fly: map, log, tick controls.
6. **Editor.** Build the brain in-game from a blank canvas; delete the reference
   from the level bundle.
7. **Polish the lesson.** Disposition badges, the "why was this ignored?" hint
   flow, Fidelity Notes panel, score screen.

**Definition of done:** a newcomer who has never read the VI Volume can, in one
sitting, fail by commanding too early, read the log to understand why, build the
handshake, fly to the zone, and articulate what `MA_ControlRequestMT` and
`MA_FlightCommandStatusMT` are for. (Test on a real human.)
