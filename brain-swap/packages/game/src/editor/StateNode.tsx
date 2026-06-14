// A brain state rendered as a MIL-spec node on the React Flow canvas. Handles on all
// four sides so transitions can be drawn between any states. Visual states: initial
// (cyan dot), selected (amber ring), active-during-RUN (green border + glow).
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface StateNodeData {
  name: string;
  initial: boolean;
  active: boolean;
  selected: boolean;
  [key: string]: unknown;
}

export function StateNode({ data }: NodeProps) {
  const d = data as StateNodeData;
  const cls = ["statenode"];
  if (d.initial) cls.push("initial");
  if (d.active) cls.push("active");
  if (d.selected) cls.push("sel");
  return (
    <div className={cls.join(" ")}>
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />
      <div className="sh">
        {d.name}
        <span className="sdot" />
      </div>
      <div className="sb">{d.initial ? "initial state" : " "}</div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
