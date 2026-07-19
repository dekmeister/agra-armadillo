/**
 * Board geometry invariants (WP4.2 / WP4.4 / WP4.6).
 *
 * `layout.ts` is pure geometry, so these run headless like the core tests. They exist
 * because the board's claims are TEACHING claims: "this traffic crosses the air" and
 * "this traffic does not" are assertions about A-GRA topology, and a hand-tuned rectangle
 * that drifts a few pixels turns one into the other. The two load-bearing assertions are
 * `every OTA rail is inside the field` and `every self-loop lobe is outside it`.
 */
import { createInitialState, SCENARIOS } from "@service-bus/core";
import { describe, expect, it } from "vitest";
import {
  alongLink,
  LAYOUTS,
  laneFor,
  type MeshHull,
  type NodeGeom,
  selfLoopBBox,
  selfLoopLabelPoint,
  stackFrac,
  TOKEN_SIDECAR,
} from "../src/lib/layout.ts";

const IDS = Object.keys(SCENARIOS);

/** viewBox as a rect. */
function viewRect(vb: string): { x: number; y: number; w: number; h: number } {
  const [x, y, w, h] = vb.split(/\s+/).map(Number) as [number, number, number, number];
  return { x, y, w, h };
}

function inside(
  r: { x: number; y: number; w: number; h: number },
  p: { x: number; y: number },
  slack = 0,
): boolean {
  return (
    p.x >= r.x - slack && p.x <= r.x + r.w + slack && p.y >= r.y - slack && p.y <= r.y + r.h + slack
  );
}

describe("board geometry", () => {
  it("covers every scenario", () => {
    expect(IDS.length).toBe(8);
    for (const id of IDS) expect(LAYOUTS[id], `no layout for ${id}`).toBeDefined();
  });

  it("gives every level an OTA field — all eight put traffic over the air", () => {
    for (const id of IDS) expect(LAYOUTS[id]?.mesh, `${id} has no mesh`).toBeDefined();
  });

  it("only calls the field a mesh where >= 3 platforms actually peer", () => {
    // Two platforms and one link is not a pub-sub mesh; saying so would imply peering
    // the topology does not have (CLAUDE.md guard rail).
    for (const id of IDS) {
      const layout = LAYOUTS[id];
      if (!layout?.mesh) continue;
      const platforms = Object.keys(layout.nodes).length;
      if (/mesh/i.test(layout.mesh.label)) {
        expect(platforms, `${id} labels a ${platforms}-node board a mesh`).toBeGreaterThanOrEqual(
          3,
        );
      }
    }
  });

  it("keeps every mesh hull inside its viewBox", () => {
    for (const id of IDS) {
      const layout = LAYOUTS[id];
      const m = layout?.mesh as MeshHull;
      if (!layout || !m) continue;
      const vb = viewRect(layout.viewBox);
      expect(inside(vb, { x: m.x, y: m.y }), `${id} hull top-left outside viewBox`).toBe(true);
      expect(
        inside(vb, { x: m.x + m.w, y: m.y + m.h }),
        `${id} hull bottom-right outside viewBox`,
      ).toBe(true);
    }
  });

  it("puts every OTA rail inside the field", () => {
    for (const id of IDS) {
      const layout = LAYOUTS[id];
      const m = layout?.mesh as MeshHull;
      if (!layout || !m) continue;
      const gs = createInitialState(1, { scenarioId: id });
      const links = Object.values(gs.links).map((l) => ({
        id: l.id,
        from: l.from,
        to: l.to,
        cls: l.cls,
      }));
      for (const l of links) {
        if (l.from === l.to) continue; // on-platform, asserted below
        const lane = laneFor(links, l.id);
        for (const t of [0, 0.5, 1]) {
          const p = alongLink(layout.nodes, l.from, l.to, t, lane);
          expect(inside(m, p), `${id}/${l.id} leaves the OTA field at t=${t}`).toBe(true);
        }
      }
    }
  });

  it("keeps every on-platform self-loop OUTSIDE the field", () => {
    // The whole of Phase 1/2's lesson. If this ever fails, the board is teaching that VI
    // crosses the contested air, which it does not.
    let checked = 0;
    for (const id of IDS) {
      const layout = LAYOUTS[id];
      const m = layout?.mesh as MeshHull;
      if (!layout || !m) continue;
      const gs = createInitialState(1, { scenarioId: id });
      for (const l of Object.values(gs.links)) {
        if (l.from !== l.to) continue;
        const n = layout.nodes[l.from] as NodeGeom;
        const box = selfLoopBBox(n);
        expect(box.x, `${id}/${l.id} lobe overlaps the OTA field`).toBeGreaterThanOrEqual(
          m.x + m.w,
        );
        checked++;
      }
    }
    expect(checked, "no self-loops exercised — phases 1 and 2 have VI loops").toBeGreaterThan(0);
  });

  it("keeps self-loop lobes and their captions inside the viewBox", () => {
    for (const id of IDS) {
      const layout = LAYOUTS[id];
      if (!layout) continue;
      const vb = viewRect(layout.viewBox);
      const gs = createInitialState(1, { scenarioId: id });
      for (const l of Object.values(gs.links)) {
        if (l.from !== l.to) continue;
        const n = layout.nodes[l.from] as NodeGeom;
        const box = selfLoopBBox(n);
        expect(inside(vb, { x: box.x + box.w, y: box.y }), `${id}/${l.id} lobe clipped`).toBe(true);
        // The caption runs ~90px right of its anchor at 10px/700.
        const cap = selfLoopLabelPoint(n);
        expect(cap.x + 90, `${id}/${l.id} caption clipped`).toBeLessThanOrEqual(vb.x + vb.w);
      }
    }
  });

  it("places every queue stack clear of every node circle", () => {
    // The postcondition, not the constant — `stackFrac` walks forward until this holds,
    // so this is what actually guarantees Phase 5's stacks clear ACP-1's rim.
    for (const id of IDS) {
      const layout = LAYOUTS[id];
      if (!layout) continue;
      const gs = createInitialState(1, { scenarioId: id });
      const links = Object.values(gs.links).map((l) => ({
        id: l.id,
        from: l.from,
        to: l.to,
        cls: l.cls,
      }));
      for (const l of links) {
        if (l.from === l.to) continue;
        const off = laneFor(links, l.id) + TOKEN_SIDECAR;
        const t = stackFrac(layout.nodes, l.from, l.to, off);
        const p = alongLink(layout.nodes, l.from, l.to, t, off);
        for (const [nid, n] of Object.entries(layout.nodes)) {
          const gap = Math.hypot(p.x - n.x, p.y - n.y) - n.r;
          expect(
            gap,
            `${id}/${l.id} stack overlaps ${nid} (gap ${gap.toFixed(1)})`,
          ).toBeGreaterThan(12);
        }
      }
    }
  });
});
