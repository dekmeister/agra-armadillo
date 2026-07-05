import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HowToPlay } from "../src/HowToPlay.tsx";
import { useGameStore } from "../src/store.ts";
import { UciReference } from "../src/UciReference.tsx";
import { WelcomeCard } from "../src/WelcomeCard.tsx";

describe("WS-D meta surfaces render", () => {
  it("WelcomeCard renders the verbatim standard self-description", () => {
    const html = renderToString(createElement(WelcomeCard));
    expect(html).toContain("messaging standard");
    expect(html).toContain("certification engineer");
  });

  it("HowToPlay renders all five sections", () => {
    const html = renderToString(createElement(HowToPlay));
    for (const h of [
      "The idea",
      "The screen",
      "The loop",
      "Reading the stamps",
      "The one big rule",
    ])
      expect(html).toContain(h);
  });

  it("UciReference renders all eight sections + catalog-bound content", () => {
    useGameStore.getState().openReference("pat-Command-2");
    const html = renderToString(createElement(UciReference));
    for (const s of [
      "What UCI is",
      "interaction patterns",
      "The envelope",
      "State enums",
      "Identity &amp; correlation",
      "The bus rules",
      "Concrete messages",
      "A-GRA bridge",
    ])
      expect(html, s).toContain(s);
    for (const p of [
      "Status-1",
      "Data-1",
      "DataRecord-1",
      "DataRequest-2",
      "ActionRequest-2",
      "Command-2",
    ])
      expect(html, p).toContain(`pat-${p}`);
    expect(html).toContain("TaskCommand");
    expect(html).toContain("enum-CommandProcessingStateEnum");
    expect(html).toContain("terminal");
  });
});
