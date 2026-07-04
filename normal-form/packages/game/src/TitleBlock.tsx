// Title block (handoff § Component: Title block): a drafting-style grid of cells.
// Values are sheet data. The world chip reads "Ask & Acknowledge" (the shipped W1
// name; the Blueprint mock's "One Way" predates the world split — see 05-mvp note).
// The PAR row was removed with scoring (WS-B) — certification is pass/fail.
import { sheet_1_1 } from "@normal-form/levels";
import { FidelityNotes } from "./FidelityNotes.tsx";
import { FONT, LAYOUT, SURFACE, ZONE } from "./tokens.ts";

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(36,67,95,.55)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 800 }}>{value}</span>
    </div>
  );
}

export function TitleBlock() {
  return (
    <aside
      style={{
        width: LAYOUT.titleBlockW,
        flex: `0 0 ${LAYOUT.titleBlockW}px`,
        background: SURFACE.chrome,
        borderLeft: `1.5px solid ${SURFACE.ink}`,
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT.mono,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid rgba(36,67,95,.2)",
        }}
      >
        <span style={{ width: 9, height: 9, background: ZONE.accent }} />
        <span style={{ fontSize: 12, fontWeight: 800 }}>TITLE BLOCK</span>
        <span style={{ marginLeft: "auto" }}>
          <FidelityNotes />
        </span>
      </div>

      <div
        style={{
          padding: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px 12px",
          flex: 1,
        }}
      >
        <Cell label="SHEET" value={sheet_1_1.id} />
        <Cell label="WORLD" value="W1 · Ask & Acknowledge" />
        <Cell label="DRAWN BY" value="sys-alpha-01" />
        <Cell label="SCALE" value="1 tick : 1 msg" />
      </div>
    </aside>
  );
}
