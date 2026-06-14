# Brain Swap — Game Design Document (one page)

**Genre.** Zachtronics-style open-ended programming puzzle, browser, single-player.
**Premise.** You are an MA vendor. Each level hands you a *body* — an airframe whose
Flight Autonomy (FA) has a real performance envelope, status quirks, and approval
behaviour — and a mission objective. You build a *brain*: a visual state machine
whose only contact with the vehicle is the A-GRA Vehicle Interface. The standard
interface is the only way to touch the aircraft. Late game, your existing brains
are re-flown on new bodies; the better you wrote against *capabilities* instead of
*constants*, the less you have to change. That portability payoff is A-GRA's entire
reason to exist, experienced rather than explained.

**Core loop.** (1) Read the mission card and the body's spec sheet (its advertised
`MA_FlightCapabilityMT` performance profile). (2) Wire/edit the brain: states,
message-triggered transitions with field guards, and send-actions with field forms.
(3) Run a deterministic fixed-tick simulation; watch the aircraft, the message log,
and the live-highlighted brain state. (4) Read rejections (`MA_FlightCommandStatusMT`
with `ValidationResult`), fix, re-run. (5) Pass, then optimize against four metrics.

**The teaching mechanic is FA.** FA always retains control and only *listens* to MA
when MA holds secondary capability control. Commands sent without control are
silently ignored (true to the spec — FA isn't listening). Commands that violate the
envelope, geofences, terrain, or endurance are rejected with the real enum reasons.
FA may counter-offer a best-effort task (`MA_TaskMT`); FA can revoke control or go
`TEMPORARILY_UNAVAILABLE` mid-mission. Every one of these is a real VI interaction,
and every one is a puzzle obstacle, not flavor text.

**Brain model.** Visual state machine (the VI Volume's interactions *are* state
machines). Primitives: states; transitions triggered by a message type + field
guard, or by tick timers; actions that send a message (form populated with literals,
stored variables, or fields captured from received messages) or set variables.
Recurring interactions the player has already built (e.g. the control-acquisition
handshake) can be collapsed into reusable **interaction blocks** — composite states
instantiated across brains. Blocks are the in-game embodiment of "implement the
interaction once, reuse it everywhere," and what makes brain portability tangible.

**Scoring (Zachtronics multi-metric, per-level histograms).**
- **Ticks** — mission time.
- **Bus traffic** — MA→VI messages sent (rewards partial HSA updates, route reuse).
- **Rejections** — rejected commands + ignored-while-not-controller sends (rewards
  reading the performance profile instead of probing FA by trial and error).
- **Brain size** — states + transitions + blocks (elegance).

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
