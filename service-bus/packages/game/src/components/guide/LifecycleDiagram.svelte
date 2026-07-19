<script lang="ts">
/**
 * Field Guide §3 — the DMS transmission lifecycle as a state machine.
 *
 * Two things this drawing must get right, both of which the repo's older diagram
 * got wrong (see docs/01 item 21):
 *   1. FAIL_UNSENT has TWO in-edges — a message can be dropped from the queue
 *      before it ever executes, and it can also fail as a final status.
 *   2. SENT is drawn as OURS, dashed and annotated, standing in front of the two
 *      real SUCCESS_* finals it collapses. Drawing it as a peer of the FAIL_*
 *      states would be the exact false teaching this guide exists to prevent.
 *
 * Decorative and propless; the same content is in the table beside it.
 */
</script>

<svg viewBox="0 0 720 330" preserveAspectRatio="xMidYMid meet" class="lc" aria-hidden="true">
  <defs>
    <marker id="lc-arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--sub)" />
    </marker>
    <marker id="lc-arrow-red" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--red)" />
    </marker>
  </defs>

  <!-- Happy path -->
  <rect x="20" y="24" width="128" height="44" rx="10" class="st" />
  <text x="84" y="51" text-anchor="middle" class="lbl">PENDING</text>
  <text x="84" y="84" text-anchor="middle" class="sub">cancel/update legal</text>

  <rect x="212" y="24" width="128" height="44" rx="10" class="st" />
  <text x="276" y="51" text-anchor="middle" class="lbl">EXECUTING</text>
  <text x="276" y="84" text-anchor="middle" class="sub">committed — no cancel</text>

  <path d="M148 46 L208 46" class="edge" marker-end="url(#lc-arrow)" />

  <!-- Our SENT, and the two real finals behind it -->
  <rect x="404" y="18" width="150" height="40" rx="10" class="ours" />
  <text x="479" y="43" text-anchor="middle" class="lbl ourslbl">SENT</text>
  <text x="479" y="72" text-anchor="middle" class="sub ourssub">this game's state — not A-GRA's</text>

  <path d="M340 46 L400 46" class="edge" marker-end="url(#lc-arrow)" />

  <rect x="404" y="108" width="290" height="38" rx="9" class="real" />
  <text x="549" y="132" text-anchor="middle" class="reallbl">SUCCESS_NO_ACK_EXPECTED</text>
  <rect x="404" y="154" width="290" height="38" rx="9" class="real" />
  <text x="549" y="178" text-anchor="middle" class="reallbl">SUCCESS_RECEIVED_ACK</text>
  <path d="M479 60 L479 104" class="collapse" />
  <text x="600" y="90" text-anchor="middle" class="sub collapsenote">A-GRA's two real success finals</text>

  <!-- Failures -->
  <rect x="212" y="236" width="150" height="40" rx="10" class="fail" />
  <text x="287" y="261" text-anchor="middle" class="lbl faillbl">FAIL_UNSENT</text>
  <text x="287" y="292" text-anchor="middle" class="sub">early, cheap to retry</text>

  <rect x="404" y="236" width="180" height="40" rx="10" class="fail" />
  <text x="494" y="261" text-anchor="middle" class="lbl faillbl">FAIL_MISSING_ACK</text>
  <text x="494" y="292" text-anchor="middle" class="sub">it may have arrived — you can't tell</text>

  <!-- FAIL_UNSENT's two in-edges: the correction. -->
  <path d="M84 70 L84 256 L208 256" class="edgered" marker-end="url(#lc-arrow-red)" />
  <text x="96" y="176" class="sub edgenote">dropped from queue</text>
  <path d="M276 70 L276 232" class="edgered" marker-end="url(#lc-arrow-red)" />
  <path d="M300 70 L470 232" class="edgered" marker-end="url(#lc-arrow-red)" />
</svg>

<style>
  .lc { width: 100%; height: auto; display: block; }
  .st { fill: var(--card); stroke: var(--hair); stroke-width: 1.8; }
  .ours { fill: var(--tint-green); stroke: var(--green); stroke-width: 1.8; stroke-dasharray: 6 4; }
  .real { fill: var(--seg-track); stroke: var(--hair); stroke-width: 1.5; }
  .fail { fill: var(--tint-red); stroke: var(--red); stroke-width: 1.6; }
  .edge { stroke: var(--sub); stroke-width: 1.8; fill: none; }
  .edgered { stroke: var(--red); stroke-width: 1.5; fill: none; opacity: 0.65; }
  .collapse { stroke: var(--green); stroke-width: 1.4; fill: none; stroke-dasharray: 4 4; }

  text { font-family: inherit; fill: var(--ink); }
  .lbl { font-size: 13px; font-weight: 800; letter-spacing: 0.3px; }
  .ourslbl { fill: #147d51; }
  .faillbl { fill: #b8302a; font-size: 12px; }
  .reallbl { font-size: 11.5px; font-weight: 700; fill: #5c6169; letter-spacing: 0.2px; }
  .sub { font-size: 9.5px; font-weight: 600; fill: var(--sub); }
  .ourssub { fill: #147d51; }
  .collapsenote { fill: #147d51; }
  .edgenote { fill: var(--red); opacity: 0.85; }
</style>
