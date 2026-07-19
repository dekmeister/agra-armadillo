<script lang="ts">
/**
 * Field Guide §1 — one off-platform hop, drawn.
 *
 * The load-bearing claim: the ASB is inside the platform, each platform runs its
 * OWN DMS instance, and between them is a mesh with nothing in the middle. Drawing
 * a box in the centre would depict the central broker the architecture explicitly
 * does not have — so the contested air is a shaded band with peer connections
 * across it, never a hub.
 *
 * Decorative and propless (the OV1Scene.svelte pattern): no state, aria-hidden,
 * with the same content stated in prose beside it.
 */
</script>

<svg viewBox="0 0 720 300" preserveAspectRatio="xMidYMid meet" class="stack" aria-hidden="true">
  <defs>
    <marker id="fg-arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--sub)" />
    </marker>
    <pattern id="fg-mesh" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="8" stroke="var(--bad)" stroke-width="1" opacity="0.28" />
    </pattern>
  </defs>

  <!-- The contested air: a band, not a node. -->
  <rect x="250" y="0" width="220" height="300" fill="url(#fg-mesh)" />
  <rect x="250" y="0" width="220" height="300" fill="var(--tint-amber)" opacity="0.35" />
  <text x="360" y="24" text-anchor="middle" class="band">CONTESTED AIR · DDS/RTPS MESH</text>
  <text x="360" y="286" text-anchor="middle" class="band-sub">no central broker</text>

  <!-- Local platform -->
  <rect x="16" y="52" width="224" height="180" rx="14" class="plat" />
  <text x="28" y="76" class="platlabel">PLATFORM A</text>
  <rect x="34" y="90" width="90" height="38" rx="9" class="box" />
  <text x="79" y="114" text-anchor="middle" class="boxlabel">MA</text>
  <rect x="34" y="146" width="188" height="30" rx="8" class="asb" />
  <text x="128" y="166" text-anchor="middle" class="asblabel">ABSTRACT SERVICE BUS (on-platform)</text>
  <rect x="148" y="90" width="74" height="38" rx="9" class="box" />
  <text x="185" y="114" text-anchor="middle" class="boxlabel">DMS</text>
  <circle cx="240" cy="109" r="7" class="port" />
  <text x="128" y="204" text-anchor="middle" class="note">reliable · no bandwidth cost</text>

  <!-- Remote platform -->
  <rect x="480" y="52" width="224" height="180" rx="14" class="plat" />
  <text x="492" y="76" class="platlabel">PLATFORM B</text>
  <rect x="596" y="90" width="90" height="38" rx="9" class="box" />
  <text x="641" y="114" text-anchor="middle" class="boxlabel">MA</text>
  <rect x="498" y="146" width="188" height="30" rx="8" class="asb" />
  <text x="592" y="166" text-anchor="middle" class="asblabel">ABSTRACT SERVICE BUS (on-platform)</text>
  <rect x="498" y="90" width="74" height="38" rx="9" class="box" />
  <text x="535" y="114" text-anchor="middle" class="boxlabel">DMS</text>
  <circle cx="480" cy="109" r="7" class="port" />
  <text x="592" y="204" text-anchor="middle" class="note">reliable · no bandwidth cost</text>

  <!-- The hop -->
  <path d="M124 109 L148 109" class="wire" marker-end="url(#fg-arrow)" />
  <path d="M247 109 L473 109" class="air" marker-end="url(#fg-arrow)" />
  <path d="M572 109 L596 109" class="wire" marker-end="url(#fg-arrow)" />
  <text x="360" y="100" text-anchor="middle" class="airlabel">bandwidth · latency · burst loss</text>

  <!-- A third peer, to make "mesh" mean mesh rather than a link. -->
  <rect x="300" y="196" width="120" height="40" rx="10" class="peer" />
  <text x="360" y="221" text-anchor="middle" class="peerlabel">PLATFORM C · DMS</text>
  <path d="M247 128 L318 196" class="airthin" />
  <path d="M473 128 L402 196" class="airthin" />
</svg>

<style>
  .stack { width: 100%; height: auto; display: block; }
  .plat { fill: var(--card); stroke: var(--hair); stroke-width: 1.5; }
  .peer { fill: var(--card); stroke: var(--hair); stroke-width: 1.5; }
  .box { fill: var(--seg-track); stroke: var(--hair); stroke-width: 1.5; }
  .asb { fill: var(--tint-green); stroke: #cfe9dc; stroke-width: 1.5; }
  .port { fill: var(--c2); }
  .wire { stroke: var(--sub); stroke-width: 1.6; fill: none; }
  .air { stroke: var(--bad); stroke-width: 2.2; fill: none; stroke-dasharray: 7 5; }
  .airthin { stroke: var(--bad); stroke-width: 1.4; fill: none; stroke-dasharray: 5 5; opacity: 0.6; }

  text { font-family: inherit; fill: var(--ink); }
  .platlabel, .band { font-size: 10px; font-weight: 700; letter-spacing: 1.1px; fill: var(--sub); }
  .band { fill: #b0821f; }
  .band-sub { font-size: 10px; font-weight: 600; letter-spacing: 0.6px; fill: #b0821f; opacity: 0.8; }
  .boxlabel { font-size: 14px; font-weight: 800; }
  .peerlabel { font-size: 11px; font-weight: 700; }
  .asblabel { font-size: 9.5px; font-weight: 700; letter-spacing: 0.4px; fill: #2c7a5a; }
  .note { font-size: 10px; font-weight: 600; fill: var(--sub); }
  .airlabel { font-size: 10px; font-weight: 600; fill: #b0821f; }
</style>
