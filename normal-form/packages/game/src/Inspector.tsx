// Inspector column (handoff § Component: Inspector). Body swaps by phase —
// envelope fields (COMPOSE), handler rules (HANDLERS), seed schedule (RUN) — with
// the STATE ENUMS legend pinned to the bottom. All values are level data or
// engine-derived; nothing is editable in S4 (editing is S5).
import type { MachineAction } from "@normal-form/core";
import { sheet_1_1 } from "@normal-form/levels";
import { useState } from "react";
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

const ORDER = ["SystemID", "Timestamp", "SchemaVersion", "Mode", "CommandID"] as const;

function ComposeBody() {
  const findings = useFindings();
  const fields = useGameStore((s) => s.session.fields);
  const setField = useGameStore((s) => s.setField);
  const editable = new Set(sheet_1_1.compose.editable);
  const errorFields = new Set(findings.map((f) => f.field).filter(Boolean));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <SectionLabel>ENVELOPE FIELDS</SectionLabel>
      {ORDER.map((name) => {
        const value = fields[name] ?? null;
        const err = errorFields.has(name);
        const canEdit = editable.has(name);
        return (
          <div
            key={name}
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
              <span>
                {name}
                {canEdit && (
                  <span style={{ color: ZONE.accent, marginLeft: 4, fontSize: 10 }}>✎</span>
                )}
              </span>
              <span style={{ fontWeight: 800 }}>{err ? "✖" : "✓"}</span>
            </div>
            {canEdit ? (
              <input
                aria-label={name}
                value={value ?? ""}
                placeholder={name === "SystemID" ? "⟨required⟩" : "canonical UUID"}
                onChange={(e) => setField(name, e.target.value === "" ? null : e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  marginTop: 4,
                  padding: "3px 5px",
                  fontFamily: FONT.mono,
                  fontSize: name === "CommandID" ? 10 : 11,
                  fontWeight: 600,
                  color: err ? STATUS.fail : SURFACE.ink,
                  background: "#fff",
                  border: `1px solid ${err ? STATUS.fail : "rgba(36,67,95,.35)"}`,
                  borderRadius: 2,
                }}
              />
            ) : (
              value != null && (
                <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.75, marginTop: 2 }}>
                  {value}
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

const HANDLER_ENUMS = ["RECEIVED", "ACCEPTED", "REJECTED"] as const;
const ACTIONS = ["wait", "terminal", "retry"] as const;

function HandlersBody() {
  const handlers = useGameStore((s) => s.session.handlers);
  const gate = useGameStore((s) => s.session.gateAccepted);
  const setHandler = useGameStore((s) => s.setHandler);
  const setGate = useGameStore((s) => s.setGate);
  const size = HANDLER_ENUMS.filter((e) => handlers[e] !== undefined).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <SectionLabel>HANDLER RULES · on TaskCommandStatus</SectionLabel>
      {HANDLER_ENUMS.map((on) => (
        <div
          key={on}
          style={{
            background: "#fff",
            borderLeft: `4px solid ${ENUM_COLOR[on]}`,
            border: "1px solid rgba(36,67,95,.2)",
            padding: "5px 8px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: ENUM_COLOR[on], flex: 1 }}>{on}</span>
            <span>→</span>
            <select
              aria-label={`${on} action`}
              value={handlers[on] ?? ""}
              onChange={(e) =>
                setHandler(on, e.target.value === "" ? null : (e.target.value as MachineAction))
              }
              style={{
                fontFamily: FONT.mono,
                fontSize: 12,
                fontWeight: 700,
                padding: "2px 4px",
                border: "1px solid rgba(36,67,95,.35)",
                borderRadius: 2,
                background: "#fff",
                color: SURFACE.ink,
              }}
            >
              <option value="">unset</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                  {a === "terminal" ? " ✔" : ""}
                  {a === "retry" ? " (1)" : ""}
                </option>
              ))}
            </select>
          </div>
          {on === "ACCEPTED" && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginTop: 4,
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(36,67,95,.7)",
              }}
            >
              <input
                type="checkbox"
                checked={gate}
                onChange={(e) => setGate(e.target.checked)}
                aria-label="require RECEIVED first"
              />
              require RECEIVED first
            </label>
          )}
        </div>
      ))}
      <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(36,67,95,.6)", paddingLeft: 2 }}>
        CANCELED → (legend only)
      </div>
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
        Machine size <b>{size}</b> —{" "}
        {size === sheet_1_1.pars.machineSize
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

// Codex stubs — "In the real standard…" (CommandProcessingStateEnum, SPC-001 §5.1.1).
const CODEX: Record<(typeof ENUMS)[number], string> = {
  RECEIVED:
    "Non-terminal. The normal entry point — but it may never be reported if the Commandee transitions straight to a terminal state.",
  ACCEPTED:
    "Terminal. The command was accepted; the sequence ends and later responses are ignored.",
  REJECTED:
    "Terminal. The command was refused (reason in CommandProcessingStateReason). Retry is a NEW command, not an UPDATE.",
  CANCELED: "Terminal. Reached via a CANCEL; terminal states ignore all subsequent updates.",
};

function EnumLegend() {
  const [open, setOpen] = useState<(typeof ENUMS)[number] | null>(null);
  return (
    <div
      style={{
        marginTop: "auto",
        paddingTop: 10,
        borderTop: "1px dashed rgba(36,67,95,.4)",
        position: "relative",
      }}
    >
      <SectionLabel>STATE ENUMS</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {ENUMS.map((e) => (
          <button
            type="button"
            key={e}
            onClick={() => setOpen(open === e ? null : e)}
            title="codex — in the real standard…"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: open === e ? ENUM_COLOR[e] : "transparent",
              border: `1.5px solid ${ENUM_COLOR[e]}`,
              color: open === e ? "#fff" : ENUM_COLOR[e],
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: FONT.mono,
              padding: "2px 7px",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: open === e ? "#fff" : ENUM_COLOR[e],
              }}
            />
            {e}
          </button>
        ))}
      </div>
      {open && (
        <div
          style={{
            marginTop: 6,
            border: `1.5px solid ${ENUM_COLOR[open]}`,
            background: "#fff",
            padding: "6px 8px",
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.5,
            color: SURFACE.ink,
          }}
        >
          <b style={{ color: ENUM_COLOR[open] }}>{open}</b> — {CODEX[open]}{" "}
          <span style={{ opacity: 0.6 }}>(CommandProcessingStateEnum · SPC-001 §5.1.1)</span>
        </div>
      )}
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
