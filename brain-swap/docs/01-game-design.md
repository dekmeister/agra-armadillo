# Brain Swap — Game Design Document (one page)

**Genre.** Realtime protocol puzzle, browser, single-player.
**Premise.** You *are* the Mission Autonomy brain. Each level hands you a *body* — an
airframe whose Flight Autonomy (FA) has a real performance envelope, status quirks,
and approval behaviour — and a mission objective. Your only contact with the vehicle
is the A-GRA Vehicle Interface: you read FA's live message stream and send VI messages
back, by hand, in (semi-)realtime. The real MA is a complex autonomous agent, not a
linear script; making the *player* be that agent forces the real decision-making while
constraining every action to honest VI messages. Late game, you re-fly the same
exchange on new bodies; the better you read against *capabilities* (the advertised
profile) instead of *constants*, the less changes. That portability payoff is A-GRA's
entire reason to exist, experienced rather than explained.

**Core loop.** (1) Read the mission card and the body's spec sheet (its advertised
`MA_FlightCapabilityMT` performance profile). (2) Press play; FA's stream advances one
tick at a time. (3) When you decide to act, **Compose** a message (the clock pauses):
pick the MA→FA type, fill its fields, send. It reaches FA next tick; FA's reply the
tick after — plan the round-trip. (4) Read rejections (`MA_FlightCommandStatusMT` with
`ValidationResult`) and the Telemetry panel, adjust, continue. (5) Pass, then optimize
against three metrics. The run is deterministic: a session is a recorded input script,
so it replays and scores identically.

**The teaching mechanic is FA.** FA always retains control and only *listens* to MA
when MA holds secondary capability control. Commands sent without control are
silently ignored (true to the spec — FA isn't listening). Commands that violate the
envelope, geofences, terrain, or endurance are rejected with the real enum reasons.
FA may counter-offer a best-effort task (`MA_TaskMT`); FA can revoke control or go
`TEMPORARILY_UNAVAILABLE` mid-mission. Every one of these is a real VI interaction,
and every one is a puzzle obstacle, not flavor text.

**Player-as-brain model (realtime).** You hand-author the MA's behaviour *as you go*
instead of pre-wiring a state machine. The interface you act through is the honest VI:
a **Compose** form that offers only the level's MA→FA message types and their real
catalog fields (literal values; validated against the advertised envelope exactly as
FA validates). A **Telemetry** panel distils the latest value of each field FA has
published so you can decide when to act. The sim is still tick-discrete and
deterministic; the only realtime element is *when* the clock advances (wall-clock
pacing, paused while you compose). A session is recorded as a `ScriptedInput[]` and can
be replayed bit-for-bit — the same property the old state machine had. *(History: the
game originally had a visual state-machine editor; it was replaced because its linear
shape mis-taught the MA as a simple program. The brain interpreter survives in
`packages/core` only to derive each level's reference script. Future assists — e.g.
automated field-watches that auto-pause on a matching value — are in `PLAN_FUTURE.md`.)*

**Scoring (multi-metric, per-level pars).**
- **Ticks** — mission time.
- **Bus traffic** — MA→VI messages sent (rewards partial HSA updates, route reuse).
- **Rejections** — rejected commands + ignored-while-not-controller sends (rewards
  reading the performance profile instead of probing FA by trial and error).
- *(Brain size was dropped with the state-machine editor — nothing to size now.)*

**Win conditions** are world-state based (reach zone, hold pattern N ticks, land at
the stored divert field), never "message sent" — forcing the brain to consume
`MA_PositionReportDetailedMT`, `NavigationReportMT`, and capability status to know
where it is and what it may do. A competent MA consumes state data; an incompetent
one can't even tell it has arrived.

**Progression.** World 0: listen before you speak. World 1: HSA/CSA (handshake,
envelope, partial commands, wind, endurance, counter-offers). World 2: Waypoint
Following (route upload state machine, loiters, read-only safety-critical routes,
supersede vs deactivate). World 3: Curve Following (quintic Béziers, append,
end-of-curve behavior). World 4: Brain Swap (ports across bodies, faults, flinchy
FAs, heartbeat discipline; capstone: one brain, three bodies, zero edits).

**Tone & presentation.** Clean engineering-console aesthetic: tactical map (PixiJS),
message log as the debugger, score screens styled as compliance test reports.
Fiction kept thin — the standard itself is the star. Each level has a "Fidelity
Notes" panel stating exactly what is simplified relative to ASK 5.0a, so the game
never teaches something false.

**Refinements adopted over the original pitch** (challenged per the brief):
boilerplate-avoidance via interaction blocks rather than per-level rewiring;
deterministic ticks rather than real time (replayable, scoreable, steppable);
"rejections" scored but with per-level pars so discovery levels don't punish
legitimate probing; robustness pressure (mid-run FA events) placed *before* the
swap world, because portability only pays off for brains already written
defensively.
