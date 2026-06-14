// A transition rendered as a labeled edge with EdgeChips floating at its midpoint.
// The trigger chip shows the trigger message type via Identifier + the guard in amber
// (red on a fault edge — none in the MVP brain, but the styling is wired for later
// slices). When the transition has a send action, a second chip underneath shows the
// emitted message in the same `SEND · message` format as the transition form (no fields,
// which would make the edge too busy).
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { Identifier } from "../ui/Identifier.tsx";

export interface TransitionEdgeData {
  messageType: string;
  guardText?: string;
  sendMessage?: string;
  fault?: boolean;
  [key: string]: unknown;
}

export function TransitionEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } =
    props;
  const d = (data ?? {}) as TransitionEdgeData;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        style={{
          stroke: d.fault ? "var(--k-warn)" : selected ? "var(--k-amber)" : "var(--k-line2)",
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: d.fault ? "5 4" : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={`edgechip-stack${d.fault ? " warn" : ""}`}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <div className="edgechip trigger">
            <Identifier name={d.messageType} />
            {d.guardText ? <span className="guard"> [{d.guardText}]</span> : null}
          </div>
          {d.sendMessage ? (
            <div className="edgechip send">
              <span className="lbl">SEND ·</span> <Identifier name={d.sendMessage} />
            </div>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
