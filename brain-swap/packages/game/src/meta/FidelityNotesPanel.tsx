// FIDELITY NOTES panel — the subset of docs/02 §3 "lies we tell" that this level touches
// (level.fidelityNotes). So the game never teaches something false (docs/01).
import { useStore } from "../store.ts";
import { Panel } from "../ui/Panel.tsx";
import { notesFor } from "./fidelityNotes.ts";

export function FidelityNotesPanel() {
  const indices = useStore((s) => s.level.fidelityNotes);
  const notes = notesFor(indices);
  if (notes.length === 0) return null;
  return (
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
  );
}
