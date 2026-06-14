// Primary console: ChromeBar + StatusStrip + the 3-column grid (468 | 1fr | 386).
// Left = brain editor (full height); center = map + mission/spec + transition form; right = log pillar.
import { useState } from "react";
import { ChromeBar } from "./ChromeBar.tsx";
import { StatusStrip } from "./StatusStrip.tsx";
import { BrainEditorPanel } from "../editor/BrainEditorPanel.tsx";
import { TransitionForm } from "../editor/TransitionForm.tsx";
import { TacticalMapPanel } from "../run/TacticalMap.tsx";
import { MissionCard, BodySpecSheet } from "../run/MissionPanels.tsx";
import { MessageLogPanel } from "../run/MessageLog.tsx";

export function Console() {
  // Mission card + body spec sheet share one collapse state so they fold/unfold
  // together; they start open. Local to the layout — no persistence needed.
  const [panelsOpen, setPanelsOpen] = useState(true);
  const togglePanels = () => setPanelsOpen((o) => !o);
  return (
    <>
      <ChromeBar />
      <StatusStrip />
      <div className="grid">
        <div className="col">
          <BrainEditorPanel />
        </div>
        <div className="col">
          <TacticalMapPanel />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <MissionCard collapsed={!panelsOpen} onToggleCollapse={togglePanels} />
            <BodySpecSheet collapsed={!panelsOpen} onToggleCollapse={togglePanels} />
          </div>
          <TransitionForm />
        </div>
        <div className="col">
          <MessageLogPanel />
        </div>
      </div>
    </>
  );
}
