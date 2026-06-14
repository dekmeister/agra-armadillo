// A transition rendered as a labeled edge with an EdgeChip floating at its midpoint.
// The chip shows the trigger message type via Identifier + the guard in amber (red on a
// fault edge — none in the MVP brain, but the styling is wired for later slices).
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { Identifier } from "../ui/Identifier.tsx";

export interface TransitionEdgeData {
  messageType: string;
  guardText?: string;
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
          className={`edgechip${d.fault ? " warn" : ""}`}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          <Identifier name={d.messageType} />
          {d.guardText ? <span className="guard"> [{d.guardText}]</span> : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
