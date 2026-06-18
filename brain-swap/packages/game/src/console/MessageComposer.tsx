// MESSAGE COMPOSER (realtime). The player IS the MA brain: they hand-compose an MA→FA
// message and fire it onto the bus. Two steps: pick the message type (a keyboard
// typeahead over the level's sendable, MA→FA, types — the player won't know every name
// by heart), then fill its fields. Values are literals only (the player reads the
// telemetry/log and types what they want — there are no msg./cap. captures here, those
// were a state-machine concept). Only required-field presence is validated client-side;
// envelope violations are deliberately allowed through so FA can reject them, teaching
// the player to recognise and handle REJECTED responses.

import {
  catalogEntry,
  type Message,
  type MessageLogEntry,
  type MessageTypeName,
} from "@brain-swap/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseLiteral } from "../sim/format.ts";
import { useStore } from "../store.ts";
import { Identifier } from "../ui/Identifier.tsx";
import { numericKeyDown, numericPaste } from "../ui/inputFilters.ts";
import { Panel } from "../ui/Panel.tsx";

const NO_MESSAGES: readonly MessageTypeName[] = [];

/** The CapabilityID MA currently holds control of (latest ControlStatusMT naming MA as
 * SecondaryController), or undefined before control has been taken. Used to prefill the
 * CapabilityID field once the player has acquired an aircraft — they type it the first time. */
function controlledCapabilityId(log: readonly MessageLogEntry[]): string | undefined {
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i]!.type !== "ControlStatusMT") continue;
    const p = log[i]!.payload as Record<string, unknown>;
    return p.SecondaryController === "MA" ? (p.CapabilityID as string) : undefined;
  }
  return undefined;
}

export function MessageComposer() {
  const body = useStore((s) => s.body);
  const level = useStore((s) => s.level);
  const available = useStore((s) => s.level.availableMessages) ?? NO_MESSAGES;
  const submit = useStore((s) => s.submitComposer);
  const cancel = useStore((s) => s.cancelComposer);
  const commandSeq = useStore((s) => s.commandSeq);
  const world = useStore((s) => s.world());
  const heldCapId = useMemo(() => controlledCapabilityId(world.log), [world.log]);

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
      commandSeq={commandSeq}
      heldCapabilityId={heldCapId}
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
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop scrim; Escape cancels and the Cancel button is the keyboard control
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop scrim; Escape cancels and the Cancel button is the keyboard control
    <div className="modal-scrim" onClick={onCancel}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops backdrop dismiss on inner clicks; not an interactive control */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops backdrop dismiss on inner clicks; not an interactive control */}
      <div className="modal" data-tour="composer" onClick={(e) => e.stopPropagation()}>
        <Panel title="SEND" titleAccent="MESSAGE" meta="PICK MESSAGE TYPE">
          <div className="mbody" style={{ display: "block" }}>
            <input
              className="field"
              // biome-ignore lint/a11y/noAutofocus: intentional — the composer must be ready to type immediately
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
                  type="button"
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
              <button type="button" className="btn" onClick={onCancel}>
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
  body: _body,
  capabilityId: _capabilityId,
  commandSeq,
  heldCapabilityId,
  onBack,
  onCancel,
  onSend,
}: {
  messageType: MessageTypeName;
  body: import("@brain-swap/core").BodyProfile;
  capabilityId: string;
  commandSeq: number;
  heldCapabilityId?: string;
  onBack?: () => void;
  onCancel: () => void;
  onSend: (payload: Record<string, unknown>) => void;
}) {
  const fields = catalogEntry(messageType).fields;
  // Prefill the IDs that are pure bookkeeping for the player: CommandID auto-increments
  // (CMD-1, CMD-2, …); CapabilityID is filled once control has been taken (they type it the
  // first time, on the control request, when heldCapabilityId is still undefined).
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((f) => {
        if (f.name === "CommandID") return [f.name, `CMD-${commandSeq}`];
        if (f.name === "CapabilityID" && heldCapabilityId) return [f.name, heldCapabilityId];
        return [f.name, f.values?.[0] ?? ""];
      }),
    ),
  );
  const setField = (name: string, value: string) => setValues((s) => ({ ...s, [name]: value }));

  // Active field: indicated in the form and focused for typing. Up/down cycles it, and
  // clicking anywhere in a row activates it. Refs let arrow-nav / clicks move focus.
  const [active, setActive] = useState(0);
  const fieldRefs = useRef<(HTMLInputElement | HTMLSelectElement | null)[]>([]);
  useEffect(() => {
    fieldRefs.current[active]?.focus();
  }, [active]);
  const moveActive = (delta: number) =>
    setActive((a) => (a + delta + fields.length) % fields.length);

  // Bumped on each rejected Enter to re-trigger the "mandatory items" flash (key remount).
  const [flashTick, setFlashTick] = useState(0);

  // Only block on missing required fields — envelope violations are FA's job to reject.
  const errors: string[] = [];
  for (const f of fields) {
    if (f.required && (values[f.name] ?? "").trim() === "") errors.push(`${f.name} required`);
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

  // Enter sends (when valid) or flashes the mandatory-items summary; Escape steps back to
  // the message-type picker (or cancels when there is no picker); up/down cycle fields.
  const onFormKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      // Let a focused footer button handle its own Enter (it fires onClick) to avoid a double-send.
      if ((e.target as HTMLElement).tagName === "BUTTON") return;
      e.preventDefault();
      if (valid) send();
      else setFlashTick((t) => t + 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      (onBack ?? onCancel)();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop scrim; Escape cancels and the Cancel button is the keyboard control
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop scrim; Escape cancels and the Cancel button is the keyboard control
    <div className="modal-scrim" onClick={onCancel}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stops backdrop dismiss on inner clicks; keyboard handled by onKeyDown */}
      <div
        className="modal"
        data-tour="composer"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onFormKey}
      >
        <Panel title="SEND" titleAccent={messageType} meta="COMPOSE FIELDS">
          <div className="mbody" style={{ display: "block" }}>
            <div className="fieldlist">
              {fields.map((f, i) => (
                // biome-ignore lint/a11y/noStaticElementInteractions: layout row wrapping the real form controls (select/input); click is a convenience mirroring their onFocus
                // biome-ignore lint/a11y/useKeyWithClickEvents: layout row wrapping the real form controls (select/input); click is a convenience mirroring their onFocus
                <div
                  className={`fl-row${i === active ? " active" : ""}`}
                  key={f.name}
                  onClick={() => setActive(i)}
                >
                  <span className="fl-name">
                    <Identifier name={f.name} />
                    {f.required && <span className="req">REQ</span>}
                    <span className="k-dim" style={{ fontSize: 9 }}>
                      {f.type}
                    </span>
                  </span>
                  {f.values ? (
                    <select
                      ref={(el) => (fieldRefs.current[i] = el)}
                      value={values[f.name] ?? ""}
                      onChange={(e) => setField(f.name, e.target.value)}
                      onFocus={() => setActive(i)}
                    >
                      <option value="">—</option>
                      {f.values.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "boolean" ? (
                    <select
                      ref={(el) => (fieldRefs.current[i] = el)}
                      value={values[f.name] ?? ""}
                      onChange={(e) => setField(f.name, e.target.value)}
                      onFocus={() => setActive(i)}
                    >
                      <option value="">—</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : f.type === "number" ? (
                    <input
                      ref={(el) => (fieldRefs.current[i] = el)}
                      className="field"
                      style={{ width: 130 }}
                      value={values[f.name] ?? ""}
                      placeholder="number"
                      onChange={(e) => setField(f.name, e.target.value)}
                      onKeyDown={numericKeyDown}
                      onPaste={numericPaste}
                      onFocus={() => setActive(i)}
                    />
                  ) : (
                    <input
                      ref={(el) => (fieldRefs.current[i] = el)}
                      className="field"
                      style={{ width: 130 }}
                      value={values[f.name] ?? ""}
                      placeholder="value"
                      onChange={(e) => setField(f.name, e.target.value)}
                      onFocus={() => setActive(i)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="mfoot">
            <span
              key={flashTick}
              className={`vsum${valid ? "" : " bad"}${flashTick > 0 && !valid ? " flash" : ""}`}
            >
              {valid ? "all required fields satisfied" : errors.join(" · ")}
            </span>
            <div className="right">
              {onBack && (
                <button type="button" className="btn" onClick={onBack}>
                  ◂ Type [Esc]
                </button>
              )}
              <button type="button" className="btn" onClick={onCancel}>
                {onBack ? "Cancel" : "Cancel [Esc]"}
              </button>
              <button type="button" className="btn on" onClick={send} disabled={!valid}>
                Send ▸ [↵]
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
