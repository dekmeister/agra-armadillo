// BRAIN EDITOR panel: the React Flow canvas + a thin toolbar for state-level edits
// (add / rename / delete / mark-initial) and brain IO (reference / reset / export / import).
import { useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useStore } from "../store.ts";
import { Panel } from "../ui/Panel.tsx";
import { BrainCanvas } from "./BrainCanvas.tsx";
import { DeleteStateModal } from "./DeleteStateModal.tsx";

export function BrainEditorPanel() {
  const brain = useStore((s) => s.brain);
  const mode = useStore((s) => s.mode);
  const selectedStateId = useStore((s) => s.selectedStateId);
  const addState = useStore((s) => s.addState);
  const renameState = useStore((s) => s.renameState);
  const deleteState = useStore((s) => s.deleteState);
  const setInitial = useStore((s) => s.setInitial);
  const loadReference = useStore((s) => s.loadReference);
  const resetBrain = useStore((s) => s.resetBrain);
  const exportBrain = useStore((s) => s.exportBrain);
  const importBrain = useStore((s) => s.importBrain);
  const fileRef = useRef<HTMLInputElement>(null);

  const editing = mode === "EDIT";

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const onAdd = () => {
    let n = brain.states.length + 1;
    while (brain.states.includes(`state-${n}`)) n += 1;
    addState(`state-${n}`);
  };
  const onRename = () => {
    if (!selectedStateId) return;
    const next = window.prompt("Rename state", selectedStateId);
    if (next) renameState(selectedStateId, next);
  };
  const onExport = () => {
    const blob = new Blob([exportBrain()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brain-${useStore.getState().level.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const onImportFile = (file: File) => {
    file.text().then((txt) => {
      if (!importBrain(txt)) window.alert("Invalid brain JSON.");
    });
  };

  return (
    <Panel
      title="BRAIN"
      titleAccent="EDITOR"
      meta={`STATE MACHINE · ${brain.states.length} STATES`}
      className="grow"
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            gap: 5,
            padding: "5px 7px",
            borderBottom: "1px solid var(--k-line)",
            flexWrap: "wrap",
          }}
        >
          <button className="btn sm" onClick={onAdd} disabled={!editing}>
            + State
          </button>
          <button className="btn sm" onClick={onRename} disabled={!editing || !selectedStateId}>
            Rename
          </button>
          <button
            className="btn sm"
            onClick={() => {
              if (!selectedStateId) return;
              const connected = brain.transitions.filter(
                (t) => t.from === selectedStateId || t.target === selectedStateId,
              ).length;
              if (connected > 0) setConfirmDeleteId(selectedStateId);
              else deleteState(selectedStateId);
            }}
            disabled={!editing || !selectedStateId || brain.states.length <= 1}
          >
            Delete
          </button>
          <button
            className="btn sm"
            onClick={() => selectedStateId && setInitial(selectedStateId)}
            disabled={!editing || !selectedStateId || brain.initial === selectedStateId}
          >
            Set Initial
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn sm" onClick={loadReference} disabled={!editing} title="Load the worked reference solution">
            Reference
          </button>
          <button className="btn sm" onClick={resetBrain} disabled={!editing}>
            Reset
          </button>
          <button className="btn sm" onClick={onExport}>
            Export
          </button>
          <button className="btn sm" onClick={() => fileRef.current?.click()} disabled={!editing}>
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
        </div>
        <div style={{ flex: "1 1 auto", position: "relative", minHeight: 0 }}>
          <ReactFlowProvider>
            <BrainCanvas />
          </ReactFlowProvider>
        </div>
      </div>
      {confirmDeleteId && (
        <DeleteStateModal
          stateName={confirmDeleteId}
          transitionCount={
            brain.transitions.filter(
              (t) => t.from === confirmDeleteId || t.target === confirmDeleteId,
            ).length
          }
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => {
            deleteState(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
        />
      )}
    </Panel>
  );
}
