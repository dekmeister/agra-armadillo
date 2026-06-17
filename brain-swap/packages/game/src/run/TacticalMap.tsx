// Tactical map — a PixiJS v8 scene driven by sim world state. Top-down, 2D only
// (fidelity lie #6: point-mass + altitude scalar). Position maps Longitude→x, Latitude→y
// (lie #6/#4); north (+y) is up, so screenY flips. Altitude is a gauge, never 3D.
//
// Camera: screenX = worldX*scale + offX ; screenY = -worldY*scale + offY. The user can
// pan (drag) and zoom (wheel) within clamped bounds; "Fit" resets to frame everything.
import { useEffect, useRef, useState } from "react";
import { Application, Graphics } from "pixi.js";
import { useStore } from "../store.ts";
import { Panel } from "../ui/Panel.tsx";
import { color, colorNum } from "../ui/tokens.ts";
import type { LevelDef, World, Zone } from "@brain-swap/core";

interface Bounds { minX: number; maxX: number; minY: number; maxY: number; }
interface Cam { scale: number; offX: number; offY: number; }

/** Zones to draw/frame for any objective kind (none for hold-control). */
function objectiveZones(level: LevelDef): readonly Zone[] {
  const o = level.objective;
  if (o.kind === "reach-hold") return [o.zone];
  if (o.kind === "waypoint-sequence") return o.waypoints.map((w) => w.zone);
  return [];
}

/** No-fly / threat circles to draw: the level's static `avoid` plus any live threats. */
function avoidZones(level: LevelDef, world: World): readonly Zone[] {
  return [...(level.avoid ?? []), ...world.threats.map((t) => t.zone)];
}

function worldBounds(
  level: LevelDef,
  startX: number,
  startY: number,
  vehX: number,
  vehY: number,
): Bounds {
  const margin = 250;
  const xs = [startX, vehX];
  const ys = [startY, vehY];
  // Frame objective zones and the level's static no-fly circles (live threats are
  // transient and not framed, so the camera stays steady as they come and go).
  for (const z of [...objectiveZones(level), ...(level.avoid ?? [])]) {
    xs.push(z.x - z.radius, z.x + z.radius);
    ys.push(z.y - z.radius, z.y + z.radius);
  }
  return {
    minX: Math.min(...xs) - margin,
    maxX: Math.max(...xs) + margin,
    minY: Math.min(...ys) - margin,
    maxY: Math.max(...ys) + margin,
  };
}

function fitScaleOf(b: Bounds, W: number, H: number): number {
  return Math.min(W / (b.maxX - b.minX), H / (b.maxY - b.minY)) * 0.92;
}
function fitCamera(b: Bounds, W: number, H: number): Cam {
  const scale = fitScaleOf(b, W, H);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { scale, offX: W / 2 - cx * scale, offY: H / 2 + cy * scale };
}
function clampPan(cam: Cam, b: Bounds, W: number, H: number): void {
  const loX = -b.maxX * cam.scale;
  const hiX = W - b.minX * cam.scale;
  cam.offX = loX <= hiX ? Math.min(Math.max(cam.offX, loX), hiX) : W / 2 - ((b.minX + b.maxX) / 2) * cam.scale;
  const loY = b.minY * cam.scale;
  const hiY = H + b.maxY * cam.scale;
  cam.offY = loY <= hiY ? Math.min(Math.max(cam.offY, loY), hiY) : H / 2 + ((b.minY + b.maxY) / 2) * cam.scale;
}

function dashedCircle(g: Graphics, cx: number, cy: number, r: number, col: number) {
  const segs = 48;
  for (let i = 0; i < segs; i += 2) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    g.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    g.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
  }
  g.stroke({ width: 1.5, color: col, alpha: 0.9 });
}

export function TacticalMapPanel() {
  const level = useStore((s) => s.level);
  const body = useStore((s) => s.body);
  const timeline = useStore((s) => s.timeline);
  const playhead = useStore((s) => s.playhead);
  const world = useStore((s) => s.world());

  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const gRef = useRef<Graphics | null>(null);
  const camRef = useRef<Cam | null>(null);
  const boundsRef = useRef<Bounds>(
    worldBounds(level, body.start.x, body.start.y, world.vehicle.x, world.vehicle.y),
  );
  const drawRef = useRef<() => void>(() => {});

  boundsRef.current = worldBounds(level, body.start.x, body.start.y, world.vehicle.x, world.vehicle.y);

  const size = (): { W: number; H: number } => {
    const app = appRef.current;
    return app ? { W: app.screen.width, H: app.screen.height } : { W: 1, H: 1 };
  };

  function draw() {
    const app = appRef.current;
    const g = gRef.current;
    if (!app || !g) return;
    const { W, H } = size();
    const b = boundsRef.current;
    if (!camRef.current) camRef.current = fitCamera(b, W, H);
    const cam = camRef.current;

    const sx = (x: number) => x * cam.scale + cam.offX;
    const sy = (y: number) => -y * cam.scale + cam.offY;

    g.clear();

    // faint world grid
    const step = 200;
    for (let x = Math.ceil(b.minX / step) * step; x <= b.maxX; x += step) {
      g.moveTo(sx(x), sy(b.maxY)).lineTo(sx(x), sy(b.minY));
    }
    for (let y = Math.ceil(b.minY / step) * step; y <= b.maxY; y += step) {
      g.moveTo(sx(b.minX), sy(y)).lineTo(sx(b.maxX), sy(y));
    }
    g.stroke({ width: 1, color: colorNum(color.line), alpha: 0.35 });

    // no-fly / threat zone(s) (dashed red circle, faint red fill) — drawn under the
    // objective so the green stays legible where they overlap.
    for (const z of avoidZones(level, world)) {
      g.circle(sx(z.x), sy(z.y), z.radius * cam.scale).fill({ color: colorNum(color.warn), alpha: 0.08 });
      dashedCircle(g, sx(z.x), sy(z.y), z.radius * cam.scale, colorNum(color.warn));
    }

    // objective zone(s) (dashed green circle) + center cross
    for (const z of objectiveZones(level)) {
      dashedCircle(g, sx(z.x), sy(z.y), z.radius * cam.scale, colorNum(color.green));
      g.moveTo(sx(z.x) - 5, sy(z.y)).lineTo(sx(z.x) + 5, sy(z.y));
      g.moveTo(sx(z.x), sy(z.y) - 5).lineTo(sx(z.x), sy(z.y) + 5);
      g.stroke({ width: 1, color: colorNum(color.green), alpha: 0.7 });
    }

    // trail: dotted cyan dots at each frame up to playhead
    const upto = Math.min(playhead, timeline.length - 1);
    for (let i = 0; i <= upto; i += 1) {
      const v = (timeline[i] as World).vehicle;
      g.circle(sx(v.x), sy(v.y), 1.6).fill({ color: colorNum(color.cyan), alpha: 0.5 });
    }

    // aircraft: a small triangle pointing along heading (0=north/up)
    const v = world.vehicle;
    const ax = sx(v.x);
    const ay = sy(v.y);
    const hdg = (v.heading * Math.PI) / 180;
    const fx = Math.sin(hdg);
    const fy = -Math.cos(hdg);
    const px = -fy;
    const py = fx;
    const L = 9;
    const Wd = 5;
    g.poly([
      ax + fx * L, ay + fy * L,
      ax - fx * L * 0.5 + px * Wd, ay - fy * L * 0.5 + py * Wd,
      ax - fx * L * 0.5 - px * Wd, ay - fy * L * 0.5 - py * Wd,
    ]).fill({ color: colorNum(color.cyan) });
  }

  // Keep a stable ref to the latest draw closure for event handlers.
  drawRef.current = draw;

  // Create the Pixi app once; wire pan/zoom on its canvas. StrictMode-safe.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let initialized = false;
    let ro: ResizeObserver | null = null;
    const app = new Application();
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camRef.current;
      if (!cam) return;
      const { W, H } = size();
      const fit = fitScaleOf(boundsRef.current, W, H);
      const rect = app.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newScale = Math.min(Math.max(cam.scale * factor, fit * 0.6), fit * 14);
      const wx = (mx - cam.offX) / cam.scale;
      const wy = (cam.offY - my) / cam.scale;
      cam.scale = newScale;
      cam.offX = mx - wx * newScale;
      cam.offY = my + wy * newScale;
      clampPan(cam, boundsRef.current, W, H);
      drawRef.current();
    };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      app.canvas.setPointerCapture(e.pointerId);
      app.canvas.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      const cam = camRef.current;
      if (cam) {
        const rect = app.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wx = (mx - cam.offX) / cam.scale;
        const wy = (cam.offY - my) / cam.scale;
        setCursor({ x: wx, y: wy });
      }
      if (!dragging) return;
      if (!cam) return;
      cam.offX += e.clientX - lastX;
      cam.offY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const { W, H } = size();
      clampPan(cam, boundsRef.current, W, H);
      drawRef.current();
    };
    const onLeave = () => setCursor(null);
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try {
        app.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      app.canvas.style.cursor = "grab";
    };

    app
      .init({
        background: colorNum(color.black),
        antialias: true,
        resizeTo: host,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      .then(() => {
        initialized = true;
        if (cancelled) {
          app.destroy(true, { children: true });
          return;
        }
        host.appendChild(app.canvas);
        app.canvas.style.cursor = "grab";
        app.canvas.style.touchAction = "none";
        const g = new Graphics();
        app.stage.addChild(g);
        appRef.current = app;
        gRef.current = g;
        app.canvas.addEventListener("wheel", onWheel, { passive: false });
        app.canvas.addEventListener("pointerdown", onDown);
        app.canvas.addEventListener("pointermove", onMove);
        app.canvas.addEventListener("pointerup", onUp);
        app.canvas.addEventListener("pointercancel", onUp);
        app.canvas.addEventListener("pointerleave", onLeave);
        // Re-fit when the panel resizes so the world stays framed by default.
        // Pixi's `resizeTo` only auto-resizes on window resize, so resize the
        // renderer to the host explicitly when the element's box changes (e.g.
        // the mission/spec cards collapsing grows this panel).
        ro = new ResizeObserver(() => {
          app.resize();
          camRef.current = null;
          drawRef.current();
        });
        ro.observe(host);
        draw();
      })
      .catch(() => {
        /* init aborted (unmounted mid-init) */
      });
    return () => {
      cancelled = true;
      ro?.disconnect();
      if (initialized) {
        app.destroy(true, { children: true });
        appRef.current = null;
        gRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw on data / playhead change (camera is preserved).
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playhead, timeline, level, body, world]);

  const fitView = () => {
    const { W, H } = size();
    camRef.current = fitCamera(boundsRef.current, W, H);
    draw();
  };

  // Snap the camera onto the aircraft at a moderate zoom (closer than Fit). Mirrors
  // fitCamera's offset formula; deliberately no clampPan so the aircraft stays centred.
  const centreView = () => {
    const { W, H } = size();
    const fit = fitScaleOf(boundsRef.current, W, H);
    const scale = Math.min(Math.max(fit * 3, fit * 0.6), fit * 14);
    const v = world.vehicle;
    camRef.current = { scale, offX: W / 2 - v.x * scale, offY: H / 2 + v.y * scale };
    draw();
  };

  // Altitude tape (HTML overlay): commanded vs actual against the body envelope.
  const cmdAlt = world.vehicle.target?.altitude;
  const actAlt = world.vehicle.altitude;
  const cap = body.capabilities.find((c) => c.id === level.capabilityId)?.profile;
  const aMax = cap?.maxAltitude ?? 12000;
  const aMin = cap?.minAltitude ?? 0;
  const altPct = (a: number) => `${(1 - (a - aMin) / (aMax - aMin)) * 100}%`;
  const ticks = [aMax, aMax * 0.75, aMax * 0.5, aMax * 0.25].map(Math.round);

  return (
    <Panel title="TACTICAL" titleAccent="MAP" className="grow">
      <div className="map-wrap" data-tour="map">
        <div className="map-canvas" ref={hostRef} />
        {world.outcome !== "running" && (
          <div className={`map-verdict ${world.outcome === "won" ? "pass" : "fail"}`}>
            {world.outcome === "won" ? "PASS" : "FAIL"}
          </div>
        )}
        <button className="btn sm map-centre" onClick={centreView} title="Centre on the aircraft">
          ✛ Centre
        </button>
        <button className="btn sm map-fit" onClick={fitView} title="Frame the whole mission area">
          ⤢ Fit
        </button>
        <div className="alt-tape">
          {ticks.map((t) => (
            <span key={t} className="atick" style={{ top: altPct(t) }}>
              {Math.round(t / 1000)}k
            </span>
          ))}
          {cmdAlt !== undefined && (
            <span className="amark cmd" style={{ top: altPct(cmdAlt) }} title={`CMD ${cmdAlt} m`} />
          )}
          <span className="amark act" style={{ top: altPct(actAlt) }} title={`ACT ${Math.round(actAlt)} m`} />
        </div>
        {cursor !== null && (
          <div className="map-coords">
            LAT {cursor.y.toFixed(0)} · LON {cursor.x.toFixed(0)}
          </div>
        )}
        
      </div>
    </Panel>
  );
}
