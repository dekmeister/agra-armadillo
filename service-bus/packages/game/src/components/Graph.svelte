<script lang="ts">
import { fade } from "svelte/transition";
import { dmsPort, layoutFor } from "../lib/layout.ts";
import { CLASS_FILL } from "../lib/palette.ts";
import {
  heroReply,
  type Highlight,
  highlightFor,
  linkView,
  selfLoopLabels,
  type TokenVM,
  tokens,
} from "../lib/sim-adapter.ts";
import { game } from "../lib/store.svelte.ts";

const gs = $derived(game.gs);
const layout = $derived(layoutFor(gs.scenarioId));
const hero = $derived(heroReply(gs));
// Reading game.renderFrac (updated ~60 fps by the store's rAF loop) here is what re-derives
// token positions every frame, gliding in-flight messages continuously between ticks.
const toks = $derived(tokens(gs, hero?.id ?? null, game.renderFrac));
// Degraded links drawn last so their marching dashes sit on top of clean rails.
const linkIds = $derived(
  Object.values(gs.links)
    .slice()
    .sort((a, b) => Number(a.channel === "BAD") - Number(b.channel === "BAD"))
    .map((l) => l.id),
);

// The OTA field renders "contested" only while an off-platform link actually is —
// derived from the same `linkView().bad` the rails use, so the field can never
// contradict the rails drawn on top of it. VI self-loops are on-platform: excluded.
const loopLabels = $derived(selfLoopLabels(gs));
const meshContested = $derived(
  Object.values(gs.links).some((l) => l.from !== l.to && linkView(gs, l.id)?.bad),
);

const sel = $derived(game.sel);
// The hero's ring is NOT computed here. It is rendered inside the hero's own <g>, which
// carries a 0.45s `.heroslide` transform transition — a ring positioned out here from the
// instantaneous hero.x/hero.y detached from the glyph for the whole slide after a reroute
// and hung around empty space (WP4.5b). Sharing one transform makes that impossible.
const heroSelected = $derived(sel?.type === "token" && !!hero && hero.id === sel.id);
// Other tokens' rings ride their live (glided) position from `toks`; nodes and links defer
// to highlightFor. Matching `headId ?? id` mirrors tokClick, so queue stacks ring correctly.
const hl = $derived.by((): Highlight | null => {
  if (sel?.type === "token") {
    if (heroSelected) return null;
    const t = toks.find((tk) => (tk.headId ?? tk.id) === sel.id);
    return t ? { kind: "circle", cx: t.x, cy: t.y, r: 16 } : null;
  }
  return highlightFor(gs, sel);
});

function nodeCat(id: string): { ring: string; sub: string; subColor: string } {
  const n = gs.nodes[id];
  if (n?.kind === "QB" || n?.kind === "LRE")
    return { ring: "var(--gold)", sub: "AUTHORITY", subColor: "var(--gold)" };
  if (n?.isLeader) return { ring: "var(--ink)", sub: "★ LEADER", subColor: "var(--c2)" };
  return { ring: "var(--ink)", sub: "", subColor: "var(--sub)" };
}
function isAuthority(id: string): boolean {
  const k = gs.nodes[id]?.kind;
  return k === "QB" || k === "LRE";
}
function tokClick(t: TokenVM): void {
  // A token — including a queue stack — inspects the message; the rail inspects the link.
  game.select("token", t.headId ?? t.id);
}
function key(e: KeyboardEvent, fn: () => void): void {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
}
</script>

<!-- viewBox comes from the active scenario's layout (cropped to its content bounds). -->
<svg viewBox={layout.viewBox} preserveAspectRatio="xMidYMid meet" class="graph">
  <defs>
    <marker id="aGood" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="15"
      refX="11" refY="6" orient="auto">
      <path d="M0,0 L12,6 L0,12 Z" fill="var(--good)" />
    </marker>
    <marker id="aBad" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="15"
      refX="11" refY="6" orient="auto">
      <path d="M0,0 L12,6 L0,12 Z" fill="var(--bad)" />
    </marker>
  </defs>

  <!-- The contested OTA region: the DMS / DDS-RTPS pub-sub mesh (no central broker;
       each platform runs its own DMS instance). Painted first so links sit on top.
       Only shown for scenarios whose topology is genuinely an OTA mesh. -->
  {#if layout.mesh}
    {@const m = layout.mesh}
    <g class="mesh" class:clean={!meshContested} pointer-events="none">
      <rect x={m.x} y={m.y} width={m.w} height={m.h} rx={m.rx} />
      <text x={m.x + 16} y={m.labelPos === "tl" ? m.y + 20 : m.y + m.h - 14} class="meshlabel">
        {m.label}{meshContested ? " · contested" : ""} [S]
      </text>
    </g>
  {/if}

  <!-- A selected link glows along its own rail path, painted UNDER the links so the rail
       itself stays crisp on top of its halo. -->
  {#if hl?.kind === "rail"}
    <g pointer-events="none" class="selrail">
      <path d={hl.d} fill="none" stroke="var(--c2)" stroke-width={hl.width + 12}
        stroke-linecap="round" stroke-opacity="0.22" />
      <path d={hl.d} fill="none" stroke="var(--ink)" stroke-width={hl.width + 3}
        stroke-linecap="round" stroke-opacity="0.35" />
    </g>
  {/if}

  <!-- Links -->
  {#each linkIds as id (id)}
    {@const lv = linkView(gs, id)}
    {#if lv}
      <g class="link" onclick={() => game.select("link", id)}
        onkeydown={(e) => key(e, () => game.select("link", id))} role="button" tabindex="0">
        <path d={lv.d} stroke="transparent" stroke-width="22" fill="none" />
        <path
          d={lv.d}
          fill="none"
          stroke-linecap="round"
          stroke-width={lv.width}
          stroke={lv.bad ? "var(--bad)" : lv.cls === "MS" ? "var(--ms-rail)" : "var(--good)"}
          stroke-dasharray={lv.bad ? "3 16" : "none"}
          class:marching={lv.bad}
          marker-end={lv.cls === "MS" ? "none" : lv.bad ? "url(#aBad)" : "url(#aGood)"}
        />
      </g>
    {/if}
  {/each}

  <!-- On-platform (self-loop) links, named on the board. The VI loop is the object of
       Phase 1/2's headline lesson — "VI is free and never crosses the air" — and was an
       anonymous grey lobe until you clicked it (WP4.4). -->
  {#each loopLabels as l (l.id)}
    <text x={l.x} y={l.y} class="looplabel">{l.text}</text>
  {/each}

  <!-- C2 lane labels for Phase 6's QB↔ACP-1 round trip (its two pipes). -->
  {#if gs.scenarioId === "phase6"}
    <text x="560" y="124" class="railLabel" text-anchor="middle">request ▴</text>
    <text x="560" y="198" class="railLabel" text-anchor="middle">reply ▾</text>
  {/if}

  <!-- Selection highlight for a node or an ordinary token (links glow above; the hero
       ring lives inside the hero group so it can't detach during the slide). -->
  {#if hl?.kind === "circle"}
    <circle cx={hl.cx} cy={hl.cy} r={hl.r} fill="none" stroke="var(--ink)"
      stroke-width="2.5" stroke-dasharray="4 5" class="selring" />
  {/if}

  <!-- Message tokens (in-flight = moving; queues = one stack + count) -->
  {#each toks as t (t.id)}
    {@const bx = t.bx ?? t.x}
    {@const by = t.by ?? t.y}
    <g class="tok" transition:fade={{ duration: 160 }} onclick={() => tokClick(t)}
      onkeydown={(e) => key(e, () => tokClick(t))} role="button" tabindex="0">
      <circle cx={t.x} cy={t.y} r="15" fill="transparent" />
      {#if t.shape === "square"}
        <rect class:settle={!!t.count} x={t.x - 8} y={t.y - 8} width="16" height="16" rx="3" fill={CLASS_FILL[t.cls]} />
      {:else}
        <circle class:settle={!!t.count} cx={t.x} cy={t.y} r="9" fill={CLASS_FILL[t.cls]} />
      {/if}
      {#if t.count}
        <!-- Amber at >= 3 is legitimate here: a hot backlog IS degradation, and it is
             now the only amber near a token (MD/MP got their own hues in WP4.3). -->
        <circle cx={bx} cy={by} r="8.5"
          fill={t.count >= 3 ? "var(--tint-amber)" : "#fff"}
          stroke={t.count >= 3 ? "var(--amber)" : "var(--hair)"} stroke-width="1.5" />
        <text x={bx} y={by + 3.5} class="tcount"
          fill={t.count >= 3 ? "var(--amber)" : "var(--sub)"}>{t.count}</text>
      {/if}
    </g>
  {/each}

  <!-- Hero strike reply -->
  {#if hero}
    {@const sgn = hero.labelSide === "left" ? -1 : 1}
    {@const anc = hero.labelSide === "left" ? "end" : "start"}
    <g transform="translate({hero.x},{hero.y})" class="tok heroslide"
      onclick={() => game.select("token", hero.id)}
      onkeydown={(e) => key(e, () => game.select("token", hero.id))} role="button" tabindex="0">
      <!-- Inside the transitioned group, at local (0,0): the ring is welded to the glyph
           and cannot lag behind it during the reroute slide. -->
      {#if heroSelected}
        <circle r="28" fill="none" stroke="var(--ink)" stroke-width="2.5"
          stroke-dasharray="4 5" class="selring" />
      {/if}
      {#if hero.ack === "missing"}
        <circle r="22" fill="none" stroke="var(--red)" stroke-width="2.5" class="glow" />
        <rect x="-11" y="-11" width="22" height="22" rx="3" fill="none"
          stroke="var(--c2)" stroke-width="2" stroke-dasharray="3 3" class="ghost" />
        <circle r="14" fill="var(--tint-cream)" />
        <circle r="14" fill="none" stroke="var(--red)" stroke-width="2.5"
          stroke-dasharray="14 8" class="ringspin" />
        <text class="glyph" y="5" fill="var(--red)">?</text>
        <text x={sgn * 30} y="5" text-anchor={anc} class="floatlabel" fill="var(--red)">MISSING ACK</text>
      {:else if hero.ack === "rerouted"}
        <!-- The player took the CORRECT recovery action, so the alarm stands down: same
             glyph grammar (it is the same reply), but blue and calm — no red glow, no
             spinning "?". The amber->blue handover animates once, so the change reads as
             a consequence of the decision rather than a silent swap. -->
        <circle r="14" fill="var(--tint-cream)" />
        <circle r="14" fill="none" stroke="var(--c2)" stroke-width="2.5"
          stroke-dasharray="14 8" class="ringspin handover" />
        <text class="glyph" y="5" fill="var(--c2)">⇢</text>
        <text x={sgn * 30} y="5" text-anchor={anc} class="floatlabel" fill="var(--c2)">REROUTED · EN ROUTE</text>
      {:else if hero.ack === "sent"}
        <circle r="15" fill="var(--tint-green)" />
        <rect x="-8" y="-8" width="16" height="16" rx="3" fill="var(--c2)" />
        <circle cx="12" cy="-11" r="7" fill="var(--green)" />
        <text x="12" y="-8" class="mini" fill="#fff">✓</text>
        <circle cx="-12" cy="11" r="7" fill="var(--gold)" />
        <text x="-12" y="14" class="mini" fill="#fff">⚿</text>
        <text x={sgn * 28} y="5" text-anchor={anc} class="floatlabel" fill="var(--green)">DELIVERED + AUTH</text>
      {:else}
        <circle r="15" fill="var(--tint-red)" />
        <rect x="-8" y="-8" width="16" height="16" rx="3" fill="#fff" stroke="var(--red)" stroke-width="2.5" />
        <text class="glyph" y="5" fill="var(--red)">✕</text>
        <text x={sgn * 26} y="5" text-anchor={anc} class="floatlabel" fill="var(--red)">MISSED</text>
      {/if}
    </g>
  {/if}

  <!-- Nodes -->
  {#each Object.keys(layout.nodes) as id (id)}
    {@const g = layout.nodes[id]}
    {#if g && gs.nodes[id]}
      {@const cat = nodeCat(id)}
      {@const port = dmsPort(g, layout.meshCenter)}
      <g class="node" onclick={() => game.select("node", id)}
        onkeydown={(e) => key(e, () => game.select("node", id))} role="button" tabindex="0">
        <circle cx={g.x} cy={g.y} r={g.r} fill="#fff" stroke={cat.ring}
          stroke-width={isAuthority(id) ? 5 : 4} />
        <text x={g.x} y={g.y - 2} class="nlabel" font-size="15">
          {gs.nodes[id]?.label}
        </text>
        {#if cat.sub}
          <text x={g.x} y={g.y + 14} class="nsub" fill={cat.subColor}>{cat.sub}</text>
        {/if}
        <!-- This platform's own DMS instance: the port where it meets the OTA mesh. -->
        <circle class="dmsport" cx={port.x} cy={port.y} r="5.5" />
        <title>{gs.nodes[id]?.label} DMS instance — port onto the DDS/RTPS mesh</title>
      </g>
    {/if}
  {/each}
</svg>

<style>
  .graph { width: 100%; height: 100%; display: block; }
  .node, .link, .tok { cursor: pointer; }
  .nlabel { text-anchor: middle; font-weight: 800; fill: var(--ink); }
  .nsub { text-anchor: middle; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; }
  .mesh rect { fill: var(--mesh-fill); stroke: var(--mesh-stroke);
    stroke-width: 1.5; stroke-dasharray: 6 7; }
  .meshlabel { font-size: 10px; font-weight: 700; letter-spacing: 0.4px; fill: var(--c2);
    fill-opacity: 0.7; }
  /* Uncontested air: the same medium, lighter. Still visibly present — "no field" would
     wrongly read as "this traffic doesn't cross the air". */
  .mesh.clean rect { fill: var(--mesh-fill-clean); stroke: var(--mesh-stroke-clean);
    stroke-dasharray: 2 6; }
  .mesh.clean .meshlabel { fill-opacity: 0.45; }
  .dmsport { fill: #fff; stroke: var(--c2); stroke-width: 2; }
  .railLabel { font-size: 10px; font-weight: 700; letter-spacing: 0.3px; fill: var(--sub); pointer-events: none; }
  .looplabel { font-size: 10px; font-weight: 700; letter-spacing: 0.3px; fill: var(--vi);
    text-anchor: start; pointer-events: none; }
  .selrail { animation: selpulse 1.4s ease-in-out infinite; }
  /* One-shot amber -> blue as the reroute takes effect: the alarm visibly standing down. */
  .handover { animation: ringspin 2s linear infinite, handover 0.9s ease-out 1; }
  .tcount { text-anchor: middle; font-size: 10px; font-weight: 800; }
  .glyph { text-anchor: middle; font-size: 16px; font-weight: 800; }
  .mini { text-anchor: middle; font-size: 9px; font-weight: 800; }
  .floatlabel { font-size: 11px; font-weight: 800; letter-spacing: 0.5px; }
  .marching { animation: badgap 1.1s linear infinite; }
  .selring { animation: selpulse 1.4s ease-in-out infinite; }
  /* transform-box: fill-box keeps SVG scale/rotate centred on the element itself
     (not the viewport origin) — otherwise the halo balloons from the top-left. */
  .ringspin { animation: ringspin 2s linear infinite; transform-box: fill-box; transform-origin: center; }
  .glow { animation: glow 1.4s ease-out infinite; transform-box: fill-box; transform-origin: center; }
  .ghost { animation: ghost 1.3s ease-in-out infinite; }
  /* In-flight tokens are positioned per-frame by the rAF clock (renderFrac) — no CSS
     transition, which would only lag the smooth glide. The queue-stack badge moves
     discretely, so it gets a short settle; the hero glyph slides on reroute. */
  .settle { transition: cx 0.25s ease, cy 0.25s ease, x 0.25s ease, y 0.25s ease; }
  .heroslide { transition: transform 0.45s ease; }
</style>
