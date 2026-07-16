# Normal Form — 1.0 Review Checkpoint (release gate)

Successor to `REVIEW_MVP.md`. The MVP review rescoped 1.0 to **W0 + W1 + epilogue**;
`PLAN_1_0.md` then built it across WS-A…WS-G. As of this checkpoint the full 1.0 is
**complete and playable end to end** — 8 sheets (`0-1…0-3`, `1-1…1-4`, bonus `1-5`)
registered, golden-proven, and reachable in sequence, plus the A-GRA debrief
(WS-G). This is the stop-and-play gate: run the script below with a real newcomer,
capture the verdicts, and only then edit `docs/` for any post-1.0 work.

The **release bar** is a human playtest — it cannot be run by the build. The
sections below are the harness for that playtest: the definition-of-done script,
the bar, and a verdict table to fill. What *could* be verified without a human
(the static 1024px layout sweep) is recorded under "Polish sweep".

## Play this first — the definition-of-done script

Run `npm run dev`, open at **≥1024px** wide, clear the browser save (or use a fresh
profile) so the welcome card shows, and play straight through **without reading
UNIS first**:

1. **W0 · One Way** — `0-1 Hello, Bus` (envelope + validator literacy; EXERCISE
   mode), `0-2 Fire and Forget` (three-consumer fan-out; republish or go stale —
   no ack), `0-3 Pattern Choice Is Semantics` (triage three jobs; the request job
   passes only by *filing the wrong-palette finding*).
2. **W1 · Ask & Acknowledge** — `1-1 First Acknowledgement` (the command cycle;
   the pre-checked gate makes seed ② a guaranteed hang; seed ③ is the duplicate),
   `1-2 Skipping the Pleasantries` (RECEIVED is a courtesy), `1-3 Rejection Letter`
   (REJECTED kills the CommandID; retry as a new command), `1-4 Request Is Not
   Command` (classify two jobs; a wrong pattern dead-ends its world-state).
3. **Bonus (optional)** — `1-5 Cancel Culture` (CANCEL is a request; the bus
   decides the race).
4. **The debrief** — once every required sheet is certified, take **▤ VIEW
   DEBRIEF** (offered on the final CERTIFIED overlay and on the drawing index):
   confirm the recap checklist names each lesson and the A-GRA bridge maps every
   primitive to its Brain Swap / Service Bus shape.

Throughout: every failure must quote the violated CERT/RQMT verbatim, and every
sheet must *arrive broken* (the lesson is guaranteed, not opt-in).

## The release bar

A real human, no UNIS knowledge, one sitting. Instrument nothing — sit with them.

- **Completes W0+W1 in ≤40 minutes.**
- Can explain, in the standard's own terms, **(a)** why the duplicate ACCEPTED had
  to be ignored (terminal-state rule, UNIS §4.6.2) and **(b)** why a request is not
  a command (the two request patterns return data / run a process; Command-2
  demands an activity — CERT UNIS-000093/-000099/-000105).

If it overruns 40 minutes, **cut the bonus sheet (1-5), not the lessons.**

## Questions the playtest should answer

Record a verdict for each. (Verdict cells intentionally blank — fill from the
human sitting, not from code review.)

| # | Topic | Verdict | Notes |
|---|-------|---------|-------|
| 1 | **Length.** Does W0+W1 land inside 40 min? Where is the time spent? | | |
| 2 | **The two load-bearing lessons.** Can the player articulate (a) dedupe-after-terminal and (b) request-vs-command unprompted? | | |
| 3 | **The 0-3 / 1-4 "file a finding" beat.** Is "no valid pattern → file the finding" discovered as an *honest* outcome, or does it read as the game being broken? | | |
| 4 | **1024px readability** (was "unverified" at MVP, REVIEW_MVP Q4). Arrow labels, fan-out labels, stamps, overlays legible on the smallest viewport? | *(static sweep done — see below; confirm the live run)* | |
| 5 | **Difficulty ramp across sheets.** Any sheet that stalls a newcomer, or any lesson that lands flat? | | |
| 6 | **The debrief.** Does the A-GRA bridge land as "I already know these shapes", i.e. earn its two minutes? | | |
| 7 | **Meta surfaces.** Are the welcome card / How to Play / UCI Reference reached when needed, ignored when not? | | |

## Polish sweep (WS-G — verified without a human)

Driven in Chrome at an exact **1024px** viewport across the drawing index, the
epilogue, and the fan-out (`0-2`), command (`1-1`), and jobs (`1-4`) boards. Two
findings, both fixed this pass:

- **Fixed — lifeline/caption collision at 1024px.** On every board the top-left
  "DIAGRAM …" zone caption shared a vertical band with the SVG lifeline header
  boxes; a left-hugging lifeline (the `0-2` fan-out producer at `0.15w`) overran
  the caption at the minimum width. `LifelineHeader` now sits below the caption
  band (box `y` 10 → 28) with dashed lifelines starting at `y1=58`; verified clean
  on the 2-, and 4-lifeline boards and the single-lifeline jobs board.
  (`packages/game/src/Board.tsx`.)
- **Fixed — jobs-sheet console copy.** The COMPOSE empty state read "composition
  validates clean · **wire handlers**, then RUN" on classification sheets (`0-3`,
  `1-4`), which have no handlers — the player triages. Now: "triage each job in
  the inspector — assign a pattern or file a finding, then RUN."
  (`packages/game/src/ValidatorConsole.tsx`.)

**Confirmed legible at 1024px:** the recap checklist + 6-row A-GRA bridge on the
debrief; the four fan-out lifelines on `0-2`; the `TaskCommand` / `TaskCommandStatus`
arrow labels on `1-1` (centered between widely-spaced lifelines, separated by tick
— the Q4 "dense-tick collision" risk did not reproduce statically). At *exactly*
1024px a vertical scrollbar clips the header's right edge by ~15px; the game targets
≥1024, so this is the boundary, not a defect — note if the playtest finds it
annoying.

**Not individually driven** (share the now-fixed board infrastructure; verify in
the live playtest): `0-1` status board, `1-2`/`1-3` command variants, `1-5`
request/cancel board; a full keyboard/focus audit (default focus rings present;
not exhaustively walked).

## After the review

Fill the verdict table, then edit `docs/` before any post-1.0 code (docs are the
source of truth). Post-1.0 candidates (W2 Records, W3 Forge, W4 Program Schema,
player-authored seeds) stay parked in `03-levels.md` "Post-1.0".
