# PLAN_REVIEW — Fixes & improvements from the first full-game review (2026-07-05)

A critical review of the completed first round (all 8 phases played, win and loss paths, all
modals/debriefs inspected, view + scenario code read) produced the findings below, grouped into
work packages sized for one Claude Code session each. Packages are ordered by teaching value;
within a package, items are ordered by importance. WPs are independent unless noted.

## Ground rules for the implementing session (read first)

- **Read `CLAUDE.md` in this directory** — the fidelity guard rail is non-negotiable: never
  misrepresent message topology (who talks to whom, over which interface, gated by what). When a
  change touches a mechanic, check the relevant ASK 5.0a `.txt` extraction (grep, don't load
  whole) and cite it in a comment; flag any simplification `[S]` in code and in
  `docs/01-mechanics-to-agra-mapping.md`.
- **Source paths (corrected in WP3 — earlier revisions of this file and CLAUDE.md were wrong).**
  There is no `design/` directory: the design set is `docs/00…04`. There is no
  `docs/References/`: the ASK 5.0a extractions live in the sibling repo at
  `../brain-swap/docs/A-GRA References/`, and only **Start Here**, **Mission Systems**, **Vehicle
  Interface** and the normative **`A-GRA_MessageDefinitions_v5_0_a.xsd`** are present on this
  device. The **C2 and Peer Interface Volumes are absent** — anything resting on them is
  unverified and listed in **`docs/VERIFY.md`**.
- The sim core (`packages/core`) is pure, deterministic, headless-tested. Keep it that way: no
  DOM, no wall-clock, seeded RNG only. `npm test` (**85 tests** as of WP3) and `npm run typecheck`
  must stay green, as must `npx biome check packages/`. View work lives in `packages/game`
  (Svelte 5 runes + SVG).
- Tutorial seeds are curated per level (`tutorialSeed` in each `ScenarioDef`) — if you change
  scenario timing/traffic, re-verify the seed still produces the intended drama (there are
  `tutorial-seed*.test.ts` tests for this).
- **Verify visually.** `npm run dev` → `http://localhost:5174/games/servicebus/?level=phaseN`
  deep-links a level; `?guide` / `?guide=<sectionId>` deep-links the Field Guide. For headless
  screenshots use **`google-chrome-stable`** — `chromium` is NOT installed on this machine.
  (This note has now been wrong in *both* directions; WP9 "fixed" it backwards. Run `which` and
  trust that, not the prose.) Driving the game with `playwright-core` (installed ad hoc,
  `executablePath: "/usr/bin/google-chrome-stable"`) works; note levels auto-pause on a beat, so
  a stalled clock usually means an unacknowledged beat — the control is a button named
  `/Acknowledged/`.
- Reference implementation for the meta layer: `../brain-swap/packages/game/src/meta/` —
  full-screen views (Help, MessageCodex, ComplianceReport, FidelityNotesPanel) reachable from
  the shell. Port the *pattern*, not the code (brain-swap is React; this repo is Svelte).

**Priorities set by the project owner:** ~15 min of gameplay is acceptable *provided the
learnings land*. No scoring/medals. Challenge variants only where they genuinely teach something
new. RF sandbox is a stretch goal. Teaching correctness beats content volume.

---

## WP1 — Progression spine & first impression (small, do first) **DONE**

**Problem.** The campaign doesn't function as a course: after a win the debrief's only exit is
"Replay scenario" — the player must reopen Levels and remember what's next. Nothing persists, so
the mission picker never shows what's been completed. Separately, the app boots with Phase 6
loaded *behind* the picker, so the first thing a new player sees is a red "WEZ WINDOW 0:18", a
COP ring, and an objective pill reading **STALLED at T+0** — alarming, wrong (nothing has
stalled; the reply doesn't exist yet), and Phase-6-specific before any phase was chosen.

**Do:**
1. Debrief (win): primary button **"Next mission ▸"** loading the next OV-1 phase (Phase 8 wins
   land on the campaign-complete state, see WP6). Keep "Replay" as secondary. On loss, keep
   Replay primary.
2. Persist per-level completion (localStorage; something like
   `servicebus.progress = { phase1: "won", ... }`). Show completion ticks on the OV-1 picker
   map chips and in the detail card. No scores — done/not-done is enough.
3. Fix the boot state: don't show STALLED before the mission starts. Phase 6's initial
   `objective` is `"stalled"` from tick 0 in its `build()` — make it `in_progress` until the
   reply actually exists and is blocked. Also either load *nothing* behind the picker (empty
   stage) or load Phase 1; a fresh player should not see Phase 6's HUD before choosing.
4. Dead code cleanup while there: the WEZ "standby · click to start" branch in `Header.svelte`
   can never show (the store arms the WEZ at build), and `#armIfNeeded` in the store is
   vestigial for the same reason. Remove or make real.

**Accept:** fresh profile → picker shows no false alarm state; win Phase 1 → one click lands in
Phase 2; reload → picker shows Phase 1 ticked.

---

## WP2 — Per-phase Help (the current Help actively mis-teaches) **DONE**

**Problem.** The "How to play" modal is 100% Phase 6 content — strike approval, BAD return link,
reroute-vs-re-request — regardless of the loaded level. A Phase 1 player opening Help gets
onboarding for a level five missions away, describing mechanics (queue policies, reroute) that
don't exist in their level.

**Do:** split Help into (a) a short generic "how the game works" section — the 1 Hz clock,
auto-pause decision points, Hold semantics, the Inspector, click-anything-to-inspect, reading
the board (shapes/colours) — and (b) a per-level "this mission" section (the situation, your
goal, what to try, win/lose) supplied by the level, e.g. new fields on `ScenarioDef` or a
parallel per-phase record in the game package next to `lib/phases.ts`. The existing Phase 6 text
becomes that level's entry. Keep it a modal; the full-page reference material goes in WP3.

**Accept:** Help opened on each of the 8 phases describes *that* phase; generic section identical
everywhere.

---

## WP3 — Field Guide: the technical-background layer **DONE** (2026-07-19)

> **Outcome, and what a later session needs to know.** Shipped as a full-page view
> (`components/FieldGuide.svelte`, content in `lib/fieldguide.ts`, codex in
> `packages/core/src/codex.ts`) reachable from the header — it **replaced** the Background modal
> rather than adding a fourth nav item. All eight sections below were built. 20 new tests.
>
> **Verification found three things the game was teaching falsely.** These are the durable part:
> 1. **`SENT` is not an A-GRA state.** `MA_TxDataPayloadCommandStatusMT` defines *four* finals;
>    `SENT` collapses `SUCCESS_NO_ACK_EXPECTED` / `SUCCESS_RECEIVED_ACK`. `types.ts`, `docs/01`
>    L62 and `docs/03` L28 all claimed the lifecycle was "verbatim"/"Faithful" — corrected, and
>    logged as **`[S]` item 21** in `docs/01`. The sim's `Lifecycle` union was deliberately left
>    alone (owner's call): renaming it is a real change needing real ack-vs-no-ack semantics, not
>    a cosmetic one. **Still open if anyone wants it.**
> 2. **`MA_VehicleCommandMT` was invented** — no such A-GRA type. Renamed throughout to
>    **`MA_FlightCommandMT`**, the real VI command (XSD; VI Volume ~L860 and Tables A-1-52/53/56
>    for its HSA_CSA / WaypointFollowing / Heading extensions). A regression test forbids the old
>    name returning.
> 3. **Phase 3's copy named `MA_PackageManagementCommandMT`, which the sim never sends.** Fixed
>    to `MA_LeaderUpdateRequestMT` and guarded (see below).
>
> **The XSD is on this device and is normative for message names** — checking against it upgraded
> 11 of 12 game message names to primary-sourced, including *both* weapon-employment flows. Use it
> before assuming something is unverifiable. The one name still unconfirmed is
> `MA_SynchronizeGlobalCopToPeer` (absent from the XSD, and missing the `MT` suffix every real
> type carries — probably wrong; needs the Peer Volume, tracked as VERIFY P6).
>
> **⚠ Two new drift guards will fail you if you change traffic or copy — this is intentional:**
> - `packages/core/test/codex.test.ts` plays every level on its tutorial seed (passively *and*
>   down its taught path) and asserts `MESSAGE_CODEX` matches what actually flies — including a
>   **per-level `levels: [...]` list** on each entry, and that nothing is marked `exercised`
>   unless some level emits it. **WP5 changes traffic, so WP5 must update `codex.ts`.** That is
>   the guard working, not a broken test.
> - `packages/game/test/copy-drift.test.ts` scans **all** of `packages/game/src` and fails on any
>   `MA_*` token that isn't a documented name. To cite a real message the game doesn't send, add
>   it to `REFERENCE_MESSAGE_NAMES` in `codex.ts` with a justification (the test requires one).
> - `packages/game/test/fieldguide.test.ts` pins the glossary's required acronym set, the six
>   interfaces, VI being on-platform, the five roles, the five election methods, and that AVC's
>   expansion stays `null`.
>
> **Unverified-by-design.** Sections 4 (roles) and 5 (election) rest on design-set assertion, not
> primary text, because the C2 and Peer Volumes are absent here. Rather than flatten that, every
> claim carries a provenance chip in the UI (*ASK 5.0a* / *design set — unverified* / *inferred* /
> *non-A-GRA source*), and **`docs/VERIFY.md` is the checklist** — 13 numbered items (C1–C6,
> P1–P7, X1–X5), each naming the claim, where it appears, and which volume settles it. A session
> on a machine with those volumes should work that file and update the chips in step. **Do not
> silently upgrade a claim to "sourced".** `AVC`'s expansion is deliberately left blank; the XSD's
> "Unmanned Air Vehicle Control Station" is a different concept and must not be borrowed.
>
> **Left for other WPs on purpose:** Phase 1's picker still claims `MS-PNT` with no MS traffic —
> that is **WP5.6**, and half-fixing it here would have been worse. MP remains exercised by zero
> messages and MS by one; the guide says so explicitly and points at the gap rather than papering
> over it (**WP5** closes it).
>
> **Shell changes other WPs will meet:** `ModalKind` lost `"background"` and gained a sibling
> `OverlayKind = ModalKind | "fieldguide"`; `App.svelte`'s `modal` is now `overlay`, and its
> existing "an overlay is open, so pause the mission" `$effect` covers the guide for free.

<details>
<summary>Original WP3 brief (kept for reference)</summary>


**Problem.** The only technical grounding in-game is one ~300-word Background modal. The project
owner explicitly wants a proper technical-background section, following brain-swap's pattern of a
separate full-screen page. Most of the needed text already exists in `design/00–04` and the
beats' `concept` strings — it lacks a home, not a rewrite. Also: **no acronym is ever expanded
anywhere in the UI** (QB, ACP, LRE, AVC, WEZ, COP, OV-1, RBAC, DMS, ASB, DDS/RTPS…). WEZ is the
flagship lose condition and is never spelled out.

**Do:** a full-page **Field Guide** view (header nav next to Levels/Help; takes over the stage or
a full-screen route — brain-swap uses store-driven view switching) with sections:
1. **The architecture** — A-GRA in two paragraphs; the ASB (on-platform) vs DMS (per-platform,
   off-platform) distinction; the full hop `MA → ASB → local DMS → DDS/RTPS mesh → remote DMS →
   remote MA`; no central broker. A simple SVG diagram of one platform's stack + the mesh is
   worth a lot here.
2. **The six L1 interfaces** — table: name, expansion, what flows over it, on-platform vs OTA,
   where it appears in the game (and explicitly which the game does NOT exercise — see WP5.5).
3. **The DMS message lifecycle** — `PENDING → EXECUTING → SENT / FAIL_UNSENT / FAIL_MISSING_ACK`
   as a small state diagram, with the game meaning of each; source `MA_TxDataPayloadCommandStatusMT`.
4. **Roles & authority** — the five RBAC roles expanded (Admin / QB "Quarterback" / AVC / LRE /
   Observer), what each may command, authority-checked-at-destination, the weapon-employment
   gate (approval path and designation path — cite the C2 volume).
5. **Leader election** — the five named methods with message-cost/robustness table; mark the two
   implemented (Static, Raft) and note the rest as reference.
6. **Message codex** — every real `MA_*MT` message name the game uses (grep the scenarios),
   one line each: interface class, direction, role in the game. Keep it generated-or-checked
   against the scenario sources so it can't drift (brain-swap generates its catalog; here a
   simple unit test asserting every `type:` string in scenarios appears in the codex is enough).
7. **Glossary** — every acronym used anywhere in the UI.
8. **Fidelity notes** — the `[S]` simplifications from `design/01` in plain language ("what the
   game fudges and why"), so the game never silently teaches something false.

Also: expand acronyms at first use in beat text where cheap ("WEZ (Weapon Engagement Zone)
window").

**Accept:** every acronym in the UI resolvable in-game; codex covers 100% of `MA_*` types used;
a reader can answer "which interfaces cross the contested air?" from the guide alone.

</details>

---

## WP4 — Board truthfulness (visual fixes that currently mislead)

These aren't polish — each one contradicts the model the game is trying to teach.

1. **Rerouted reply still shows red "MISSING ACK".** After the player chooses reroute (the
   *correct* action), the hero token keeps its red spinning-"?" MISSING-ACK treatment while
   EXECUTING happily along the relay path — the reward for the right decision is an unchanged
   alarm. In `sim-adapter.ts` `heroReply()`, ack stays `"missing"` until SENT+verified. Add an
   intermediate state (e.g. amber→blue "REROUTED · EN ROUTE") the moment the reply is queued on
   the relay route.
2. **The contested-mesh field renders only on Phase 6.** Only `PHASE6_LAYOUT` defines `mesh` in
   `lib/layout.ts`, yet Phases 3/4/5/7 are contested-OTA topologies too (the code even comments
   "L3 — the P2P mesh is the contested medium"). The game's core visual metaphor — shaded OTA
   field + per-platform DMS ports — appears in 1 of 8 levels, and the Phase 1–2 "VI is free, OTA
   costs" lesson loses its visual: the C2 link should visibly cross the shaded field while the
   VI self-loop visibly stays outside it. Add mesh hulls to all OTA layouts (a narrow band
   between nodes is fine on 2-node boards). Phases 1/2/8 use a *clean short-range* LRE link —
   still OTA; either include a lightly-shaded (uncontested) field or a labelled "short-range
   C2" treatment, but don't leave the air invisible.
3. **Amber does quadruple duty; legend covers a third of the board.** Amber currently means:
   BAD-link marching dashes, MISSING_ACK state, MD-class tokens, and hot queue badges — on
   Phase 5 amber MD tokens swarm next to amber count badges during an amber-accented beat.
   Reserve amber strictly for degradation; recolour MD/MP. Extend the Legend to everything
   actually drawn: all token classes used (C2, P2P, VI, MS, MD), node ring meanings (gold ring =
   authority node, ★ LEADER), the DMS port dot, the queue-stack count badge, the VI self-loop.
4. **Label the VI self-loop** on the board (small "VI · on-platform" caption) — it's the object
   of Phase 1/2's headline lesson and is currently an anonymous grey lobe until clicked.
5. **Selection visuals:** (a) the dashed link-selection ellipse on long links (worst on Phase
   4's single horizontal link) spans the whole board and reads as diagram geometry — replace
   with a highlighted/glowing rail stroke; (b) after a reroute the token selection ring can
   detach from the hero glyph and ring empty space (the `.heroslide` CSS transition and the
   instantaneously-computed highlight position disagree) — compute both from the same position
   or drop the transition on route change.
6. **Token collisions:** Phase 5's queue stack overlaps ACP-1's rim, and fan-out count badges
   float ambiguously between links. Nudge stack placement per-link so stacks sit clear of node
   circles and unambiguously beside their own rail.

**Accept:** screenshot pass over all 8 phases: no red alarm on a recovering reply, every colour
on the board is in the legend, mesh field present wherever traffic crosses the air.

---

## WP5 — Level changes (curriculum fixes — the review's "should levels change?" answer)

> **Read WP3's outcome note first.** Two things bind this WP: (a) `packages/core/src/codex.ts`
> carries a per-level `levels: [...]` list for every message and a test that checks it against
> what the levels actually emit — **add MP/MD messages there in the same change**, and update the
> `status`/`inGame` copy for the interfaces the guide currently calls *thin*; (b) `lib/fieldguide.ts`
> §2 explicitly tells the player MP is unexercised and MS appears once. When WP5 fixes that, fix
> those strings too, or the guide starts lying in the other direction. Item 5.6 below is still
> open — WP3 deliberately did not touch it.

Structural review verdict: Phases 1, 2, 6, 7 are sound as designed. Phase 4 is the weak level;
Phases 3/5/6 each have one teaching hole; Phase 8 wastes the synthesis moment. Two curriculum
gaps cut across levels: **MP/MD never appear** (message-class tally across all scenarios:
C2×23, P2P×16, VI×4, MS×2, MD×1, MP×0 — the game claims "six L1 interfaces" and exercises
four), and **the RBAC negative case is unreachable in Phase 6** (see 5.3).

1. **Phase 4 (Transit) — expand from 2 nodes to a 3-ACP formation, and make it the MP/MD
   carrier.** Currently two nodes and one capped link teaching bandwidth+queue discipline that
   Phase 6 re-teaches under stakes; `docs/02` describes Phase 4 as sustained P2P formation
   heartbeat + COP seeding, which the level doesn't show. Rework: 3 ACPs in formation with
   periodic P2P formation-status heartbeats (real interaction: Provide/Receive Formation
   Status), plus an OTA **MP mission-plan update** pushed from C2 to the package that must
   share the capped link with the heartbeats — the bandwidth-cap/queue-discipline lesson stays,
   now on faithful traffic, and MP gets its one honest appearance. Cite the Peer volume for the
   formation interactions before coding.
2. **Phase 5 (CAP) — give shed-traffic a real cost.** `shedTraffic` currently just stops bulk MD
   injection; nothing degrades while shed, so the game's only Phase 5 decision is a no-brainer
   (and teaches that shedding is free — false). Add a visible consequence: e.g. a sensor-track
   completeness readout that decays while bulk is shed, so shedding is *triage* — correct under
   COP pressure, not costless — and re-enabling after recovery is the second half of the lesson.
   Keep it honest: if the standard implies bulk MD is deferrable, say so in the beat and make
   the cost mild. Also label the bulk tokens as MD in beat text/legend (per WP4.3 recolour).
3. **Phase 6 — make the wrong-authority loss reachable.** The lose condition "approval acted on
   under the wrong authority" and the REJECTED reply path exist in code but can never trigger:
   the request always routes to the QB, so the RBAC check always passes. The game's tagline
   ("authority is checked at the destination · arrival ≠ effect") is never *experienced* as a
   failure. Cheapest faithful fix: make **re-request** offer a tempting wrong choice — e.g.
   "ask ACP-2 (AVC role) to relay an approval" which arrives fine and returns
   `REJECTED / CannotComply` because an AVC is not a Target Authority — one decision branch,
   real RBAC lesson, uses the existing rejection machinery. (Alternatively fold into a WP7
   variant, but reachable-in-tutorial is better.)
4. **Phase 3 (Team formation) — let the player watch before the election, and show the
   contrast.** The election decision currently pauses at T+1 before any message has moved. Add
   a few ticks of package-joining P2P traffic (`MA_PackageManagementCommandMT` is already the
   level's cited message) before raising the beat. And since the player picks Static *or* Raft
   and never sees the other: after the outcome, the debrief should state the counterfactual
   ("Raft on this seed: N messages, elected at T+k / stalled — no quorum") — it's deterministic,
   so compute it by running the other branch headlessly at build time or hardcode from the seed.
5. **Phase 8 (Land) — move the synthesis to where it belongs.** The campaign-debrief beat fires
   at T+1 and narrates the landing round trip *before it happens*. Let the landing play out
   (it's the calm bookend — fine), then make the **win debrief** the campaign synthesis: a
   summary mapping what was learned to the interface/authority curriculum (which interfaces you
   used where, who held authority in each phase). Pairs with WP1's campaign-complete state.
6. **Picker honesty.** Phase 1's card claims "MS-PNT" but the level has no MS traffic; re-check
   every `interfaces:` string in `lib/phases.ts` against what the scenario actually spawns, and
   fix either side (adding a trivial PNT-init MS message to Phase 1 is fine if faithful; else
   drop the claim).

**Accept:** class tally after WP5 includes MP≥1, MD≥1 with real gameplay meaning; a player can
lose Phase 6 by trusting the wrong authority; Phase 3 debrief names both methods' costs; picker
interface strings match spawned traffic exactly.

---

## WP6 — Beat timing & debrief quality

1. **Delay lesson beats until the evidence is on screen.** Phase 3 elects at T+1, Phase 7's
   RTB-REJECTED lands at T+2, Phase 8 debriefs at T+1. Teaching-by-observation needs a few
   ticks of observation; Phase 6 gets this right (contingency T+2, drama T+13). Rule of thumb:
   no decision beat before the traffic it's about has visibly moved at least one full leg.
   (Overlaps WP5.4/5.5 — coordinate.)
2. **Counterfactuals for every level, not just Phase 6.** The debrief's "on this seed, X would
   have worked" line is the single best teaching device in the game and it's Phase-6-only.
   Every level has a clamped tutorial seed, so each can state its deterministic counterfactual
   on loss (Phase 2: "re-attempting at the MISSING_ACK prompt confirms all 7 reports by T+n").
3. **"Your moves" lists non-moves.** The debrief reconstructs player actions by regexing the
   event log, and the pattern matches the sim's *automatic* "Re-attempting" line — a zero-action
   loss shows a move the player never made. Track player actions explicitly (the store knows) or
   tag log lines with an `actor` field instead of regexing prose.
4. **Text polish:** Phase 2's debrief renders "FAIL_MISSING_ACK — FAIL_MISSING_ACK — …" (title
   duplicated in the lesson line); the Objective card shows the same static
   "authority is checked at the destination" strapline on all 8 levels until it's wallpaper —
   make it the level's actual key principle (one line, from the phase record).
5. **Surface the sweep's killer stat.** The emergent lesson (README: FIFO ~28%, EDF/Class ~90%,
   reroute ~95%, re-request ~22%) never reaches the player. After a Phase 6 outcome, show a
   small "across 500 seeds" strategy-comparison strip (precomputed constants are fine; cite the
   sweep command in a comment). This is the bridge to the WP8 sandbox and costs an afternoon.

---

## WP7 — Challenge variants (only where they teach something new)

Owner guidance: no scoring; variants must earn their place by teaching, not padding. These three
qualify (each maps to `docs/03`'s phase→contingency affinity table). Infrastructure: variants
are just alternate `ScenarioDef` configs/seeds — add a variant field to the phase record and a
second Play button on the picker card once the base phase is completed ("Contingency: …").
Locked until the base phase is won (needs WP1's persistence).

1. **Phase 3 variant — election under degradation (quorum stall).** Run the same election over
   links that are already bursty; Raft stalls without a reachable majority (the `quorum` beat
   machinery exists), Static declares locally and wins ugly. Teaches *why* method choice
   depends on link state — the design set's stated point of the five methods, currently untaught
   because the tutorial election runs clean.
2. **Phase 6 variant — the designation path.** The second real weapon-employment flow
   (`MA_DesignationRequestMT → MA_DesignationMT`) instead of approval; same gate, different
   message semantics (QB designates rather than approves). Closes the "weapon employment is a
   distinct gated flow" claim with both of its real forms. Check the C2 volume for the exact
   sequence before coding; if 5.3's wrong-authority branch went into a variant instead of the
   tutorial, it belongs here. **Note (WP3):** both names are XSD-confirmed and already sit in
   `REFERENCE_MESSAGE_NAMES` in `packages/core/src/codex.ts` as "real, but the game doesn't send
   them". Implementing this means **moving them into `MESSAGE_CODEX`** with a `levels` list — the
   codex test forbids a name being in both places. The *sequence* remains unverified (VERIFY C4);
   the C2 Volume is not on this device.
3. **Phase 7 variant — alternate-site fallback.** Primary LRE link unreachable at Bingo; the RTB
   request must fall back to the alternate recovery site (real OV-1 contingency). Teaches that
   authority hand-back has a *routing* dimension, not just a role dimension.

Skip variants for 1/2/4/5/8 — nothing new to teach that the base level + WP5 changes don't cover.

---

## WP8 — Stretch: the RF sandbox

The headless sweep harness (`tools/run-sweep.ts`) is the game's hidden best feature for the
target player (RF/EMC background). Expose it in-browser as a **Sandbox** view on the Phase 6
board: sliders for the Gilbert–Elliott parameters (`pGoodToBad`, `pBadToGood`, block
probabilities, ackLoss), latency, bandwidth cap; free-run (no WEZ) or timed mode; live re-run
button. Optionally a mini Monte-Carlo: run N seeds headlessly *in the browser* (the core is
already isomorphic) and plot win rate by strategy — the sweep's lesson, interactive. Keep it
gated behind campaign completion or a nav item so it doesn't confuse first-timers. No new sim
code should be needed — this is UI over existing knobs; if a knob isn't reachable via
`ScenarioOpts.config`, extend that rather than forking the scenario.

---

## WP9 — Housekeeping (batch with any other WP) **DONE**

- Favicon 404 on every load (`packages/game/index.html` has no icon link).
- ~~`CLAUDE.md` dev-environment note is **backwards**: `/usr/bin/chromium` IS installed,
  `google-chrome-stable` is NOT.~~ **This item was itself wrong, and the WP9 fix made the note
  wrong in the opposite direction.** Verified 2026-07-19 with `which`:
  **`google-chrome-stable` IS installed; `chromium` is NOT.** CLAUDE.md now says so, dated, with
  an instruction to re-check rather than trust the prose. **Still to do: check the sibling games'
  CLAUDE.md files for the same claim** — that half was never done.
- Gate the Inspector's queue-policy segment (Class/FIFO/Deadline) to links where policy is
  meaningful — it currently renders on clean links and the VI self-loop, where it does nothing
  observable; likewise "Prioritise C2 reply" shows at T+0 before the contingency exists.
- Header phase pill shows the bare level title ("Hold") styled like a control — cosmetic, judge
  in situ.

---

## Explicitly out of scope (owner decisions)

- Scoring, medals, par times.
- Session-length padding for its own sake — ~15 min is fine if the learnings land.
- The remaining three election methods (Bully / Max-Consensus / Off-Nominal) as playable — Field
  Guide reference only.
- Team-split re-election drama beyond Phase 7's existing split-brain merge.
- Mobile/responsive work.
