<script lang="ts">
import { dmsPort, HIGHLIGHT, MESH_HULL, NODES } from "../lib/layout.ts";
import { heroReply, linkView, type TokenVM, tokens } from "../lib/sim-adapter.ts";
import { game } from "../lib/store.svelte.ts";

const gs = $derived(game.gs);
const hero = $derived(heroReply(gs));
const toks = $derived(tokens(gs, hero?.id ?? null));
const linkIds = ["relayQbAcp2", "relayAcp2Acp1", "req", "p2p", "p2p3", "bad"];

const sel = $derived(game.sel);
const hl = $derived(sel ? HIGHLIGHT[`${sel.type}:${sel.id}`] : undefined);

function nodeCat(id: string): { ring: string; sub: string; subColor: string } {
  const n = gs.nodes[id];
  if (n?.kind === "QB") return { ring: "var(--gold)", sub: "AUTHORITY", subColor: "var(--gold)" };
  if (n?.isLeader) return { ring: "var(--ink)", sub: "★ LEADER", subColor: "var(--c2)" };
  return { ring: "var(--ink)", sub: "", subColor: "var(--sub)" };
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

<!-- viewBox is cropped to the actual content bounds (mesh hull + nodes + their
     selection halos), not the full 1120x470 authoring space — the old box left
     ~480px of dead horizontal margin that shrank the graph between the side
     columns. Node coordinates in layout.ts are unchanged. -->
<svg viewBox="240 0 660 424" preserveAspectRatio="xMidYMid meet" class="graph">
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
       each platform runs its own DMS instance). Painted first so links sit on top. -->
  <g class="mesh" pointer-events="none">
    <rect x={MESH_HULL.x} y={MESH_HULL.y} width={MESH_HULL.w} height={MESH_HULL.h}
      rx={MESH_HULL.rx} />
    <text x={MESH_HULL.x + 16} y={MESH_HULL.y + MESH_HULL.h - 14} class="meshlabel">
      DMS / DDS-RTPS mesh — contested OTA [S]
    </text>
  </g>

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
          stroke={lv.bad ? "var(--bad)" : lv.cls === "MS" ? "#dedbd2" : "var(--good)"}
          stroke-dasharray={lv.bad ? "3 16" : "none"}
          class:marching={lv.bad}
          marker-end={lv.cls === "MS" ? "none" : lv.bad ? "url(#aBad)" : "url(#aGood)"}
        />
      </g>
    {/if}
  {/each}

  <!-- C2 lane labels: the QB↔ACP-1 round trip reads as two pipes. Sit in the clear
       gap between the two rails (tokens ride outboard, the relay shadows the right). -->
  <text x="560" y="124" class="railLabel" text-anchor="middle">request ▴</text>
  <text x="560" y="198" class="railLabel" text-anchor="middle">reply ▾</text>

  <!-- Selection highlight -->
  {#if hl}
    <circle cx={hl[0]} cy={hl[1]} r={hl[2]} fill="none" stroke="var(--ink)"
      stroke-width="2.5" stroke-dasharray="4 5" class="selring" />
  {/if}

  <!-- Message tokens (in-flight = moving; queues = one stack + count) -->
  {#each toks as t (t.id)}
    {@const bx = t.x < 560 ? t.x - 14 : t.x + 14}
    <g class="tok" onclick={() => tokClick(t)}
      onkeydown={(e) => key(e, () => tokClick(t))} role="button" tabindex="0">
      <circle cx={t.x} cy={t.y} r="15" fill="transparent" />
      {#if t.shape === "square"}
        <rect class="glide" x={t.x - 8} y={t.y - 8} width="16" height="16" rx="3" fill="var(--c2)" />
      {:else}
        <circle class="glide" cx={t.x} cy={t.y} r="9" fill="var(--p2p)" />
      {/if}
      {#if t.count}
        <circle cx={bx} cy={t.y - 12} r="8.5"
          fill={t.count >= 3 ? "var(--tint-amber)" : "#fff"}
          stroke={t.count >= 3 ? "var(--amber)" : "var(--hair)"} stroke-width="1.5" />
        <text x={bx} y={t.y - 8.5} class="tcount"
          fill={t.count >= 3 ? "var(--amber)" : "var(--sub)"}>{t.count}</text>
      {/if}
    </g>
  {/each}

  <!-- Hero strike reply -->
  {#if hero}
    {@const sgn = hero.labelSide === "left" ? -1 : 1}
    {@const anc = hero.labelSide === "left" ? "end" : "start"}
    <g transform="translate({hero.x},{hero.y})" class="tok"
      onclick={() => game.select("token", hero.id)}
      onkeydown={(e) => key(e, () => game.select("token", hero.id))} role="button" tabindex="0">
      {#if hero.ack === "missing"}
        <circle r="22" fill="none" stroke="var(--red)" stroke-width="2.5" class="glow" />
        <rect x="-11" y="-11" width="22" height="22" rx="3" fill="none"
          stroke="var(--c2)" stroke-width="2" stroke-dasharray="3 3" class="ghost" />
        <circle r="14" fill="var(--tint-cream)" />
        <circle r="14" fill="none" stroke="var(--red)" stroke-width="2.5"
          stroke-dasharray="14 8" class="ringspin" />
        <text class="glyph" y="5" fill="var(--red)">?</text>
        <text x={sgn * 30} y="5" text-anchor={anc} class="floatlabel" fill="var(--red)">MISSING ACK</text>
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
  {#each Object.keys(NODES) as id (id)}
    {@const g = NODES[id]}
    {@const cat = nodeCat(id)}
    {@const port = dmsPort(id)}
    {#if g}
      <g class="node" onclick={() => game.select("node", id)}
        onkeydown={(e) => key(e, () => game.select("node", id))} role="button" tabindex="0">
        <circle cx={g.x} cy={g.y} r={g.r} fill="#fff" stroke={cat.ring}
          stroke-width={id === "qb" ? 5 : 4} />
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
  .mesh rect { fill: var(--c2); fill-opacity: 0.05; stroke: var(--c2); stroke-opacity: 0.35;
    stroke-width: 1.5; stroke-dasharray: 6 7; }
  .meshlabel { font-size: 10px; font-weight: 700; letter-spacing: 0.4px; fill: var(--c2);
    fill-opacity: 0.7; }
  .dmsport { fill: #fff; stroke: var(--c2); stroke-width: 2; }
  .railLabel { font-size: 10px; font-weight: 700; letter-spacing: 0.3px; fill: var(--sub); pointer-events: none; }
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
  .glide { transition: cx 0.4s linear, cy 0.4s linear, x 0.4s linear, y 0.4s linear; }
</style>
