// Inspector column (handoff § Component: Inspector). Body swaps by phase —
// envelope fields (COMPOSE), handler rules (HANDLERS), seed schedule (RUN) — with
// the STATE ENUMS legend pinned to the bottom. All values are level data or
// engine-derived; nothing is editable in S4 (editing is S5).
import { sheet_1_1 } from "@normal-form/levels";
import { useGameStore } from "./store.ts";
import { ENUM_COLOR, FONT, LAYOUT, STATUS, SURFACE, ZONE } from "./tokens.ts";
import { useFindings } from "./useFindings.ts";
import { useRun } from "./useRun.ts";

const ENUMS = ["RECEIVED", "ACCEPTED", "REJECTED", "CANCELED"] as const;
const CIRCLED = ["①", "②", "③"] as const;

function ZoneHeader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderBottom: `1.5px solid ${SURFACE.ink}`,
      }}
    >
      <span style={{ width: 9, height: 9, background: ZONE.sendRespond }} />
      <span style={{ fontSize: 12, fontWeight: 800 }}>INSPECTOR</span>
      <span
        style={{
          marginLeft: "auto",
          fontFamily: FONT.hand,
          fontSize: 12,
          color: "rgba(36,67,95,.55)",
        }}
      >
        TaskCommand
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".08em",
        color: "rgba(36,67,95,.6)",
        margin: "2px 0 4px",
      }}
    >
      {children}
    </div>
  );
}

function ComposeBody() {
  const findings = useFindings();
  const errorFields = new Set(findings.map((f) => f.field).filter(Boolean));
  const fields = sheet_1_1.compose.initialFields;
  const rows: { name: string; value: string | null }[] = [
    "SystemID",
    "Timestamp",
    "SchemaVersion",
    "Mode",
    "CommandID",
  ].map((name) => ({ name, value: fields[name] ?? null }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <SectionLabel>ENVELOPE FIELDS</SectionLabel>
      {rows.map((r) => {
        const err = errorFields.has(r.name);
        return (
          <div
            key={r.name}
            style={{
              background: err ? STATUS.errorBg : "#fff",
              border: err ? `1.5px solid ${STATUS.fail}` : "1px solid rgba(36,67,95,.25)",
              borderLeft: err ? `1.5px solid ${STATUS.fail}` : `3px solid ${STATUS.pass}`,
              padding: "5px 8px",
              fontSize: 12,
              fontWeight: 600,
              color: err ? STATUS.fail : SURFACE.ink,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{r.name}</span>
              <span style={{ fontWeight: 800 }}>
                {err ? (r.name === "SystemID" ? "✖ ⟨required⟩" : "✖ not UUID") : "✓"}
              </span>
            </div>
            {r.value != null && (
              <div
                style={{
                  fontSize: r.name === "CommandID" ? 10 : 11,
                  fontWeight: 500,
                  opacity: 0.75,
                  wordBreak: "break-all",
                  marginTop: 2,
                }}
              >
                {r.value}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HandlersBody() {
  const machine = useGameStore((s) => s.machine);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <SectionLabel>HANDLER RULES · on TaskCommandStatus</SectionLabel>
      {machine ? (
        machine.rules.map((r) => (
          <div
            key={`${r.from}-${r.on}`}
            style={{
              background: "#fff",
              borderLeft: `4px solid ${ENUM_COLOR[r.on]}`,
              border: "1px solid rgba(36,67,95,.2)",
              padding: "5px 8px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <span style={{ color: ENUM_COLOR[r.on] }}>{r.on}</span> → {r.action}
            {r.action === "terminal" ? " ✔" : ""}
            {r.action === "retry" && r.budget != null ? ` (max ${r.budget})` : ""}
          </div>
        ))
      ) : (
        <div style={{ fontSize: 12, color: "rgba(36,67,95,.6)" }}>
          No handler machine wired (editing lands in S5). Open with ?ref=1 to load the reference.
        </div>
      )}
      <div
        style={{
          border: `1px solid ${SURFACE.ink}`,
          background: SURFACE.chrome,
          fontFamily: FONT.hand,
          fontSize: 12,
          padding: "6px 8px",
          marginTop: 4,
        }}
      >
        Machine size <b>{machine ? machine.rules.length : 0}</b> —{" "}
        {machine && machine.rules.length === sheet_1_1.pars.machineSize
          ? "matches par."
          : `par is ${sheet_1_1.pars.machineSize}.`}
      </div>
    </div>
  );
}

function RunBody() {
  const { all } = useRun();
  const setSeed = useGameStore((s) => s.setSeed);
  const seedId = useGameStore((s) => s.seedId);
  const statusById = new Map((all?.results ?? []).map((r) => [r.seedId, r.pass]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <SectionLabel>SEED SCHEDULE</SectionLabel>
      {sheet_1_1.seeds.map((s) => {
        const pass = statusById.get(s.id);
        const color = pass === undefined ? STATUS.waitSeed : pass ? STATUS.pass : STATUS.fail;
        const glyph = pass === undefined ? "○" : pass ? "✔" : "✖";
        const selected = seedId === s.id;
        return (
          <button
            type="button"
            key={s.id}
            onClick={() => setSeed(s.id)}
            style={{
              textAlign: "left",
              background: "#fff",
              borderLeft: `4px solid ${color}`,
              border: selected ? `1.5px solid ${ZONE.accent}` : "1px solid rgba(36,67,95,.2)",
              padding: "5px 8px",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: FONT.mono,
              cursor: "pointer",
              color: SURFACE.ink,
            }}
          >
            <span style={{ color }}>{glyph}</span> {CIRCLED[s.id - 1] ?? s.id} {s.label}
          </button>
        );
      })}
    </div>
  );
}

function EnumLegend() {
  return (
    <div style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px dashed rgba(36,67,95,.4)" }}>
      <SectionLabel>STATE ENUMS</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {ENUMS.map((e) => (
          <span
            key={e}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              border: `1.5px solid ${ENUM_COLOR[e]}`,
              color: ENUM_COLOR[e],
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 7px",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: ENUM_COLOR[e] }} />
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Inspector() {
  const phase = useGameStore((s) => s.phase);
  return (
    <aside
      style={{
        width: LAYOUT.inspectorW,
        flex: `0 0 ${LAYOUT.inspectorW}px`,
        background: SURFACE.panelCool,
        borderLeft: "1.5px dashed #24435f",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT.mono,
        overflow: "hidden",
      }}
    >
      <ZoneHeader />
      <div
        style={{
          padding: 12,
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "auto",
        }}
      >
        {phase === "compose" && <ComposeBody />}
        {phase === "handlers" && <HandlersBody />}
        {phase === "run" && <RunBody />}
        <EnumLegend />
      </div>
    </aside>
  );
}
