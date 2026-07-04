# Normal Form — MVP Review Checkpoint

The MVP is **sheet 1-1 "First Acknowledgement"**, playable end-to-end in the
browser (`PLAN_MVP.md`, S1–S6 built). This is the stop-and-play checkpoint: play
it against this doc, capture verdicts, then edit `docs/01–05` where the design
changed on contact with play — **before** any post-MVP code.

## Play this first — the definition-of-done script

Run `npm run dev -w @normal-form/game`, open at ≥1024px wide, and go end-to-end
without reading UNIS first (`docs/05-mvp.md` "Definition of done"):

1. **COMPOSE** — click **Command-2** in the palette to place its arrow pair.
2. Read the validator: `✖ ENV HeaderType — MessageHeader missing required SystemID`
   and `✖ RQMT USTD-000436 — CommandID is not a valid RFC-4122 UUID`.
3. Fix both fields in the inspector (a real UUID, e.g.
   `f81d4fae-7dec-11d0-a765-00a0c91e6bf6`). Watch the badge fall to `READY`.
4. **HANDLERS** — wire `RECEIVED → wait`, `ACCEPTED → terminal`, `REJECTED → retry`.
5. **RUN** — play seed ① (in-order): watch `TaskCommand → RECEIVED → ACCEPTED ✔`,
   the activity fire, and `✔ GOAL REACHED`.
6. **Break it on purpose (seed ②):** back in HANDLERS check **"require RECEIVED
   first"**, run seed ②. It hangs — `✖ NO PROOF`. The console quotes UNIS §4:
   *"there can be no assumption that messages come in any order…"*. Uncheck it;
   seed ② passes.
7. **Break it again (seed ③):** set `ACCEPTED → wait`, run seed ③. The duplicate
   double-counts — `✖ FAULT`, quoting UNIS §4.6.2 *"once a terminal state is
   reported, the sequence should end."* Use **⤳ scrub to fault** to jump to the
   offending tick. Set `ACCEPTED → terminal`; all three seeds pass — **✔ CERTIFIED**.
8. Open **⚑ FIDELITY NOTES** (title block) and the **STATE ENUMS** codex; confirm
   you can articulate what `CommandProcessingStateEnum` is and why the duplicate
   ACCEPTED had to be ignored.

**Pass bar:** a newcomer completes 1–8 in one sitting and can explain the two
failures in the standard's own terms.

## Questions the review should answer

Record a verdict for each below.

1. **Seed difficulty curve.** Is ① → ② → ③ the right ramp? Does ② (reorder/hang)
   or ③ (duplicate/fault) land harder, and is that the intended order?
2. **Validator text — teach or nag?** Do the verbatim CERT/RQMT lines read as
   instructive, or as noise the player learns to dismiss?
3. **Handler vocabulary.** Is `wait / terminal / retry` + the gate toggle enough
   to stay interesting through the rest of World 1, or already too thin?
4. **Board readability at 1024px.** Arrows, stamps, the certified overlay, and the
   disposition tags — legible on the smallest supported viewport?
5. **[S5 flag] V10 shows as a COMPOSE error.** After the fields are clean, the
   console still reads `1 ERROR · RUN BLOCKED` (no terminal handler wired yet).
   Correct-but-surprising: should V10 read as a *compose error*, or as a distinct
   *handler-readiness* state that only surfaces in HANDLERS/RUN?
6. **[S5 flag] Seed-② gate discoverability.** The "require RECEIVED first" toggle
   is the only way to build the seed-② footgun. Is it findable, or should the
   sheet nudge the player into the mistake so the lesson is guaranteed?

## Known debts accepted into the MVP (from PLAN_MVP)

> **Resolved in WS-B (2026-07-05):** scoring/pars cut entirely (`score.ts`
> removed; no metric pills / PAR row / score-vs-par — certification is pass/fail);
> the gate ships pre-checked so seed ② is a guaranteed fail-then-fix; V10 is an
> amber `HANDLERS NOT READY` readiness state, not a compose error; the run phase
> has a per-tick event log + RUN ALL. The debts below are the original MVP notes,
> kept as history.

- Handler vocabulary is the minimum honest set (`wait / terminal / retry`) — the
  gate toggle is the one concession that makes seed ② a fail-then-fix.
- `SchemaVersion` / `Timestamp` are prefilled-valid, not exercised — envelope
  literacy is World 0's job, and World 0 doesn't exist yet.
- Only `CommandProcessingStateEnum` handling is real; the request-pattern enum
  plumbing (`RequestProcessingStateEnum`) is a seam, not an implementation.
- Landscape ≥1024 only; no touch/accessibility pass beyond semantic HTML + focus.

## Verdicts (filled 2026-07-04)

| # | Topic | Verdict | Doc/edit that follows |
|---|-------|---------|-----------------------|
| 1 | Seed curve | **Keep ①②③.** Reorder-hang before duplicate-fault is the right ramp. But the lesson was opt-in (see #6) — order is right, delivery wasn't guaranteed. | `03-levels.md` design rule "the lesson is guaranteed" |
| 2 | Validator text | **Keep, verbatim.** The CERT/RQMT quotes are the game's soul. Run-phase console was the weak surface (static line) → replaced by a per-tick event log. | `05-mvp.md` amendment 4; PLAN_1_0 WS-B |
| 3 | Handler vocabulary | **Thin but sufficient** for the trimmed W1 (4+1 sheets). Generalize the one-off checkbox into a per-rule "only after X" qualifier so the footgun is part of the handler language and reusable in 1-2. | `03-levels.md`; PLAN_1_0 WS-B/WS-F |
| 4 | 1024px readability | **Unverified** — needs the real-human playtest (code review suggests OK; arrow label collisions at dense ticks are the risk). | PLAN_1_0 WS-G playtest checklist |
| 5 | V10-in-compose | **Wrong as shipped.** "1 ERROR · RUN BLOCKED" after fixing both fields steals the reward beat. V10 becomes an amber `HANDLERS NOT READY` readiness state (still blocks RUN), not a compose error. | `05-mvp.md` amendment 3; PLAN_1_0 WS-B |
| 6 | Gate discoverability | **Invert it.** Don't make the player find the footgun — ship the sheet with the gate pre-checked (inherited "sequential handler template"), mirroring the broken compose fields. Seed ② failure becomes guaranteed. | `05-mvp.md` amendment 2; `03-levels.md` 1-1 entry |

**Review outcome beyond the six questions:** scoring/pars cut entirely
(pass/fail certification only); 1.0 rescoped to W0 + W1(trimmed) + epilogue with
W2/W3/W4 moved post-1.0; new meta surfaces (welcome card, How to Play, UCI
Reference codex — `docs/06-how-to-play.md`, `docs/07-uci-reference.md`); RUN ALL
+ event log for iteration speed. Work plan: `PLAN_1_0.md`.

## After the review

Expected outputs (`PLAN_MVP.md` "The review checkpoint"): (a) the verdict list
above, (b) edits to `docs/01–05` where the design changed on contact with play,
(c) a re-scoped plan for the next tranche (World 0 + the rest of World 1). Docs
are the source of truth and are updated **before** new code.
