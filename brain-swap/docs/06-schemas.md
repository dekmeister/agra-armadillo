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
    { "id": "MULE-01", "type": "HSA_CSA",
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
  "capabilityId": "MULE-01",  // capability the brain controls (drives cap.* refs)
  "objective": {              // win is world-state, never "message sent" (docs/01)
    "kind": "reach-hold",     // discriminated union — see "Objective kinds" below
    "zone": { "x": -900, "y": 0, "radius": 150 },
    "altitude": 3000, "altitudeTolerance": 50,
    "holdTicks": 10           // consecutive ticks in-zone & at-altitude
  },
  "availableMessages": [ "MA_FlightCommandMT", … ],  // editor subset (UI concern)
  "maxTicks": 200,            // hard budget; run fails if exceeded (keeps golden runs finite)
  "pars": { "ticks": 26, "busTraffic": 2, "rejections": 0, "brainSize": 7 },
  "fidelityNotes": [2, 3, 6, 8],   // indices into docs/02 §3
  // --- optional fields (post-MVP) ---
  "brief": "…", "teaches": "…",    // teaching copy surfaced in-game (optional)
  "start": { "x": 0, … },          // override the body's start for this mission (optional)
  "bodies": ["ax-01","ax-02","ax-03"],  // multi-body level (4.5); one brain, every body
  "events": [ { "kind": "degrade-envelope", "tick": 40, … } ]  // mid-mission schedule — see "Mission events"
}
```

### Objective kinds (`Objective` discriminated union, `level/types.ts`)

Win conditions dispatch on `kind`. Every variant carries `holdTicks` (consecutive
ticks the terminal predicate must hold), so callers may read `objective.holdTicks`
without narrowing. `evaluateWin` (`level/runtime.ts`) is given the vehicle, the FA
state, and the carried progress `{ holdTicks, waypointIndex }`.

```jsonc
// reach-hold (1.2, 1.3, 4.5): be in the zone & altitude band for holdTicks
{ "kind": "reach-hold", "zone": {…}, "altitude": 3000, "altitudeTolerance": 50, "holdTicks": 10 }

// hold-control (1.1): be the secondary controller of capabilityId for holdTicks (no flight)
{ "kind": "hold-control", "holdTicks": 30 }

// waypoint-sequence (1.4): pass each waypoint in order, then hold the final one
{ "kind": "waypoint-sequence",
  "waypoints": [ { "zone": {…}, "altitude?": …, "altitudeTolerance?": … }, … ],
  "holdTicks": 5 }
```

The world carries `waypointIndex` (next waypoint to reach) alongside `holdTicks`;
both init to 0. Multi-body levels (`bodies`) ignore the singular `body` field — see
`multiBodyScenarios` + `aggregateWorst` (`packages/levels/src/index.ts`, scoring).

### Mission events (`MissionEvent` union, `level/events.ts`)

`LevelDef.events?` is a deterministic schedule of mid-mission changes. Each event has
a `kind` + integer `tick` and fires in **Phase A′** of the step that advances the
world to that `tick` — before inbound delivery, so the commands delivered that tick
are validated against the new state (and the re-advertised envelope reaches MA the
next tick). Events emit only existing catalog messages (no new fidelity surface).
Ordering among events sharing a tick is stable (`kind`, then id), so brain run,
`replayScript`, and `store.advanceLive` agree byte-for-byte.

```jsonc
// degrade-envelope: tighten a capability's advertised envelope; FA re-advertises
//   MA_FlightCapabilityMT with the merged values and validates against them.
{ "kind": "degrade-envelope", "tick": 40, "capabilityId": "HERON-02", "maxAltitude": 6000 }

// capability-unavailable: pull a capability; FA emits MA_FlightCapabilityStatusMT
//   (TEMPORARILY_UNAVAILABLE|UNAVAILABLE), drops MA's control, and ignores commands
//   on it until re-acquired.
{ "kind": "capability-unavailable", "tick": 60, "capabilityId": "HERON-02", "reason": "TEMPORARILY_UNAVAILABLE" }

// spawn-threat / despawn-threat: add/remove a threat zone in World.threats (optional
//   velocity {vx,vy}). Rendered + breach-checked in later phases.
{ "kind": "spawn-threat", "tick": 20, "threatId": "T1", "zone": {…}, "velocity": { "vx": 1, "vy": 0 } }
{ "kind": "despawn-threat", "tick": 80, "threatId": "T1" }
```

The overlay this produces lives on the world: `World.dynamicEnvelope` (capId →
effective `CapabilityProfile`, absent = the body's static profile) and
`World.threats`; capability pulls are tracked in `FaState.unavailableCaps`.

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
`brainSize` = states + transitions. `aggregateWorst(scores)` reduces several runs to
the per-metric worst case — used by multi-body levels (4.5) to grade one brain across
the whole fleet.
