// MESSAGE COMPOSER (realtime). The player IS the MA brain: they hand-compose an MA→FA
// message and fire it onto the bus. Two steps: pick the message type (a keyboard
// typeahead over the level's sendable, MA→FA, types — the player won't know every name
// by heart), then fill its fields. Values are literals only (the player reads the
// telemetry/log and types what they want — there are no msg./cap. captures here, those
// were a state-machine concept). Validation mirrors FA exactly like the old send form:
// required fields populated + Altitude/Speed within the advertised envelope
// (packages/core/src/fa/validator.ts).
import { useMemo, useRef, useState } from "react";
import {
  catalogEntry,
  findCapability,
  type Message,
  type MessageTypeName,
} from "@brain-swap/core";
import { useStore } from "../store.ts";
import { Panel } from "../ui/Panel.tsx";
import { Identifier } from "../ui/Identifier.tsx";
import { parseLiteral } from "../sim/format.ts";
import { numericKeyDown, numericPaste } from "../ui/inputFilters.ts";

const NO_MESSAGES: readonly MessageTypeName[] = [];

export function MessageComposer() {
  const body = useStore((s) => s.body);
  const level = useStore((s) => s.level);
  const available = useStore((s) => s.level.availableMessages) ?? NO_MESSAGES;
  const submit = useStore((s) => s.submitComposer);
  const cancel = useStore((s) => s.cancelComposer);

  // Sendable = MA→FA messages the level exposes.
  const sendable = useMemo(
    () => available.filter((m) => catalogEntry(m).direction === "MA->FA"),
    [available],
  );

  const [messageType, setMessageType] = useState<MessageTypeName | null>(
    sendable.length === 1 ? sendable[0]! : null,
  );
  const [query, setQuery] = useState("");

  if (messageType === null) {
    return (
      <Typeahead
        sendable={sendable}
        query={query}
        setQuery={setQuery}
        onPick={(mt) => setMessageType(mt)}
        onCancel={cancel}
      />
    );
  }

  return (
    <FieldForm
      messageType={messageType}
      body={body}
      capabilityId={level.capabilityId}
      onBack={sendable.length > 1 ? () => setMessageType(null) : undefined}
      onCancel={cancel}
      onSend={(payload) => submit({ type: messageType, from: "MA", to: "FA", payload } as Message)}
    />
  );
}

function Typeahead({
  sendable,
  query,
  setQuery,
  onPick,
  onCancel,
}: {
  sendable: readonly MessageTypeName[];
  query: string;
  setQuery: (q: string) => void;
  onPick: (mt: MessageTypeName) => void;
  onCancel: () => void;
}) {
  const matches = useMemo(
    () => sendable.filter((m) => m.toLowerCase().includes(query.trim().toLowerCase())),
    [sendable, query],
  );
  const [hi, setHi] = useState(0);
  const idx = Math.min(hi, Math.max(0, matches.length - 1));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[idx]) onPick(matches[idx]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <Panel title="SEND" titleAccent="MESSAGE" meta="PICK MESSAGE TYPE">
          <div className="mbody" style={{ display: "block" }}>
            <input
              className="field"
              autoFocus
              style={{ width: "100%" }}
              placeholder="type to filter MA→FA messages…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHi(0);
              }}
              onKeyDown={onKeyDown}
            />
            <div className="fieldlist" style={{ marginTop: 8 }}>
              {matches.length === 0 && (
                <div className="k-dim" style={{ fontSize: 10, padding: 8 }}>
                  No sendable message matches “{query}”.
                </div>
              )}
              {matches.map((m, i) => (
                <button
                  key={m}
                  className={`fl-row pick${i === idx ? " on" : ""}`}
                  onClick={() => onPick(m)}
                  onMouseEnter={() => setHi(i)}
                >
                  <Identifier name={m} />
                  <span className="k-dim" style={{ marginLeft: "auto", fontSize: 9 }}>
                    {catalogEntry(m).summary ?? ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mfoot">
            <span className="vsum">↑/↓ to choose · Enter to select · Esc to cancel</span>
            <div className="right">
              <button className="btn" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function FieldForm({
  messageType,
  body,
  capabilityId,
  onBack,
  onCancel,
  onSend,
}: {
  messageType: MessageTypeName;
  body: import("@brain-swap/core").BodyProfile;
  capabilityId: string;
  onBack?: () => void;
  onCancel: () => void;
  onSend: (payload: Record<string, unknown>) => void;
}) {
  const fields = catalogEntry(messageType).fields;
  const init = useRef<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, f.values?.[0] ?? ""])),
  );
  const [values, setValues] = useState<Record<string, string>>(init.current);
  const setField = (name: string, value: string) => setValues((s) => ({ ...s, [name]: value }));

  const capProfile = findCapability(body, capabilityId)?.profile;

  // Validation mirrors FA: required populated + envelope on a flight command.
  const errors: string[] = [];
  for (const f of fields) {
    if (f.required && (values[f.name] ?? "").trim() === "") errors.push(`${f.name} required`);
  }
  const num = (name: string): number | undefined => {
    const v = values[name];
    if (!v || v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  };
  if (messageType === "MA_FlightCommandMT" && capProfile) {
    const alt = num("Altitude");
    if (alt !== undefined) {
      if (capProfile.maxAltitude !== undefined && alt > capProfile.maxAltitude) errors.push("Altitude > MaxAltitude");
      if (capProfile.minAltitude !== undefined && alt < capProfile.minAltitude) errors.push("Altitude < MinAltitude");
    }
    const spd = num("Speed");
    if (spd !== undefined) {
      if (capProfile.maxAirspeed !== undefined && spd > capProfile.maxAirspeed) errors.push("Speed > MaxAirspeed");
      if (capProfile.minAirspeed !== undefined && spd < capProfile.minAirspeed) errors.push("Speed < MinAirspeed");
    }
  }
  const valid = errors.length === 0;

  const send = () => {
    if (!valid) return;
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name] ?? "";
      if (v.trim() === "" && !f.required) continue;
      payload[f.name] = parseLiteral(v);
    }
    onSend(payload);
  };

  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <Panel title="SEND" titleAccent={messageType} meta="COMPOSE FIELDS">
          <div className="mbody" style={{ display: "block" }}>
            <div className="fieldlist">
              {fields.map((f) => (
                <div className="fl-row" key={f.name}>
                  <span className="fl-name">
                    <Identifier name={f.name} />
                    {f.required && <span className="req">REQ</span>}
                    <span className="k-dim" style={{ fontSize: 9 }}>
                      {f.type}
                    </span>
                  </span>
                  {f.values ? (
                    <select value={values[f.name] ?? ""} onChange={(e) => setField(f.name, e.target.value)}>
                      <option value="">—</option>
                      {f.values.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "boolean" ? (
                    <select value={values[f.name] ?? ""} onChange={(e) => setField(f.name, e.target.value)}>
                      <option value="">—</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : f.type === "number" ? (
                    <input
                      className="field"
                      style={{ width: 130 }}
                      value={values[f.name] ?? ""}
                      placeholder="number"
                      onChange={(e) => setField(f.name, e.target.value)}
                      onKeyDown={numericKeyDown}
                      onPaste={numericPaste}
                    />
                  ) : (
                    <input
                      className="field"
                      style={{ width: 130 }}
                      value={values[f.name] ?? ""}
                      placeholder="value"
                      onChange={(e) => setField(f.name, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="mfoot">
            <span className={`vsum${valid ? "" : " bad"}`}>
              {valid
                ? "all required fields satisfied · values within advertised envelope"
                : errors.join(" · ")}
            </span>
            <div className="right">
              {onBack && (
                <button className="btn" onClick={onBack}>
                  ◂ Type
                </button>
              )}
              <button className="btn" onClick={onCancel}>
                Cancel
              </button>
              <button className="btn on" onClick={send} disabled={!valid}>
                Send ▸
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
