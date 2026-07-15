// The drawing-index (sheet-select) screen — the progression entry point (WS-C).
// Styled as a Blueprint drafting index: the registered sheets in play order, each
// a row that reads locked / ready / certified. A sheet unlocks when its
// predecessor is certified (the first is always open). Export/import round-trips
// the whole save as a JSON file (docs/04-tech "localStorage + JSON export/import").
import { SHEET_LIST } from "@normal-form/levels";
import { useRef } from "react";
import { exportSave, loadSave } from "./persist.ts";
import { useGameStore } from "./store.ts";
import { BORDER, FONT, RADIUS, SHADOW, STATUS, SURFACE, ZONE } from "./tokens.ts";

const WORLD_LABEL: Record<string, string> = {
  w0: "World 0 · One Way",
  w1: "World 1 · Ask & Acknowledge",
};

function worldLabel(world: string): string {
  return WORLD_LABEL[world] ?? world.toUpperCase();
}

type Status = "certified" | "ready" | "locked";

function statusOf(index: number, certified: Readonly<Record<string, boolean>>): Status {
  const id = SHEET_LIST[index]?.id ?? "";
  if (certified[id]) return "certified";
  const prev = index === 0 ? null : SHEET_LIST[index - 1];
  const unlocked = index === 0 || (prev != null && certified[prev.id] === true);
  return unlocked ? "ready" : "locked";
}

function StatusChip({ status }: { status: Status }) {
  const spec = {
    certified: { text: "CERTIFIED ✔", bg: STATUS.pass, fg: "#fff" },
    ready: { text: "READY", bg: ZONE.accent, fg: "#fff" },
    locked: { text: "LOCKED", bg: "transparent", fg: "rgba(36,67,95,.5)" },
  }[status];
  return (
    <span
      style={{
        background: spec.bg,
        color: spec.fg,
        border: status === "locked" ? "1px dashed rgba(36,67,95,.5)" : "none",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: ".06em",
        padding: "3px 9px",
        borderRadius: RADIUS.badge,
        whiteSpace: "nowrap",
      }}
    >
      {status === "locked" ? "🔒 LOCKED" : spec.text}
    </span>
  );
}

function SheetRow({ index }: { index: number }) {
  const sheet = SHEET_LIST[index]!;
  const certified = useGameStore((s) => s.certified);
  const selectSheet = useGameStore((s) => s.selectSheet);
  const status = statusOf(index, certified);
  const locked = status === "locked";

  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => !locked && selectSheet(sheet.id)}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 14,
        width: "100%",
        textAlign: "left",
        background: SURFACE.console,
        border: BORDER.divider,
        borderLeft: `5px solid ${
          status === "certified" ? STATUS.pass : locked ? "rgba(36,67,95,.35)" : ZONE.accent
        }`,
        boxShadow: locked ? "none" : SHADOW.drafting2,
        padding: "12px 16px",
        fontFamily: FONT.mono,
        color: SURFACE.ink,
        cursor: locked ? "not-allowed" : "pointer",
        opacity: locked ? 0.6 : 1,
      }}
    >
      <span
        style={{
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: ".02em",
          color: locked ? "rgba(36,67,95,.5)" : SURFACE.ink,
          minWidth: 52,
        }}
      >
        {sheet.id}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{sheet.title}</span>
          {sheet.bonus && (
            <span
              style={{
                background: ZONE.accent,
                color: "#fff",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: ".06em",
                padding: "1px 6px",
                borderRadius: RADIUS.badge,
              }}
            >
              BONUS · OPTIONAL
            </span>
          )}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(36,67,95,.6)" }}>
          {worldLabel(sheet.world)}
        </span>
        <span
          style={{
            fontFamily: FONT.hand,
            fontSize: 13,
            color: "rgba(36,67,95,.75)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {locked ? "Certify the previous sheet to unlock." : sheet.goal.text}
        </span>
      </span>
      <StatusChip status={status} />
    </button>
  );
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

export function SheetSelect() {
  const importState = useGameStore((s) => s.importState);
  const openReference = useGameStore((s) => s.openReference);
  const openHowTo = useGameStore((s) => s.openHowTo);
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = () => {
    const blob = new Blob([exportSave(loadSave())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "normal-form-save.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => importState(String(reader.result ?? ""));
    reader.readAsText(file);
  };

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
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: ".04em" }}>NORMAL FORM</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(36,67,95,.65)" }}>
              DRAWING INDEX · SEQUENCE CERTIFICATION SHEETS
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => openReference()} style={toolbarBtn()}>
              ▤ UCI REFERENCE
            </button>
            <button type="button" onClick={openHowTo} style={toolbarBtn()}>
              ? HOW TO PLAY
            </button>
            <button type="button" onClick={onExport} style={toolbarBtn()}>
              ⭳ EXPORT
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} style={toolbarBtn()}>
              ⭱ IMPORT
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              aria-label="import save file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportFile(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <p
          style={{
            fontFamily: FONT.hand,
            fontSize: 14,
            color: "rgba(36,67,95,.7)",
            margin: "0 0 20px",
          }}
        >
          Certify each interaction sheet in order. A sheet unlocks when the one before it is
          certified — your progress is saved to this browser.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {SHEET_LIST.map((sheet, i) => (
            <SheetRow key={sheet.id} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
