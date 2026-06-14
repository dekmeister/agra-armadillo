// Confirmation modal shown before deleting a state that has connected transitions.
// Follows the modal-scrim + modal pattern used by FidelityNotesModal and SendActionForm.
import { Panel } from "../ui/Panel.tsx";

export function DeleteStateModal({
  stateName,
  transitionCount,
  onCancel,
  onConfirm,
}: {
  stateName: string;
  transitionCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal narrow" onClick={(e) => e.stopPropagation()}>
        <Panel title="DELETE" titleAccent={stateName} meta="CONFIRM">
          <div className="datalist" style={{ gap: 6 }}>
            <p style={{ lineHeight: 1.5 }}>
              This will also delete{" "}
              <span className="k-amber" style={{ fontWeight: 600 }}>
                {transitionCount}
              </span>{" "}
              connected {transitionCount === 1 ? "transition" : "transitions"}.
            </p>
          </div>
        </Panel>
        <div className="mfoot">
          <div className="right">
            <button className="btn" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn on" onClick={onConfirm}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
