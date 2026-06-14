// TRANSITION form: edits the selected transition (MVP subset, docs/05) — one message-type
// trigger, at most one field guard (field / op / literal), an optional send action, and a
// goto target. The trigger/guard field dropdowns are populated from the real catalog so a
// guard can never reference a field that doesn't exist on the trigger message type.
import { useState } from "react";
import {
  catalogEntry,
  type CompareOp,
  isKnownMessageType,
  type MessageTypeName,
} from "@brain-swap/core";
import { useStore } from "../store.ts";
import { Panel } from "../ui/Panel.tsx";
import { Identifier } from "../ui/Identifier.tsx";
import { formatValueExpr, parseLiteral } from "../sim/format.ts";
import { SendActionForm } from "./SendActionForm.tsx";
import { MessageReference } from "../meta/MessageReference.tsx";

const OPS: CompareOp[] = ["==", "!=", "<", "<=", ">", ">="];
const NO_MESSAGES: readonly MessageTypeName[] = [];

export function TransitionForm() {
  const index = useStore((s) => s.selectedTransitionIndex);
  const transition = useStore((s) => (s.selectedTransitionIndex !== null ? s.brain.transitions[s.selectedTransitionIndex] : undefined));
  const states = useStore((s) => s.brain.states);
  const available = useStore((s) => s.level.availableMessages) ?? NO_MESSAGES;
  const update = useStore((s) => s.updateTransition);
  const remove = useStore((s) => s.deleteTransition);
  const editing = useStore((s) => s.mode === "EDIT");
  const [sendOpen, setSendOpen] = useState(false);
  // Which message the cheatsheet pane shows. Tabs set it manually; focusing the
  // trigger/guard rows vs the action row auto-follows (onFocusCapture below).
  const [refTab, setRefTab] = useState<"trigger" | "action">("trigger");

  if (index === null || !transition) {
    return (
      <Panel title="TRANSITION" className="tform-panel">
        <div style={{ padding: 10, fontSize: 10, color: "var(--k-dim)" }}>
          Select an edge to edit its trigger, guard, and action — or drag between states to
          create one.
        </div>
      </Panel>
    );
  }

  const triggerType = transition.trigger.messageType;
  const triggerFields = isKnownMessageType(triggerType) ? catalogEntry(triggerType).fields : [];
  const guard = transition.guard;
  const action = transition.actions?.[0];
  // Effective cheatsheet tab — fall back to trigger when the action tab is selected
  // but no action exists (e.g. it was just cleared).
  const effTab = refTab === "action" && action ? "action" : "trigger";
  const refType = effTab === "action" ? action!.message : triggerType;

  const setTrigger = (mt: MessageTypeName) =>
    // Trigger change invalidates the guard (fields differ) — drop it.
    update(index, { trigger: { messageType: mt }, guard: undefined });

  const setGuardField = (field: string) =>
    update(index, { guard: { field, op: guard?.op ?? "==", value: guard?.value ?? "" } });
  const setGuardOp = (op: CompareOp) =>
    guard && update(index, { guard: { ...guard, op } });
  const setGuardValue = (text: string) =>
    guard && update(index, { guard: { ...guard, value: parseLiteral(text) } });

  return (
    <Panel title="TRANSITION" meta={`${transition.from} → ${transition.target ?? transition.from}`} className="tform-panel">
      <div className="tform-split">
      <div className="tform">
        {/* Trigger + Guard reference the trigger message — focusing either shows it. */}
        <div className="frow-group" onFocusCapture={() => setRefTab("trigger")}>
          {/* Trigger */}
          <div className="frow">
            <span className="flbl">Trigger · on message</span>
            <div className="controls">
              <select
                value={triggerType}
                disabled={!editing}
                onChange={(e) => setTrigger(e.target.value as MessageTypeName)}
              >
                {available.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Guard */}
          <div className="frow">
            <span className="flbl">Guard · field condition</span>
            <div className="controls">
              <select
                value={guard?.field ?? ""}
                disabled={!editing}
                onChange={(e) =>
                  e.target.value ? setGuardField(e.target.value) : update(index, { guard: undefined })
                }
              >
                <option value="">(none)</option>
                {triggerFields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
              {guard && (
                <>
                  <select value={guard.op} disabled={!editing} onChange={(e) => setGuardOp(e.target.value as CompareOp)}>
                    {OPS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field"
                    style={{ width: 110 }}
                    defaultValue={formatValueExpr(guard.value)}
                    disabled={!editing}
                    onBlur={(e) => setGuardValue(e.target.value)}
                    placeholder="value"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action references the send message — focusing it shows that. */}
        <div className="frow-group" onFocusCapture={() => action && setRefTab("action")}>
          {/* Action */}
          <div className="frow">
            <span className="flbl">Action · send</span>
            <div className="controls">
              {action ? (
                <>
                  <span className="chip">
                    SEND · <Identifier name={action.message} />
                  </span>
                  <button className="btn sm" disabled={!editing} onClick={() => setSendOpen(true)}>
                    Edit Fields ▸
                  </button>
                  <button className="btn sm" disabled={!editing} onClick={() => update(index, { actions: [] })}>
                    Clear
                  </button>
                </>
              ) : (
                <button className="btn sm" disabled={!editing} onClick={() => setSendOpen(true)}>
                  + Send Action
                </button>
              )}
            </div>
          </div>

          {/* Send field preview */}
          {action && (
            <div className="preview">
              {catalogEntry(action.message).fields.map((f) => {
                const v = action.fields[f.name];
                if (v === undefined) {
                  return f.required ? (
                    <span key={f.name} className="req">
                      ✱ {f.name} (missing)
                    </span>
                  ) : null;
                }
                return (
                  <span key={f.name}>
                    {f.required ? <span className="req">✱ </span> : null}
                    {f.name} <span className="pf">{formatValueExpr(v)}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Goto */}
        <div className="frow">
          <span className="flbl">Goto · target state</span>
          <div className="controls">
            <select
              value={transition.target ?? ""}
              disabled={!editing}
              onChange={(e) =>
                update(index, e.target.value ? { target: e.target.value } : { target: undefined })
              }
            >
              <option value="">(stay)</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span style={{ flex: 1 }} />
            <button className="btn sm" disabled={!editing} onClick={() => remove(index)}>
              Delete Transition
            </button>
          </div>
        </div>
      </div>

      {/* Cheatsheet: reference for the trigger or action message, no page switch. */}
      <div className="tref">
        <div className="tref-tabs">
          <button
            className={`btn sm${effTab === "trigger" ? " on" : ""}`}
            onClick={() => setRefTab("trigger")}
          >
            Trigger
          </button>
          {action && (
            <button
              className={`btn sm${effTab === "action" ? " on" : ""}`}
              onClick={() => setRefTab("action")}
            >
              Action
            </button>
          )}
        </div>
        <div className="tref-body">
          {isKnownMessageType(refType) ? (
            <MessageReference name={refType} />
          ) : (
            <div style={{ padding: 4, fontSize: 12, color: "var(--k-dim)" }}>
              No message reference available.
            </div>
          )}
        </div>
      </div>
      </div>

      {sendOpen && (
        <SendActionForm
          transitionIndex={index}
          triggerType={triggerType}
          initial={action}
          onClose={() => setSendOpen(false)}
        />
      )}
    </Panel>
  );
}
