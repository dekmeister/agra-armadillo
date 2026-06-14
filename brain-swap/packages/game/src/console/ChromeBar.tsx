// ChromeBar (58px): MissionBlock | TickTransport | EditRunSwitch.
import { useState } from "react";
import { useStore, type Speed } from "../store.ts";
import { FidelityNotesModal } from "../meta/FidelityNotesPanel.tsx";
import { notesFor } from "../meta/fidelityNotes.ts";

const SPEEDS: Speed[] = [1, 2, 8];

export function ChromeBar() {
  const level = useStore((s) => s.level);
  const body = useStore((s) => s.body);
  const running = useStore((s) => s.running);
  const speed = useStore((s) => s.speed);
  const mode = useStore((s) => s.mode);
  const playhead = useStore((s) => s.playhead);
  const togglePlay = useStore((s) => s.togglePlay);
  const stepOne = useStore((s) => s.stepOne);
  const setSpeed = useStore((s) => s.setSpeed);
  const setMode = useStore((s) => s.setMode);

  const cap = body.capabilities.find((c) => c.id === level.capabilityId);
  const notes = notesFor(level.fidelityNotes);
  const [fidOpen, setFidOpen] = useState(false);

  return (
    <>
      <div className="chrome">
        <div className="region mission">
          <div className="l1">
            <span className="k-amber">MSN {level.id}</span> · {level.title.toUpperCase()}
          </div>
          <div className="l2">
            BODY {body.name.toUpperCase()} ({body.id}) · {cap?.type ?? "—"} · AUTHORITY SECONDARY
          </div>
        </div>

        <div className="region transport">
          <button
            className={`iconbtn${running ? " playing" : ""}`}
            onClick={togglePlay}
            disabled={mode === "EDIT"}
            title={running ? "Pause" : "Play"}
          >
            {running ? "❚❚" : "▶"}
          </button>
          <button className="iconbtn" onClick={stepOne} disabled={mode === "EDIT"} title="Step">
            ⏭
          </button>
          <div className="seg">
            {SPEEDS.map((s) => (
              <button key={s} className={speed === s ? "on" : ""} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
          <div className="tickreadout">
            <span className="lbl">TICK </span>
            <span className="num">{String(playhead).padStart(4, "0")}</span>
          </div>
          {notes.length > 0 && (
            <button className="btn sm" onClick={() => setFidOpen(true)}>
              ⚠ FIDELITY ({notes.length})
            </button>
          )}
        </div>

        <div className="spacer" />

        <div className="region runswitch">
          <div className="seg run">
            <button
              className={`edit${mode === "EDIT" ? " on" : ""}`}
              onClick={() => setMode("EDIT")}
            >
              EDIT
            </button>
            <button className={`run${mode === "RUN" ? " on" : ""}`} onClick={() => setMode("RUN")}>
              RUN
            </button>
          </div>
        </div>
      </div>
      {fidOpen && <FidelityNotesModal onClose={() => setFidOpen(false)} />}
    </>
  );
}
