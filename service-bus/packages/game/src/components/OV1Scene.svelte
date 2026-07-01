<script lang="ts">
/**
 * OV-1 operational-view background, hand-drawn as an inline SVG in the game's
 * muted-cartographic style (pale sea / sand / sky, thin ink coastline, colour-coded
 * dashed mission routes) but with the depth of the original vignette: atmospheric horizon
 * haze, shaded mountains, dune/wave texture, detailed platforms and soft drop-shadows.
 *
 * Vector redraw of the original `assets/ov1.jpg` photo on the same `0 0 1052 591`
 * coordinate space, so the phase hotspots in `OV1Map.svelte` still land on the matching
 * scene elements. Purely decorative: no interactivity lives here.
 *
 * Faithful to the DCA vignette topology: BVLOS QB + Data Feed at the rear, the Launch &
 * Recovery area (airbase/LRE) at bottom-left, the CAP orbit and Agile Formations forward
 * over the Mission Area, and the hostile Target Track top-right where QB commands Engage.
 */
</script>

<svg viewBox="0 0 1052 591" preserveAspectRatio="xMidYMid meet" class="scene" aria-hidden="true">
  <defs>
    <!-- Sky: cool zenith warming toward a hazy horizon. -->
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e7eef2" />
      <stop offset="0.62" stop-color="#eef2f2" />
      <stop offset="1" stop-color="#f6f2ea" />
    </linearGradient>
    <!-- Warm low sun, top-left. -->
    <radialGradient id="sun" cx="0.24" cy="0.1" r="0.5">
      <stop offset="0" stop-color="#fff6e2" stop-opacity="0.9" />
      <stop offset="1" stop-color="#fff6e2" stop-opacity="0" />
    </radialGradient>
    <!-- Sea: hazy near the horizon, deepening into the foreground. -->
    <linearGradient id="sea" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0" stop-color="#dce9ee" />
      <stop offset="0.4" stop-color="#c6dde6" />
      <stop offset="1" stop-color="#a9cdda" />
    </linearGradient>
    <!-- Land: sunlit sand fading to warmer foreground. -->
    <linearGradient id="land" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="#e9e0ca" />
      <stop offset="1" stop-color="#d8c9a6" />
    </linearGradient>
    <!-- Platform hull sheen (dark stealth grey). -->
    <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#464d57" />
      <stop offset="1" stop-color="#20252c" />
    </linearGradient>
    <!-- Hostile hull. -->
    <linearGradient id="foehull" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ef6a60" />
      <stop offset="1" stop-color="#c9362c" />
    </linearGradient>

    <!-- Lift platforms off the map. -->
    <filter id="drop" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="1.4" dy="3" stdDeviation="2.4" flood-color="#1b1f24" flood-opacity="0.3" />
    </filter>

    <!-- Cranked-kite UCAV (the ACPs), nose at -y. -->
    <g id="ucav">
      <path class="ucbody" d="M0 -16 L22 8 L9 7 L4 13 L0 10 L-4 13 L-9 7 L-22 8 Z" />
      <path class="ucspine" d="M0 -13 L0 9" />
      <path class="uccanopy" d="M0 -11 L3 -4 L0 -1 L-3 -4 Z" />
      <path class="ucedge" d="M0 -15 L20.5 7" />
      <path class="ucedge" d="M0 -15 L-20.5 7" />
    </g>

    <!-- AWACS / Data Feed: fuselage, straight wings, rotodome. -->
    <g id="awacs">
      <path class="acbody" d="M0 -17 C 2.4 -16 3 -8 3 0 L2.2 12 L0 15 L-2.2 12 L-3 0 C -3 -8 -2.4 -16 0 -17 Z" />
      <path class="acbody" d="M-24 1 L24 1 L19 6 L-19 6 Z" />
      <path class="acbody" d="M-9 11 L9 11 L7 15 L-7 15 Z" />
      <line class="domepylon" x1="0" y1="-3" x2="0" y2="-8" />
      <ellipse class="dome" cx="0" cy="-4" rx="10" ry="3.6" />
      <ellipse class="domehi" cx="0" cy="-5" rx="6" ry="1.6" />
    </g>

    <!-- Hostile fighter: swept delta, canopy forward. -->
    <g id="foe">
      <path class="foebody" d="M0 -15 L3 -4 L18 8 L4 6 L3 11 L6 15 L0 12.5 L-6 15 L-3 11 L-4 6 L-18 8 L-3 -4 Z" />
      <path class="foecanopy" d="M0 -11 L2 -4 L0 -1 L-2 -4 Z" />
    </g>

    <!-- Comms/radar radiation arcs. -->
    <g id="waves3">
      <path class="wave" d="M6 -9 A 15 15 0 0 1 6 7" />
      <path class="wave" d="M12 -15 A 23 23 0 0 1 12 13" />
      <path class="wave" d="M18 -21 A 31 31 0 0 1 18 19" />
    </g>
  </defs>

  <!-- ══ Terrain & atmosphere ═══════════════════════════════════════════ -->
  <rect x="0" y="0" width="1052" height="312" fill="url(#sky)" />
  <rect x="0" y="0" width="1052" height="312" fill="url(#sun)" />
  <!-- Cloud wisps. -->
  <ellipse class="cloud" cx="470" cy="70" rx="120" ry="10" />
  <ellipse class="cloud" cx="760" cy="46" rx="90" ry="7" />
  <ellipse class="cloud" cx="240" cy="150" rx="80" ry="7" />

  <rect x="0" y="300" width="1052" height="291" fill="url(#land)" />
  <!-- Sea: right of / below the coastline. -->
  <path
    class="water"
    d="M430 305 C 470 360, 462 432, 384 500 C 344 540, 300 570, 250 591 L1052 591 L1052 305 Z"
  />
  <!-- Wave texture, fading toward the hazy horizon. -->
  <g class="waves">
    <path d="M690 360 q 26 -6 52 0" />
    <path d="M810 400 q 30 -7 60 0" />
    <path d="M600 470 q 34 -8 68 0" />
    <path d="M760 520 q 40 -9 80 0" />
    <path d="M470 560 q 44 -10 88 0" />
    <path d="M900 470 q 30 -7 60 0" />
  </g>
  <!-- Shoreline foam, just inside the coastline. -->
  <path
    class="foam"
    d="M432 312 C 470 364, 460 432, 380 498 C 342 536, 300 566, 254 588"
  />
  <!-- Coastline. -->
  <path
    class="coast"
    d="M430 305 C 470 360, 462 432, 384 500 C 344 540, 300 570, 250 591"
  />

  <!-- Horizon haze band for atmospheric depth. -->
  <rect class="haze" x="0" y="288" width="1052" height="34" />

  <!-- Rear-left mountains — hazier the farther back. -->
  <path class="mtn far" d="M0 300 L34 250 L70 286 L120 236 L176 288 L214 262 L262 300 Z" />
  <path class="mtn near" d="M0 306 L48 262 L86 300 L150 250 L206 300 Z" />
  <path class="mtn shade" d="M150 250 L206 300 L150 300 Z" />
  <path class="mtn shade" d="M48 262 L86 300 L48 300 Z" />

  <!-- Desert dune contours & a wadi. -->
  <g class="dunes">
    <path d="M12 372 q 120 -22 250 4" />
    <path d="M40 420 q 150 -20 300 8" />
    <path d="M0 470 q 130 -18 250 6" />
  </g>
  <path class="wadi" d="M60 356 q 40 40 30 90 q -8 44 40 80" />
  <!-- Ground movement chevrons (ingress axis), echoing the OV-1 arrows. -->
  <g class="chevrons">
    <path d="M120 500 l22 9 l-22 9" />
    <path d="M156 494 l22 9 l-22 9" />
    <path d="M192 488 l22 9 l-22 9" />
  </g>

  <!-- ══ Zone labels ════════════════════════════════════════════════════ -->
  <text class="zone big" x="908" y="352" text-anchor="middle">MISSION AREA</text>
  <text class="zone" x="150" y="332" text-anchor="middle">LAUNCH &amp; RECOVERY</text>
  <text class="zone" x="150" y="346" text-anchor="middle">OPERATIONS AREA</text>
  <text class="zone" x="770" y="197" text-anchor="middle">COMBAT AIR PATROL (CAP)</text>

  <!-- ══ Mission routes ═════════════════════════════════════════════════ -->
  <!-- Tactical Ingress: QB Command → target track (C2). -->
  <path class="rt c2" marker-end="url(#hRed)" d="M612 78 C 720 40, 830 44, 946 62" />
  <text class="rlbl" x="828" y="34" text-anchor="middle">Tactical Ingress</text>
  <!-- Egress / Retrograde back off the CAP (muted). -->
  <path class="rt mute" marker-end="url(#hMute)" d="M690 150 C 800 132, 900 128, 986 118" />
  <text class="rlbl" x="905" y="142" text-anchor="middle">Egress / Retrograde</text>
  <!-- CAP orbit. -->
  <ellipse class="orbit" cx="762" cy="152" rx="140" ry="25" />
  <!-- Agile Formations orbit (P2P). -->
  <ellipse class="orbit p2p" cx="738" cy="305" rx="120" ry="40" />
  <text class="rlbl" x="738" y="360" text-anchor="middle">Agile Formations</text>
  <!-- Transit into the Mission Area (P2P heartbeat). -->
  <path class="rt p2p" marker-end="url(#hP2P)" d="M470 300 C 540 250, 600 220, 660 205" />
  <text class="rlbl" x="556" y="276" text-anchor="middle">Transit</text>
  <!-- RTB Route: from the CAP back to the airbase (muted). -->
  <path class="rt mute" marker-end="url(#hMute)" d="M690 205 C 560 250, 470 322, 250 405" />
  <text class="rlbl" x="470" y="308" text-anchor="middle">RTB Route</text>
  <!-- Alternate RTB (fainter). -->
  <path class="rt mute faint" d="M540 250 C 400 300, 260 320, 120 330" />
  <!-- Final approach to recovery (dashed). -->
  <path class="rt mute faint" d="M470 486 C 400 462, 350 454, 250 452" />
  <!-- Hold orbit at the launch area. -->
  <ellipse class="orbit" cx="232" cy="288" rx="72" ry="26" />
  <!-- BVLOS C2 tether: QB ground station → forward CAP (long-range command). -->
  <path class="rt c2 faint" d="M64 68 C 320 120, 540 150, 700 150" />
  <!-- Sense-&-Avoid / Divert contingency spur. -->
  <path class="rt mute faint" d="M470 275 C 430 240, 380 232, 336 246" />
  <text class="rlbl small" x="392" y="224" text-anchor="middle">Divert / S&amp;A</text>

  <!-- Route arrowheads (declared after routes so orient resolves cleanly). -->
  <defs>
    <marker id="hP2P" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0 0 L7 3 L0 6 Z" fill="var(--p2p)" />
    </marker>
    <marker id="hMute" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0 0 L7 3 L0 6 Z" fill="var(--sub)" />
    </marker>
    <marker id="hRed" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0 0 L7 3 L0 6 Z" fill="var(--red)" />
    </marker>
  </defs>

  <!-- ══ Launch & Recovery: airbase ═════════════════════════════════════ -->
  <g transform="translate(150 424) rotate(-19)">
    <rect class="apron" x="-98" y="-24" width="42" height="48" rx="3" />
    <rect class="runway" x="-74" y="-8" width="150" height="16" rx="2" />
    <line class="rwthr" x1="-70" y1="-5" x2="-70" y2="5" />
    <line class="rwthr" x1="72" y1="-5" x2="72" y2="5" />
    <line class="rwctr" x1="-62" y1="0" x2="66" y2="0" />
    <rect class="bldg" x="-94" y="-20" width="12" height="9" rx="1" />
    <rect class="bldg" x="-94" y="4" width="14" height="10" rx="1" />
    <rect class="bldg" x="-76" y="-22" width="9" height="7" rx="1" />
  </g>
  <text class="nlbl" x="150" y="478" text-anchor="middle">Airbase · LRE</text>

  <!-- ══ Rear nodes: BVLOS QB satcom & Data Feed (AWACS) ═══════════════ -->
  <g transform="translate(42 60)" filter="url(#drop)">
    <rect class="gs" x="-11" y="6" width="22" height="6" rx="1.5" />
    <line class="mast" x1="0" y1="6" x2="0" y2="-6" />
    <path class="dish" d="M-9 -6 A 11 11 0 0 1 9 -6 Z" />
    <use href="#waves3" class="rf" transform="translate(2 -2)" />
  </g>
  <text class="nlbl" x="42" y="94" text-anchor="middle">BVLOS QB</text>

  <g transform="translate(186 58) scale(1.1)" filter="url(#drop)">
    <use href="#awacs" transform="rotate(96)" />
    <use href="#waves3" class="rf" transform="translate(10 -2) scale(0.8)" />
  </g>
  <text class="nlbl" x="186" y="94" text-anchor="middle">Data Feed</text>

  <!-- ══ Platforms (ACPs) — scaled for depth ═══════════════════════════ -->
  <g class="fleet" filter="url(#drop)">
    <!-- Ingress ACP pressing toward the target (high/far). -->
    <use href="#ucav" transform="translate(648 92) rotate(82) scale(0.82)" />
    <!-- CAP orbit ACPs. -->
    <use href="#ucav" transform="translate(668 142) rotate(72) scale(0.9)" />
    <use href="#ucav" transform="translate(858 162) rotate(250) scale(0.92)" />
    <!-- Transit ACP. -->
    <use href="#ucav" transform="translate(560 240) rotate(62)" />
    <!-- Agile Formation cluster (forward, larger). -->
    <use href="#ucav" transform="translate(694 302) rotate(104) scale(1.08)" />
    <use href="#ucav" transform="translate(738 318) rotate(96) scale(1.12)" />
    <use href="#ucav" transform="translate(782 302) rotate(88) scale(1.06)" />
    <!-- Hold-orbit ACPs. -->
    <use href="#ucav" transform="translate(176 284) rotate(250) scale(0.95)" />
    <use href="#ucav" transform="translate(292 294) rotate(70) scale(0.95)" />
    <!-- Climb-out from the airbase (near). -->
    <use href="#ucav" transform="translate(258 358) rotate(44) scale(1.05)" />
    <!-- RTB aircraft mid-route home. -->
    <use href="#ucav" transform="translate(430 330) rotate(240)" />
  </g>

  <!-- ══ Hostile Target Track (top-right) ═══════════════════════════════ -->
  <g class="foes" filter="url(#drop)">
    <use href="#foe" transform="translate(984 62) rotate(244) scale(0.95)" />
    <use href="#foe" transform="translate(936 82) rotate(240) scale(0.82)" />
  </g>
  <g class="threat" transform="translate(998 46)">
    <path d="M0 -8 L8 0 L0 8 L-8 0 Z" />
    <circle cx="0" cy="0" r="2.2" />
  </g>
  <text class="nlbl red" x="984" y="32" text-anchor="middle">Target Track</text>
</svg>

<style>
  .scene {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Atmosphere & water. */
  .cloud { fill: #ffffff; opacity: 0.5; }
  .water { fill: url(#sea); }
  .haze { fill: #ffffff; opacity: 0.32; }
  .coast { fill: none; stroke: #8aa1ab; stroke-width: 1.4; opacity: 0.75; }
  .foam { fill: none; stroke: #ffffff; stroke-width: 2.4; opacity: 0.45; }
  .waves path { fill: none; stroke: #ffffff; stroke-width: 1.4; opacity: 0.4; stroke-linecap: round; }

  /* Mountains — receding haze + a shadow face. */
  .mtn { stroke-linejoin: round; }
  .mtn.far { fill: #d7cfbe; opacity: 0.45; }
  .mtn.near { fill: #ccbf9f; opacity: 0.8; }
  .mtn.shade { fill: #b0a37f; opacity: 0.55; }

  /* Desert texture. */
  .dunes path { fill: none; stroke: #c9b98f; stroke-width: 1.2; opacity: 0.5; }
  .wadi { fill: none; stroke: #b6a884; stroke-width: 1.4; opacity: 0.45; stroke-linecap: round; }
  .chevrons path { fill: none; stroke: #fbf7ee; stroke-width: 2.4; opacity: 0.5; stroke-linecap: round; stroke-linejoin: round; }

  /* Airbase. */
  .apron { fill: #d3c6a4; stroke: #b1a380; stroke-width: 1; opacity: 0.9; }
  .runway { fill: #b7aa88; stroke: #9a8d6c; stroke-width: 1; }
  .rwthr { stroke: #fff; stroke-width: 1.6; opacity: 0.75; }
  .rwctr { stroke: #fff; stroke-width: 1.4; stroke-dasharray: 8 7; opacity: 0.8; }
  .bldg { fill: #877c63; opacity: 0.9; }

  /* Zone labels — restrained small caps with a light halo for legibility. */
  .zone {
    fill: var(--sub);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    paint-order: stroke;
    stroke: rgba(255, 255, 255, 0.65);
    stroke-width: 2.5px;
  }
  .zone.big { fill: var(--faint); font-size: 26px; letter-spacing: 3px; opacity: 0.9; }

  /* Routes — dashed, colour-coded by interface. */
  .rt { fill: none; stroke-width: 1.8; stroke-dasharray: 7 6; stroke-linecap: round; opacity: 0.85; }
  .rt.c2 { stroke: var(--c2); }
  .rt.p2p { stroke: var(--p2p); }
  .rt.mute { stroke: var(--sub); }
  .rt.faint { opacity: 0.4; stroke-width: 1.4; }
  .orbit { fill: none; stroke: var(--sub); stroke-width: 1.6; stroke-dasharray: 6 6; opacity: 0.5; }
  .orbit.p2p { stroke: var(--p2p); opacity: 0.48; }

  /* Captions. */
  .rlbl {
    fill: var(--sub); font-size: 9.5px; font-weight: 600; letter-spacing: 0.3px;
    paint-order: stroke; stroke: rgba(255, 255, 255, 0.6); stroke-width: 2px;
  }
  .rlbl.small { font-size: 8.5px; }
  .nlbl {
    fill: var(--ink); font-size: 10px; font-weight: 700; letter-spacing: 0.3px; opacity: 0.85;
    paint-order: stroke; stroke: rgba(255, 255, 255, 0.7); stroke-width: 2.5px;
  }
  .nlbl.red { fill: var(--red); opacity: 1; }

  /* UCAV platforms. */
  .ucbody { fill: url(#hull); }
  .ucspine { stroke: #6d7783; stroke-width: 0.8; opacity: 0.6; }
  .uccanopy { fill: #8fa6b6; opacity: 0.85; }
  .ucedge { fill: none; stroke: #ffffff; stroke-width: 0.8; opacity: 0.28; }

  /* AWACS. */
  .acbody { fill: url(#hull); }
  .dome { fill: #7f8b98; }
  .domehi { fill: #b9c4cd; opacity: 0.8; }
  .domepylon { stroke: #454d57; stroke-width: 1.4; }

  /* Hostiles. */
  .foebody { fill: url(#foehull); }
  .foecanopy { fill: #6a1f19; opacity: 0.8; }

  /* Ground station. */
  .gs { fill: #4a525c; }
  .mast { stroke: #4a525c; stroke-width: 1.6; }
  .dish { fill: #7f8b98; stroke: #454d57; stroke-width: 0.8; }

  /* RF / radar arcs. */
  .wave { fill: none; stroke: var(--c2); stroke-width: 1.3; opacity: 0.5; }

  /* Hostile track reticle. */
  .threat path { fill: none; stroke: var(--red); stroke-width: 1.6; opacity: 0.9; }
  .threat circle { fill: var(--red); opacity: 0.85; }
</style>
