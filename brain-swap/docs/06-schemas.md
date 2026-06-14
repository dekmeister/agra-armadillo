# Data Schemas (catalog, body, level, brain)

Firmed up during build-order steps 1–4 (previously "not yet decided" in `CLAUDE.md`).
These are the headless-MVP shapes; they will extend (timers, variables, blocks,
waypoints, curves) in later slices. The TypeScript definitions are the source of
truth — this doc is the human map.

## Message catalog — `packages/levels/catalog/tier1.yaml`

Source for codegen (`tools/gen-catalog.ts` → `packages/core/src/messages/generated.ts`)
and the fidelity gate (`tools/check-fidelity.ts`). One document:

```yaml
version: 1
xsd: A-GRA_MessageDefinitions_v5_0_a.xsd     # informational
messages:
  - name: MA_FlightCommandMT                 # must grep in the XSD
    tier: 1
    direction: MA->FA | FA->MA
    citation: "VI Vol §1.2.2.2 …"            # VI Volume interaction/table
    summary: "…"
    fields:
      - name: CommandState                   # must grep in the XSD
        path: MessageData.Command.…          # indicative (pruned); not structurally validated
        type: string | number | boolean | enum | object
        values: [NEW, UPDATE, CANCEL]        # enum literals — each must grep in the XSD
        required: true | false
```

Fidelity rule: every `name` and every enum `values` literal must appear verbatim in
the XSD. `path` is indicative only (the real structures are deeply nested UCI; the
game prunes — fidelity lie #5). `type: object` maps to `Record<string, unknown>`;
an `enum` with N values becomes a TS string-literal union.

## Body — `packages/levels/bodies/*.json` (`BodyProfile`)

One airframe + its FA configuration. FA is one engine configured by this data
(`docs/04`); adding a body never means new FA code. Keys prefixed `_` are doc-only.

```jsonc
{
  "id": "ax-01", "name": "Mule",
  "capabilities": [
    { "id": "CAP-HSA", "type": "HSA_CSA",
      "profile": { "minAltitude": 0, "maxAltitude": 12000,
                   "minAirspeed": 20, "maxAirspeed": 140 } }   // same data FA validates against
  ],
  "flight":  { "maxTurnRateDeg": 6, "maxClimbRate": 50, "maxAccel": 20 }, // per tick (lie #6)
  "control": { "approvalLatencyTicks": 0 },     // 0 = instant APPROVED; >0 = PENDING then APPROVED
  "publish": { "positionIntervalTicks": 1, "activityIntervalTicks": 5 },
  "start":   { "x": 0, "y": 0, "altitude": 3000, "heading": 270, "speed": 0 }
}
```

## Level — `packages/levels/worlds/*/level-*.json` (`LevelDef`)

```jsonc
{
  "id": "1.2", "title": "First Valid HSA Command",
  "body": "ax-01",            // body id reference
  "capabilityId": "CAP-HSA",  // capability the brain controls (drives cap.* refs)
  "objective": {              // win is world-state, never "message sent" (docs/01)
    "zone": { "x": -900, "y": 0, "radius": 150 },
    "altitude": 3000, "altitudeTolerance": 50,
    "holdTicks": 10           // consecutive ticks in-zone & at-altitude
  },
  "availableMessages": [ "MA_FlightCommandMT", … ],  // editor subset (UI concern)
  "maxTicks": 200,            // hard budget; run fails if exceeded (keeps golden runs finite)
  "pars": { "ticks": 26, "busTraffic": 2, "rejections": 0, "brainSize": 7 },
  "fidelityNotes": [2, 3, 6, 8]    // indices into docs/02 §3
}
```

## Brain — `*.reference-brain.json` and player saves (`Brain`)

Visual state machine as data. MVP subset (`docs/05`): one message-type trigger + at
most one field guard per transition; actions are `send` (+ the implicit `goto` carried
by `target`). No timers, variables, or blocks yet.

```jsonc
{
  "id": "ref-1.2",
  "initial": "await-capability",
  "states": ["await-capability", "awaiting-approval", "…"],
  "transitions": [
    {
      "from": "await-capability",
      "trigger": { "messageType": "MA_FlightCapabilityStatusMT" },
      "guard":   { "field": "Availability", "op": "==", "value": "AVAILABLE" },
      "actions": [
        { "kind": "send", "message": "MA_ControlRequestMT",
          "fields": { "RequestType": "ACQUIRE",
                      "CapabilityID": { "cap": "CapabilityID" } } }
      ],
      "target": "awaiting-approval"
    }
  ]
}
```

**Guard** — `<trigger-message field> <op> <value>`, `op ∈ == != < <= > >=`.
**Value expr** (guard RHS and send-field templates) — one of:
- a literal (`"AVAILABLE"`, `270`, `true`),
- `{ "msg": "<field>" }` — a field of the triggering message,
- `{ "cap": "<field>" }` — a field of the controlled capability
  (`CapabilityID`, `MinAltitude`, `MaxAltitude`, `MinAirspeed`, `MaxAirspeed`).

Evaluated by `packages/core/src/brain/evaluator.ts` — **no `eval()`** (`docs/04`),
which keeps brains pure data and the sim deterministic.

## Scoring (`packages/core/src/score.ts`)

`{ ticks, busTraffic, rejections, brainSize }` (docs/01). `busTraffic` = MA→FA
messages; `rejections` = sends ignored-while-not-controller + FA-rejected commands;
`brainSize` = states + transitions.
