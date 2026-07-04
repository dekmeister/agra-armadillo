// RUN playback timer (handoff § State Management): while `playing`, advance the
// tick every `runSpeed` ms until the run's final tick, then stop. The interval is
// cleared on pause, reset, phase change (all flip `playing`/`tick` in the store),
// and unmount. Tick is read from the store at fire time to avoid a stale closure.
import { useEffect } from "react";
import { useGameStore } from "./store.ts";
import { useRun } from "./useRun.ts";

export function usePlayback() {
  const playing = useGameStore((s) => s.playing);
  const runSpeed = useGameStore((s) => s.runSpeed);
  const setTick = useGameStore((s) => s.setTick);
  const pause = useGameStore((s) => s.pause);
  const { endTick } = useRun();

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const { tick } = useGameStore.getState();
      if (tick >= endTick) {
        pause();
        return;
      }
      setTick(tick + 1);
    }, runSpeed);
    return () => clearInterval(id);
  }, [playing, runSpeed, endTick, setTick, pause]);
}
