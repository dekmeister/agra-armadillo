// Primary console: ChromeBar + StatusStrip + the 3-column grid (468 | 1fr | 386).
// Left = brain editor + transition form; center = map + mission/spec; right = log pillar.
import { ChromeBar } from "./ChromeBar.tsx";
import { StatusStrip } from "./StatusStrip.tsx";
import { BrainEditorPanel } from "../editor/BrainEditorPanel.tsx";
import { TransitionForm } from "../editor/TransitionForm.tsx";
import { TacticalMapPanel } from "../run/TacticalMap.tsx";
import { MissionCard, BodySpecSheet } from "../run/MissionPanels.tsx";
import { MessageLogPanel } from "../run/MessageLog.tsx";

export function Console() {
  return (
    <>
      <ChromeBar />
      <StatusStrip />
      <div className="grid">
        <div className="col">
          <BrainEditorPanel />
          <TransitionForm />
        </div>
        <div className="col">
          <TacticalMapPanel />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <MissionCard />
            <BodySpecSheet />
          </div>
        </div>
        <div className="col">
          <MessageLogPanel />
        </div>
      </div>
    </>
  );
}
