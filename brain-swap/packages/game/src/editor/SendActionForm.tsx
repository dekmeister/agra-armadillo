// SEND-ACTION form (modal). Compose the message a transition sends. Each catalog field
// gets a value-source toggle: LIT (literal, amber) | CAP (a body-capability reference,
// cyan, cap.*) | MSG (a field captured from the triggering message, amber, msg.*). The
// CAP palette binds to the honest cap key set (caps.ts) and MSG to the trigger message's
// real catalog fields. Validation mirrors FA: required fields populated + Altitude/Speed
// within the advertised envelope (packages/core/src/fa/validator.ts).
import { useMemo, useState } from "react";
import {
  catalogEntry,
  findCapability,
  isKnownMessageType,
  type MessageTypeName,
  type SendAction,
  type ValueExpr,
} from "@brain-swap/core";
import { useStore } from "../store.ts";
import { Panel } from "../ui/Panel.tsx";
import { Identifier } from "../ui/Identifier.tsx";
import { capEntries } from "../sim/caps.ts";
import { parseLiteral } from "../sim/format.ts";

const NO_MESSAGES: readonly MessageTypeName[] = [];

type Source = "LIT" | "CAP" | "MSG";
interface FieldState {
  source: Source;
  value: string;
}

function detectSource(v: ValueExpr): FieldState {
  if (v && typeof v === "object") {
    if ("cap" in v) return { source: "CAP", value: v.cap };
    if ("msg" in v) return { source: "MSG", value: v.msg };
  }
  return { source: "LIT", value: String(v) };
}

function toValueExpr(fs: FieldState): ValueExpr {
  if (fs.source === "CAP") return { cap: fs.value };
  if (fs.source === "MSG") return { msg: fs.value };
  return parseLiteral(fs.value);
}

export function SendActionForm({
  transitionIndex,
  triggerType,
  initial,
  onClose,
}: {
  transitionIndex: number;
  triggerType: string;
  initial?: SendAction;
  onClose: () => void;
}) {
  const body = useStore((s) => s.body);
  const level = useStore((s) => s.level);
  const available = useStore((s) => s.level.availableMessages) ?? NO_MESSAGES;
  const update = useStore((s) => s.updateTransition);

  // Sendable types = MA→FA messages available in this level.
  const sendable = useMemo(
    () => available.filter((m) => catalogEntry(m).direction === "MA->FA"),
    [available],
  );
  const [messageType, setMessageType] = useState<MessageTypeName>(
    initial?.message ?? sendable[0] ?? "MA_ControlRequestMT",
  );

  const fields = catalogEntry(messageType).fields;
  const initFieldStates = (): Record<string, FieldState> => {
    const out: Record<string, FieldState> = {};
    for (const f of fields) {
      const existing = initial && initial.message === messageType ? initial.fields[f.name] : undefined;
      if (existing !== undefined) out[f.name] = detectSource(existing);
      else out[f.name] = { source: "LIT", value: f.values?.[0] ?? "" };
    }
    return out;
  };
  const [fstate, setFstate] = useState<Record<string, FieldState>>(initFieldStates);

  const onChangeType = (mt: MessageTypeName) => {
    setMessageType(mt);
    const next: Record<string, FieldState> = {};
    for (const f of catalogEntry(mt).fields) next[f.name] = { source: "LIT", value: f.values?.[0] ?? "" };
    setFstate(next);
  };

  const setField = (name: string, patch: Partial<FieldState>) =>
    setFstate((s) => ({ ...s, [name]: { ...s[name]!, ...patch } }));

  /** Accept a dragged palette token ("cap:Key" / "msg:Field") onto a field value box. */
  const onDropToken = (name: string, raw: string) => {
    const [kind, ...rest] = raw.split(":");
    const val = rest.join(":");
    if (kind === "cap") setField(name, { source: "CAP", value: val });
    else if (kind === "msg") setField(name, { source: "MSG", value: val });
  };

  const caps = capEntries(body, level.capabilityId);
  const capProfile = findCapability(body, level.capabilityId)?.profile;
  const msgFields = isKnownMessageType(triggerType) ? catalogEntry(triggerType as MessageTypeName).fields : [];

  // --- validation: mirror FA (required populated + envelope) ---
  const errors: string[] = [];
  for (const f of fields) {
    const fs = fstate[f.name]!;
    if (f.required && fs.value.trim() === "") errors.push(`${f.name} required`);
  }
  const resolveNum = (name: string): number | undefined => {
    const fs = fstate[name];
    if (!fs || fs.value.trim() === "") return undefined;
    if (fs.source === "LIT") {
      const n = Number(fs.value);
      return Number.isNaN(n) ? undefined : n;
    }
    if (fs.source === "CAP") {
      const e = caps.find((c) => c.key === fs.value);
      return typeof e?.value === "number" ? e.value : undefined;
    }
    return undefined; // MSG resolves only at runtime
  };
  if (messageType === "MA_FlightCommandMT" && capProfile) {
    const alt = resolveNum("Altitude");
    if (alt !== undefined) {
      if (capProfile.maxAltitude !== undefined && alt > capProfile.maxAltitude) errors.push("Altitude > MaxAltitude");
      if (capProfile.minAltitude !== undefined && alt < capProfile.minAltitude) errors.push("Altitude < MinAltitude");
    }
    const spd = resolveNum("Speed");
    if (spd !== undefined) {
      if (capProfile.maxAirspeed !== undefined && spd > capProfile.maxAirspeed) errors.push("Speed > MaxAirspeed");
      if (capProfile.minAirspeed !== undefined && spd < capProfile.minAirspeed) errors.push("Speed < MinAirspeed");
    }
  }
  const valid = errors.length === 0;

  const onInsert = () => {
    if (!valid) return;
    const outFields: Record<string, ValueExpr> = {};
    for (const f of fields) {
      const fs = fstate[f.name]!;
      if (fs.value.trim() === "" && !f.required) continue;
      outFields[f.name] = toValueExpr(fs);
    }
    const action: SendAction = { kind: "send", message: messageType, fields: outFields };
    update(transitionIndex, { actions: [action] });
    onClose();
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <Panel title="SEND" titleAccent="ACTION" meta="COMPOSE MESSAGE">
          <div className="mbody">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
              <div className="frow">
                <span className="flbl">Message Type</span>
                <select value={messageType} onChange={(e) => onChangeType(e.target.value as MessageTypeName)}>
                  {sendable.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fieldlist">
                {fields.map((f) => {
                  const fs = fstate[f.name]!;
                  return (
                    <div className="fl-row" key={f.name}>
                      <span className="fl-name">
                        <Identifier name={f.name} />
                        {f.required && <span className="req">REQ</span>}
                        <span className="k-dim" style={{ fontSize: 9 }}>
                          {f.type}
                        </span>
                      </span>
                      <div className="seg">
                        {(["LIT", "CAP", "MSG"] as Source[]).map((src) => (
                          <button
                            key={src}
                            className={fs.source === src ? "on" : ""}
                            onClick={() => setField(f.name, { source: src, value: "" })}
                          >
                            {src}
                          </button>
                        ))}
                      </div>
                      {fs.source === "LIT" && f.values ? (
                        <select value={fs.value} onChange={(e) => setField(f.name, { value: e.target.value })}>
                          <option value="">—</option>
                          {f.values.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="field"
                          style={{ width: 130 }}
                          value={fs.value}
                          placeholder={fs.source === "LIT" ? "literal" : fs.source === "CAP" ? "cap.field" : "msg.field"}
                          onChange={(e) => setField(f.name, { value: e.target.value })}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            onDropToken(f.name, e.dataTransfer.getData("text/plain"));
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="palettes">
              <div className="palette cap">
                <div className="pt">Body Capabilities · cap.*</div>
                {caps.map((c) => (
                  <div
                    key={c.key}
                    className="pitem"
                    title="Drag onto a field value box (set its source to CAP first)"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", `cap:${c.key}`)}
                  >
                    <span className="pdot" />
                    cap.{c.key} <span className="k-dim" style={{ marginLeft: "auto" }}>{String(c.value)}</span>
                  </div>
                ))}
              </div>
              <div className="palette msg">
                <div className="pt">Captured Fields · msg.*</div>
                {msgFields.length === 0 && <div className="k-dim" style={{ fontSize: 9 }}>no trigger fields</div>}
                {msgFields.map((f) => (
                  <div
                    key={f.name}
                    className="pitem"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", `msg:${f.name}`)}
                  >
                    <span className="pdot" />
                    msg.{f.name}
                  </div>
                ))}
                <div className="k-dim" style={{ fontSize: 9, marginTop: 4 }}>
                  drag a token onto a field's value box (set its source to CAP/MSG first)
                </div>
              </div>
            </div>
          </div>
          <div className="mfoot">
            <span className={`vsum${valid ? "" : " bad"}`}>
              {valid
                ? "all required fields satisfied · values within advertised envelope"
                : errors.join(" · ")}
            </span>
            <div className="right">
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button className="btn on" onClick={onInsert} disabled={!valid}>
                Insert Action ▸
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
