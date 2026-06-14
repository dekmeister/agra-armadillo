// StatusStrip (30px): RunLamp + four MetricReadouts (live, vs level pars).
import { useMemo } from "react";
import { scoreWorld, type LevelPars } from "@brain-swap/core";
import { useStore } from "../store.ts";

interface MetricSpec {
  key: keyof LevelPars;
  label: string;
  value: number;
  par?: number;
}

export function StatusStrip() {
  const running = useStore((s) => s.running);
  const mode = useStore((s) => s.mode);
  // Select the stable world snapshot, then derive the score in render. Computing the
  // score inside the selector would return a new object every call and trip
  // useSyncExternalStore's "getSnapshot should be cached" infinite-loop guard.
  const world = useStore((s) => s.world());
  const score = useMemo(() => scoreWorld(world), [world]);
  const pars = useStore((s) => s.level.pars);

  const lampLabel = running ? "RUN · SIMULATING" : mode === "RUN" ? "RUN · PAUSED" : "EDIT · HALTED";

  const metrics: MetricSpec[] = [
    { key: "ticks", label: "Ticks", value: score.ticks, par: pars?.ticks },
    { key: "busTraffic", label: "Bus Traffic", value: score.busTraffic, par: pars?.busTraffic },
    { key: "rejections", label: "Rejections", value: score.rejections, par: pars?.rejections },
    { key: "brainSize", label: "Brain Size", value: score.brainSize, par: pars?.brainSize },
  ];

  return (
    <div className="status">
      <div className={`runlamp${running ? " on" : ""}`}>
        <span className="dot" />
        <span className="lbl">{lampLabel}</span>
      </div>
      <div className="metrics">
        {metrics.map((m) => {
          const over = m.par !== undefined && m.value > m.par;
          return (
            <div key={m.key} className={`metric${over ? " alert" : ""}`}>
              <span className="lbl">{m.label}</span>
              <span className="val">{m.value}</span>
              {m.par !== undefined && <span className="par">/ par {m.par}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
