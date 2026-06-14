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

Trial it out at: [https://stuff.aerowalsh.com/games/brainswap/](https://stuff.aerowalsh.com/games/brainswap/)

## Design documents

| Doc | Contents |
|---|---|
| [docs/01-game-design.md](docs/01-game-design.md) | One-page game design document |
| [docs/02-fidelity.md](docs/02-fidelity.md) | Which real messages/sequences appear, simplifications, and the "lies we tell" list |
| [docs/03-levels.md](docs/03-levels.md) | Level progression: first HSA command → third airframe |
| [docs/04-architecture.md](docs/04-architecture.md) | Technology and architecture for the browser implementation |
| [docs/05-mvp.md](docs/05-mvp.md) | Scoped MVP build order (shipped) — historical record |
| [docs/06-schemas.md](docs/06-schemas.md) | Catalog / body / level / brain JSON schemas |

## Development

TypeScript monorepo (npm workspaces): a pure, deterministic, headless simulation
`core`; `levels` data; and a React 18 + PixiJS `game` (the playable run view +
brain editor). The core stays DOM-free and RNG-free — same brain + same level ⇒
identical message log every run.

```bash
npm install
npm run dev          # run the game (Vite dev server) — play the levels
npm run typecheck    # tsc --noEmit, strict (core + levels)
npm run typecheck:game
npm run gen:catalog  # regenerate packages/core/src/messages/generated.ts from the catalog YAML
npm run fidelity     # CI gate: every catalog name must exist in the A-GRA XSD
npm test             # vitest: core (handshake/vehicle/validator/determinism), fidelity, and the per-level golden runs
npm run build:game   # production bundle
```

Each playable level has a byte-stable **golden-run test** (e.g.
`packages/levels/test/level-1.2.golden.test.ts`) proving a hand-written reference
brain solves it deterministically. Playable today: **1.1, 1.2, 1.3, 1.4, 4.1, 4.5**
(see `docs/03-levels.md`). For authoring more, see "Adding a level" in
[CLAUDE.md](CLAUDE.md); `npx tsx tools/dump-log.ts <levelKey> <brainKey>` prints a
run's log/sends/score for tuning golden tests.

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
