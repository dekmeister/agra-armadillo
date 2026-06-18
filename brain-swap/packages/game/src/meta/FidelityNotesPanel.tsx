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
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop scrim; the modal's Close button is the keyboard-accessible control
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop scrim; the modal's Close button is the keyboard-accessible control
    <div className="modal-scrim" onClick={onClose}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops backdrop dismiss on inner clicks; not an interactive control */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops backdrop dismiss on inner clicks; not an interactive control */}
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <Panel title="FIDELITY" titleAccent="NOTES">
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
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
