import { REFERENCE } from "@normal-form/core";
import { SHEET_LIST } from "@normal-form/levels";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Epilogue } from "../src/Epilogue.tsx";

// Escape HTML the same way React does when serializing text, so recap lines with
// & / < / > (e.g. "returns data or runs a process") still match the rendered markup.
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

describe("WS-G epilogue debrief", () => {
  const html = renderToString(createElement(Epilogue));

  it("replays every sheet's recap line as a checklist", () => {
    expect(SHEET_LIST.length).toBeGreaterThan(0);
    for (const sheet of SHEET_LIST) {
      expect(html, `id ${sheet.id}`).toContain(sheet.id);
      expect(html, `recap ${sheet.id}`).toContain(esc(sheet.recap));
    }
  });

  it("renders the A-GRA bridge from the policed REFERENCE data", () => {
    expect(REFERENCE.bridge.length).toBe(6);
    for (const row of REFERENCE.bridge) {
      expect(html, `bridge ${row.primitive}`).toContain(row.primitive);
      expect(html, `bridge ${row.primitive} brainSwap`).toContain(esc(row.brainSwap));
    }
  });

  it("shows the three debrief sections and the sibling call-to-action", () => {
    expect(html).toContain("WHAT YOU PROVED");
    expect(html).toContain("A-GRA BRIDGE");
    expect(html).toContain("NOW PLAY THE SENTENCES");
    expect(html).toContain("Brain Swap");
    expect(html).toContain("Service Bus");
  });
});
