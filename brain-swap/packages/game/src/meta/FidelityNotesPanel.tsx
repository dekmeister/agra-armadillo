// FIDELITY NOTES modal — the subset of docs/02 §3 "lies we tell" that this level touches
// (level.fidelityNotes). Triggered from ChromeBar next to the TICK readout.
import { useStore } from "../store.ts";
import { Panel } from "../ui/Panel.tsx";
import { notesFor } from "./fidelityNotes.ts";

export function FidelityNotesModal({ onClose }: { onClose: () => void }) {
  const indices = useStore((s) => s.level.fidelityNotes);
  const notes = notesFor(indices);
  if (notes.length === 0) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <Panel title="FIDELITY" titleAccent="NOTES" meta="vs ASK 5.0a">
          <div className="datalist" style={{ gap: 6 }}>
            {notes.map((n) => (
              <div key={n.index} style={{ lineHeight: 1.4 }}>
                <span className="k-amber" style={{ fontWeight: 600 }}>
                  #{n.index} {n.title}.
                </span>{" "}
                <span className="k-dim">{n.body}</span>
              </div>
            ))}
          </div>
        </Panel>
        <div className="mfoot">
          <div className="right">
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
