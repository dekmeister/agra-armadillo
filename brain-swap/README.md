# Brain Swap

A Zachtronics-style browser puzzle game that teaches the A-GRA (ASK 5.0a) Vehicle
Interface by making the player build a Mission Autonomy "brain" — a small state
machine that exchanges real VI messages with Flight Autonomy — and then port that
brain across airframes.

Grounded in the public A-GRA 5.0a release in `../References/A-GRA/`:
- `standard/Documentation/ASK 5.0a Vehicle Interface Volume.pdf` (primary source)
- `standard/Schema/A-GRA_MessageDefinitions_v5_0_a.xsd` (ground truth for names;
  a byte-identical copy is vendored in-repo at `docs/A-GRA References/`)
- `test-harness/` (model for interaction-level compliance judging)

## Design documents

| Doc | Contents |
|---|---|
| [docs/01-game-design.md](docs/01-game-design.md) | One-page game design document |
| [docs/02-fidelity.md](docs/02-fidelity.md) | Which real messages/sequences appear, simplifications, and the "lies we tell" list |
| [docs/03-levels.md](docs/03-levels.md) | Level progression: first HSA command → third airframe |
| [docs/04-architecture.md](docs/04-architecture.md) | Technology and architecture for the browser implementation |
| [docs/05-mvp.md](docs/05-mvp.md) | Scoped MVP: first playable level |
| [docs/06-schemas.md](docs/06-schemas.md) | Catalog / body / level / brain JSON schemas (firmed up in build steps 1–4) |

## Development (headless core — build-order steps 1–4)

Pure-TypeScript, deterministic, headless simulation core + data, no UI yet
(React/Pixi run view is a later slice). npm workspaces: `packages/core`,
`packages/levels`.

```bash
npm install
npm run typecheck    # tsc --noEmit, strict
npm run gen:catalog  # regenerate packages/core/src/messages/generated.ts from the catalog YAML
npm run fidelity     # CI gate: every catalog name must exist in the A-GRA XSD
npm test             # vitest: handshake, vehicle, validator, fidelity, determinism, and the 1.2 golden run
npm run run:1.2      # dev aid: print the reference brain's run log + scores
```

The milestone: `packages/levels/test/level-1.2.golden.test.ts` proves level 1.2 is
solvable by a hand-written reference brain in a deterministic, byte-stable golden run
— before any UI exists.

## Standing rules for this project

1. **No invented messages.** Every message type, field name, and enum literal shown
   to the player must exist in the A-GRA 5.0a XSD / VI Volume. A fidelity-check
   script (see architecture doc) greps the real XSD for every name in the game's
   message catalog and fails the build on any mismatch.
2. **Simplifications are documented, never silent.** Anything the game simplifies
   is listed in `02-fidelity.md` under "lies we tell", and where practical surfaced
   in-game in the level's "Fidelity Notes" panel.
3. **Fun beats fidelity, but only explicitly.** If a rule adds fidelity and no
   interesting decision, it gets cut — and the cut gets recorded.
