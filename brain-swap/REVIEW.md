# REVIEW.md — Critical review & consolidated work plan

> **This is the single working document for Brain Swap from here on.** It merges the
> 2026-07-05 critical review (UI / gameplay / learning) with the surviving work from
> `PLAN_FUTURE.md`, `PLAN_LEVELS.md`, and `PLAN_LEVELS_FINALS.md`, which it supersedes
> (their content is folded in below or explicitly cut; git history has the originals).
>
> **How to use:** each Work Stream (WS-1 … WS-13) is written to be handed to a fresh
> Claude Code session as a standalone prompt: "Read CLAUDE.md and REVIEW.md, then
> execute WS-N." Work them roughly in order — WS-1/WS-2 are cheap and unblock the rest.
> Every WS ends with the same verification bar: `npm run typecheck && npm run
> typecheck:game && npm run fidelity && npm test`, plus a manual `npm run dev` play of
> anything touched. CLAUDE.md hard rules apply throughout (XSD-verified names only,
> recorded simplifications, deterministic headless core, spec questions to the source).

---

## 1. Vision (revised thesis — supersedes docs/01's premise)

**The player IS the Mission Autonomy. The game teaches what MA *is* by making the
player perform its job: reading and driving the A-GRA interactions with Flight
Autonomy (FA) and Mission Systems (MS), live, message by message.**

What changed and why:

- **Portability is no longer the thesis.** "One brain, zero edits, three airframes"
  was the payoff of the removed state-machine editor — you were *designing* an MA
  artifact that could port. In realtime mode there is no artifact; the player is not
  designing the MA, they are *being* it. The old capstone (4.5 "Type Certificate")
  and all "zero edits" framing go away.
- **Flying different aircraft stays.** Body variety (Mule / Heron / Ferret / route
  variant / Boxkite-to-come) is how the game *implicitly* conveys that the interface
  is body-agnostic: the same messages, handshakes, and envelope-reading skills carry
  across airframes with different numbers and quirks. That is portability taught by
  experience, without ever being the stated lesson. WS-6 adds lightweight "challenge
  airframe" re-flights to lean into this.
- **The curriculum is the interaction patterns** — what a competent MA does:
  1. *Listen first* — consume the stream; capability/status/position are data on the bus.
  2. *Acquire before commanding* — the control handshake; FA always retains authority.
  3. *Command inside the advertised envelope* — and treat rejection enums as information.
  4. *Negotiate* — a rejection can carry a counter-offer (to build: WS-4).
  5. *Drive multi-step protocols* — the route upload/activation liturgy.
  6. *Task the payload* — MS scheduling, consent chains, DLZ geometry; and understand
     that MS fails *quietly* where FA rejects *loudly*.
  7. *Stay robust* — faults, interrupts, re-advertised envelopes, mid-mission retasks.
  8. *Be a good bus citizen* — heartbeat/comms discipline; MA has obligations, not
     just privileges (to build: WS-5).
  9. *Orchestrate* — run FA and MS in parallel on one mission (capstone: WS-6).

The honesty machinery (fidelity gate, lies list, VI-volume citations) is unchanged and
remains the game's backbone.

---

## 2. Verified findings register

Facts below were verified against the code during the review — future sessions can rely
on them without re-deriving (re-check line numbers, they will drift):

| # | Finding | Evidence |
|---|---------|----------|
| F1 | `Course` is offered by the composer (in `tier1.yaml` → `MA_FlightCommandMT`) but the FA engine reads only `cmd.Heading`; `Course` appears nowhere in `fa/engine.ts`, `fa/validator.ts`, or `pointmass.ts`. A Course-only command is ACCEPTED and does nothing directional — an unrecorded lie. | grep verified |
| F2 | `BodySpecSheet` (`packages/game/src/run/MissionPanels.tsx`) renders `body.capabilities` — the static body def, not the bus. Envelope is visible before FA advertises it, and in 4.3 the panel shows the stale boot envelope after `degrade-envelope` re-advertises, while its own footer claims it shows "the same envelope FA validates against". | `capEntries(body, level.capabilityId)` |
| F3 | `hints.ts` `VIOLATION_ENDURANCE` hint ends "(Introduced in later levels.)" — but 1.6 Bingo is built and that's exactly when it's read. `VIOLATION_AIR_TRAFFIC` ("Later levels.") is 4.2's core rejection; `VIOLATION_GEOFENCE` similar. | `packages/game/src/meta/hints.ts:17-21` |
| F4 | `scrubTo` is implemented in the store but no UI calls it — there is no timeline scrubber despite store comments and docs claiming scrub-back review. | grep verified |
| F5 | `recordResult` (store) keeps only the fastest *winning* run; all three medals bind to that run, so a slower run with better Bus Traffic / Rejections is discarded. Per-metric optimization is impossible to bank. | `store.ts` `recordResult` |
| F6 | `submitComposer` force-sets `running: true` — sending yanks a deliberately paused/step-wise player back into motion (at 8× you can blow past the reply). | `store.ts` |
| F7 | `restart()` does not reset `commandSeq` (`selectLevel` does) — after Restart the composer prefills CMD-continuing-from-last-run. | `store.ts` |
| F8 | `scoreWorld` counts as rejections only: `ignored-not-controller`, `MA_FlightCommandStatusMT REJECTED`, `MA_ControlRequestStatusMT REJECTED`. MS quiet-CANCELs and route-liturgy `*_FAILED` steps score zero; every sampled level sets `pars.rejections: 0` (contradicting docs/01's "pars so discovery levels don't punish probing"). | `score.ts` |
| F9 | `evaluateDiagnostics` fault signals cover control-rejection, ignored sends, flight-command rejections, flameout, breach, racetrack bus-par — nothing MS-side. On 3.1–3.5 a sloppy run (early status request latching the wrong state, CANCELED AMTI command, long-ignored MS fault) still reads "✓ DEMONSTRATED"; 2.1 liturgy fumbles likewise. | `level/diagnostics.ts` |
| F10 | Telemetry panel: objective progress row exists only for `reach-hold` / `hold-control`; `ms-track` (tracks N/M), `waypoint-sequence`, `route-complete`, `ms-strike` have no live progress readout. FA rows dominate the left column even on MS-centric levels. `MsPanel` shows subsystem/service state only — no AMTI activity state or track count. | `TelemetryPanel.tsx`, `MsPanel.tsx` |
| F11 | The map cursor readout and code comments label flat meters as "LAT/LON". | `TacticalMap.tsx` map-coords |
| F12 | `BodySpecSheet` hardcodes `MaxAltitude` as the highlighted "binding constraint" on every level (wrong emphasis in 1.6 — speed/fuel binds — and 2.4 — turn radius binds). | `MissionPanels.tsx` |
| F13 | Composer is a full-screen modal: telemetry/spec/map/log are occluded while composing (the player must memorize envelope numbers and geometry first), and a stray backdrop click cancels, discarding all typed fields. No units are shown for any numeric field anywhere in the game; heading convention (0 = north, clockwise) is never stated; there is no bearing/range tool for picking a heading. | `MessageComposer.tsx` |
| F14 | Onboarding: tutorial 0.0 is watch-only, then 1.1 is unaided — no guided first compose. Default boot level is 1.2 (`DEFAULT_LEVEL_ID`), skipping 0.0/1.1 for a visitor who dismisses the welcome card. Welcome overlay and tutorial dismissal are in-memory only (reappear every reload) while best scores *do* use localStorage. | `store.ts`, `WelcomeOverlay.tsx` |
| F15 | Level Select: never-attempted levels are labeled "▶ resume"; "locked" means "not built" (there is no progression gating); the T/B/R medal chips have no on-screen legend. "Test Report" in the nav renders a stampless report mid-run (outcome RUNNING). World 0 doesn't appear at all (not even locked rows). | `LevelSelect.tsx`, `App.tsx` |
| F16 | Speed keys: 1/2/3 map to 1×/2×/8× — pressing "3" produces "8×". | `App.tsx`, `ChromeBar.tsx` |
| F17 | CLAUDE.md references `RESEARCH_MS.md` and `PLAN_MS.md`, which no longer exist in the repo. | `ls` verified |

Two review themes with no single code locus, for context:

- **The restart loop is the biggest tedium generator.** Every mistake or optimization
  attempt means full Restart → re-wait AVAILABLE → re-ACQUIRE → re-command. Fixed by
  WS-7 (rewind & branch), which determinism makes cheap.
- **Silent failures present as dead air.** Ignored-not-controller sends, MS quiet
  CANCELs, and mistyped-but-valid fields all produce an unresponsive screen with no
  eye-catch. The log records the disposition; nothing surfaces it. Fixed by WS-3.

---

## 3. Work streams

### WS-1 · Honesty & copy fixes *(small; do first)*

**Goal:** the game never shows something false. Five independent fixes (F1, F2, F3,
F11, F12):

1. **Remove the `Course` trap (F1).** Delete the `Course` field from
   `MA_FlightCommandMT` in `packages/levels/catalog/tier1.yaml`; run
   `npm run gen:catalog && npm run fidelity`. Remove the `Course` branch in
   `level/diagnostics.ts::summarizeSend` and the `crs` mention. Course returns with
   WS-13 (Winds Aloft), where the engine will actually honor it. Check no reference
   brain or golden log carries `Course` (none found in review, but verify —
   `grep -rn Course packages/levels/worlds packages/levels/test`).
2. **Spec sheet reads the bus (F2).** Rework `BodySpecSheet` to derive envelope rows
   from the latest `MA_FlightCapabilityMT` per capability in `world.log` (there is a
   `latest()` helper in `console/telemetry-utils.ts`). Before the first advert, show
   "awaiting capability advertisement…". This makes 4.3's re-advertised envelope
   live-update (the panel's footer claim becomes true) and quietly teaches "the
   profile is data on the bus". Decide what to do with `MaxTurnRateDeg`/`MaxClimbRate`
   (they come from `body.flight` and are *not* advertised): either grep the XSD for
   fidelity-clean advertised names and add them to the catalog + FA advert, or move
   them to a visually separated "airframe data (not on the bus)" block. Do not
   invent names (hard rule #1).
3. **Fix stale hints (F3).** In `packages/game/src/meta/hints.ts`, write real teaching
   copy for `VIOLATION_ENDURANCE` (point at NavigationReportMT fuel + slowing to an
   efficient cruise — the 1.6 lesson), `VIOLATION_AIR_TRAFFIC` (yield, vector clear,
   wait for the fresh capability advert — the 4.2 lesson), `VIOLATION_GEOFENCE`
   (route around; note 2.2's breach-fail flavor doesn't reject — see fidelity notes).
   `VIOLATION_TERRAIN` may keep a "not modeled" note.
4. **Kill the LAT/LON lie (F11).** Map cursor readout and any player-visible copy:
   "X … · Y … (m)". Code comments can keep the lie-#6 mapping explanation.
5. **Level-aware constraint highlight (F12).** Either drop the hardcoded MaxAltitude
   caution in `BodySpecSheet` or drive it from level data (e.g. an optional
   `LevelDef.bindingConstraint` key rendered in caution). Simplest honest option:
   drop it.

**Acceptance:** full verification bar; manually play 1.2 (spec sheet fills in after
the advert), 4.3 (spec sheet updates mid-run after the degrade event), and confirm a
rejected 1.6 command shows the new endurance hint.

---

### WS-2 · Thesis alignment pass *(docs + naming; mostly prose)*

**Goal:** everything the player and the docs say matches §1's vision; no artifact of
the portability thesis or the removed brain-editor steers future work.

- **`docs/01-game-design.md`:** rewrite the premise/progression/scoring rationale
  around §1 (player-as-MA, interaction-pattern curriculum, multi-airframe as implicit
  flavor). Drop "portability payoff is A-GRA's entire reason to exist" and the World 4
  brain-swap framing.
- **`docs/03-levels.md`:** retitle World 4 (suggestion: **"Contingencies"** — 4.2
  Flinch, 4.3 Degraded, plus the WS-6 capstone). Remove/rewrite the 4.5 Type
  Certificate entry (WS-6 replaces it) and the 4.1 tombstone's portability language.
  Decide World 0's fate here: **recommendation — cut 0.1/0.2 as levels** (their
  lessons are now carried by tutorial 0.0, level 1.1's baits, and WS-1's
  spec-sheet-from-bus change) and record the cut.
- **`CLAUDE.md`:** update the header paragraph and locked-decisions to the new thesis;
  fix dangling references (F17): `RESEARCH_MS.md`, `PLAN_MS.md`, and the superseded
  `PLAN_FUTURE.md`/`PLAN_LEVELS*.md` all → this file.
- **Player-facing copy:** `Help.tsx` ("re-flying one brain across airframes (4.5)"
  and the level list), `LevelSelect` capstone chip ("◆ Capstone · zero edits" → new
  capstone wording), `levelCatalog.ts` W4 name. Leave 4.5 playable/wired until WS-6
  replaces it — this WS is copy only.
- **Game title:** "Brain Swap" no longer names a mechanic. Flag for the user with 2–3
  candidate names; **do not rename without their decision** (brand, repo, package
  names all follow from it).
- **Code:** none required. `brainSize`, `aggregateWorst`, locked/reference brains stay
  as test infrastructure; just stop describing them as the point of the game.

**Acceptance:** grep for `portab`, `zero edits`, `brain` in `docs/` and
`packages/game/src` player-visible strings; every remaining hit is either the game
title (pending user decision) or an accurate description of test infrastructure.

---

### WS-3 · MS parity: debrief signals, silent-failure feedback, objective telemetry

**Goal:** the MS half of the curriculum gets the same feedback quality as the FA half,
and silent failures stop being dead air. (F8-adjacent, F9, F10; scoring itself is WS-10.)

1. **Debrief fault signals (F9).** In `packages/core/src/level/diagnostics.ts`, add
   fault signals (and recap events) for:
   - `AMTI_CommandStatusMT` with `CommandProcessingState === "CANCELED"` — note copy:
     "MS quietly canceled your sensor command — reference the advertised CapabilityID
     and a time window that hasn't passed; MS doesn't REJECT, it just doesn't collect."
   - `MA_MissionPlanActivationCommandStatusMT` with a `*_FAILED` `ActivationState` —
     "You skipped or reordered a liturgy step."
   - An `ms-status` objective won after sending `SubsystemStatusDataRequestMT` while
     the subsystem was not yet in the required state (the 3.1 bait) — derive from the
     log order, deterministically.
   - An MS-side `MA_FaultMT` that was never answered with an `AMTI_CommandMT CANCEL`
     (the 3.5 bait).
   Keep verdicts pure functions of `World` + script + level (golden-test friendly);
   extend the diagnostics test in `packages/levels/test/diagnostics.test.ts`.
2. **Surface silent failures in-run.** The message log must catch the eye when an MA
   send lands badly: a transient flash/pulse on new rows whose disposition is
   `ignored-not-controller`, and on `AMTI_CommandStatusMT CANCELED` /
   `*_FAILED` liturgy replies (CSS animation on `LogRow`; the badge machinery in
   `ui/tokens.ts::badgeFor` already classifies). Add `hints.ts` entries for the AMTI
   quiet-CANCEL and liturgy `*_FAILED` states (the liturgy *success* states already
   have hints — mirror that pattern for the failure states).
3. **Objective progress for every kind (F10).** In `TelemetryPanel` (or `MsPanel` for
   MS kinds), add live progress rows: tracks collected N/M (`ms-track`), waypoints
   passed N/M, route execution state, strike task state (`ms-strike`). The world state
   needed already exists (`world.ms.tracks`, objective/hold state); keep it to one row
   per kind, same visual language as "Objective hold".
4. **MS-centric layout.** On levels with `msBody` and no flight objective (3.1/3.2),
   render `MsPanel` above the FA telemetry, expanded by default, and add an AMTI
   activity-state row (latest `AMTI_ActivityMT.ActivityState`) so the player watches
   the schedule advance without digging in the log.

**Acceptance:** verification bar; play 3.1 taking the bait (early request) and see the
debrief say NOT DEMONSTRATED with the latch note; play 3.2 with a wrong CapabilityID
and see the log flash + hint + debrief signal; play 2.1 fumbling the order once and
see the `*_FAILED` recap row.

---

### WS-4 · Level 1.7 "Counter-Offer" *(new mechanic + level — rejection as negotiation)*

**Goal:** teach that a rejection can open a negotiation — FA suggests achievable
parameters and MA resends. This is a core FA-interaction mode (VI §1.2.2.5) the game
currently never shows. *(Folded from PLAN_LEVELS_FINALS, updated for realtime.)*

- **Mechanic (core):** an FA counter-offer path in `fa/engine.ts`: when a flight
  command is rejected for a recoverable envelope reason (e.g. over-ceiling), FA also
  emits an `MA_TaskMT` carrying a best-effort suggested command (the achievable
  altitude). Must be a pure, deterministic function of the rejected command + the
  advertised envelope.
- **Catalog:** `MA_TaskMT` on the FA bus (direction FA->MA). **Grep the XSD first**
  for the real Flight-task field names before authoring; record the collapse as a new
  fidelity lie in `docs/02-fidelity.md` + `fidelityNotes.ts`.
- **Level data:** World 1, body AX-02 Heron (ceiling 8000 makes the over-ask natural).
  Objective `reach-hold` above a naive read of the zone; brief steers the player to
  ask high, get rejected+countered, read the suggested value from the log/telemetry,
  resend. Bait (naive brain): resend the original value → rejected again → timeout.
  The reference brain can read the suggested field via the existing `{ msg: … }`
  capture (see 4.3's reference brain).
- **UI:** an `MA_TaskMT` hint in `hints.ts` ("FA countered with parameters it *can*
  fly — read them and resend") and make the log row for it visually inviting (it's
  the level's pivot).
- **Full "Adding a level" checklist** (CLAUDE.md): level JSON + reference/naive
  brains, registry, dump-log map, golden test + `realtime-replay.golden.test.ts`
  CASE, `playable: true`, pars from a measured run, docs/03 entry.

**Acceptance:** verification bar; the golden negative test asserts the naive brain
fails the documented way; manual play confirms the counter-offer is discoverable
without reading the level JSON.

---

### WS-5 · Level 4.4 "Heartbeat Discipline" + AX-04 *(new mechanic + level — MA's obligations)*

**Goal:** the only level where MA has *duties*: publish a periodic heartbeat or lose
control. Nothing playable currently teaches that MA is a bus citizen with obligations.
*(Folded from PLAN_LEVELS_FINALS; realtime dissolves the old blocker — the player just
sends the heartbeat by hand, no brain-DSL timer needed.)*

- **Mechanic (core):** FA heartbeat tracking in `fa/engine.ts`: a body-configured
  cadence (`heartbeatIntervalTicks` on the new body); FA tracks the last MA
  heartbeat tick; on a missed cadence FA revokes secondary control
  (`MA_ControlRequestStatusMT` CANCELED + `ControlStatusMT` with no
  SecondaryController) and MA must re-ACQUIRE. Deterministic, tick-driven.
- **Catalog caution:** the heartbeat message is `ServiceStatusMT`, which exists in
  `tier2-ms.yaml` with direction `MS->MA`. MA→FA needs its own catalog entry /
  direction handling — check how `loadCatalog` merges and whether a second entry with
  a different direction is representable before building; if not, that's the first
  design decision to settle (with the XSD open). Record whatever shape ships as a
  fidelity note.
- **New body:** AX-04 "Boxkite" in `packages/levels/bodies/` — the designed W4
  oddball (strict heartbeat discipline). Keep its flight envelope unremarkable; the
  discipline is the quirk.
- **Reference-solution caution:** the brain DSL has no periodic trigger, so the
  reference *brain* can't express "send every N ticks". Options: (a) author a
  committed `*.reference-script.json` and make this level's golden test
  `replayScript`-only (the migration path already sketched for dropping brains —
  do it for this level only); (b) minimally extend the DSL with a periodic trigger
  (**don't extend the DSL without the user** — ask first). Option (a) is recommended.
- **Level data:** objective `hold-control` with the twist that holding now requires
  the cadence. Bait: stop publishing → revocation → the debrief needs a fault signal
  for "control revoked — you missed the heartbeat" (extend diagnostics like WS-3).
- Full "Adding a level" checklist as in WS-4.

**Acceptance:** verification bar; a golden negative test where the heartbeat stops
and control is revoked; manual play confirms the cadence is readable from the brief +
spec sheet (the player must know N).

---

### WS-6 · Capstone "Full Mission" (replaces 4.5) + challenge airframes

**Goal:** the climax of the new thesis — one mission, both interfaces, live faults —
plus a lightweight mechanism that keeps multi-airframe value (implicit portability).

1. **Retire 4.5 Type Certificate.** Remove the level data/locked brain/golden test,
   registry rows, dump-log entry, catalog row (the WS-2 copy changes land for real
   here). Keep `aggregateWorst` in core (harmless, tested) or delete it — implementer's
   call; if deleted, update `score.ts` tests/docs.
2. **New capstone (id 4.5, name suggestion "Full Mission").** Level data only if
   possible (the engines already coexist): FA airframe **AX-03 Ferret** (agile,
   flinchy) + an MS Talon body. Mission shape: acquire control → transit to station
   with a `spawn-threat` collision interrupt en route (4.2's mechanic) → schedule the
   sensor (3.2) → DLZ + fire + consent (3.4) → a mid-run MS fault forcing a re-task
   (3.5). Objective `ms-strike` (+ `avoid` zones — `avoid` composes with any
   objective kind). Trim scope during tuning if the run gets long — the essential
   bar is: *both interfaces active in one run, at least one fault on each side*.
   Verify the MS engine's strike gating and the FA threat interrupt don't interact
   badly (they share the tick loop but touch different state).
3. **Challenge airframes (the implicit-portability hook).** Per level, an optional
   `challengeBody` (or reuse `LevelDef.bodies`) — a second airframe the level can be
   re-flown on from Level Select ("Re-fly on the Heron"), earning a per-level chip.
   Store: selecting a challenge run swaps the body (the level `start` override and
   pars may need per-body variants — keep pars for the primary body only and make the
   challenge chip completion-based, not medal-based, to avoid a par-tuning explosion).
   Start with 2–3 levels where the envelope difference actually bites (1.2 on the
   Heron: approval latency + low ceiling; 2.4 on a curve-capable body swap; 1.4 on
   the Ferret: fast turns). Golden coverage: one `realtime-replay` CASE per shipped
   challenge variant proving solvability.

**Acceptance:** verification bar; capstone golden + replay CASE + negative test
(ignore the MS fault → timeout); challenge runs recorded and visible in Level Select;
manual full playthrough of the capstone.

---

### WS-7 · Rewind & branch *(transport; biggest fun-per-effort fix)*

**Goal:** kill the full-restart loop. The sim is deterministic and every frame is
kept — scrub back, then *resume from there*, keeping the script up to that point.

- **Scrubber UI (F4):** a timeline strip in/under `ChromeBar` bound to the existing
  `store.scrubTo` (it works; it's just unreachable). Scrubbing pauses and moves
  `playhead`; the log/telemetry/map already render `timeline[playhead]`.
- **Branch-from-playhead:** a "Resume from here" action when `playhead <
  timeline.length - 1`: truncate `timeline` to `playhead + 1`, truncate `script` to
  inputs with `tick < timeline[playhead].tick`, clear `pendingInputs`, resume live.
  Mind the `extractScript` back-dating convention when picking the cutoff (inputs are
  recorded at the tick they were *injected*); write a store unit test proving a
  branched run replays byte-identically to a straight run with the same inputs.
  Tutorial demo levels: disable branching (keep watch-only semantics simple).
- **Score/best-run integrity:** a branched run is still one honest `ScriptedInput[]`
  session — no special-casing needed, but assert that in the test.
- **Quality-of-life while here (F6, F7):** `submitComposer` preserves the
  pre-compose `running` state instead of force-playing; `restart()` resets
  `commandSeq`.
- *(Deferred, folded from old PLAN_FUTURE §3: "ghost" replay of your best run and
  session export/import. Only if the session has spare capacity — the branch feature
  is the point.)*

**Acceptance:** verification bar + the new store test; manual: fumble 1.3, scrub back
before the bad send, resume, win — without re-doing the handshake.

---

### WS-8 · Watches & event-skip *(kill the vigilance tax)*

**Goal:** waiting for a value to change stops being the core skill. *(Folded from old
PLAN_FUTURE §1 — the design there was sound; summary below is self-contained.)*

- **Field watches:** declarative auto-pause rules — e.g.
  `MA_ControlRequestStatusMT.ApprovalRequestProcessingState == APPROVED → pause`.
  Reuse `evaluateGuard` (`packages/core/src/brain/evaluator.ts`) — a watch is exactly
  a `Guard` (`field`/`op`/`value`) evaluated against each delivered payload, keeping
  watch semantics fidelity-clean. Store: `watches: Watch[]`; in `advanceLive`, after
  each delivered inbound message, test active watches; on hit set `running: false` +
  highlight the matching log row / telemetry row. UI: small watch list in the left
  column; an "add watch" affordance on telemetry rows is the natural entry point.
  Watches are *assists*, not part of the recorded script — replay determinism is
  untouched.
- **Event-skip:** a transport button "▸▸ next message" — advance ticks until the next
  non-periodic log entry (or a watch hit / terminal outcome), then pause. Cheap
  (loop `advanceLive(1)` with a filter) and immediately removes hold/transit tedium
  (30-tick holds, 2.1's spectator stretch, MS boot timelines).
- Teaching angle: watches are how the player graduates from "manual reflexes" to
  "programming their own triggers" — the closest realtime gets to authoring an MA.
  Consider introducing them in a mid-W1 brief.

**Acceptance:** verification bar; a watch on APPROVED pauses 1.1 at the right tick;
event-skip crosses 2.1's EXECUTING stretch in one press; goldens untouched.

---

### WS-9 · Composer ergonomics & onboarding

**Goal:** composing stops requiring memorization; new players get a guided first send.
*(Folds old PLAN_FUTURE §4.)*

1. **Non-occluding composer (F13).** Replace the centered modal with a docked panel
   (left column, over/replacing telemetry) so map, spec sheet, and log stay visible
   while composing. Keep the two-step flow (typeahead → fields) and keyboard model.
   Backdrop-cancel must go; Esc still cancels but a confirm (or field-state
   preservation on reopen) protects typed work.
2. **Units + conventions (F13).** Add a `unit` string to catalog field entries
   (game-side metadata, not XSD content — but sanity-check units against the VI
   volume; e.g. altitude m, speed m/s, heading degrees true, 0 = north, clockwise)
   and render it as a suffix in the composer, spec sheet, and telemetry. State the
   heading convention in Help.
3. **Bearing/range tool (F13).** Map readout: alongside cursor X/Y, show bearing and
   range *from the aircraft* to the cursor — this removes the mental-trig wall in
   2.2/3.4 without dumbing anything down. (One `atan2`; the camera transforms exist.)
4. **Value affordances.** Prefill/suggest from live data where honest: envelope
   min/max shown next to Altitude/Speed fields (from the *advertised* profile, per
   WS-1.2), latest position shown in the composer header. Keep FA as the validator —
   don't client-block envelope violations (that's the teaching mechanic).
5. **Guided first compose (F14).** Extend `TutorialCoach` (anchors already exist) so
   level 1.1's first play walks the ACQUIRE send: coachmark on Compose → typeahead →
   the two fields → Send, then hands off. Dismissible, shows once (persist dismissal —
   see 6).
6. **Onboarding hygiene (F14).** Persist welcome/tutorial dismissal (localStorage,
   like best scores — revisit the old "no persistence" call with the user if needed);
   default boot level → tutorial 0.0 for a fresh profile, else last-played (persist
   current level id); rewrite the Welcome card's first paragraph to say what the
   player *does* before introducing acronyms.

**Acceptance:** verification bar; compose in 1.3 while reading the spec sheet
(nothing occluded); a fresh-profile run lands on the tutorial and the 1.1 guided
compose fires once.

---

### WS-10 · Scoring integrity

**Goal:** the three metrics mean what they say, per world, and can be optimized
independently. (F5, F8.)

1. **Per-metric bests (F5).** Store per-level, per-metric best values across winning
   runs (or the Pareto set) instead of one fastest run; medals in Level Select and
   the debrief read per-metric bests. Migrate the existing `brain-swap:best`
   localStorage shape gracefully (version the key).
2. **Count MS/liturgy failures (F8).** Extend `scoreWorld` rejections (or add a
   fourth "faults" readout — decide with one eye on UI space) to include AMTI
   quiet-CANCELs of MA commands and `*_FAILED` liturgy replies, so the metric doesn't
   go blind in Worlds 2–3. **This changes golden pars** — re-measure every affected
   level with `npx tsx tools/dump-log.ts` and update `pars` + tests in the same
   change.
3. **Honest rejection pars (F8).** Revisit `pars.rejections: 0` on first-encounter
   levels (1.3, 2.2, 2.4 …): docs/01 promises "pars so discovery levels don't punish
   legitimate probing" — either set nonzero pars there or drop that sentence in the
   WS-2 pass (coordinate).

**Acceptance:** verification bar with all pars re-tuned; a run that wins slowly with
gold Bus Traffic banks that medal without losing the ticks medal from another run.

---

### WS-11 · UI polish batch *(nits; one sweep)*

All small (F15, F16, plus leftovers): Level Select "▶ resume" → "not attempted" (or
similar) and a T/B/R medal legend; "Test Report" nav disabled (or labeled "—") until
the run is terminal; speed control shown as a cycle with true labels (keys 1/2/3 →
labels 1×/2×/8× is fine if the buttons say what the key does — just make key and
label agree); consider whether unbuilt-level rows should say "coming soon" instead of
"locked" (no progression gating exists); tutorial coach re-measure on panel collapse;
any items discovered during WS-1–WS-10 playtesting land here.

---

### WS-12 · Tech debt *(folded from old PLAN_FUTURE §7)*

- `packages/game/src/sim/timeline.ts::buildTimeline` is only used by
  tests/utilities — keep (golden tooling) or fold into core; decide and document.
- The brain interpreter (`packages/core/src/brain/*`) is retained purely to derive
  reference scripts. If WS-5 introduces `*.reference-script.json` for 4.4, consider
  migrating *all* levels to committed reference scripts and dropping the interpreter —
  sizeable, only worth it if it's blocking something.
- `sim/format.ts` / `sim/caps.ts` carry brain-era comments (`msg.`/`cap.` exprs);
  trim once WS-8 (which reuses `evaluateGuard`) has settled what still reads them.
- `Score.brainSize` and `aggregateWorst` — remove or explicitly annotate as legacy
  after WS-6 decides 4.5's fate.

---

### WS-13 · Optional tail: Level 1.5 "Winds Aloft"

*(Folded from PLAN_LEVELS_FINALS; lowest priority — build only after WS-1…WS-10.)*
Teaches heading (HSA) vs course (CSA) in a crosswind — the honest home for the
`Course` field removed in WS-1. Mechanic: a deterministic wind vector in
`pointmass.ts::integrate` (ground velocity = air velocity + wind); FA honors `Course`
by solving the wind-correction angle. New catalog message for wind (grep
`WeatherObservationMT` and its field names in the XSD first); reinstate `Course` in
the catalog *in the same change* that makes the engine honor it; fidelity note for
the prune. Level: narrow corridor, stiff crosswind; bait = pure Heading command
drifts out. Full "Adding a level" checklist.

---

## 4. Explicitly cut (decided; don't resurrect without the user)

| Cut | Was | Why |
|-----|-----|-----|
| Interactive multi-body 4.5 / script-replay-across-bodies | old PLAN_FUTURE §2 | Portability is no longer the thesis; WS-6's challenge airframes carry the implicit version. |
| "Type Certificate" capstone & all "zero edits" framing | docs/03 4.5 | Replaced by WS-6 Full Mission. |
| World 0 levels 0.1 / 0.2 | docs/03 | Lessons now covered by tutorial 0.0 + 1.1 + WS-1 spec-sheet-from-bus. (Confirm in WS-2.) |
| Slow-mo compose / time-pressure scoring / latency tuning | old PLAN_FUTURE §5 | The pause-to-compose model is the game; realtime pressure is not the point of the new thesis. |
| 2.5 Canyon (multi-segment curves + terrain) | docs/03 | Already cut; stands. |
| Brain-DSL investments (new triggers/expressions) beyond what goldens need | old plans passim | The DSL is test scaffolding now; WS-5 prefers reference scripts over DSL extension. |
| Session export/import & ghost replay | old PLAN_FUTURE §3 | Nice-to-have; revisit after WS-7 if ever. |
| Stretch levels (Failsafe, QNH, Open FA) | docs/03 | Unscheduled; keep in docs/03 as a stretch list only. |

## 5. Superseded files

`PLAN_FUTURE.md`, `PLAN_LEVELS.md` (fully executed except items folded above),
`PLAN_LEVELS_FINALS.md` (designs folded into WS-4 / WS-5 / WS-13) — deleted in the
same change that added this file; recover from git history if needed. CLAUDE.md and
docs references to them are fixed in WS-2.
