# Fidelity Decisions

Source of truth: *ASK 5.0a Vehicle Interface Volume* (interactions, sequence
semantics, required fields per Tables 1-1…1-36) and
*A-GRA_MessageDefinitions_v5_0_a.xsd* (message/field/enum names). Rule: the game
may **omit**, it may **never rename or invent**. A build-time fidelity check greps
the XSD for every name in the game's message catalog.

## 1. Real interactions in the game, by tier

Tier = when the player meets it. Names are the real interaction names from the VI
Volume §1.2.

| VI Volume interaction | Tier | In-game role |
|---|---|---|
| Control Mode Authorization (1.2.2.4) | 1 | FA advertises modes + performance profile (`MA_FlightCapabilityMT`), signals ready (`MA_FlightCapabilityStatusMT`) |
| Receive Control Request (1.2.2.7) | 1 | The handshake: `MA_ControlRequestMT` (ACQUIRE) → `MA_ControlRequestStatusMT` (PENDING/APPROVED/REJECTED) → confirm via next `ControlStatusMT` |
| Publish Control Status (1.2.6.2) | 1 | Who FA listens to; FA always PrimaryController, MA at most SecondaryController |
| Control by HSA/CSA Command (1.2.2.2) | 1 | Persistent mode, partial updates, heading vs course, speed value / Mach / `SpeedOptimizationEnum` |
| Receive Vehicle State Data (1.2.6.8) | 1 | `MA_PositionReportDetailedMT`, `NavigationReportMT` (fuel), `WeatherObservationMT` (winds) |
| Receive Vehicle Performance Values (1.2.6.7) | 1 | Envelope as data: min/max airspeed vs altitude, altitude limits, turn/climb/descent limits; republished as flight condition changes |
| Best-effort counter-offer (within 1.2.2.1–1.2.2.3) | 1 | FA rejects + suggests adjusted task via `MA_TaskMT` (Flight field); brain may adopt it |
| Control by Waypoint Following (1.2.2.3) | 2 | Routes, loiter types (Circle/Racetrack/Figure-eight/ATC hold) with real defaults (right turns; 60 s legs ≤14,000 ft MSL, 90 s above) |
| Convert and Upload Route (1.2.5.2) | 2 | PREPARE_FOR_UPLOAD → publish `MA_RoutePlanMT` → `MA_SystemNotificationMT` CONFIRMED → UPLOAD |
| Prepare for Route Activation (1.2.5.3) | 2 | → READY_FOR_ACTIVATION (or PREPARATION_FOR_ACTIVATION_FAILED) |
| Activate Route (1.2.5.1) | 2 | `MA_MissionPlanActivationCommandMT` ACTIVATE → status COMPLETED |
| Receive Deactivate Route (1.2.5.4) | 2 | DEACTIVATE fails with status FAILED if route is EXECUTING — supersede instead |
| VI Deactivate Route (1.2.5.6) | 2 | FA aborts your route; `RoutePlanExecutionStatusMT` CANCELED; brain must recover |
| Query Route Plan / Query Airfield Update (1.2.6.3/4) | 2 | Discover the pre-stored, read-only takeoff/approach/landing routes; activate by reference only |
| Validate Route Plan (1.2.5.5) | 2 | Pre-flight route validation (`RoutePlanValidationCommandMT` → `RoutePlanValidationMT`) |
| Control by Curve Following (1.2.2.1) | 3 | Quintic Béziers, 6 control points/segment, ≤10 segments, ownship NED reference, `AppendCurve`, `EndOfCurveBehavior` |
| Exchange Heartbeat (1.2.6.1) | 4 | `ServiceStatus`/`SubsystemStatus` as heartbeats; the brain must *emit* `ServiceStatusMT` periodically or FA treats comms as failed |
| Intra-Vehicle Comms Failure (1.2.1.2) | 4 | Missed heartbeats → `SubsystemStatusDataRequestMT` → contingency |
| Modify Capabilities (1.2.2.6) | 4 | `TEMPORARILY_UNAVAILABLE` with `AvailabilityReason`; resume without repeated reason |
| Collision Avoidance (1.2.1.1) | 4 | FA stops accepting commands: reason `CONSTRAINT_COLLISION_AVOIDANCE`; resume signaled by `MA_FlightCapabilityMT` |
| Mechanical Damage / Sensor Failure (1.2.1.4/5) | 4 | `MA_FaultMT` (severity NOMINAL…FAILED) + tightened republished envelope |
| Unpair Control Assignment (1.2.2.8) | 4 | FA revokes: `MA_ControlRequestStatusMT` CANCELED + `MA_ControlAssignmentMT` with remaining capabilities |

The eight rejection reasons are the real `MA_ValidationResultEnum`, verified against
the XSD: `INVALID_CURVE`, `INVALID_WAYPOINT`, `PERFORMANCE_LIMIT_EXCEEDED`,
`VIOLATION_ENDURANCE`, `VIOLATION_GEOFENCE`, `VIOLATION_AIR_TRAFFIC`,
`VIOLATION_TERRAIN`, `CAPABILITY_NOT_SUPPORTED`. All eight appear in-game.

## 2. Real interactions cut, and why

| Cut | Why |
|---|---|
| Weapon Employment / Validate Release Envelope (1.2.7) | Scope and tone; adds no new sequence semantics beyond the command cycle |
| Request Terrain Data / DTED (1.2.6.9) | Terrain exists in the sim, but the elevation-query protocol adds fidelity without an interesting decision; FA still rejects `VIOLATION_TERRAIN` |
| Checksum Validation / Query for Missing Data (1.2.4.1/2) | File-hash bookkeeping; no decision, pure ritual. Noted in-game when `FileMetadataMT.SHA_2_Hash` appears in route queries |
| MA Failsafe (1.2.1.3) | Candidate stretch level (designating a failsafe plan via `MA_ResponseMT` is a nice "insurance" mechanic) — out of base scope |
| Update C2 Control Designations (1.2.2.9) | Requires the C2 interface; out of this game's interface boundary |
| Receive Barometric Pressure (1.2.6.5) | Candidate 1-screen bonus level (`MA_SystemManagementRequestMT` QNH); cut from base scope |
| MA-VI Command Task generic flow (1.2.2.5) | Subsumed pedagogically by the flight-command cycle; `MA_TaskMT` appears only as FA's best-effort counter-offer |
| Receive Execution Status full family (1.2.6.6) | Only `RoutePlanExecutionStatusMT` and `TaskStatusMT` appear; the other six `*ExecutionStatusMT` siblings add reading, not deciding |

## 3. Lies we tell (explicit, surfaced in-game where practical)

1. **"FA" names the whole safety-critical side.** Real architecture: MA talks to a
   **VI OMS Isolator** at the Airworthiness Boundary; validation may be federated
   between the isolator and FA proper. The game collapses isolator + VMS + FA into
   one character called FA. One world-4 body re-introduces the isolator as a
   distinct latency/filtering stage.
2. **One MA service, one vehicle, perfect bus.** Real: pub/sub topics over an
   Abstract Service Bus (AMQ in the test harness), multiple services, QoS,
   out-of-order delivery. Game: single in-order bus, 1-tick delivery.
3. **Discrete ticks.** "Periodic" rates (e.g. 1 s default `ServiceStatus`) map to
   every-N-ticks; everything is deterministic and replayable. Real systems are
   asynchronous. Realtime mode paces tick advance on a wall-clock and pauses while the
   player composes a message, but the sim itself stays tick-discrete — the recorded
   session (`ScriptedInput[]`) replays identically.
4. **Short IDs.** `CMD-7`, `MULE-01`, `RTE-2` instead of UUIDs. Correlation
   semantics (CommandID ↔ status, CapabilityID ↔ control request) are preserved
   exactly; only the format is shortened.
5. **Pruned field sets.** Each message shows the fields the VI Volume's interaction
   tables mark required, plus discriminators (`CommandState` NEW/UPDATE/CANCEL,
   capability payload choice, `Ranking`). Omitted: security markings, timestamps
   (the tick is the timestamp), most optional fields. Kept fields are never renamed.
6. **2D world + altitude scalar.** Point-mass aircraft with turn-rate, climb/descent,
   and acceleration limits. Real: full 3D kinematics, body-axis limits scheduled
   against Mach, orientation-rate envelopes. The *shape* of the performance profile
   (airspeed-vs-altitude pairs, min/max altitude, turn/climb/descent limits) is real.
7. **Objectives arrive by magic.** Real missions arrive via C2/Mission Planning
   (Mission Data Package). Those are different L1 interfaces — different games.
8. **Silent ignore when not in control** is our reading of the spec ("VI… ready to
   start listening", ControlStatus with no SecondaryController = not accepting
   inputs). The spec doesn't define an explicit NACK for commands from
   non-controllers; we make FA visibly drop them in the log rather than invent a
   rejection reason.
9. **FA validators are deterministic and learnable.** Partially true to life: A-GRA
   deliberately specifies the interface, not FA internals — vendor FAs genuinely
   differ, which is the game's whole point. The lie is only that real FA behaviour
   may not be reproducible run-to-run.
10. **Curve following constants auto-filled.** Weights = 1.0 and the clamped knot
    vector [0×6, 1×6] are fixed by the spec for Bézier representation; the game
    fills them and shows them read-only rather than making the player type them.
    (`CurveFitMethod` alternatives like B_SPLINE/CATMULL_ROM exist in the schema
    but the game uses the Volume's Bézier formulation only.)
11. **Compliance scoring is per-level**, judged by our FA referee in the style of
    the official harness (interaction-level: right messages, right order, required
    fields populated) — but passing Brain Swap is not A-GRA compliance.
12. **Holding a zone = flying slowly through it.** HSA/CSA commands a flight *vector*;
    a fixed-wing body can't hover (`MinAirspeed` > 0). The MVP "enter-and-hold zone
    for N ticks" win (1.2) is satisfied by slowing to near min airspeed and transiting
    the zone, not station-keeping — the reference brain consumes
    `MA_PositionReportDetailedMT` to decide *when* to slow (the lesson). True loiter
    (Racetrack/Circle, §1.2.2.3) is a separate capability introduced in world 2.
13. **Control correlation by `CapabilityID`.** The real control request/assignment
    links control to a Controllee/ControlType (`MA_ControlDefinitionBaseType`), and
    `ControlStatus` identifies controllers by `SystemID`. The game correlates the
    whole acquisition handshake by `CapabilityID` (an extension of lie #4). Every
    field name shown — `RequestType`, `CapabilityID`, `ApprovalRequestProcessingState`,
    `PrimaryController`/`SecondaryController` — is real.
14. **The performance envelope is static (level 1.3).** Real FA *republishes* the
    profile as flight conditions change (Receive Vehicle Performance Values, 1.2.6.7
    — e.g. ceiling rises as fuel burns off). Level 1.3 advertises the envelope once at
    boot and validates against that fixed envelope. A dynamic, fuel-coupled envelope
    needs a fuel-burn model + an event schedule (a later world); the lesson here is
    only "read the profile, don't hardcode."
15. **The racetrack is flown by position thresholds, not timed legs (level 1.4).**
    Real loiter (Racetrack/Circle, §1.2.2.3) has FA-managed legs with real defaults
    (right turns; 60 s legs ≤14,000 ft MSL). Level 1.4 has the brain hand-steer a
    four-corner circuit, issuing a Direction-only `UPDATE` when a
    `MA_PositionReportDetailedMT` coordinate crosses a corner threshold. There is no
    brain timer yet, so legs are geometric, not timed; the waypoint zones sit on the
    straights (where position is stable) rather than on the turn arcs.
16. **The Type Certificate is graded by the test harness, not in-game (level 4.5).**
    The 4.5 "fly one locked brain across the whole airframe fleet" proof runs headless:
    the golden test runs the brain on every body in the level's `bodies` list and
    records the worst-of-three score (`aggregateWorst`). There is no in-game
    score-screen UI for the multi-body comparison yet.
17. **Fuel is a flat scalar with a U-curve burn (level 1.6).** Real endurance
    (`EnduranceBaseType`) carries `Fuel` (a `MassType`), `Duration`, `DurationEnd`, and
    `Percent`, inside a `NavigationReportMT` that also reports `SystemID`/`Source`/
    `ContingencyLevel`/`Navigation`. The game prunes to flat `Fuel` (kg) + `Percent`
    and burns a U-shaped fuel flow `minBurn + burnQuad·(speed − bestSpeed)²` per tick —
    a floor at the most efficient speed (a bit above the stall), rising gently toward
    the stall and steeply toward max speed (the generic aircraft fuel-flow curve). It's
    deterministic and learnable, not real aerodynamics. FA's endurance reserve check
    (`VIOLATION_ENDURANCE` when a commanded speed leaves `< minEnduranceTicks` of
    endurance) is a single threshold standing in for real FA energy management.

> **Exercised by the MVP (level 1.2):** lies #2 (single in-order bus), #3 (discrete
> ticks), #4/#13 (short ids + CapabilityID correlation), #6 (2D + altitude scalar),
> #8 (silent ignore when not controller), #12 (hold = slow transit).
>
> **Added by the post-MVP batch (1.1/1.3/1.4/4.5):** #14 (static envelope, 1.3),
> #15 (geometric racetrack, 1.4), #16 (headless type certificate, 4.5). 1.1 exercises
> the handshake (lie #8 bait); 4.5 leans on #6/#13 for one portable, profile-driven
> brain certified across the AX-01/02/03 fleet (the portability lesson the standalone
> 4.1 used to carry is now absorbed here).
>
18. **Collision avoidance is a fly-away plus a fault (level 4.2).** Real
    `MA_SubsystemFaultType` carries `FaultState`/`ComponentID` and FA's avoidance is a
    full maneuver against tracked traffic. The game prunes `MA_FaultMT` to
    `FaultID`/`Severity`/`FaultDescription`/`CapabilityID` and models the interrupt as:
    when the commanded vector would enter a threat within a fixed per-body lookahead,
    FA raises one CAUTION fault, overrides the target to fly directly away from the
    zone, and rejects any re-issued vector still entering a threat
    (`VIOLATION_AIR_TRAFFIC`) until MA commands a clear one. Threats are circles in the
    2D world (lie #6); pop-ups and motion are `spawn-threat` events.
19. **Same message, two buses (World 3 Mission Systems).** `SubsystemStatusMT` and
    `MA_FaultMT` flow on both the VI and MS interfaces in the real standard — the MS
    heartbeat is a pub/sub broadcast (any listener gets it); the VI heartbeat is directed
    to MA. The game collapses both onto its single in-order bus (lie #2); the message's
    `from` party (FA vs MS) distinguishes the source. MS is a real third bus party
    (`to:"MS"`), routed in `step()` and modelled by a parallel `MsBodyDef` + `ms/engine.ts`.
20. **MS isn't safety-critical — no REJECT gate (level 3.1).** The VI has the
    Airworthiness Boundary (FA retains final authority and REJECTs invalid commands). The
    MS interface has no equivalent: MA schedules sensors and *consents* to weapon release
    without an approve/reject cycle. The game makes this tangible by never returning a
    REJECTED disposition for a well-formed MS command — the feedback loop is task/subsystem
    status, not a validator gate. In 3.1, an on-demand `SubsystemStatusDataRequestMT` sent
    before the subsystem reaches OPERATE simply reflects the current state and never wins.
    The subsystem state timeline (INITIALIZATION→OPERATE) is deterministic, no RNG (rule #3).
21. **Sensor scheduling is simplified (level 3.2).** Real MS schedulers manage resource
    contention across many sensors and time-deconflict requests. The game models one AMTI
    capability with deterministic scheduling: a valid `AMTI_CommandMT` (advertised
    `CapabilityID`, a tasking interval that hasn't passed) is always accepted, goes ACTIVE
    after a fixed delay, and reports its tracks on a fixed timetable.
22. **Tracks are simulated, not sensed (level 3.2).** `EntityMT` tracks appear at
    deterministic ticks after the AMTI activity goes ACTIVE — there is no real radar return,
    and a track's position is authored, not computed from a sensor model. The teaching point
    (wait for the activity and the entity report rather than assuming instant intelligence)
    is preserved; the physics behind it is not.
23. **Store inventory is static; consent's C2 leg is implicit (level 3.3).** Real store
    management tracks station-by-station load, MDF variants, and compatibility testing; the
    game provides a fixed `StrikeCapabilityMT` at level start (one store type, one station).
    The real release-consent chain (MS Vol §1.2.10.10) also involves C2 authorizers beyond
    MA — the game models only the MA↔MS consent leg and assumes the C2 authorization.
24. **The DLZ is a single range ring (level 3.4).** A real Dynamic Launch Zone is an
    azimuth-array of ranges (min/optimal/max per bearing) and the WEZ complement adds more.
    The game collapses it to scalar minimum/optimal/maximum ranges and gates the strike on a
    single circular maximum: the weapon only releases once the vehicle is within
    `RangeMaxAero` of the target.
25. **Upload confirmation collapses `MA_SystemNotificationMT` (levels 2.1 / 2.3).** A
    route-upload handshake would naturally end in an `MA_SystemNotificationMT CONFIRMED`
    step, but that message carries no CONFIRMED state in the XSD. The game models upload and
    activation confirmation purely through `MA_MissionPlanActivationCommandStatusMT` state
    transitions (`READY_FOR_UPLOAD`→`UPLOADED`→`READY_FOR_ACTIVATION`→`ACTIVATED`, with
    `*_FAILED` on an out-of-order step) — fewer messages, all real, matching the spec's
    status-driven handshake.
26. **Pruned route content (levels 2.1 / 2.3, extends #5).** `MA_RoutePlanMT` shows a
    `RoutePlanID` plus a flat leg list ending in a terminal `RACETRACK` loiter
    (`OrbitEnum` on `MA_OrbitType`), not the full `RouteType`/`Path`/`PathSegment` nesting.
    The legs the player never authors are level geometry; FA flies them once the route is
    ACTIVATED and reports `RoutePlanExecutionStatusMT` `EXECUTING`→`COMPLETE`.
27. **Simplified curve — one `Curvature` (level 2.4, extends #10).** A curve is commanded
    with a single `Curvature` on `MA_FlightCommandMT`; the control points, `KnotVector`, and
    `Weight`s are auto-filled and shown read-only. The presence of `Curvature` selects the
    CurveFollowing mode. A curvature tighter than the body's `curve.maxCurvature` (radius
    below the minimum turn radius) is rejected with `PERFORMANCE_LIMIT_EXCEEDED`; a body that
    advertises no curve capability rejects with `CAPABILITY_NOT_SUPPORTED`.

> **Added by Phase 2–4:** #5/#6/#12 again for 2.2 (hand-flown no-fly avoidance), 1.6
> (Bingo), 4.2 (The Flinch) and 4.3 (Degraded); #17 (flat fuel + U-curve burn +
> endurance reserve, 1.6); #18 (collision interrupt fly-away + MA_FaultMT, 4.2). 4.3
> exercises #14 (the envelope is live — re-read the re-advertised MA_FlightCapabilityMT).
>
> **Added by Phase 5 (Mission Systems foundation):** #19 (same message on the VI and MS
> buses) and #20 (MS is not safety-critical — no REJECT gate), both surfaced by 3.1 Meet
> MS. The further MS simplifications #21–#24 (sensor scheduling, simulated `EntityMT`
> tracks, static store inventory, the implicit C2 leg of release consent) landed with the
> sensor/weapon/DLZ levels 3.2–3.4.
>
> **Added by World 2 (Navigation):** #25 (upload confirmation collapses
> `MA_SystemNotificationMT` into activation-status transitions) and #26 (pruned route
> content) for 2.1 Upload / 2.3 Retask, and #27 (a curve is one `Curvature`) for 2.4 First
> Curve. The route/curve execution state lives in `FaState` (`ms/engine.ts` lifecycle
> shape), tick-driven and deterministic (rule #3).

## 4. Honesty mechanisms

- **Fidelity CI**: `tools/check-fidelity.ts` extracts every message type, field
  path, and enum literal from the game's message catalog and greps
  `A-GRA_MessageDefinitions_v5_0_a.xsd`; unknown names fail the build.
- **In-game Fidelity Notes panel** per level: the subset of the list above that the
  level touches.
- **"In the real standard…" codex**: each message's inspector links to a short note
  with the real message's full context (volume section, omitted fields).
