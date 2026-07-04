# UCI Reference (in-game codex — spec)

The sibling convention, ported: Brain Swap's **MessageCodex** is an in-game
reference for every message the player can touch, **bound directly to the
generated, fidelity-policed catalog** so it can never drift from what the
player actually wires. Normal Form gets the same surface, named **UCI
REFERENCE**, reachable from the header at all times (and deep-linked from chips
throughout the game).

Two content layers, one hard rule:

- **Catalog-bound layer** (mechanical): message shapes, field tables, enum
  values, citations — rendered from `packages/core/src/messages/generated.ts`.
  Never hand-written; if it's not in `catalog/uci.yaml` (and therefore
  fidelity-CI-policed), it doesn't render.
- **Curated layer** (authored prose): the pattern explanations and "in the real
  standard…" notes. Authored in a `reference` section of the catalog YAML so
  the fidelity gate greps its names and CERT/RQMT numbers too — same policing,
  same pipeline. Quotes are verbatim with document + section.

The existing enum-legend codex popovers in the inspector (`CODEX` in
`Inspector.tsx`) migrate into this: chips keep their popover, and the popover
gains a "→ full entry" link into the reference screen.

## Sections (in render order)

1. **What UCI is** — three sentences (same framing as the welcome card,
   `06-how-to-play.md`), plus the three documents the game cites and what each
   owns: **STD-001** (compliance RQMTs), **UNIS / SPC-002** (the interaction
   patterns and CERT UNIS numbers), **SPC-001** (schema style, CERT SCH
   numbers). Players see these prefixes on every finding; the reference is
   where the prefixes are decoded (fidelity lie #11 — the three regimes stay
   distinct).

2. **The six interaction patterns** — the heart of the reference; one block per
   pattern, in palette order:
   - a **mini sequence diagram** (SVG, the board's own visual language),
   - role names (Producer/Consumer, Requester/Requestee, Commander/Commandee),
   - the naming rule (`*Status` / bare name / `*DataRequest` / `*Request` /
     `*Command` + `…Status` responses),
   - one-paragraph semantics (what it's *for* — the 0-3 lesson in reference
     form),
   - lock state: patterns not yet reached in progression render with their
     "unlocks at sheet N-N" tag, but are fully readable (the reference never
     locks knowledge, only the palette locks tools).
   Citations: UNIS §4.1–4.6, §3 Table 3.0-1; CERT UNIS-000076/-000081/
   -000087/-000093/-000099/-000105; SPC-001 §5.1.

3. **The envelope** — abstract `MessageType` = `SecurityInformation` +
   `MessageHeader`; the `HeaderType` field table (`SystemID`, `Timestamp`,
   `SchemaVersion`, `Mode`, and the omitted-but-real optionals `ServiceID`,
   `MissionID` marked "not modeled — see Fidelity Notes"). Field-table format
   copied from Brain Swap's `MessageReference` (name / type / required /
   values).

4. **State enums** — `CommandStateEnum`, `CommandProcessingStateEnum`,
   `RequestStateEnum`, `RequestProcessingStateEnum`: every value, terminal
   values flagged, with the two load-bearing quotes rendered prominently
   (RECEIVED "may not be reported…"; terminal states "ignore all subsequent
   updates… including CANCEL"). This section is the codex the inspector chips
   deep-link into.

5. **Identity & correlation** — `ID_Type` (UUID + `DescriptiveLabel`), the two
   UUID RQMTs (USTD-000436 Leach-Salz / USTD-000673 canonical form), and the
   correlation rule (a status whose `CommandID` isn't yours is not yours).

6. **The bus rules** — the UNIS §4 no-ordering/no-delivery quote and the
   terminal-state rule, stated once, canonically; every seed's cruelty links
   back here.

7. **Concrete messages in this game** — a `MessageReference`-style block per
   catalog message (1.0: `TaskCommand` / `TaskCommandStatus`; grows with the
   worlds): direction, citation (XSD element + MT/MDT), summary, field table.

8. **The A-GRA bridge** — the `02-fidelity.md` §4 table, rendered: each
   primitive beside its Brain Swap / Service Bus incarnations ("you already
   know this shape: Command-2"). This is also the epilogue's content; the
   reference holds it permanently so players can peek early.

## Interactions

- Header button (all phases): `▤ UCI REFERENCE`. Opens as a full-screen
  Blueprint document (like Brain Swap's codex screen), scroll-with-index nav.
- Deep links: palette chips (locked and unlocked) → their pattern block;
  inspector enum chips → their enum entry; every finding's `docRef` → the
  relevant section. Back returns to the sheet exactly as left (the reference
  never resets game state).
- Every entry carries its citation inline; the footer repeats the honesty line:
  omissions are listed in Fidelity Notes, nothing is renamed or invented.

## Non-goals

- Not a spec browser: no full-text search over the `.txt` sources, no XSD tree
  viewer. It covers exactly what the game touches.
- Not a tutorial: teaching stays in the sheets; the reference is for lookup and
  consolidation.
