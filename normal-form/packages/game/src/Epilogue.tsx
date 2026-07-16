// The epilogue debrief (WS-G; docs/03-levels.md "Epilogue — the A-GRA debrief").
// A full-viewport Blueprint document reached once every required sheet is certified
// (the bonus sheet never gates). Three parts: the sheet-by-sheet recap lines replayed
// as a checklist, the A-GRA bridge table (rendered from the same fidelity-policed
// REFERENCE.bridge the UCI Reference uses), and the "now play the sentences" pointer
// to the sibling games. Read-only — it holds no game state; `backToSelect` returns to
// the drawing index exactly as left.
import { REFERENCE } from "@normal-form/core";
import { SHEET_LIST } from "@normal-form/levels";
import { useGameStore } from "./store.ts";
import { BORDER, FONT, RADIUS, SHADOW, STATUS, SURFACE } from "./tokens.ts";

const WORLD_LABEL: Record<string, string> = {
  w0: "World 0 · One Way",
  w1: "World 1 · Ask & Acknowledge",
};

function worldLabel(world: string): string {
  return WORLD_LABEL[world] ?? world.toUpperCase();
}

function toolbarBtn(): React.CSSProperties {
  return {
    background: "transparent",
    color: SURFACE.ink,
    border: BORDER.divider,
    borderRadius: RADIUS.pill,
    padding: "6px 12px",
    fontFamily: FONT.mono,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  };
}

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: ".08em",
  color: "rgba(36,67,95,.65)",
  margin: "28px 0 12px",
};

function RecapRow({ index }: { index: number }) {
  const sheet = SHEET_LIST[index]!;
  const done = useGameStore((s) => s.certified[sheet.id] === true);
  // A skippable bonus that was not played is "optional", not "pending" — it never
  // gates the debrief, so it must not read as an incomplete step.
  const optionalSkipped = !done && sheet.bonus === true;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto 1fr",
        alignItems: "center",
        gap: 14,
        width: "100%",
        background: SURFACE.console,
        border: BORDER.divider,
        borderLeft: `5px solid ${done ? STATUS.pass : "rgba(36,67,95,.35)"}`,
        boxShadow: done ? SHADOW.drafting2 : "none",
        padding: "10px 16px",
        fontFamily: FONT.mono,
        color: SURFACE.ink,
        opacity: done ? 1 : 0.72,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: done ? STATUS.pass : "rgba(36,67,95,.5)",
          width: 18,
          textAlign: "center",
        }}
      >
        {done ? "✔" : "○"}
      </span>
      <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: ".02em", minWidth: 44 }}>
        {sheet.id}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{sheet.title}</span>
          <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(36,67,95,.55)" }}>
            {worldLabel(sheet.world)}
          </span>
          {optionalSkipped && (
            <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(36,67,95,.5)" }}>
              BONUS · NOT PLAYED
            </span>
          )}
        </span>
        <span style={{ fontFamily: FONT.hand, fontSize: 14, color: "rgba(36,67,95,.85)" }}>
          {sheet.recap}
        </span>
      </span>
    </div>
  );
}

export function Epilogue() {
  const backToSelect = useGameStore((s) => s.backToSelect);
  const openReference = useGameStore((s) => s.openReference);

  return (
    <div
      style={{
        minWidth: 1024,
        height: "100dvh",
        overflow: "auto",
        background: SURFACE.desk,
        color: SURFACE.ink,
        fontFamily: FONT.mono,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 860, padding: "40px 24px 64px" }}>
        {/* Header band */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderBottom: `2px solid ${SURFACE.ink}`,
            paddingBottom: 12,
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: ".04em" }}>THE DEBRIEF</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(36,67,95,.65)" }}>
              SEQUENCE CERTIFICATION · A-GRA BRIDGE
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => openReference()} style={toolbarBtn()}>
              ▤ UCI REFERENCE
            </button>
            <button type="button" onClick={backToSelect} style={toolbarBtn()}>
              ◂ BACK TO INDEX
            </button>
          </div>
        </div>

        <p
          style={{
            fontFamily: FONT.hand,
            fontSize: 15,
            color: "rgba(36,67,95,.75)",
            margin: "0 0 8px",
          }}
        >
          You certified the grammar. Here is what each sheet proved — and where these same shapes
          reappear across the A-GRA suite.
        </p>

        {/* §1 — the recap lines replayed as a checklist */}
        <div style={SECTION_TITLE}>WHAT YOU PROVED</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SHEET_LIST.map((sheet, i) => (
            <RecapRow key={sheet.id} index={i} />
          ))}
        </div>

        {/* §2 — the A-GRA bridge, rendered from the same policed data as the UCI Reference */}
        <div style={SECTION_TITLE}>THE A-GRA BRIDGE</div>
        <p style={{ margin: "0 0 10px", fontSize: 12.5, fontWeight: 500, lineHeight: 1.6 }}>
          You already know these shapes. The sibling games — Brain Swap and Service Bus — speak
          A-GRA messages that inherit UCI's grammar; the bridge is shape-level (pattern), not a UCI
          citation. "<code style={{ fontSize: 11 }}>MA_FlightCommand</code> /{" "}
          <code style={{ fontSize: 11 }}>MA_FlightCommandStatus</code> — you already know this
          shape: Command-2."
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

        {/* §3 — the "now play the sentences" pointer to the sibling games (prose, no links) */}
        <div style={SECTION_TITLE}>NOW PLAY THE SENTENCES</div>
        <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 500, lineHeight: 1.6 }}>
          Normal Form is the grammar course for the suite: it teaches the parts of speech — the
          envelope, the six primitive patterns, the state handshakes, the rules of a bus that
          guarantees nothing. Its siblings put that grammar to work.
        </p>
        <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 500, lineHeight: 1.6 }}>
          <strong>Brain Swap</strong> plays one interface's sentences — a single component's message
          exchanges, end to end. <strong>Service Bus</strong> routes the paragraphs — the traffic
          between many components across the bus. Same shapes, same names; you have already
          certified the grammar they speak.
        </p>

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
          The game may omit; it never renames or invents. Every name above traces to the public UCI
          2.5 standard — the omissions are listed in each sheet's Fidelity Notes.
        </p>

        <div style={{ marginTop: 24 }}>
          <button
            type="button"
            onClick={backToSelect}
            style={{
              background: SURFACE.ink,
              color: "#fff",
              border: "none",
              borderRadius: RADIUS.pill,
              padding: "9px 18px",
              fontFamily: FONT.mono,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: ".04em",
              cursor: "pointer",
            }}
          >
            ◂ BACK TO INDEX
          </button>
        </div>
      </div>
    </div>
  );
}
