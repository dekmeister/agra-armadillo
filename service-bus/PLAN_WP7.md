# PLAN_WP7 — Challenge variants: implementation plan

Implementation plan for **PLAN_REVIEW.md § WP7**. Written 2026-08-02, before any code.

Baseline verified: `npm test` → **161 tests / 25 files green**. WP1–WP6 and WP9 are done; WP7 and
WP8 are the remainder.

WP7 asks for three variants — Phase 3 (election under degradation), Phase 6 (the designation
path), Phase 7 (alternate-site fallback) — each unlocked by winning its base phase, each earning
its place by teaching something the base level cannot.

---

## 0. Two primary-source finds that change the brief

Both were checked against sources **present on this device**, before any design was fixed.

### (a) The designation *sequence* is XSD-sourced — WP7.2 is no longer resting on assertion

PLAN_REVIEW says of WP7.2: *"Check the C2 volume for the exact sequence before coding… The
sequence remains unverified (VERIFY C4); the C2 Volume is not on this device."* That is now only
half true. `A-GRA_MessageDefinitions_v5_0_a.xsd` L2724, in the `MA_RulesOfEngagementMT`
annotation, states the sequence verbatim:

> "The **TargetDesignationCriteria** field provides a mechanism to specify what criteria can be
> used to set or confirm that an EntityMT is a Target (meaning that a **MA_DesignationRequestMT
> can be created, and sent to be approved by the related Target Authority who would then send a
> MA_DesignationMT**). The **TargetAuthorityCriteria** field specifies who is authorized to
> approve or set something as a Target (by sending a MA_DesignationMT …)"

So: the designation flow, the Target Authority gate, and the requester→authority→designation
direction are **primary-sourced**, not design-set assertion. Additionally (XSD L2171–2188, with
`UCI_PRIMITIVE` tags):

| Message | XSD documentation | Primitive |
|---|---|---|
| `MA_DesignationRequestMT` | "request designation of one or more objects as either a target or a non-target" | `ActionRequest-2` |
| `MA_DesignationRequestStatusMT` | "sent in response to a MA_DesignationRequest message" | `ActionRequest-2` |
| `MA_DesignationMT` | "explicitly designate one or more specific objects as a target or non-target" | **`Data-1`** |

**That primitive split is the variant's whole teaching payload.** Approval is a two-message
request/status round trip: the status *is* the verdict. Designation is a request whose *status*
merely acknowledges the request, while the actual designation comes back as a separately
**published data message**. A status reply arriving is therefore **not** a designation — the
purest possible instance of the campaign's own "arrival ≠ effect", now on primary source rather
than on our word for it. The variant should model all three messages, not the two named in
PLAN_REVIEW.

`MA_DesignationRequestStatusMT` is currently in neither `MessageType` nor
`REFERENCE_MESSAGE_NAMES` — it needs adding.

### (b) The alternate recovery site is in the OV-1 text — WP7.3 is sourced

`ASK 5.0a Start Here Guide.doc.txt` L61–63:

> "Potential **alternate QBs** are depicted around the periphery of the battlespace and may
> interact with ACPs according to permissions associated with their roles. When an ACP reaches
> the Bingo Fuel state, it requests Return to Base (RTB) to the **primary or alternate launch and
> recovery site**."

So a second recovery site with its own LRE is faithful topology, not invention — and the same
sentence independently supports the "alternate QB" fallback in `docs/03` §3. WP7.3's premise is
sourced; only the *role assignment* of the alternate site's operator (LRE, per C1/C2) inherits
the existing unverified-roles caveat.

### What stays unverified

WP7.1 adds **no** new A-GRA claims but makes **VERIFY P1/P2** (the five election methods and
their cost/robustness profiles) load-bearing in a second place — the same escalation WP5.3 made
for C7. It needs a VERIFY entry saying so, not a silent upgrade.

---

## 1. Architecture

### 1.1 A variant is a full `ScenarioDef` in a second registry

PLAN_REVIEW proposes "variants are just alternate `ScenarioDef` configs/seeds". That is true of
7.1 and false of 7.2 and 7.3 — those change message types, hooks and win conditions, which no
`ScenarioConfig` knob can express. So variants are real `ScenarioDef`s, but they must **not**
enter `CAMPAIGN`: `CAMPAIGN` is the eight-phase OV-1 spine that the picker, the sweeps and five
drift guards are built on, and `layout.test.ts` literally asserts `IDS.length === 8`.

`packages/core/src/scenario.ts`:

```ts
export const SCENARIOS: Record<string, ScenarioDef> = { phase1 … phase8 };   // unchanged
export const VARIANTS: Record<string, ScenarioDef> = {
  "phase3-degraded":   phase3Degraded,
  "phase6-designation": phase6Designation,
  "phase7-alternate":  phase7Alternate,
};
export const ALL_SCENARIOS = { ...SCENARIOS, ...VARIANTS };
export const CAMPAIGN: ScenarioDef[] = Object.values(SCENARIOS).sort(…);      // unchanged, 8
export function getScenario(id: string) { return ALL_SCENARIOS[id] ?? phase6; }
```

`ScenarioDef` gains one field, so a variant can never be an orphan:

```ts
/** For a challenge variant, the campaign scenarioId it varies (and whose win unlocks it). */
variantOf?: string;
```

Everything else resolves through `getScenario(state.scenarioId)` already, so the engine,
`apply`, `tick`, `taughtPathOutcome`, `electionOutcome` and the Objective card work unchanged.

### 1.2 Base scenarios become factories (the `raiseBeat` trap)

The obvious `{ ...phase6, id: "phase6-designation" }` spread is a trap: `phase6.ts`'s internal
helpers call `raiseBeat(s, phase6, …)` with the *module's own* def, so a spread variant with new
or altered beats would silently raise the base level's copy. Instead, convert each of the three
affected modules to a self-referencing factory:

```ts
function makeTeamFormation(v: TeamFormationOpts): ScenarioDef {
  const def: ScenarioDef = {
    id: v.id, phase: 3, …
    generateDemand(s) { … raiseBeat(s, def, "election-cost"); },
  };
  return def;
}
export const phase3 = makeTeamFormation({ id: "phase3" });            // byte-identical to today
export const phase3Degraded = makeTeamFormation({ id: "phase3-degraded", … });
```

The self-reference resolves at call time, not construction time, so this is safe. **Hard
constraint: the default-options path must produce behaviour byte-identical to today** — the
tutorial seeds, `STRATEGY_WIN_RATES` (asserted *exactly* by `sweep.test.ts`) and the
screenshot-locked Phase 6 geometry all depend on it. `determinism.test.ts` plus the existing
per-phase tests are the check; if any of them move, the refactor is wrong, not the constants.

### 1.3 View plumbing: `basePhaseId()`, decided per site

Seven places currently branch on a literal scenario id. Add
`basePhaseId(id) = getScenario(id).variantOf ?? id` and then decide **each site individually** —
a blanket rewrite would be wrong in two of them:

| Site | Today | Under variants |
|---|---|---|
| `store.svelte.ts` `usesWez` | `=== "phase6"` | base-phase → variant arms the WEZ too |
| `Header.svelte` `showCop` | `=== "phase6"` | base-phase |
| `Graph.svelte` request/reply rail captions | `=== "phase6"` | base-phase (the variant has the same two pipes) |
| `sim-adapter.ts` `linkView` contested damping | `=== "phase6" && linkId === "bad"` | base-phase |
| `sim-adapter.ts` `heroReply` | `=== "phase6"` | base-phase, **label derived from the message type** (`DESIGNATED` ≠ `DELIVERED + AUTH`) |
| `Inspector.svelte` `isPhase6` | `=== "phase6"` | base-phase |
| `Debrief.svelte` `electionAlt` | `=== "phase3"` | base-phase — the counterfactual *is* 7.1's lesson |
| `Debrief.svelte` `showSweep` | `=== "phase6"` | **stays exact.** `STRATEGY_WIN_RATES` was measured on base Phase 6's approval flow; showing it under the designation variant would present a number from a different scenario as if it described this one. |

Also: `App.svelte`'s deep link validates `/^phase[1-8]$/` — replace with a lookup against
`ALL_SCENARIOS` keys so `?level=phase6-designation` works for screenshots and so the regex can
never drift from the registry.

`layoutFor()` and `missionHelp()` need explicit variant entries. Both fall back silently
(`?? PHASE6_LAYOUT`, `?? MISSION_HELP.phase6`), so a missing entry is invisible in play and
catastrophic in teaching — the coherence test in §3 closes that.

### 1.4 Picker surface and unlock

`Phase` gains an optional variant record — a sibling of the existing honesty fields, so the same
guard covers it:

```ts
export interface PhaseVariant {
  scenarioId: string;
  name: string;                 // "Contingency: election under degradation"
  classes: InterfaceClass[];    // machine-checked against the sim, exactly as the base is
  interfaces: string;           // prose, pinned to `classes`
  teaches: string;
  blurb: string;
}
```

`Modal.svelte`'s level card grows a second row: a "Contingency ▸" button when
`progress.isWon(phase.scenarioId)`, and a muted "Complete Phase N to unlock" chip otherwise.
`progress` already keys on `scenarioId` and its comment says *"Room to grow (e.g. per-variant)
without a migration"* — so variant completion persists with no storage change. The OV-1 chip gets
a small second marker when a phase has a completed variant.

Deep links bypass the unlock (dev/screenshot affordance), as `?level=` already bypasses the
picker.

Debrief behaviour on a variant: `nextScenarioId` returns `null` (variants aren't in `PHASES`'
spine), so a variant win lands on Replay + Missions. That is right, but `campaignComplete` is
`won && nextId === null` — which would fire the **full campaign synthesis screen** on a variant
win. Must be tightened to `won && phaseByScenario(id)?.id === 8`.

---

## 2. The three variants

### 2.1 `phase3-degraded` — election under degradation

*Base:* `phase3` (leaderless P2P triangle, currently loss-free by construction).

*Change:* `meshLink` takes Gilbert–Elliott parameters; the variant runs bursty from T+0 rather
than severing at a contingency tick. Raft's request-vote/reply round trips frequently fail to
complete inside the window → no quorum → the existing `quorum` beat fires and invites a switch to
Static (the `applyAction` path that clears a stalled election already exists).

**Open design decision — the one thing in WP7 that needs a ruling.** With the win condition
unchanged (`s.election?.leader`), Static is an *instant guaranteed win*: `startElection` installs
the leader locally at pick time, before a single declaration flies. The variant would then teach
"under degradation always pick Static, and it costs nothing" — the same falsehood WP5.2 had to
fix for `shedTraffic` ("nothing degrades while shed… teaches that shedding is free — false").

- **Option A — "declaring is not knowing" (recommended).** `ElectionState` gains
  `informed: NodeId[]` (participants whose declaration/vote actually *delivered*). The variant's
  win requires leader **and** every participant informed; re-picking Static re-emits declarations
  and accumulates `msgCount`. Static wins, but ugly and at a visible message cost; Raft cannot
  resolve at all. Teaches both halves — method choice depends on link state, *and* a locally
  declared leader is not a package-wide fact until the message lands. Costs one `ElectionState`
  field, one beat, and a small `evaluateOutcome` branch. Base Phase 3 keeps its current win
  condition, so its seed and tests are untouched.
- **Option B — minimal.** Link params + copy only. Cheapest, and the headline point still lands,
  but Static reads as free.

Recommendation: **A**, on the WP5.2 precedent.

*New:* one beat (`declaration-lost` or similar), `TAUGHT_PATHS["phase3-degraded"]`, a scanned
tutorial seed (passive loses; Raft-then-Static wins), `principle`, help copy. Layout reuses
`TRI_NODES` — but the field's contested weight is derived live from `linkView().bad` (WP4), so
the variant's board will *correctly* show a contested mesh where the base shows a clean one, with
no geometry change. That is the WP4 design paying off.

*Fidelity:* no new claims; raises P1/P2's prominence → VERIFY entry.

### 2.2 `phase6-designation` — the designation path

*Base:* `phase6` (QB / ACP-1 / ACP-2 / ACP-3, BAD return link, WEZ window, routine C2 backlog,
reroute + re-request + wrong-authority affordances). All of that is shared, deliberately: the
variant's point is *same gate, different message semantics*, so everything except the message
flow must be held constant.

*Change:* the interaction becomes the three-message designation sequence from §0(a):

```
ACP-1 ──MA_DesignationRequestMT──▸ QB          (ActionRequest-2, over `req`)
QB ────MA_DesignationRequestStatusMT──▸ ACP-1  (ActionRequest-2 — acknowledges the REQUEST)
QB ────MA_DesignationMT──────────────▸ ACP-1   (Data-1 — the designation itself)
```

Win = `MA_DesignationMT` delivered before the WEZ closes, with authority verified. The status
reply arriving is explicitly **not** enough — and since it is the *cheaper* message on the same
degraded link, it will typically arrive first, producing the variant's teaching moment: a green
"delivered" token that changes nothing. A dedicated beat (`status-is-not-designation`) fires on
the status arrival.

*New:* `MessageType` gains three names (all moved **out** of `REFERENCE_MESSAGE_NAMES` and into
`MESSAGE_CODEX` — the codex test forbids being in both, exactly as PLAN_REVIEW notes);
`InteractionKind` gains `"strike-designation"`; one or two beats; `TAUGHT_PATHS` entry; scanned
tutorial seed; layout entry reusing `PHASE6_LAYOUT` (**explicitly**, not via the fallback);
`heroReply` label; Field Guide §4's "Real, and not implemented here" line must change.

*Fidelity:* upgrades VERIFY C4 substantially (see §4). The RBAC gate is reused unchanged, so C7
(an AVC may not approve weapon employment) becomes load-bearing in a second place if the
wrong-authority branch is kept — recommend keeping it, since the ROE annotation's
`TargetAuthorityCriteria` sentence covers designation authority too.

### 2.3 `phase7-alternate` — alternate-site fallback

*Base:* `phase7` (QB / LRE / ACP-1 / orphan pair; RTB misrouted to the QB; partition →
split-brain).

*Change:* add an `lreAlt` node (LRE role, second recovery site — sourced, §0(b)) with its own
clean C2 link pair. At Bingo the **primary LRE link goes unreachable** (a scripted contingency in
the same family as `docs/03`'s "QB goes silent → fall back to alternate QB"). The hand-back is
still required *and no longer sufficient*: the correctly-roled RTB now goes nowhere. A new action
`divertAlternate` re-issues the RTB to `lreAlt`.

Teaches what PLAN_REVIEW asks: **authority hand-back has a routing dimension as well as a role
dimension** — the right role at an unreachable endpoint is as useless as the wrong role at a
reachable one. It is the exact inverse of Phase 6's ACP-3 trap (reachable but unauthorised),
which is why it is worth the level.

*New:* `Action` gains `divertAlternate` → `describeAction` (total over the union, so this is
compiler-enforced); a beat; a layout entry (`PHASE7_NODES` + `lreAlt`, needing a hull re-check —
`layout.test.ts` asserts every OTA rail lies inside the field); `TAUGHT_PATHS`; seed; help copy.

*Scope call:* keep or drop the split-brain half? Keeping both makes a long level; dropping it
makes the variant a focused single lesson. **Recommend dropping the partition** in this variant
(set `contingencyTick` past the window) so the routing lesson is not competing with a lesson the
base level already taught — and note it in the variant's help copy.

---

## 3. Guards — the part that makes this WP repo-shaped

Every prior WP's durable value was its drift guards. WP7's must cover variants or the variants
become the one part of the game nothing checks.

**Changed:**

- `layout.test.ts` — `IDS` from `ALL_SCENARIOS`; `expect(IDS.length).toBe(8)` → 8 campaign + 3
  variants, asserted as two separate counts so a variant can never masquerade as a phase.
  Everything else (rails inside the field, lobes outside, stack clearance) then covers variants
  for free — which is exactly why `phase7-alternate`'s new node needs a hull re-check.
- `picker-honesty.test.ts` — the existing per-level assertions, applied to `phase.variant` too.
  Non-negotiable: a variant's `interfaces` prose sits above a Play button just as a phase's does.
- `codex.test.ts` — union over `ALL_SCENARIOS`, and **`CodexEntry.levels: number[]` becomes
  `scenarios: string[]`** (see below).
- `beats.test.ts` — extend the copy block and the "no two levels share a `principle`" assertion
  across all eleven defs.
- `tutorial-seeds.test.ts` — passive-loses / taught-path-wins for each variant.
- `counterfactual.test.ts` — its "every `TAUGHT_PATHS` level wins on its tutorial seed" assertion
  picks up the variants automatically once `levelsWithTaughtPath()` sees them.
- `sim-adapter.test.ts` — iterates `Object.keys(SCENARIOS)`; widen.
- `copy-drift.test.ts` — needs no change, and will *fail* until the three designation names move
  into the codex. That is the guard working.

**New:** `packages/core/test/variants.test.ts` — registry coherence. Every variant has a
`variantOf` naming a real campaign scenario; no variant is in `CAMPAIGN`; every variant has a
`layoutFor` entry that is not the silent Phase 6 fallback, a `MISSION_HELP` entry that is not the
silent Phase 6 fallback, a picker `PhaseVariant`, a `principle`, and a `tutorialSeed`. Those two
silent fallbacks are the highest-risk thing in this WP: a missing entry does not crash, it just
teaches the wrong level's content.

### `CodexEntry.levels` → `scenarios`

The Field Guide renders `L{e.levels.join(" · L")}` — player-visible. Under variants, a
designation message documented as `levels: [6]` tells a player it flies in Phase 6, and it does
not: only the variant emits it. Replacing `levels: number[]` with `scenarios: string[]` (exact
ids) makes the guard per-scenario rather than per-phase, lets the guide render "L6 · contingency",
and removes a hand-maintained number in favour of a checked id. ~20 mechanical entry edits plus a
small render helper. Doing it any other way means either a knowingly false chip or an optional
field that is only sometimes checked.

---

## 4. Docs

- **`docs/VERIFY.md`** — the careful part. **C4 splits**: the *designation* sequence and the
  Target-Authority gate move to "Resolved by the XSD" citing L2724 + L2171–2188; the *approval*
  sequence (`MA_ApprovalRequestMT → MA_ApprovalRequestStatusMT(APPROVED)`) stays open, because the
  ROE annotation names designation explicitly and approval only obliquely ("or a specific
  commanded/approved task defined in the associated ApprovalPolicyMT"). **Do not collapse the
  two.** New entries: the alternate-recovery-site source (Start Here L63) resolving WP7.3's
  premise; P1/P2 flagged as raised in prominence by 7.1; C7 as raised again by 7.2.
- **`docs/01`** — new `[S]` items continuing from 34 (the variant link-parameter choices, any
  peer-knowledge model from 7.1 Option A, the single-alternate-site simplification in 7.3).
- **`docs/03`** — §3's contingency catalogue already anticipates all three; add the
  variant→contingency mapping so the affinity table stops being aspirational.
- **`packages/game/src/lib/fieldguide.ts`** — §4's "Designation … Real, and not implemented here"
  becomes implemented, with the three-message sequence and the `ActionRequest-2` / `Data-1`
  distinction, provenance chip upgraded from *design set — unverified* to *ASK 5.0a*. §5's
  election table gains a note that the degradation case is now playable.
- **`PLAN_REVIEW.md`** — WP7 marked DONE with the outcome note the other WPs carry: what shipped,
  what the guards will fail you on, what the source finds changed.

---

## 5. Build order

Sized as three sessions. WP7 is not a one-session package — the infrastructure alone touches the
registry, three scenario modules, eight view call sites and six guards.

**Stage 1 — the seam, proved by the cheapest variant.**
`variantOf` on `ScenarioDef`; `VARIANTS` / `ALL_SCENARIOS` / `getScenario`; the factory refactor
of `phase3.ts` with **byte-identical base behaviour** (verify: full suite green *before* adding
anything); `basePhaseId` and the eight view sites; picker `PhaseVariant` + unlock UI; the
`campaignComplete` tightening; the deep-link fix; `variants.test.ts`; all guard widenings; then
**7.1** end to end. Ends with the seam demonstrated and every guard already covering it.

**Stage 2 — `phase6-designation`.** The factory refactor of `phase6.ts`, the three message types
(codex move + `scenarios` field migration), the interaction kind, beats, seed scan, Field Guide
§4 rewrite, VERIFY C4 split. Highest fidelity payoff; do it while the §0(a) source reading is
fresh.

**Stage 3 — `phase7-alternate`.** Factory refactor of `phase7.ts`, `lreAlt` node + layout + hull
re-check, `divertAlternate` action, beats, seed, docs, and the PLAN_REVIEW outcome note for the
whole WP.

Rough test delta: +25–35 tests, ~186–196 total.

---

## 6. Risks

1. **The factory refactor silently changes base behaviour.** `sweep.test.ts` asserts
   `STRATEGY_WIN_RATES` *exactly* and its own docstring says never to widen it. Mitigation: land
   the refactor as its own commit with zero behavioural intent and the suite green before any
   variant code exists.
2. **Tutorial-seed scans.** Each variant needs a curated seed satisfying a matrix
   (passive loses / taught path wins / the specific drama fires). Phase 6's seed took a 20k-seed
   scan. Budget a scan per variant and record it in the test docstring, as `tutorial-seed.test.ts`
   does.
3. **The two silent fallbacks** (`layoutFor`, `missionHelp`). Covered by `variants.test.ts` —
   which is the reason that file exists.
4. **Session length.** The owner accepts ~15 min "provided the learnings land". 7.2 and 7.3
   inherit their base level's full length; 7.3's scope call in §2.3 is partly about this.
5. **7.1 Option A** adds a peer-knowledge concept to `ElectionState` that base Phase 3 does not
   use. Keep it strictly opt-in per variant so L3's seed and the L7 orphan re-election (which
   shares `election-flow.ts`) are untouched.

---

## 7. Decisions needed before Stage 1

1. **7.1 win condition** — Option A ("declaring is not knowing", recommended) or Option B
   (minimal)?
2. **7.3 scope** — drop the split-brain half so the routing lesson stands alone (recommended), or
   keep both?
3. **`CodexEntry.levels` → `scenarios`** — approve the migration, or accept a less precise chip in
   the Field Guide?
4. **Staging** — three sessions as above, or a different cut?
