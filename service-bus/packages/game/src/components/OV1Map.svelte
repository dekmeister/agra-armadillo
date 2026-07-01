<script lang="ts">
import ov1 from "../assets/ov1.jpg";
import { PHASES } from "../lib/phases.ts";

let { selected, onSelect }: { selected: number; onSelect: (id: number) => void } = $props();

// Enter/Space activation, mirroring Graph.svelte's keyboard helper.
function key(e: KeyboardEvent, id: number): void {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onSelect(id);
  }
}
</script>

<div class="ov1">
  <img src={ov1} alt="OV-1 operational view — the DCA mission vignette" />

  <!-- Hotspot overlay. Shares the image's exact 1052×591 aspect, so regions register. -->
  <svg viewBox="0 0 1052 591" preserveAspectRatio="xMidYMid meet" class="overlay">
    {#each PHASES as p (p.id)}
      {@const [x, y, w, h] = p.hotspot}
      {@const [mx, my] = p.marker}
      <g
        class="hot"
        class:active={p.id === selected}
        class:locked={!p.playable}
        role="button"
        tabindex="0"
        aria-label={`Phase ${p.id} — ${p.name}`}
        aria-pressed={p.id === selected}
        onclick={() => onSelect(p.id)}
        onfocus={() => onSelect(p.id)}
        onkeydown={(e) => key(e, p.id)}
      >
        <!-- Fat transparent hit-area. -->
        <rect {x} {y} width={w} height={h} rx="10" fill="transparent" />
        <!-- Pulsing highlight, shown on hover/active (CSS-gated). -->
        <rect class="ring" {x} {y} width={w} height={h} rx="10" fill="none" stroke-width="3" />
        <!-- Always-visible numbered chip so every phase reads as clickable. -->
        <circle class="chip" cx={mx} cy={my} r="13" />
        <text class="cnum" x={mx} y={my + 4}>{p.id}</text>
        {#if !p.playable}
          <text class="lock" x={mx + 11} y={my - 9}>🔒</text>
        {/if}
      </g>
    {/each}
  </svg>
</div>

<style>
  .ov1 {
    position: relative;
    width: 100%;
    aspect-ratio: 1052 / 591;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--hair);
    background: #0b1622;
  }
  .ov1 img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .hot {
    cursor: pointer;
    outline: none;
  }
  /* Numbered chip — subtle until hover/active. */
  .chip {
    fill: rgba(11, 22, 34, 0.66);
    stroke: #fff;
    stroke-width: 1.5;
    opacity: 0.78;
    transition: opacity 0.15s ease, fill 0.15s ease;
  }
  .cnum {
    text-anchor: middle;
    font-size: 15px;
    font-weight: 800;
    fill: #fff;
    pointer-events: none;
  }
  .lock {
    text-anchor: middle;
    font-size: 12px;
    pointer-events: none;
  }
  /* Highlight ring hidden by default; revealed on hover/focus/active. */
  .ring {
    stroke: var(--c2);
    opacity: 0;
    stroke-dasharray: 7 6;
    transition: opacity 0.15s ease;
  }
  .hot.locked .ring {
    stroke: var(--sub);
  }
  .hot:hover .ring,
  .hot:focus-visible .ring,
  .hot.active .ring {
    opacity: 1;
    animation: selpulse 1.4s ease-in-out infinite;
  }
  .hot:hover .chip,
  .hot:focus-visible .chip,
  .hot.active .chip {
    opacity: 1;
    fill: var(--c2);
  }
  .hot.locked:hover .chip,
  .hot.locked:focus-visible .chip,
  .hot.locked.active .chip {
    fill: var(--sub);
  }
</style>
