// ChromeBar (58px): MissionBlock | LiveTransport. Realtime transport: Play/Pause · Restart ·
// Step · Compose · speed · tick readout. (No EDIT/RUN switch — there is no brain to edit.)
import { useState } from "react";
import { FidelityNotesModal } from "../meta/FidelityNotesPanel.tsx";
import { notesFor } from "../meta/fidelityNotes.ts";
import { type Speed, useStore } from "../store.ts";

const SPEEDS: [Speed, string][] = [
  [1, "1"],
  [2, "2"],
  [8, "3"],
];

export function ChromeBar() {
  const level = useStore((s) => s.level);
  const body = useStore((s) => s.body);
  const running = useStore((s) => s.running);
  const composing = useStore((s) => s.composing);
  const tutorial = useStore((s) => s.tutorial);
  const speed = useStore((s) => s.speed);
  const playhead = useStore((s) => s.playhead);
  const togglePlay = useStore((s) => s.togglePlay);
  const restart = useStore((s) => s.restart);
  const stepOne = useStore((s) => s.stepOne);
  const openComposer = useStore((s) => s.openComposer);
  const setSpeed = useStore((s) => s.setSpeed);

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

        <div className="region transport" data-tour="transport">
          <button
            className={`iconbtn${running ? " playing" : ""}`}
            onClick={togglePlay}
            title={running ? "Pause [Space]" : "Play [Space]"}
          >
            {running ? "❚❚" : "▶"}
          </button>
          <button className="iconbtn" onClick={restart} title="Restart [R]">
            ■
          </button>
          <button className="iconbtn" onClick={stepOne} title="Step one tick [→]">
            ⏭
          </button>
          <button
            className="btn sm on"
            onClick={openComposer}
            disabled={composing || tutorial}
            title={tutorial ? "Disabled during the tutorial demo" : "Compose & send [C]"}
          >
            ✎ Send
          </button>
          <div className="seg">
            {SPEEDS.map(([s, key]) => (
              <button
                key={s}
                className={speed === s ? "on" : ""}
                onClick={() => setSpeed(s)}
                title={`${s}× speed [${key}]`}
              >
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
      </div>
      {fidOpen && <FidelityNotesModal onClose={() => setFidOpen(false)} />}
    </>
  );
}
