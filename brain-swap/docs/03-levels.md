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
interrupt) + **4.3 Degraded** (live envelope) levels (Phase 4). (Standalone **4.1** was built then
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
- **1.5 Winds Aloft.** Reach a narrow corridor in a stiff crosswind read from
  `WeatherObservationMT`. Heading (HSA) vs course (CSA, `Course` field) — command
  course or compute your own crab angle. Teaches: H vs C is not pedantry.
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
- **1.7 Counter-Offer.** Mission parameters FA won't accept as-asked; FA rejects
  *with a best-effort `MA_TaskMT`* (Flight field). Brain must read the suggested
  parameters and resend. Teaches: rejection is the start of a negotiation, not a
  dead end.

## World 2 — Waypoint Following (6 levels, bodies AX-01/AX-02)

- **2.1 The Upload Liturgy.** A route is given; getting FA to fly it is the puzzle:
  `MA_MissionPlanActivationCommandMT` PREPARE_FOR_UPLOAD → COMPLETED → publish
  `MA_RoutePlanMT` → `MA_SystemNotificationMT` CONFIRMED → UPLOAD → COMPLETED →
  prepare-for-activation → READY_FOR_ACTIVATION → ACTIVATE → route executes.
  Skipping or reordering any step fails with the real status semantics. This level
  is unapologetically the route-plan state machine, and it becomes the player's
  first big reusable interaction block.
- **2.2 Threading the Fence. [Built]** Build the route's waypoints yourself around
  geozones. Lazy straight line → `VIOLATION_GEOFENCE` (with the offending segment
  identified, per `RouteValidationInvalidPathType`). Optional pre-check via
  Validate Route Plan (`RoutePlanValidationCommandMT`) — costs messages, saves
  rejections; the metrics trade off against each other. *(Built as a hand-flown
  HSA avoidance level: a `LevelDef.avoid` no-fly circle on the direct line; entering
  it is a world-state breach → `failed` (no geofence rejection). The reference brain
  dog-legs with a Direction-only `UPDATE`; the naive straight-line brain breaches.
  Route-plan geozones / `Validate Route Plan` are not built — they belong with the
  Phase-5 route-upload world.)*
- **2.3 On Station.** Loiter on a fix: Racetrack with the real defaults (right
  turns; 60 s legs at/below 14 000 ft MSL, 90 s above). Par requires letting the
  defaults work for you instead of over-specifying. Teaches loiter types +
  `MA_FixOrbitType` refinement.
- **2.4 Read-Only.** Weather closes the objective; divert and land. You cannot
  upload an approach route — takeoff/departure/approach/landing plans are
  pre-stored on FA, safety-critical, read-only (real rule). Query them
  (`QueryDataRequestMT` → `MA_RoutePlanMT` + `AirfieldReportMT`) and activate by
  reference. Teaches: the Airworthiness Boundary as a gameplay wall.
- **2.5 Retask.** Mid-route, the objective moves. DEACTIVATE on an EXECUTING route
  returns FAILED (real); the correct move is superseding with a new flight command
  or activating a replacement route. Teaches: supersede vs deactivate semantics.
- **2.6 FA Says No.** Pop-up restricted zone: FA aborts your active route itself
  (VI Deactivate Route; `RoutePlanExecutionStatusMT` CANCELED). Brain must detect
  the cancel, fall back to an HSA hold (block reuse from world 1!), and re-plan.
  First robustness exam.

## World 3 — Curve Following (4 levels, body AX-03 — which advertises Curve on
this variant; its sister variant in world 4 doesn't)

- **3.1 First Curve.** One quintic Bézier segment (six control points, ownship NED
  reference) through two gates. Teaches the curve command payload; knot vector and
  weights shown read-only.
- **3.2 Canyon.** Multi-segment (≤10) curve through terrain. Over-tight curvature →
  `PERFORMANCE_LIMIT_EXCEEDED` or `INVALID_CURVE` with the offending section
  (`MA_CurveSectionType` start/end parameter + segment number); terrain clips →
  `VIOLATION_TERRAIN`. Teaches: control-point geometry vs the acceleration limits
  in `CurveFollowingPerformanceProfile`.
- **3.3 Append.** Continuous show-line: keep appending segments with `AppendCurve`
  *while executing* (only valid then — real rule); a gap in the pipeline means the
  vehicle hits `EndOfCurveBehavior` and loiters, blowing the time par.
- **3.4 Exit Strategy.** Same course, two scored variants: end in a circular
  loiter at the endpoint vs continue at previous CSA (`EndOfCurveBehaviorEnum`),
  plus a timing window via `MA_CurveTraversingType`. Teaches: you choose what
  happens after the curve, and FA holds you to it.

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
- **4.4 Heartbeat Discipline.** AX-04 (isolator modeled): the brain must publish
  `ServiceStatusMT` every N ticks; on missed FA heartbeats it must issue
  `SubsystemStatusDataRequestMT` before assuming failure (real comms-failure
  interaction). Mishandling earns revocation: `MA_ControlRequestStatusMT` CANCELED
  + `MA_ControlAssignmentMT` listing your remaining capabilities (none).
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
