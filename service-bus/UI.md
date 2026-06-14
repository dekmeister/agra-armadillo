# UI.md — GUI Exploration Prompt for "Service Bus"

Paste the prompt below into a fresh Claude conversation (e.g. claude.ai, with artifacts) to explore
distinct GUI directions for the game. It is **self-contained** — it does not assume access to this repo.
Use it to generate comparable mockups, then bring the winning direction back here to implement in
Svelte + SVG.

> **Tip:** run it once as written to get the three directions, then follow up with "expand Direction N
> into a full interactive artifact" for whichever you want to feel in motion. Keep mockups static-data
> only; the real simulation lives in a separate deterministic TypeScript engine.

---

## PROMPT (copy from here down)

You are helping me design the GUI for a browser game called **Service Bus**. I want you to produce
**three distinct, self-contained HTML/CSS (and minimal JS) mockups as artifacts**, each a different
visual and interaction *direction* for the same screen, using realistic placeholder data so I can
compare them side by side. Do not build the game logic — these are look-and-feel + layout explorations.

### What the game is
A routing/throughput game (think **Mini Metro**'s minimalist clarity, **Factorio**'s logistics density,
and **SpaceChem**'s spatial-program feel) that teaches the message-routing topology of a military
autonomy standard. The player operates a **message bus** connecting a small team of autonomous aircraft
("ACPs"), a command node ("QB"), and a relay. Mission-critical **interactions** (each is a *round trip*:
a request and its required reply) must travel across a **contested radio network** of directional links
that have bandwidth, latency, and bursty packet loss. The player routes and prioritises this traffic so
the right message reaches the right node, with the right authority, before a deadline.

It is a serious, technical aesthetic — closer to a tactical C2 / network-operations console than a
cartoon game — but it must stay **legible and calm**, not a wall of noise. The player should always be
able to answer at a glance: *what's flowing, what's blocked, what's about to miss its deadline.*

### The single screen to design (one mission in progress)
Lay out these elements; this is the same content in all three directions, differently expressed:

1. **Network graph (the centrepiece).** ~5 nodes — 3 aircraft (`ACP-1` is the team leader), one command
   node (`QB`), one relay (`DMS`). Nodes are connected by **directional links** (arrows; A→B can differ
   from B→A). Each link shows a **quality state**: GOOD or BAD (bursty), plus a load/queue indicator.
   One link (`QB → ACP-1`) is currently **BAD** — this is the crisis the player is reacting to.
2. **Message tokens** travelling along links, each tagged by **interface class** (use two for now:
   **C2** = command/approval traffic; **P2P** = team-to-team picture-sharing). Each token shows a
   **lifecycle state**: `PENDING`, `EXECUTING`, `SENT` (success), or a failure — `FAIL_UNSENT` /
   `FAIL_MISSING_ACK`. These states need clearly distinct visual treatments; `FAIL_MISSING_ACK` (sent but
   unconfirmed) is the most important and most anxiety-inducing — make it feel uncertain, not just "red".
3. **Per-link queue / priority control.** The player can set how each link orders its backlog (by
   interface class, FIFO, or earliest-deadline). Show how a player would inspect and change this.
4. **HUD / status panel** with: current **mission phase** ("Threat Engagement"), a **score**, a
   **"COP freshness"** gauge (a team-shared picture that decays and must be refreshed — turns amber/red if
   starved), and a **countdown deadline** ("WEZ window") for a pending strike-approval interaction.
5. **The active objective card:** "Strike approval — needs QB authority — 0:18 to deadline," showing the
   round trip's progress (request out → awaiting reply) and that it is **stalled on the BAD link**.
6. **An authority indicator:** the approval is only valid if it carries **QB authority**; if the player
   routes it to the wrong node it would be rejected. Convey "delivery ≠ authority" somehow in the UI.
7. **A contingency/event log** (compact, scrollable): timestamped lines like
   "T+142 QB→ACP-1 link degraded", "T+143 approval reply: MISSING_ACK".

### Three directions I want compared (make them genuinely different)
- **Direction A — "Tactical console":** dark, high-contrast, mil-spec network-ops feel. Monospaced data,
  thin precise lines, restrained accent colours, dense but ordered. Graph is the hero; panels are chrome.
- **Direction B — "Mini Metro minimalist":** light, lots of whitespace, bold simple shapes, a tiny
  colour palette (one colour per interface class), playful clarity. Tokens as clean dots gliding on lines.
  Prioritise instant readability over data density.
- **Direction C — "Logistics dashboard":** Factorio/throughput-sim influence. Show the network *and* live
  meters — per-link throughput bars, queue depths, a flow/sankey hint of which interface is eating
  bandwidth. For the player who wants to optimise numbers, not just watch dots.

### For each direction, deliver
- A single self-contained artifact (inline CSS, placeholder data, no external assets; tiny vanilla JS only
  for hover/inspect is fine).
- A 3–4 sentence rationale: what this direction optimises for, who it's best for, and its main risk.
- One callout on how it handles the **`FAIL_MISSING_ACK` on the deadline-critical link** moment — the most
  important emotional/clarity beat in the game.

### Constraints & taste
- Legibility first. A new player must read the board in ~5 seconds. Colour must carry meaning
  consistently (interface class vs. link health vs. lifecycle state must not collide into confusion —
  propose a clear colour-role scheme and state it).
- Accessible contrast; don't rely on colour alone for the four lifecycle states (use shape/iconography
  too — important for the failure states).
- Target a 16:9 desktop browser viewport. No frameworks.

Start by briefly proposing your **colour-role scheme** (how you'll separate interface class, link health,
and lifecycle state visually), then produce the three artifacts.

## END PROMPT
