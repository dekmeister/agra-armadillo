// Level Select — five world columns (W0–W4). Only 1.2 is playable in this slice; medals
// (T/B/S = Ticks / Bus / Size) bind to persisted best scores vs the level par.
import { useStore } from "../store.ts";
import { WORLDS, type LevelEntry } from "./levelCatalog.ts";
import type { LevelPars, Score } from "@brain-swap/core";

type Medal = "gold" | "silver" | "none";

/** gold ≤ par, silver ≤ 1.5×par (or par+1), else unearned. */
function medal(value: number, par: number): Medal {
  if (value <= par) return "gold";
  if (value <= Math.max(par * 1.5, par + 1)) return "silver";
  return "none";
}

function medals(score: Score | undefined, pars: LevelPars | undefined): { t: Medal; b: Medal; s: Medal } {
  if (!score || !pars) return { t: "none", b: "none", s: "none" };
  return {
    t: medal(score.ticks, pars.ticks),
    b: medal(score.busTraffic, pars.busTraffic),
    s: medal(score.brainSize, pars.brainSize),
  };
}

export function LevelSelect() {
  const setView = useStore((s) => s.setView);
  const setMode = useStore((s) => s.setMode);
  const currentLevelId = useStore((s) => s.level.id);
  const pars = useStore((s) => s.level.pars);
  const best = useStore((s) => s.bestScores);

  const openLevel = (lv: LevelEntry) => {
    if (!lv.playable) return;
    setView("console");
    setMode("EDIT");
  };

  return (
    <div className="screen">
      <div className="worlds">
        {WORLDS.map((w) => {
          const cleared = w.levels.filter((l) => best[l.id]?.won).length;
          return (
            <div className="worldcol" key={w.no}>
              <div className="wh">
                <div className="wn">{w.no}</div>
                <div className="wname">{w.name}</div>
                <div className="wprog">{cleared}/{w.levels.length} CLEARED</div>
              </div>
              {w.levels.map((lv) => {
                const slot = best[lv.id];
                const m = lv.id === currentLevelId ? medals(slot?.score, pars) : { t: "none", b: "none", s: "none" } as const;
                const status = !lv.playable
                  ? "locked"
                  : slot?.won
                    ? "cleared"
                    : "▶ resume";
                return (
                  <div
                    key={lv.id}
                    className={`levelcard${lv.playable ? "" : " locked"}${lv.id === currentLevelId ? " current" : ""}`}
                    onClick={() => openLevel(lv)}
                  >
                    <div className="lid">{lv.id}</div>
                    <div className="lname">{lv.name}</div>
                    <div className="medals">
                      {(["t", "b", "s"] as const).map((k) => (
                        <span key={k} className={`medal ${m[k]}`}>{k.toUpperCase()}</span>
                      ))}
                    </div>
                    <div className="lstatus">{status}</div>
                    {lv.capstone && <div className="capstone">◆ Capstone · zero edits</div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
