<script lang="ts">
/**
 * FIELD GUIDE — the full-page technical-background layer (WP3).
 *
 * A separate view rather than a fourth Modal branch: the Modal is a fixed-width
 * card at 84vh, which is the wrong shape for eight sections of reference material.
 * It follows brain-swap's meta/ pattern — a full-screen view with its own nav —
 * adapted to Svelte. The mission clock is paused by App.svelte's existing overlay
 * effect while this is open, so reading is free.
 *
 * Content is data, not markup: everything below renders from lib/fieldguide.ts and
 * the core's MESSAGE_CODEX, both under test. The `prov` chips are part of the
 * content, not decoration — see the header comment in lib/fieldguide.ts.
 */
import { MESSAGE_CODEX, REFERENCE_MESSAGE_NAMES } from "@service-bus/core";
import {
  ARCHITECTURE_CAVEATS,
  ARCHITECTURE_HTML,
  AUTHORITY_HTML,
  AVC_CAVEAT,
  ELECTION_METHODS,
  ELECTION_NOTE_HTML,
  FIDELITY_CLOSE_HTML,
  FIDELITY_CORE,
  FIDELITY_MODELLING,
  GLOSSARY,
  INTERFACES,
  INTERFACES_NOTE_HTML,
  LIFECYCLE_NOTE_HTML,
  LIFECYCLE_STATES,
  MP_NAMING_CAVEAT,
  type Provenance,
  PROVENANCE_LABEL,
  PROVENANCE_TITLE,
  ROLES,
  SECTIONS,
} from "../lib/fieldguide.ts";
import LifecycleDiagram from "./guide/LifecycleDiagram.svelte";
import StackDiagram from "./guide/StackDiagram.svelte";

const { onClose, initial = "architecture" }: { onClose: () => void; initial?: string } = $props();

let active = $state(initial);

const codexEntries = Object.entries(MESSAGE_CODEX).sort(([a], [b]) => a.localeCompare(b));
const referenceNames = Object.entries(REFERENCE_MESSAGE_NAMES);

function show(id: string) {
  active = id;
  document.querySelector(".fg-body")?.scrollTo({ top: 0 });
}
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onClose()} />

{#snippet prov(p: Provenance)}
  <span class="prov {p}" title={PROVENANCE_TITLE[p]}>{PROVENANCE_LABEL[p]}</span>
{/snippet}

<div class="fg">
  <header class="fg-head">
    <div class="titles">
      <div class="caps">A-GRA · ASK 5.0a</div>
      <h1>Field Guide</h1>
    </div>
    <button class="close" onclick={onClose}>Close ✕</button>
  </header>

  <div class="fg-main">
    <nav class="fg-nav">
      {#each SECTIONS as s (s.id)}
        <button class="navitem" class:on={active === s.id} onclick={() => show(s.id)}>
          <span class="navtitle">{s.title}</span>
          <span class="navsub">{s.standfirst}</span>
        </button>
      {/each}
      <div class="legend">
        <div class="caps">Provenance</div>
        <p>Claims are chipped by where they come from. Anything marked
          <b>design set — unverified</b> is this project's reading, not a quotation: two ASK 5.0a
          Interface Volumes are not available to this build.</p>
      </div>
    </nav>

    <div class="fg-body">
      {#each SECTIONS as s (s.id)}
        {#if active === s.id}
          <h2>{s.title}</h2>
          <p class="standfirst">{s.standfirst}</p>
        {/if}
      {/each}

      <!-- §1 ------------------------------------------------------------ -->
      {#if active === "architecture"}
        <div class="prose">{@html ARCHITECTURE_HTML}</div>
        <figure>
          <StackDiagram />
          <figcaption>One off-platform hop. The air is a band, not a box — there is nothing in
            the middle to route through, and nothing in the middle to lose.</figcaption>
        </figure>
        <h3>Where this is weaker than it looks</h3>
        <ul class="caveats">
          {#each ARCHITECTURE_CAVEATS as c (c.text)}
            <li>{@render prov(c.prov)}<span>{c.text}</span></li>
          {/each}
        </ul>

      <!-- §2 ------------------------------------------------------------ -->
      {:else if active === "interfaces"}
        <p class="lead">{@render prov("ask")} The six L1 interfaces are named in the Start Here
          Guide; the descriptions below follow it closely. The <b>air</b> column is this project's
          topology guard rail — getting it wrong is the one error the game must never make.</p>
        <div class="tablewrap">
          <table class="ifaces">
            <thead>
              <tr><th>Interface</th><th>What it covers</th><th>Air</th><th>In this game</th></tr>
            </thead>
            <tbody>
              {#each INTERFACES as i (i.code)}
                <tr class:thin={i.thin}>
                  <td class="code"><b>{i.code}</b><span class="ifname">{i.name}</span></td>
                  <td>{i.flows}</td>
                  <td><span class="air {i.air === 'OTA' ? 'ota' : i.air === 'On-platform' ? 'onplat' : 'mix'}">{i.air}</span></td>
                  <td>{i.inGame}{#if i.thin}<span class="thintag">thin</span>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="prose">{@html INTERFACES_NOTE_HTML}</div>
        <ul class="caveats">
          <li>{@render prov(MP_NAMING_CAVEAT.prov)}<span>{MP_NAMING_CAVEAT.text}</span></li>
        </ul>

      <!-- §3 ------------------------------------------------------------ -->
      {:else if active === "lifecycle"}
        <p class="lead">{@render prov("ask")} Every message token on the board walks these states,
          per destination, from
          <code>MA_TxDataPayloadCommandStatusMT</code>'s <code>DestinationTransmissionStatus</code>.</p>
        <figure>
          <LifecycleDiagram />
          <figcaption>Note <code>FAIL_UNSENT</code>'s two in-edges — a message can be dropped from
            the queue before it ever executes, as well as failing as a final status.</figcaption>
        </figure>
        <div class="tablewrap">
          <table class="states">
            <thead><tr><th>State</th><th>In game</th><th>Meaning</th></tr></thead>
            <tbody>
              {#each LIFECYCLE_STATES as s (s.state)}
                <tr class:absent={!s.inGame}>
                  <td class="code"><b>{s.state}</b></td>
                  <td>{s.inGame ? "yes" : "—"}</td>
                  <td>{s.meaning}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="prose callout">{@html LIFECYCLE_NOTE_HTML}</div>

      <!-- §4 ------------------------------------------------------------ -->
      {:else if active === "roles"}
        <p class="lead">{@render prov("assert")} The five roles and their authorities come from
          this project's design set. The C2 Volume, which defines RBAC, is not available to this
          build — so treat the specifics as unconfirmed even though the code implements exactly
          what is described here. Note that no schema check can settle this one: A-GRA models an
          operator role as <i>configured data</i> — an ID and a free-text description, referenced
          by whatever gates on it — rather than as a fixed enumeration. The gate below is sourced;
          this list of who stands behind it is not.</p>
        <div class="tablewrap">
          <table class="roles">
            <thead><tr><th>Role</th><th>May command</th><th>In this game</th></tr></thead>
            <tbody>
              {#each ROLES as r (r.code)}
                <tr>
                  <td class="code"><b>{r.code}</b><span class="ifname">{r.expansion ?? "expansion unknown"}</span></td>
                  <td>{r.authority}</td>
                  <td>{r.inGame}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <ul class="caveats"><li>{@render prov("assert")}<span>{AVC_CAVEAT}</span></li></ul>
        <div class="prose">{@html AUTHORITY_HTML}</div>

      <!-- §5 ------------------------------------------------------------ -->
      {:else if active === "election"}
        <p class="lead">{@render prov("ask")} A-GRA names <b>four</b> election methods, enumerated
          as integers on <code>PackageLeaderElectionMethod</code> in the normative schema. The
          <b>Message cost</b> and <b>Under stress</b> columns are a different matter
          {@render prov("assert")} — the schema characterises the methods only in a sentence each,
          so the numbers and failure modes below are this project's model, not A-GRA's.</p>
        <div class="tablewrap">
          <table class="elect">
            <thead>
              <tr><th>Method</th><th>Pattern</th><th>Message cost</th><th>Under stress</th><th>Teaches</th></tr>
            </thead>
            <tbody>
              {#each ELECTION_METHODS as m (m.name)}
                <tr class:ship={m.implemented}>
                  <td class="code"><b>{m.name}</b>
                    <span class="ifname">{m.implemented ? "playable" : "reference only"}</span></td>
                  <td>{m.pattern}</td><td>{m.cost}</td><td>{m.underStress}</td><td>{m.teaches}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="prose">{@html ELECTION_NOTE_HTML}</div>

      <!-- §6 ------------------------------------------------------------ -->
      {:else if active === "codex"}
        <p class="lead">Every A-GRA message the campaign uses. This table renders straight from the
          simulation's own catalogue and is held to it by tests — it cannot drift from what the
          game actually sends. Names are checked against the normative message schema.</p>
        <div class="codexlist">
          {#each codexEntries as [name, e] (name)}
            <article class="entry" class:declared={e.status === "declared-only"}>
              <header>
                <code class="mname">{name}</code>
                <span class="cls c-{e.cls}">{e.cls}</span>
                {#if e.status === "declared-only"}<span class="tag">declared, never sent</span>
                {:else}<span class="tag lv">L{e.levels.join(" · L")}</span>{/if}
                {@render prov(e.provenance === "xsd" ? "ask" : "assert")}
              </header>
              <div class="dir">{e.direction}</div>
              <p>{e.role}</p>
              {#if e.caveat}<p class="note">{e.caveat}</p>{/if}
            </article>
          {/each}
        </div>
        <h3>Named for reference only</h3>
        <p class="lead">Real A-GRA messages this guide mentions but the game does not send.</p>
        <div class="codexlist">
          {#each referenceNames as [name, why] (name)}
            <article class="entry declared">
              <header><code class="mname">{name}</code><span class="tag">reference</span></header>
              <p>{why}</p>
            </article>
          {/each}
        </div>

      <!-- §7 ------------------------------------------------------------ -->
      {:else if active === "glossary"}
        <p class="lead">Every acronym the game puts on screen. A test holds this list to that
          promise.</p>
        <dl class="gloss">
          {#each GLOSSARY as g (g.term)}
            <div class="grow">
              <dt>{g.term}</dt>
              <dd>
                <b class:unknown={!g.expansion}>{g.expansion ?? "no expansion available"}</b>
                {#if g.prov !== "ask"}{@render prov(g.prov)}{/if}
                {#if g.note}<span class="note">{g.note}</span>{/if}
              </dd>
            </div>
          {/each}
        </dl>

      <!-- §8 ------------------------------------------------------------ -->
      {:else if active === "fidelity"}
        <p class="lead">What this game simplifies, and what each simplification costs. The rule it
          works to: abstract message <i>content</i> freely, but never misrepresent
          <i>topology</i> — who talks to whom, over which interface, gated by what.</p>
        <h3>The core simplifications</h3>
        <ul class="notes">
          {#each FIDELITY_CORE as n (n.title)}
            <li class:faithful={n.notASimplification}>
              <b>{n.title}{#if n.notASimplification}<span class="tag ok">faithful</span>{/if}</b>
              <span>{n.body}</span>
            </li>
          {/each}
        </ul>
        <h3>Modelling choices</h3>
        <ul class="notes">
          {#each FIDELITY_MODELLING as n (n.title)}
            <li><b>{n.title}</b><span>{n.body}</span></li>
          {/each}
        </ul>
        <div class="prose callout">{@html FIDELITY_CLOSE_HTML}</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .fg {
    position: fixed; inset: 0; z-index: 60; background: var(--bg);
    display: flex; flex-direction: column;
  }
  .fg-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 28px 14px; border-bottom: 1px solid var(--hair); background: var(--card);
  }
  .titles h1 { margin: 2px 0 0; font-size: 22px; font-weight: 800; letter-spacing: -0.2px; }
  .close {
    border: 1px solid var(--hair); background: var(--card); border-radius: 10px;
    padding: 8px 14px; font-size: 13px; font-weight: 700; color: var(--sub);
  }
  .close:hover { color: var(--ink); box-shadow: var(--shadow-chip); }

  .fg-main { flex: 1; display: flex; min-height: 0; }
  .fg-nav {
    width: 268px; flex: none; border-right: 1px solid var(--hair); background: var(--card);
    padding: 14px 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;
  }
  .navitem {
    text-align: left; border: 0; background: transparent; border-radius: 10px;
    padding: 9px 12px; display: flex; flex-direction: column; gap: 2px;
  }
  .navitem:hover { background: var(--seg-track); }
  .navitem.on { background: var(--seg-track); box-shadow: inset 3px 0 0 var(--c2); }
  .navtitle { font-size: 13.5px; font-weight: 700; color: var(--ink); }
  .navsub { font-size: 11px; font-weight: 500; color: var(--sub); line-height: 1.35; }
  .legend { margin-top: 14px; padding: 12px; border-top: 1px solid var(--hair); }
  .legend p { margin: 6px 0 0; font-size: 11px; line-height: 1.5; color: var(--sub); }

  .fg-body { flex: 1; overflow-y: auto; padding: 26px 36px 64px; max-width: 1080px; }
  h2 { margin: 0; font-size: 20px; font-weight: 800; }
  h3 { margin: 28px 0 10px; font-size: 14px; font-weight: 800; }
  .standfirst { margin: 4px 0 20px; font-size: 13.5px; color: var(--sub); font-weight: 500; }
  .lead { font-size: 13.5px; line-height: 1.6; color: #34383e; margin: 0 0 18px; }

  .prose :global(p) { font-size: 13.5px; line-height: 1.62; color: #34383e; margin: 0 0 12px; }
  .prose :global(h4) { font-size: 12px; font-weight: 800; color: var(--sub);
    text-transform: uppercase; letter-spacing: 0.8px; margin: 20px 0 8px; }
  .prose :global(ul) { margin: 0 0 12px; padding-left: 20px; }
  .prose :global(li) { font-size: 13.5px; line-height: 1.6; color: #34383e; margin-bottom: 6px; }
  .prose :global(.hop) { text-align: center; }
  .prose :global(.thin-note) { font-size: 12.5px; color: var(--sub); }
  :global(code) { background: var(--seg-track); border-radius: 5px; padding: 1px 5px;
    font-size: 0.92em; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .callout { background: var(--tint-cream); border-radius: 14px; padding: 16px 18px;
    border: 1px solid #f0e2c0; margin-top: 16px; }

  figure { margin: 18px 0; background: var(--card); border: 1px solid var(--hair);
    border-radius: var(--r-card); padding: 18px; }
  figcaption { margin-top: 12px; font-size: 12px; color: var(--sub); line-height: 1.5; }

  .tablewrap { overflow-x: auto; background: var(--card); border: 1px solid var(--hair);
    border-radius: var(--r-card); }
  table { border-collapse: collapse; width: 100%; min-width: 620px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
    color: var(--sub); font-weight: 700; padding: 12px 14px; border-bottom: 1px solid var(--hair); }
  td { padding: 12px 14px; font-size: 12.5px; line-height: 1.55; color: #34383e;
    border-bottom: 1px solid var(--hair); vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  td.code { white-space: nowrap; }
  td.code b { font-size: 13px; }
  .ifname { display: block; font-size: 10.5px; color: var(--sub); font-weight: 600; margin-top: 2px; }
  tr.thin td { background: #fbfaf7; }
  tr.absent td { background: #fbfaf7; color: var(--sub); }
  tr.ship td.code b { color: #147d51; }

  .air { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 20px;
    white-space: nowrap; }
  .air.ota { background: var(--tint-amber); color: #9a6f10; }
  .air.onplat { background: var(--tint-green); color: #147d51; }
  .air.mix { background: var(--seg-track); color: var(--sub); }
  .thintag { display: inline-block; margin-left: 6px; font-size: 9.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.6px; color: #9a6f10; }

  .prov { display: inline-block; font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.7px; padding: 2px 7px; border-radius: 20px; margin-right: 8px;
    white-space: nowrap; vertical-align: 1px; }
  .prov.ask { background: var(--tint-green); color: #147d51; }
  .prov.assert { background: var(--tint-amber); color: #9a6f10; }
  .prov.inferred { background: var(--seg-track); color: var(--sub); }
  .prov.external { background: #eef2fb; color: #3a5ea8; }

  .caveats { list-style: none; margin: 14px 0 0; padding: 0; display: flex;
    flex-direction: column; gap: 10px; }
  /* Breathing room where a section runs table → caveats → prose. */
  .tablewrap + .prose, .caveats + .prose { margin-top: 18px; }
  .caveats li { display: flex; gap: 4px; align-items: flex-start; font-size: 12.5px;
    line-height: 1.55; color: var(--sub); }

  .codexlist { display: flex; flex-direction: column; gap: 10px; }
  .entry { background: var(--card); border: 1px solid var(--hair); border-radius: 14px;
    padding: 14px 16px; }
  .entry.declared { background: #fbfaf7; }
  .entry header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
  .mname { font-size: 12.5px; font-weight: 700; background: transparent; padding: 0; }
  .cls { font-size: 9.5px; font-weight: 800; padding: 2px 7px; border-radius: 20px;
    background: var(--seg-track); color: var(--sub); }
  .cls.c-C2 { background: #e8effd; color: #2f6df0; }
  .cls.c-P2P { background: #f1ebfe; color: #7c4ddb; }
  .cls.c-VI { background: var(--tint-green); color: #147d51; }
  .tag { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
    color: var(--sub); }
  .tag.lv { color: var(--c2); }
  .tag.ok { background: var(--tint-green); color: #147d51; padding: 2px 7px; border-radius: 20px;
    margin-left: 8px; }
  .dir { font-size: 11.5px; font-weight: 600; color: var(--sub); margin-bottom: 6px; }
  .entry p { margin: 0; font-size: 12.5px; line-height: 1.55; color: #34383e; }
  .entry p.note, .gloss .note { display: block; margin-top: 6px; font-size: 11.5px;
    line-height: 1.5; color: var(--sub); }

  .gloss { margin: 0; display: flex; flex-direction: column; gap: 1px; }
  .grow { display: flex; gap: 16px; padding: 10px 14px; background: var(--card);
    border: 1px solid var(--hair); border-radius: 10px; }
  .gloss dt { width: 72px; flex: none; font-size: 13px; font-weight: 800; }
  .gloss dd { margin: 0; font-size: 12.5px; line-height: 1.55; color: #34383e; }
  .gloss dd b { font-weight: 600; margin-right: 8px; }
  .gloss dd b.unknown { color: var(--sub); font-style: italic; }

  .notes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .notes li { background: var(--card); border: 1px solid var(--hair); border-radius: 14px;
    padding: 13px 16px; font-size: 12.5px; line-height: 1.55; color: #34383e; }
  .notes li b { display: block; font-size: 13px; margin-bottom: 4px; }
  .notes li.faithful { background: var(--tint-green); border-color: #cfe9dc; }
</style>
