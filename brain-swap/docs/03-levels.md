# Level Progression

~22 levels in five worlds. Each level lists: the lesson, the obstacle, and the new
real material it introduces. Optimization re-play is expected; pars per metric.

Bodies introduced along the way (performance profiles are level data):
- **AX-01 "Mule"** — forgiving trainer: wide envelope, instant approvals, no quirks.
- **AX-02 "Heron"** — endurance platform: slow, low ceiling, miserly fuel model,
  FA answers control requests with PENDING for several ticks first.
- **AX-03 "Ferret"** — agile: tight turn limits at low speed, no Curve Following
  capability advertised, flinchy collision-avoidance FA.
- **AX-04 "Boxkite"** — world-4 oddball: VI OMS Isolator modeled as a distinct
  filtering/latency stage; strict heartbeat discipline.

## Build status

> **Realtime mode.** Levels are now played in realtime — the player *is* the MA brain,
> hand-injecting MA→FA messages against FA's live stream (the visual state-machine
> editor was removed; see `PLAN_FUTURE.md`). Each level's reference brain is retained
> only as the source for a derived input script; `realtime-replay.golden.test.ts` proves
> every level below is solvable by hand with the same MA sends and score. Scoring is now
> three metrics (Ticks / Bus Traffic / Rejections — Brain Size dropped).

Implemented and golden-tested (`packages/levels`): **1.2** (MVP), plus the
post-MVP batch **1.1, 1.3, 1.4, 4.5**, the avoidance level **2.2** (Phase 2), and
the endurance level **1.6 Bingo** (Phase 3), and the **4.2 The Flinch** (collision
interrupt) + **4.3 Degraded** (live envelope) levels (Phase 4), and the first
**Mission Systems** level **3.1 Meet MS** (Phase 5 — the MS foundation: a third bus
party with its own heartbeat, on the new MS body **Sentry MS**). (Standalone **4.1** was built then
removed in the Phase-0 streamline — its portability lesson is now owned by 4.5,
which already flies one locked brain across the whole fleet.) Bodies built (one
version each): **AX-01 "Mule"**, **AX-02 "Heron"** (`approvalLatencyTicks 3`, ceiling
8000, `maxAirspeed 50`, slow turn; carries the **fuel model** — a U-shaped burn used
by Bingo), **AX-03 "Ferret"** (agile `maxTurnRateDeg 10`, narrow altitude band
1000–10000, higher stall `minAirspeed 30`; carries `collisionLookaheadTicks` so its
FA flinches at traffic — the Flinch airframe). Only the Heron models fuel and only the
Ferret flinches; absent those fields a body is unaffected (4.5 runs the Ferret with no
threats, so no interrupt). Everything else below is design, not yet built.

The built versions are deliberately simplified against the design copy (see
`docs/02-fidelity.md` lies #14–16):
- **1.3** advertises a *static* envelope — no fuel burn-off / ceiling-rise yet
  (needs a fuel model + event schedule). The lesson (clamp to `cap.MaxAltitude`)
  is intact; a level `start` override puts AX-02 near its ceiling so the climb
  completes during the zone transit. Flown **south (heading 180) to a station at
  `(0,-900)`** so it reads as a distinct map from 1.2's westbound run to `(-900,0)`.
- **1.4** is flown by *position-threshold* steering (Direction-only `UPDATE` when
  a position-report coordinate crosses a corner), not FA-managed timed legs; the
  waypoint zones sit on the straight legs (no brain timer yet).
- **2.2** is a *hand-flown* avoidance level (`LevelDef.avoid` no-fly circle +
  world-state breach → `failed`), not the design's route-plan geozones / `Validate
  Route Plan`. The lesson (avoidance is world-state; FA flies you into the fence if
  commanded) is intact: the reference dog-legs around the circle with a Direction-only
  `UPDATE`; the naive straight-line brain breaches and fails with no FA rejection.
- **4.5** is graded headless (worst-of-three via the test harness); no in-game
  score-screen UI yet. It owns the portability lesson outright: the locked
  profile-driven brain (reads `cap.MaxAltitude`/`MaxAirspeed`/`MinAirspeed`) ports
  unchanged across AX-01/02/03 — the role the removed standalone 4.1 used to fill.
- **3.1 Meet MS** is the first level on the **MS interface** (a real third bus party,
  `to:"MS"`). The MS engine (`packages/core/src/ms/engine.ts`) mirrors the FA engine's
  shape but only the Status Service: a subsystem boots INITIALIZATION→OPERATE on a
  deterministic timeline, MS publishes a periodic heartbeat (`SubsystemStatusMT` /
  `ServiceStatusMT`), and answers an on-demand `SubsystemStatusDataRequestMT`. Unlike FA,
  MS does **not** validate/REJECT — an early request just reflects the current state
  (the `ms-status` objective, the MS analogue of `hold-control`). Sensor tasking, weapons,
  and DLZ are deferred (`PLAN_MS.md`).

## World structure note (W2/W3 restructure)

World 2 (Waypoint Following, 6 levels) and the old World 3 (Curve Following, 4 levels)
were merged into a single **World 2 "Navigation"** (~5 levels), freeing World 3 for the
new **"Mission Systems"** world. No playable id changed (2.2 keeps its id; the new 3.1 is
"Meet MS"). The trimmed/folded levels are recorded in `RESEARCH_MS.md` §6.

## Tutorial — First Flight (1 level)

- **0.0 First Flight. [Built]** A standalone, watch-only onboarding demo (its own
  "Tutorial" group in the level select, separate from World 0). It reuses 1.2's
  mission verbatim (AX-01, fly heading 270 to the zone and hold at 3000 m); the
  player just presses **Play** and the mission solves itself while a 4-step coachmark
  tour points at the console regions (telemetry / map / log / transport). Implemented
  as a client-side "demo auto-play": the store derives an input script from the
  reference brain (`extractScript`) and injects it through the normal `advanceLive`
  inject→step path, so the demo is deterministic and golden-tested exactly like every
  other level. Compose is disabled while the tutorial is active. Teaches: the realtime
  MA→FA loop end to end, and what each console region does.

## World 0 — Listen Before You Speak (2 levels)

- **0.1 First Contact.** No commands available. Goal: light a panel lamp when
  `SubsystemStatusMT` arrives and keep it lit (it doubles as FA's heartbeat — real
  semantics). Teaches: the message log, triggers, the idea that FA talks first.
- **0.2 Spec Sheet.** Goal: read the body's `MA_FlightCapabilityMT` and set output
  registers: which control modes are advertised? what is MaxAltitude? Teaches:
  the performance profile is data on the bus, not a manual page.

## World 1 — HSA/CSA (7 levels, body AX-01 then AX-02)

- **1.1 Handshake. [Built]** Acquire HSA capability control: wait for
  `MA_FlightCapabilityStatusMT` AVAILABLE → `MA_ControlRequestMT` (ACQUIRE, correct
  CapabilityID) → handle APPROVED → confirm via next `ControlStatusMT` showing you
  as SecondaryController. Win: hold secondary control 30 ticks. FA advertises the
  capability **TEMPORARILY_UNAVAILABLE at boot and AVAILABLE only at tick 12** (a
  `capability-available` event, modelling Control Mode Authorization readiness, VI
  §1.2.2.4): ACQUIRE before then is **REJECTED**. Two baits, both visible in the log:
  an impatient early ACQUIRE (REJECTED) and sending `MA_FlightCommandMT` before
  holding control — FA silently drops it (it isn't listening, lie #8).
- **1.2 First Valid HSA Command.** Fly heading 270° at 3 000 m to a zone. Full
  cycle: command → ACCEPTED → consume `MA_FlightActivityMT` and
  `MA_PositionReportDetailedMT` to detect arrival (HSA has no completion state —
  real semantics; *you* must notice you've arrived). **← MVP level.**
- **1.3 Envelope. [Built]** Objective zone sits above this body's MaxAltitude... or does
  it? The profile republishes as fuel burns off and the ceiling rises. Naive
  command → `PERFORMANCE_LIMIT_EXCEEDED`. Par (0 rejections) requires reading
  `HSA_CSA_PerformanceProfile` and clamping/waiting. Teaches: rejection enum +
  envelope-as-data. *(Built: static envelope — no fuel/ceiling-rise yet.)*
- **1.4 Racetrack by Hand. [Built]** Fly a hold pattern using only HSA. Teaches partial
  commands: update *only* `Direction` each leg (bus-traffic par is unreachable if
  you resend full commands), `CommandState` UPDATE vs NEW. *(Built: four-corner
  waypoint sequence steered by position thresholds — no timed legs yet.)*
- **1.5 Winds Aloft. [Deferred → `PLAN_LEVELS_FINALS.md`]** Reach a narrow corridor in a
  stiff crosswind read from `WeatherObservationMT`. Heading (HSA) vs course (CSA, `Course`
  field) — command course or compute your own crab angle. Teaches: H vs C is not pedantry.
  Needs wind in the integrator + 1 new message; grey row removed from the catalog.
- **1.6 Bingo. [Built]** Distant zone, thin fuel. `NavigationReportMT` (fuel mass/percent/
  duration) + `SpeedOptimizationEnum` MAX_ENDURANCE vs explicit speed. Greedy max
  cruise → `VIOLATION_ENDURANCE` rejection. Teaches: FA validates against
  endurance, and speed can be delegated. *(Built on the fuel-bearing **AX-02 Heron**
  with a U-shaped fuel flow (`minBurn + burnQuad·(speed − bestSpeed)²`),
  `NavigationReportMT` pruned to flat `Fuel`+`Percent`, and an FA endurance-reserve
  check. The Heron launches hot on a thin tank, so the player must slow to the
  efficient cruise to make the range; the naive max-throttle brain is rejected
  `VIOLATION_ENDURANCE` and flames out short. Speed delegation via
  `SpeedOptimizationEnum` and `Duration` are not built — fidelity lie #17.)*
- **1.7 Counter-Offer. [Deferred → `PLAN_LEVELS_FINALS.md`]** Mission parameters FA won't
  accept as-asked; FA rejects *with a best-effort `MA_TaskMT`* (Flight field). Brain must
  read the suggested parameters and resend. Teaches: rejection is the start of a negotiation,
  not a dead end. Needs `MA_TaskMT` on the FA bus + an FA counter-offer path; grey row removed.

## World 2 — Navigation (4 levels, merged W2 Waypoint + old W3 Curve; bodies AX-01/02/03)

Merged per `RESEARCH_MS.md` §6: the route-upload liturgy, geofence avoidance, retask, and a
first curve. **All four built and playable** (route/curve execution state lives in `FaState`,
modelled on the `ms/engine.ts` lifecycle; see fidelity lies #25–#27). 2.5 Canyon was **cut**.

- **2.1 Upload. [Built]** A route is given; getting FA to fly it is the puzzle. Liturgy:
  `MA_MissionPlanActivationCommandMT` PREPARE_FOR_UPLOAD → READY_FOR_UPLOAD → publish
  `MA_RoutePlanMT` → UPLOAD → UPLOADED → PREPARE_FOR_ACTIVATION → READY_FOR_ACTIVATION →
  ACTIVATE → ACTIVATED, then FA flies RTE-1 and reports `RoutePlanExecutionStatusMT`
  EXECUTING → COMPLETE. Skipping or reordering any step fails with the real `*_FAILED`
  status. The route ends at a RACETRACK loiter hold-point set as a route parameter. The
  upload confirmation collapses `MA_SystemNotificationMT` into the activation-status
  transitions (lie #25); route content is pruned (lie #26). Naive brain ACTIVATEs first →
  ACTIVATION_FAILED → times out. The airframe is a route-following Mule variant
  (`ax-01-route`): its `MULE-01` capability advertises `WAYPOINT_FOLLOWING`, not `HSA_CSA`,
  so a hand-flown `MA_FlightCommandMT` is honestly REJECTED `CAPABILITY_NOT_SUPPORTED` (real
  `MA_FlightCapabilityEnum`) — you fly this one by uploading a plan, not by direct vectors.
- **2.2 Avoid. [Built]** Build the route's waypoints yourself around geozones. Lazy
  straight line → `VIOLATION_GEOFENCE` (offending segment identified, per
  `RouteValidationInvalidPathType`). Optional pre-check via Validate Route Plan
  (`RoutePlanValidationCommandMT`) — costs messages, saves rejections; the metrics trade
  off. *(Built as a hand-flown HSA avoidance level: a `LevelDef.avoid` no-fly circle on
  the direct line; entering it is a world-state breach → `failed` (no geofence rejection).
  The reference brain dog-legs with a Direction-only `UPDATE`; the naive straight-line
  brain breaches. Route-plan geozones / `Validate Route Plan` are the unbuilt upgrade.)*
- **2.3 Retask. [Built]** Mid-route FA aborts the active route itself (an `abort-route`
  event → `RoutePlanExecutionStatusMT` CANCELED) and the loiter has moved. The brain must
  detect the cancel and fall back to an HSA hold at the moved zone (block reuse from World
  1!). DEACTIVATE on an EXECUTING route returns FAILED (real, VI §1.2.5.4). Recovery is an
  HSA hold, **not** a route re-upload (the brain DSL has no variables to re-author a route).
  Naive brain ignores CANCELED → times out. First robustness exam.
- **2.4 First Curve. [Built]** Take control, then send ONE `MA_FlightCommandMT` carrying a
  `Curvature`; the presence of `Curvature` selects CurveFollowing mode. FA validates against
  the body's minimum turn radius, accepts, and flies the curvature-limited arc to the
  terminal, reporting `MA_FlightActivityMT` START_CURVE_FOLLOWING → CURVE_IN_PROGRESS →
  CURVE_COMPLETED. Simplified to a single `Curvature` (lie #27, extends #10). Over-tight
  curvature → `PERFORMANCE_LIMIT_EXCEEDED`; a curveless body (AX-03) → `CAPABILITY_NOT_SUPPORTED`.
  Naive brain commands an over-tight curve → REJECTED → times out.

*(**2.5 Canyon cut**: multi-segment curve + `AppendCurve` pipelining + terrain needs a full
multi-segment curve/terrain system — least fun to author in realtime, deferred indefinitely.
Original 10-level trim per `RESEARCH_MS.md` §6 also folded away 2.3 On Station, 2.4 Read-Only,
3.3 Append, 3.4 Exit Strategy.)*

## World 3 — Mission Systems (5 levels; FA airframe + an MS body in parallel)

The MS interface owns the payload (sensors, weapons, status, geometry) on its own bus.
MA is the integration layer orchestrating FA **and** MS at once. Progression: passive MS
first (MS publishes, you read), then active MS (you command). See `RESEARCH_MS.md` for the
interaction analysis and `PLAN_MS.md` for the deferred 3.2–3.4 build.

- **3.1 Meet MS. [Built]** *(passive)* The Sentry radar boots INITIALIZATION→OPERATE on a
  deterministic timeline; MS publishes a periodic heartbeat (`SubsystemStatusMT` /
  `ServiceStatusMT`, MS Vol §1.2.9.1/§1.2.9.4). Win: read the heartbeat, wait for OPERATE,
  then confirm it with an on-demand `SubsystemStatusDataRequestMT` (MS Vol §1.2.9.5). The
  bait requests during INITIALIZATION and latches the wrong state — MS doesn't REJECT (it
  isn't safety-critical), it just reflects the current state. Teaches: MS is a separate body
  on its own bus with its own heartbeat; read it like FA, but the party is MS.
- **3.2 Eyes Open. [Built]** *(first MS command)* `MA_AMTI_CapabilityMT` advertises the radar;
  schedule a search via `AMTI_CommandMT` (referencing the advertised `CapabilityID`, valid
  time windows, a `TargetVolume`); watch `AMTI_CommandStatusMT` → `AMTI_ActivityMT` →
  `EntityMT` tracks. Teaches: sensors are scheduled, not pointed; the command/status/activity
  cycle.
- **3.3 Clear to Engage. [Built]** *(fire command + consent)* `StrikeCapabilityMT` →
  `MA_TaskMT` → `MA_TaskCommandMT` (NEW/execute) → respond to `StrikeConsentRequestMT` with
  `StrikeConsentRequestStatusMT` → `MA_StrikeActivityMT`. Teaches: MS holds the capability;
  MA holds the key — the consent chain is the human-machine-teaming model in its most direct
  form. Bait: ignore the consent request and the weapon never releases.
- **3.4 In the Zone. [Built]** *(DLZ + full fire sequence)* Request the DLZ (`DLZ_RequestMT` →
  `DLZ_MT`), maneuver FA (HSA block reuse from World 1) to close the target into the zone,
  then run the 3.3 fire sequence. The MS engine gates strike completion on the vehicle being
  within `RangeMaxAero`, so a completed strike is a geometrically valid one. First level
  actively managing two interfaces in one run — a preview of the Brain Swap capstone.
- **3.5 Sensor Failure. [Built]** *(robustness variant of 3.2)* Mid-collection the primary
  radar subsystem degrades and MS publishes `MA_FaultMT` (the same message as FA, on the MS
  bus). Cancel the dead task (`AMTI_CommandMT` CANCEL) and re-task the healthy backup radar.
  Bait: ignore the fault and keep waiting on silence → timeout. Teaches: MS has its own fault
  model; the same `MA_FaultMT` flows on both interfaces.

## World 4 — Brain Swap (5 levels)

- **4.1 Second Body. [Removed — folded into 4.5]** Originally a standalone "re-fly
  the mission on AX-02" level. Built, then removed in the Phase-0 streamline because
  it duplicated to *play* what 4.5 already proves: a profile-driven brain ported to a
  body with a lower ceiling, PENDING-before-APPROVED latency, and a slower turn rate.
  The portability lesson now lives in 4.5, which flies one locked brain across the
  whole AX-01/02/03 fleet.
- **4.2 The Flinch. [Built]** AX-03 with an anxious FA: frequent collision-avoidance
  interrupts (`CONSTRAINT_COLLISION_AVOIDANCE`, capabilities TEMPORARILY_UNAVAILABLE,
  resume signaled by fresh `MA_FlightCapabilityMT`). Brain must hold state, not
  spam, and resume cleanly. Also: it advertises *no* Curve Following — a brain that
  assumes the mode meets `CAPABILITY_NOT_SUPPORTED`. *(Built: a `spawn-threat` pops up
  on the track; FA raises a CAUTION `MA_FaultMT` and flies the Ferret clear, rejecting
  any vector still entering the zone (`VIOLATION_AIR_TRAFFIC`). The reference yields and
  dog-legs around; a brain that ignores the fault is held off and times out. Avoidance
  is the fly-away interrupt of fidelity lie #18, not the full `CONSTRAINT_*`/curve
  story.)*
- **4.3 Degraded. [Built]** Mid-mission `MA_FaultMT` (CAUTION, then WARNING) and a
  tightened republished envelope. The mission is still completable inside the new
  numbers. Final exam in consuming status: the brain that re-reads
  `MA_FlightCapabilityMT` after a fault passes; the one that cached it at boot
  doesn't. *(Built: a `degrade-envelope` event raises MinAirspeed mid-mission and FA
  re-advertises `MA_FlightCapabilityMT`. The reference reads the new floor off the
  re-advert (`{msg: MinAirspeed}`) and loiters valid; the naive caches the boot value
  and is rejected `PERFORMANCE_LIMIT_EXCEEDED`, blowing through the station. No
  `MA_FaultMT` in this build — the re-advert alone carries the lesson.)*
- **4.4 Heartbeat Discipline. [Deferred → `PLAN_LEVELS_FINALS.md`]** AX-04 (isolator
  modeled): the brain must publish `ServiceStatusMT` every N ticks; on missed FA heartbeats
  it must issue `SubsystemStatusDataRequestMT` before assuming failure (real comms-failure
  interaction). Mishandling earns revocation: `MA_ControlRequestStatusMT` CANCELED
  + `MA_ControlAssignmentMT` listing your remaining capabilities (none). Needs a new AX-04
  body + a heartbeat/revocation path (and likely a periodic brain trigger); grey row removed.
- **4.5 Type Certificate (capstone). [Built]** One brain, locked: it flies the same
  mission on AX-01, AX-02, AX-03 back-to-back with zero edits. Score = worst of
  the three runs. Score screen styled as a compliance test report. *(Built headless:
  the golden test runs the locked brain on all three bodies and records
  `aggregateWorst`; no score-screen UI yet.)*

## Stretch levels (post-1.0 candidates)

- **Failsafe** (MA Failsafe, 1.2.1.3): designate a recovery plan via
  `MA_ResponseMT` before FA will tolerate risky tasking.
- **QNH** (Receive Barometric Pressure): one-screen settings puzzle.
- **Open FA**: sandbox where the player inspects the FA-side validator config of
  each body — the "read the other side's state machine" reward.
