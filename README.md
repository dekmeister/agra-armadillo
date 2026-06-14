# agra-armadillo

A collection of browser-based puzzle games for learning the **A-GRA (ASK 5.0a)** open
architecture — the US Air Force's Autonomous Systems Kit standard for Mission Autonomy
vehicle interfaces, messaging topology, and compliance assessment.

Each game teaches a different layer of A-GRA through play. All message names, field
names, interaction patterns, and vocabulary used in the games are drawn directly from
the public A-GRA 5.0a release (see [Sources](#sources) below). Simplifications are
always documented, never silent.

## Games

| Directory | Status | What it teaches |
|---|---|---|
| [`brain-swap/`](brain-swap/) | In development | The A-GRA Vehicle Interface (VI): build a Mission Autonomy "brain" — a state machine exchanging real VI messages with Flight Autonomy — then port it across airframes |
| [`service-bus/`](service-bus/) | Design phase | A-GRA topology and message-flow: route interactions across the six L1 interfaces through a contested RF network, operating the real Decentralized Messaging Service (DMS) |
| [`compliance-officer/`](compliance-officer/) | Concept | The A-GRA compliance and assessment regime |

## Repository layout

```
References/          Vendored copies of the authoritative public standards (read-only)
  A-GRA/
    standard/        ASK 5.0a documentation volumes and message schema XSD
    test-harness/    A-GRA 5.0a Compliance Test Harness
  OMS/oms/           Open Mission Systems (OMS) v2.5 D&D set
  UCI/standard/      Universal C2 Interface (UCI) v2.5 standard documents and schema
normal-form/         UCI normalised interface specification and schema (working copy)
brain-swap/          Game 1 — Vehicle Interface puzzle game
service-bus/         Game 2 — DMS routing/throughput game (design docs)
compliance-officer/  Game 3 — compliance assessment game (concept)
```

## Sources

All standards used in this project are publicly released by the United States Air Force
through the [Open Architecture Collaborative Working Group (OACWG)](https://github.com/modular-af/)
under a government-owned, non-proprietary licence. They are reproduced here in
`References/` for offline use and build-time validation; the canonical sources are:

### A-GRA ASK 5.0a

**Autonomous Systems Kit (ASK) 5.0a** — the primary source for all game content.

- Standard documents and message schema XSD:
  [`github.com/open-arsenal/a-gra`](https://github.com/open-arsenal/a-gra)
- Compliance Test Harness (model for interaction-level compliance judging):
  [`github.com/open-arsenal/a-gra-test-harness`](https://github.com/open-arsenal/a-gra-test-harness)

The vendored copy lives in `References/A-GRA/`. The message schema XSD
(`A-GRA_MessageDefinitions_v5_0_a.xsd`) is used as the build-time ground truth: a
fidelity-check step fails the build if any message name in the game catalog cannot be
found in the XSD.

### UCI v2.5

**Universal Command and Control Interface (UCI) v2.5** — the foundational message
architecture that A-GRA builds on. UCI defines the message envelope, interaction
patterns (request + required-status round trips), and schema design rules used
throughout the games.

- Canonical source:
  [`github.com/modular-af/UCI`](https://github.com/modular-af/UCI)

The vendored copy lives in `References/UCI/`.

### OMS v2.5

**Open Mission Systems (OMS) v2.5** — the mission-systems layer that sits above UCI,
defining platform/subsystem/service composition and the Critical Abstraction Layer
(CAL). Referenced for context on how A-GRA fits into the broader architecture.

- Canonical source:
  [`github.com/modular-af/OMS`](https://github.com/modular-af/OMS)

The vendored copy lives in `References/OMS/`.

---

*These standards are government-owned and non-proprietary. Contact the OACWG at
<aflcmc.ase.architectures@us.af.mil> for governance questions.*
