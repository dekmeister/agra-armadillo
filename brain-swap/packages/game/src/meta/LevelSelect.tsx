// Level Select — five world columns (W0–W4). Playable levels (catalog `playable` flag, backed
// by the @brain-swap/levels registry) load on click via selectLevel; the rest are locked.
// Medals (T/B/R = Ticks / Bus / Rejections) bind to persisted best scores vs each level's par.
import { useStore } from "../store.ts";
import { WORLDS, type LevelEntry } from "./levelCatalog.ts";
import { levelById } from "@brain-swap/levels";
import { medals } from "./medals.ts";

export function LevelSelect() {
  const selectLevel = useStore((s) => s.selectLevel);
  const currentLevelId = useStore((s) => s.level.id);
  const best = useStore((s) => s.bestScores);

  const openLevel = (lv: LevelEntry) => {
    if (!lv.playable) return;
    selectLevel(lv.id);
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
                const m = medals(slot?.score, levelById(lv.id)?.level.pars);
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
                      {(["t", "b", "r"] as const).map((k) => (
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
