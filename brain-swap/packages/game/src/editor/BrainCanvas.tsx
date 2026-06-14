// The brain state machine as an editable React Flow graph. Nodes/edges are derived from
// the store's Brain (core data) + UI layout; this is "the editor is just a view" (docs/04).
// Editing (positions, connections, selection) flows back through store actions, each of
// which rebuilds the deterministic timeline.
import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useStore } from "../store.ts";
import { StateNode } from "./StateNode.tsx";
import { TransitionEdge } from "./TransitionEdge.tsx";
import { shortGuard } from "../sim/format.ts";

const nodeTypes = { state: StateNode };
const edgeTypes = { transition: TransitionEdge };

export function BrainCanvas() {
  const brain = useStore((s) => s.brain);
  const layout = useStore((s) => s.layout);
  const mode = useStore((s) => s.mode);
  const activeState = useStore((s) => (s.mode === "RUN" ? s.world().ma.brainState : null));
  const selectedStateId = useStore((s) => s.selectedStateId);
  const selectedTransitionIndex = useStore((s) => s.selectedTransitionIndex);

  const setNodePosition = useStore((s) => s.setNodePosition);
  const selectState = useStore((s) => s.selectState);
  const selectTransition = useStore((s) => s.selectTransition);
  const addTransition = useStore((s) => s.addTransition);
  const updateTransition = useStore((s) => s.updateTransition);
  const deleteState = useStore((s) => s.deleteState);
  const deleteTransition = useStore((s) => s.deleteTransition);

  const derivedNodes = useMemo<Node[]>(
    () =>
      brain.states.map((id) => ({
        id,
        type: "state",
        position: layout[id] ?? { x: 0, y: 0 },
        data: {
          name: id,
          initial: brain.initial === id,
          active: activeState === id,
          selected: selectedStateId === id,
        },
      })),
    [brain.states, brain.initial, layout, activeState, selectedStateId],
  );

  const derivedEdges = useMemo<Edge[]>(
    () =>
      brain.transitions.map((t, i) => ({
        id: `t${i}`,
        source: t.from,
        target: t.target ?? t.from,
        type: "transition",
        selected: selectedTransitionIndex === i,
        data: {
          messageType: t.trigger.messageType,
          guardText: shortGuard(t.guard),
          fault: false,
        },
      })),
    [brain.transitions, selectedTransitionIndex],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(derivedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(derivedEdges);

  // Keep React Flow in sync when the brain / selection / active-state changes.
  useEffect(() => setNodes(derivedNodes), [derivedNodes, setNodes]);
  useEffect(() => setEdges(derivedEdges), [derivedEdges, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (mode !== "EDIT" || !c.source || !c.target || c.source === c.target) return;
      // Update the store only — the brain is the source of truth; derivedEdges + the
      // sync effect re-render the canvas with a fully-formed (data-bearing) edge. Adding
      // an edge directly here would create one with no `data`, crashing the edge chip.
      const idx = useStore.getState().brain.transitions.length;
      addTransition(c.source);
      updateTransition(idx, { target: c.target });
    },
    [mode, addTransition, updateTransition],
  );

  // Disallow self-connections (a state's own top/bottom pins). A "stay in this state"
  // transition is still expressible via the Transition form's goto = (stay).
  const isValidConnection = useCallback(
    (c: Connection | Edge) => c.source !== c.target,
    [],
  );

  // Keyboard delete (Del / Backspace) routes through the store so the brain stays the
  // single source of truth. Edges are deleted by descending index to keep indices stable.
  const onNodesDelete = useCallback(
    (deleted: Node[]) => deleted.forEach((n) => deleteState(n.id)),
    [deleteState],
  );
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      deleted
        .map((e) => Number(e.id.slice(1)))
        .sort((a, b) => b - a)
        .forEach((i) => deleteTransition(i));
    },
    [deleteTransition],
  );

  return (
    <div className="editor-body">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={mode === "EDIT" ? ["Delete", "Backspace"] : null}
        nodesDraggable={mode === "EDIT"}
        nodesConnectable={mode === "EDIT"}
        onNodeClick={(_, n) => selectState(n.id)}
        onNodeDragStart={(_, n) => selectState(n.id)}
        onNodeDragStop={(_, n) => {
          selectState(n.id);
          setNodePosition(n.id, n.position.x, n.position.y);
        }}
        onEdgeClick={(_, e) => selectTransition(Number(e.id.slice(1)))}
        onPaneClick={() => {
          selectState(null);
          selectTransition(null);
        }}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2c3325" />
      </ReactFlow>
    </div>
  );
}
