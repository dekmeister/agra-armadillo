// Validator battery V1–V10 (PLAN_MVP S3). The two scripted compose beats produce
// exactly the two findings from the mock — with the corrected ENV HeaderType code,
// not the placeholder SCH-000164 (docs/02 lie #9) — and a fully-corrected
// composition returns []. Plus property-style UUID checks (V5/V6).
import {
  type Composition,
  classifyUuid,
  initialComposition,
  type Machine,
  validate,
} from "@normal-form/core";
import { sheet_1_1 } from "@normal-form/levels";
import { describe, expect, it } from "vitest";
import refMachine from "./reference/ref-1-1.json" with { type: "json" };

const ref = refMachine as Machine;
const CANONICAL_UUID = "f81d4fae-7dec-11d0-a765-00a0c91e6bf6";

const codes = (c: Composition) => validate(sheet_1_1, c).map((x) => x.code);
const ids = (c: Composition) => validate(sheet_1_1, c).map((x) => x.id);

describe("validator — the two scripted compose beats", () => {
  const initial = initialComposition(sheet_1_1, ref);

  it("produces exactly the two findings from the mock", () => {
    expect(ids(initial)).toEqual(["V1-systemid", "V5-uuid-invalid"]);
  });

  it("uses the corrected ENV HeaderType code, not SCH-000164", () => {
    const beat1 = validate(sheet_1_1, initial).find((x) => x.field === "SystemID")!;
    expect(beat1.code).toBe("ENV HeaderType");
    expect(beat1.message).toBe("MessageHeader missing required SystemID");
    expect(beat1.code).not.toContain("SCH-000164");
  });

  it("cites the UUID RQMT verbatim for the malformed CommandID", () => {
    const beat2 = validate(sheet_1_1, initial).find((x) => x.field === "CommandID")!;
    expect(beat2.code).toBe("RQMT USTD-000436");
    expect(beat2.message).toBe("CommandID is not a valid RFC-4122 UUID");
    expect(beat2.quote).toContain("Leach-Salz UUID variant (variant 1) or the nil UUID");
  });
});

describe("validator — a fully-corrected composition returns []", () => {
  it("clears once SystemID and CommandID are fixed", () => {
    const fixed: Composition = {
      ...initialComposition(sheet_1_1, ref),
      fields: {
        ...sheet_1_1.compose.initialFields,
        SystemID: "sys-alpha-01",
        CommandID: CANONICAL_UUID,
      },
    };
    expect(validate(sheet_1_1, fixed)).toEqual([]);
  });
});

describe("validator — per-rule", () => {
  const base = (): Composition => ({
    ...initialComposition(sheet_1_1, ref),
    fields: {
      ...sheet_1_1.compose.initialFields,
      SystemID: "sys-alpha-01",
      CommandID: CANONICAL_UUID,
    },
  });

  it("V2: rejects a non-ISO-8601 Timestamp", () => {
    expect(codes({ ...base(), fields: { ...base().fields, Timestamp: "yesterday" } })).toContain(
      "ENV HeaderType",
    );
  });

  it("V4: rejects a Mode outside MessageModeEnum", () => {
    const found = validate(sheet_1_1, { ...base(), fields: { ...base().fields, Mode: "TESTING" } });
    expect(found.some((x) => x.id === "V4-mode-enum")).toBe(true);
  });

  it("V7: rejects a CommandState outside CommandStateEnum", () => {
    const found = validate(sheet_1_1, {
      ...base(),
      fields: { ...base().fields, CommandState: "PENDING" },
    });
    expect(found.some((x) => x.id === "V7-commandstate")).toBe(true);
  });

  it("V8: rejects a request/response binding that breaks the *Command/*CommandStatus suffixes", () => {
    const found = validate(sheet_1_1, {
      ...base(),
      binding: { request: "TaskData", response: "TaskDataStatus" },
    });
    expect(found.some((x) => x.code === "CERT SCH-002461")).toBe(true);
  });

  it("V9: rejects an unbound role", () => {
    const found = validate(sheet_1_1, {
      ...base(),
      roles: { commander: "commander", commandee: null },
    });
    expect(found.some((x) => x.code === "CERT UNIS-000105")).toBe(true);
  });

  it("V10: rejects a machine with no handler for the reachable terminal state (ACCEPTED)", () => {
    const noAccepted: Machine = {
      initial: "s0",
      states: ["s0"],
      rules: [{ from: "s0", on: "RECEIVED", action: "wait" }],
    };
    const found = validate(sheet_1_1, { ...base(), machine: noAccepted });
    expect(found.some((x) => x.id === "V10-terminal-handler")).toBe(true);
  });
});

describe("validator — UUID property checks (V5/V6)", () => {
  it("accepts valid variant-1 UUIDs and the nil UUID", () => {
    expect(classifyUuid("f81d4fae-7dec-11d0-a765-00a0c91e6bf6")).toBe("ok"); // v1, variant a
    expect(classifyUuid("9c5b94b1-35ad-49bb-b118-8e8fc24abf80")).toBe("ok"); // v4, variant b
    expect(classifyUuid("00000000-0000-0000-0000-000000000000")).toBe("ok"); // nil
  });

  it("rejects a wrong-variant UUID as invalid (V5)", () => {
    expect(classifyUuid("f81d4fae-7dec-11d0-c765-00a0c91e6bf6")).toBe("invalid"); // variant c
  });

  it("flags a non-canonical (uppercase / braced) UUID (V6)", () => {
    expect(classifyUuid("F81D4FAE-7DEC-11D0-A765-00A0C91E6BF6")).toBe("noncanonical");
    expect(classifyUuid("{f81d4fae-7dec-11d0-a765-00a0c91e6bf6}")).toBe("noncanonical");
  });

  it("rejects unparseable strings as invalid (the beat value)", () => {
    expect(classifyUuid("f81d4fae-7dec-11d0-a765-00a0zzz")).toBe("invalid");
    expect(classifyUuid("")).toBe("invalid");
    expect(classifyUuid(null)).toBe("invalid");
  });
});
