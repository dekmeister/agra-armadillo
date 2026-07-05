// UCI REFERENCE codex (WS-D; docs/07-uci-reference.md). A full-viewport Blueprint
// document with a left scroll-nav index and eight sections. Two content layers:
//   • curated  — the REFERENCE export (overview, patterns, quotes, bridge),
//                 authored in catalog/uci.yaml and fidelity-policed.
//   • catalog  — MESSAGE_CATALOG + FINDINGS from the generated catalog; these
//                 render straight from the policed source and can never drift.
// Deep-links (palette chips, inspector enum popovers) pass an anchor; on open we
// scroll to it. Closing returns to the sheet exactly as left (store overlay).
import { FINDINGS, isTerminalState, MESSAGE_CATALOG, REFERENCE } from "@normal-form/core";
import { useEffect, useRef } from "react";
import { useGameStore } from "./store.ts";
import { BORDER, ENUM_COLOR, FONT, RADIUS, SURFACE, ZONE } from "./tokens.ts";

const NAV: { id: string; label: string }[] = [
  { id: "sec-what", label: "1 · What UCI is" },
  { id: "sec-patterns", label: "2 · The six patterns" },
  { id: "sec-envelope", label: "3 · The envelope" },
  { id: "sec-enums", label: "4 · State enums" },
  { id: "sec-identity", label: "5 · Identity & correlation" },
  { id: "sec-bus", label: "6 · The bus rules" },
  { id: "sec-messages", label: "7 · Messages in this game" },
  { id: "sec-bridge", label: "8 · The A-GRA bridge" },
];

/** Section heading with a stable anchor id. */
function Section({ id, n, title }: { id: string; n: number; title: string }) {
  return (
    <div
      id={id}
      style={{
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: ".02em",
        color: SURFACE.ink,
        margin: "30px 0 10px",
        paddingBottom: 5,
        borderBottom: `1.5px solid ${SURFACE.ink}`,
        scrollMarginTop: 12,
      }}
    >
      <span style={{ color: ZONE.accent }}>{n}</span> · {title}
    </div>
  );
}

function Cite({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{ fontSize: 10, fontWeight: 600, color: ZONE.sendRespond, letterSpacing: ".02em" }}
    >
      {children}
    </span>
  );
}

/** A verbatim standard quote, called out. */
function Quote({ text, cite }: { text: string; cite: string }) {
  return (
    <blockquote
      style={{
        margin: "8px 0",
        borderLeft: `3px solid ${ZONE.oneWay}`,
        background: "rgba(47,111,176,.06)",
        padding: "7px 12px",
        fontStyle: "italic",
        fontSize: 12.5,
        lineHeight: 1.6,
        color: SURFACE.ink,
      }}
    >
      "{text}"
      <div style={{ marginTop: 4, fontStyle: "normal" }}>
        <Cite>{cite}</Cite>
      </div>
    </blockquote>
  );
}

/** A small SVG sequence diagram: two lifelines and one (or a round-trip pair of)
 *  labelled arrow(s), the board's own visual language. */
function MiniDiagram({
  left,
  right,
  down,
  up,
}: {
  left: string;
  right: string;
  down: string;
  up?: string;
}) {
  const W = 250;
  const H = up ? 108 : 80;
  const lx = 46;
  const rx = 204;
  const headY = 22;
  const y1 = 50;
  const y2 = 78;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ maxWidth: W, background: SURFACE.board, border: "1px solid rgba(36,67,95,.25)" }}
      role="img"
      aria-label={`${left} to ${right}: ${down}${up ? `, then ${up}` : ""}`}
    >
      {/* lifeline heads */}
      {[
        { x: lx, label: left },
        { x: rx, label: right },
      ].map((n) => (
        <g key={n.label}>
          <line
            x1={n.x}
            y1={headY + 6}
            x2={n.x}
            y2={H - 6}
            stroke="rgba(36,67,95,.55)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
          <text
            x={n.x}
            y={headY}
            textAnchor="middle"
            fontFamily={FONT.mono}
            fontSize={9.5}
            fontWeight={800}
            fill={SURFACE.ink}
          >
            {n.label}
          </text>
        </g>
      ))}
      {/* request arrow (down/right) */}
      <line x1={lx} y1={y1} x2={rx - 3} y2={y1} stroke={ZONE.oneWay} strokeWidth={1.75} />
      <polygon
        points={`${rx},${y1} ${rx - 7},${y1 - 3.5} ${rx - 7},${y1 + 3.5}`}
        fill={ZONE.oneWay}
      />
      <text
        x={(lx + rx) / 2}
        y={y1 - 5}
        textAnchor="middle"
        fontFamily={FONT.mono}
        fontSize={9}
        fontWeight={700}
        fill={ZONE.oneWay}
      >
        {down}
      </text>
      {/* response arrow (up/left), dashed */}
      {up && (
        <>
          <line
            x1={rx}
            y1={y2}
            x2={lx + 3}
            y2={y2}
            stroke={ZONE.sendRespond}
            strokeWidth={1.75}
            strokeDasharray="4 2"
          />
          <polygon
            points={`${lx},${y2} ${lx + 7},${y2 - 3.5} ${lx + 7},${y2 + 3.5}`}
            fill={ZONE.sendRespond}
          />
          <text
            x={(lx + rx) / 2}
            y={y2 - 5}
            textAnchor="middle"
            fontFamily={FONT.mono}
            fontSize={9}
            fontWeight={700}
            fill={ZONE.sendRespond}
          >
            {up}
          </text>
        </>
      )}
    </svg>
  );
}

/** Split "A → B" role text into the two lifeline heads. */
function roleHeads(roles: string): [string, string] {
  const parts = roles.split("→").map((s) => s.trim());
  return [parts[0] ?? "Producer", (parts[1] ?? "Consumer").replace(/\(s\)/, "s")];
}

/** Short arrow labels from a naming rule ("*Command / *CommandStatus"). */
function arrowLabels(naming: string, twoWay: boolean): { down: string; up?: string } {
  const first = naming.split(/[/(]/)[0]?.trim() ?? naming;
  if (!twoWay) return { down: first };
  const parts = naming.split("/").map((s) => s.trim());
  return { down: parts[0] ?? first, up: parts[1] ?? "…Status" };
}

function PatternBlock({ p }: { p: (typeof REFERENCE.patterns)[number] }) {
  const twoWay = p.name.endsWith("-2");
  const [left, right] = roleHeads(p.roles);
  const { down, up } = arrowLabels(p.naming, twoWay);
  return (
    <div
      id={`pat-${p.name}`}
      style={{
        display: "grid",
        gridTemplateColumns: "270px 1fr",
        gap: 16,
        alignItems: "start",
        border: BORDER.divider,
        borderLeft: `4px solid ${ZONE.accent}`,
        background: SURFACE.console,
        padding: 12,
        marginBottom: 12,
        scrollMarginTop: 12,
      }}
    >
      <MiniDiagram left={left} right={right} down={down} up={up} />
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{p.name}</span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: ".05em",
              color: "#fff",
              background: ZONE.oneWay,
              borderRadius: RADIUS.chip,
              padding: "1px 6px",
            }}
          >
            UNLOCKS AT {p.unlocksAt.toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(36,67,95,.7)", marginTop: 3 }}>
          {p.roles} · naming: <code>{p.naming}</code>
        </div>
        <p style={{ margin: "6px 0", fontSize: 12.5, fontWeight: 500, lineHeight: 1.6 }}>
          {p.summary}
        </p>
        <Cite>{p.cite}</Cite>
      </div>
    </div>
  );
}

/** name / type / required / values field table (Brain Swap MessageReference shape). */
function FieldTable({
  fields,
  extraNote,
}: {
  fields: readonly { name: string; required: boolean; enum?: string; ref?: string }[];
  extraNote?: (name: string) => string | undefined;
}) {
  const enums = MESSAGE_CATALOG.enums as Record<string, { values: readonly string[] }>;
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 11.5,
        margin: "6px 0",
      }}
    >
      <thead>
        <tr style={{ textAlign: "left", color: "rgba(36,67,95,.65)" }}>
          <th style={{ padding: "3px 6px", borderBottom: `1.5px solid ${SURFACE.ink}` }}>Field</th>
          <th style={{ padding: "3px 6px", borderBottom: `1.5px solid ${SURFACE.ink}` }}>Type</th>
          <th style={{ padding: "3px 6px", borderBottom: `1.5px solid ${SURFACE.ink}` }}>Req</th>
          <th style={{ padding: "3px 6px", borderBottom: `1.5px solid ${SURFACE.ink}` }}>
            Values / note
          </th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f) => {
          const type = f.enum ?? f.ref ?? "string";
          const note = extraNote?.(f.name);
          const values = f.enum ? (enums[f.enum]?.values ?? []).join(" · ") : (note ?? "");
          return (
            <tr key={f.name} style={{ borderBottom: "1px solid rgba(36,67,95,.15)" }}>
              <td style={{ padding: "3px 6px", fontWeight: 700 }}>{f.name}</td>
              <td style={{ padding: "3px 6px" }}>
                <code>{type}</code>
              </td>
              <td
                style={{
                  padding: "3px 6px",
                  fontWeight: 700,
                  color: f.required ? ZONE.stamp : "rgba(36,67,95,.5)",
                }}
              >
                {f.required ? "yes" : "opt"}
              </td>
              <td style={{ padding: "3px 6px", fontSize: 11 }}>
                {note && f.enum ? `${values} — ${note}` : values}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function UciReference() {
  const closeOverlay = useGameStore((s) => s.closeOverlay);
  const anchor = useGameStore((s) => s.referenceAnchor);
  const bodyRef = useRef<HTMLDivElement>(null);

  // On open (and if the deep-link target changes), scroll to the anchored block.
  useEffect(() => {
    if (!anchor) return;
    const el = bodyRef.current?.querySelector(`#${CSS.escape(anchor)}`);
    if (el) el.scrollIntoView({ block: "start" });
  }, [anchor]);

  const overview = REFERENCE.overview;
  const enums = Object.values(MESSAGE_CATALOG.enums) as {
    name: string;
    values: readonly string[];
    cite?: string;
  }[];
  const header = MESSAGE_CATALOG.envelope.HeaderType;
  const idType = MESSAGE_CATALOG.types.ID_Type;
  const messages = Object.values(MESSAGE_CATALOG.messages) as {
    name: string;
    mt: string;
    role: string;
    cite?: string;
    fields: readonly { name: string; required: boolean; enum?: string; ref?: string }[];
  }[];
  const quoteById = (id: string) => REFERENCE.quotes.find((q) => q.id === id);
  const busQuote = quoteById("bus-no-ordering");
  const termQuote = quoteById("terminal-end");
  const receivedQuote = quoteById("received-optional");
  const cancelQuote = quoteById("terminal-ignore-cancel");

  // The three finding prefixes decoded (docs/02 lie #11 — three regimes distinct).
  const PREFIXES: { code: string; color: string; body: string }[] = [
    {
      code: "ENV",
      color: ZONE.oneWay,
      body: "XSD schema validity — a field is missing or malformed against the message definition.",
    },
    {
      code: "CERT SCH",
      color: ZONE.sendRespond,
      body: "SPC-001 schema-style requirements — how a message must be shaped.",
    },
    {
      code: "CERT UNIS",
      color: ZONE.accent,
      body: "UNIS interaction requirements — how components must behave on the wire.",
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        background: SURFACE.desk,
        color: SURFACE.ink,
        fontFamily: FONT.mono,
      }}
    >
      {/* left index nav */}
      <nav
        style={{
          flex: "0 0 210px",
          borderRight: `2px solid ${SURFACE.ink}`,
          background: SURFACE.chrome,
          padding: "16px 12px",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: ".03em", marginBottom: 4 }}>
          UCI REFERENCE
        </div>
        <div
          style={{ fontSize: 10, fontWeight: 600, color: "rgba(36,67,95,.6)", marginBottom: 10 }}
        >
          the game's codex
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() =>
              bodyRef.current?.querySelector(`#${n.id}`)?.scrollIntoView({ block: "start" })
            }
            style={{
              textAlign: "left",
              background: "transparent",
              border: "none",
              borderLeft: "3px solid transparent",
              padding: "4px 6px",
              fontFamily: FONT.mono,
              fontSize: 11.5,
              fontWeight: 600,
              color: SURFACE.ink,
              cursor: "pointer",
            }}
          >
            {n.label}
          </button>
        ))}
        <button
          type="button"
          onClick={closeOverlay}
          style={{
            marginTop: "auto",
            background: "transparent",
            color: SURFACE.ink,
            border: BORDER.divider,
            borderRadius: RADIUS.pill,
            padding: "7px 12px",
            fontFamily: FONT.mono,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ◂ BACK TO SHEET
        </button>
      </nav>

      {/* scrollable body */}
      <div ref={bodyRef} style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 28px 72px" }}>
          {/* 1 · What UCI is */}
          <Section id="sec-what" n={1} title="What UCI is" />
          {overview.blurb.map((b) => (
            <p
              key={b.slice(0, 24)}
              style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, lineHeight: 1.65 }}
            >
              {b}
            </p>
          ))}
          <Quote text={overview.quote.text} cite={overview.quote.cite} />
          <div style={{ fontSize: 12, fontWeight: 700, margin: "12px 0 4px" }}>
            The three documents the game cites
          </div>
          {overview.documents.map((d) => (
            <div key={d.key} style={{ fontSize: 12, marginBottom: 4, lineHeight: 1.5 }}>
              <b>{d.title}</b> — {d.owns}
            </div>
          ))}
          <div style={{ fontSize: 12, fontWeight: 700, margin: "14px 0 4px" }}>
            Reading a finding's prefix
          </div>
          {PREFIXES.map((p) => (
            <div
              key={p.code}
              style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 4 }}
            >
              <span
                style={{
                  flex: "0 0 78px",
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: "#fff",
                  background: p.color,
                  borderRadius: RADIUS.chip,
                  padding: "1px 6px",
                  textAlign: "center",
                }}
              >
                {p.code}
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.5 }}>{p.body}</span>
            </div>
          ))}

          {/* 2 · The six patterns */}
          <Section id="sec-patterns" n={2} title="The six interaction patterns" />
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 12,
              fontWeight: 500,
              color: "rgba(36,67,95,.7)",
            }}
          >
            The reference never locks knowledge — every pattern is readable here; only the palette
            locks tools.
          </p>
          {REFERENCE.patterns.map((p) => (
            <PatternBlock key={p.name} p={p} />
          ))}

          {/* 3 · The envelope */}
          <Section id="sec-envelope" n={3} title="The envelope" />
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500, lineHeight: 1.6 }}>
            Every placed message is wrapped in the abstract <code>MessageType</code> ={" "}
            <code>SecurityInformation</code> + <code>MessageHeader</code>. The header is a{" "}
            <code>{header.name}</code>: <Cite>{header.cite}</Cite>
          </p>
          <FieldTable
            fields={header.fields}
            extraNote={(name) =>
              name === "ServiceID" || name === "MissionID"
                ? "not modeled — see Fidelity Notes"
                : undefined
            }
          />

          {/* 4 · State enums */}
          <Section id="sec-enums" n={4} title="State enums" />
          {receivedQuote && <Quote text={receivedQuote.text} cite={receivedQuote.cite} />}
          {cancelQuote && <Quote text={cancelQuote.text} cite={cancelQuote.cite} />}
          {enums.map((e) => {
            const isProcessing = e.name === "CommandProcessingStateEnum";
            return (
              <div
                key={e.name}
                id={`enum-${e.name}`}
                style={{
                  border: BORDER.divider,
                  background: SURFACE.console,
                  padding: 10,
                  marginBottom: 10,
                  scrollMarginTop: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800 }}>{e.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0" }}>
                  {e.values.map((v) => {
                    const terminal =
                      isProcessing && isTerminalState(v as Parameters<typeof isTerminalState>[0]);
                    const color = (ENUM_COLOR as Record<string, string>)[v] ?? ZONE.oneWay;
                    return (
                      <span
                        key={v}
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color,
                          border: `1.5px solid ${color}`,
                          borderRadius: 3,
                          padding: "2px 7px",
                        }}
                      >
                        {v}
                        {terminal ? " ▪ terminal" : ""}
                      </span>
                    );
                  })}
                </div>
                {e.cite && <Cite>{e.cite}</Cite>}
              </div>
            );
          })}

          {/* 5 · Identity & correlation */}
          <Section id="sec-identity" n={5} title="Identity & correlation" />
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500, lineHeight: 1.6 }}>
            Every message carries an identity of type <code>{idType.name}</code> (a UUID plus an
            optional descriptive label). Two compliance requirements govern the UUID itself:
          </p>
          {[FINDINGS["V5-uuid-invalid"], FINDINGS["V6-uuid-noncanonical"]].map((f) => (
            <div key={f.id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: ZONE.stamp }}>{f.code}</div>
              <Quote text={f.quote ?? ""} cite={f.docRef} />
            </div>
          ))}
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500, lineHeight: 1.6 }}>
            <b>Correlation rule:</b> a status whose <code>CommandID</code> is not the one you sent
            is not your status. Matching the ID back to your command is how you know a response is
            yours — and how you ignore duplicates and stragglers.
          </p>

          {/* 6 · The bus rules */}
          <Section id="sec-bus" n={6} title="The bus rules" />
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500, lineHeight: 1.6 }}>
            The two rules every seed leans on, stated once, canonically. Every seed's cruelty traces
            back here.
          </p>
          {busQuote && <Quote text={busQuote.text} cite={busQuote.cite} />}
          {termQuote && <Quote text={termQuote.text} cite={termQuote.cite} />}

          {/* 7 · Concrete messages in this game */}
          <Section id="sec-messages" n={7} title="Concrete messages in this game" />
          {messages.map((m) => (
            <div
              key={m.name}
              style={{
                border: BORDER.divider,
                background: SURFACE.console,
                padding: 10,
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{m.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: ZONE.accent }}>
                  {m.role === "request" ? "Commander → SystemB" : "SystemB → Commander"}
                </span>
                <code style={{ fontSize: 10, color: "rgba(36,67,95,.6)" }}>{m.mt}</code>
              </div>
              {m.cite && (
                <div style={{ margin: "3px 0" }}>
                  <Cite>{m.cite}</Cite>
                </div>
              )}
              <FieldTable fields={m.fields} />
            </div>
          ))}

          {/* 8 · The A-GRA bridge */}
          <Section id="sec-bridge" n={8} title="The A-GRA bridge" />
          <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 500, lineHeight: 1.6 }}>
            You already know these shapes. The sibling games — Brain Swap and Service Bus — speak
            A-GRA messages that inherit UCI's grammar; the bridge is shape-level (pattern), not a
            UCI citation.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 640 }}
            >
              <thead>
                <tr style={{ textAlign: "left", color: "rgba(36,67,95,.65)" }}>
                  <th style={{ padding: "4px 8px", borderBottom: `1.5px solid ${SURFACE.ink}` }}>
                    Primitive
                  </th>
                  <th style={{ padding: "4px 8px", borderBottom: `1.5px solid ${SURFACE.ink}` }}>
                    Brain Swap
                  </th>
                  <th style={{ padding: "4px 8px", borderBottom: `1.5px solid ${SURFACE.ink}` }}>
                    Service Bus
                  </th>
                </tr>
              </thead>
              <tbody>
                {REFERENCE.bridge.map((r) => (
                  <tr key={r.primitive} style={{ borderBottom: "1px solid rgba(36,67,95,.15)" }}>
                    <td style={{ padding: "4px 8px", fontWeight: 800 }}>{r.primitive}</td>
                    <td style={{ padding: "4px 8px" }}>{r.brainSwap}</td>
                    <td style={{ padding: "4px 8px" }}>{r.serviceBus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p
            style={{
              marginTop: 28,
              paddingTop: 12,
              borderTop: "1px dashed rgba(36,67,95,.4)",
              fontFamily: FONT.hand,
              fontSize: 13,
              color: "rgba(36,67,95,.7)",
            }}
          >
            The game may omit; it never renames or invents. Every name, number, and quote above is
            grep-checked against the real UCI sources — the omissions are listed in each sheet's
            Fidelity Notes.
          </p>
        </div>
      </div>
    </div>
  );
}
