// The sheet registry is the ordered source of truth for the lineup + progression
// flow (WS-C). These pin the invariants the game leans on: the list is id-ordered
// and non-empty, every entry is addressable by its own id, and `nextSheetId`
// walks the order (undefined past the end) — the CERTIFIED → next-sheet unlock.
import { FIRST_SHEET_ID, getSheet, nextSheetId, SHEET_LIST, SHEETS } from "@normal-form/levels";
import { describe, expect, it } from "vitest";

describe("sheet registry", () => {
  it("is non-empty and every sheet is addressable by its id", () => {
    expect(SHEET_LIST.length).toBeGreaterThan(0);
    for (const sheet of SHEET_LIST) {
      expect(getSheet(sheet.id)).toBe(sheet);
      expect(SHEETS[sheet.id]).toBe(sheet);
    }
  });

  it("ids are unique", () => {
    const ids = SHEET_LIST.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("FIRST_SHEET_ID is the head of the lineup", () => {
    expect(FIRST_SHEET_ID).toBe(SHEET_LIST[0]?.id);
  });

  it("nextSheetId walks the order and returns undefined past the end", () => {
    for (let i = 0; i < SHEET_LIST.length; i++) {
      const here = SHEET_LIST[i]!.id;
      const expected = SHEET_LIST[i + 1]?.id;
      expect(nextSheetId(here)).toBe(expected);
    }
    expect(nextSheetId("no-such-sheet")).toBeUndefined();
  });

  it("registers World 0 then World 1 in order", () => {
    expect(SHEET_LIST.map((s) => s.id).slice(0, 7)).toEqual([
      "0-1",
      "0-2",
      "0-3",
      "1-1",
      "1-2",
      "1-3",
      "1-4",
    ]);
    expect(nextSheetId("0-1")).toBe("0-2");
    expect(nextSheetId("0-2")).toBe("0-3");
    expect(nextSheetId("0-3")).toBe("1-1");
    expect(nextSheetId("1-1")).toBe("1-2");
    expect(nextSheetId("1-2")).toBe("1-3");
    expect(nextSheetId("1-3")).toBe("1-4");
  });
});
