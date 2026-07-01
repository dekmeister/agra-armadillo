/**
 * Shared, scenario-agnostic runtime helpers used by the engine and every
 * ScenarioDef. Pure: no DOM, no wall-clock, no ambient RNG (the only randomness is
 * the seeded Rng threaded through the engine). Keeping these here lets a level's
 * module spawn demand, log, and raise beats without reaching into the engine.
 */
import { enqueue, makeMsgId } from "./message.ts";
import type { ScenarioDef } from "./scenario-def.ts";
import type {
  Beat,
  BeatId,
  GameState,
  Link,
  LogEntry,
  Message,
  MessageType,
  NodeId,
  Role,
  SimNode,
} from "./types.ts";

export interface SpawnSpec {
  type: MessageType;
  cls: Message["cls"];
  route: string[];
  leg: Message["leg"];
  ixn?: string | null;
  priority?: number;
  deadlineTick?: number | null;
  approval?: Message["approval"];
  authorityVerified?: boolean;
}

/** Create + enqueue a message (PENDING on the first hop of its route). Returns it. */
export function spawn(s: GameState, spec: SpawnSpec): Message {
  const seq = s.nextSeq++;
  const msg: Message = {
    id: makeMsgId(
      spec.type === "MA_ApprovalRequestStatusMT" ? "reply" : spec.cls.toLowerCase(),
      seq,
    ),
    type: spec.type,
    cls: spec.cls,
    ixn: spec.ixn ?? null,
    leg: spec.leg,
    state: "PENDING",
    route: spec.route,
    hop: 0,
    seq,
    priority: spec.priority ?? 1,
    deadlineTick: spec.deadlineTick ?? null,
    approval: spec.approval ?? null,
    authorityVerified: spec.authorityVerified ?? false,
  };
  enqueue(s, msg);
  return msg;
}

export function log(s: GameState, text: string, severity: LogEntry["severity"]): void {
  s.log.push({ tick: s.tick, text, severity });
}

/** Raise a decision point the first time its condition fires (one pending at a time). */
export function raiseBeat(s: GameState, def: ScenarioDef, id: BeatId, focus?: Beat["focus"]): void {
  if (s.pendingBeat || s.seenBeats.includes(id)) return;
  const d = def.beats[id];
  if (!d) return;
  s.pendingBeat = { ...d, tick: s.tick, focus: focus ?? d.focus };
  s.seenBeats.push(id);
}

/** The node a message is addressed to (the `to` of the last link on its route). */
export function destNode(s: GameState, msg: Message): SimNode | undefined {
  const lastLink = s.links[msg.route[msg.route.length - 1] ?? ""];
  return lastLink ? s.nodes[lastLink.to] : undefined;
}

export function mkNode(
  id: string,
  kind: SimNode["kind"],
  role: Role,
  label: string,
  isLeader = false,
): SimNode {
  return { id, kind, role, label, isLeader };
}

export function mkLink(p: Partial<Link> & Pick<Link, "id" | "from" | "to" | "cls">): Link {
  return {
    bandwidthCap: 1,
    latency: 1,
    channel: "GOOD",
    pGoodToBad: 0.02,
    pBadToGood: 0.5,
    blockGood: 0.02,
    blockBad: 0.9,
    ackLoss: 0.05,
    policy: "fifo",
    queue: [],
    ...p,
  };
}

/**
 * Per-follower COP freshness (L5). Generalizes the single `cop` scalar to one value
 * per follower node: COP is one-to-many, so freshness is a per-recipient budget. Decays
 * every follower a step and flags `copBreached` if ANY follower drops below threshold.
 * No-op when `copFollowers` is undefined (levels using the scalar path are untouched).
 */
export function decayFollowers(s: GameState, decay: number, threshold: number): void {
  if (!s.copFollowers) return;
  for (const id of Object.keys(s.copFollowers)) {
    const next = Math.max(0, Math.round(((s.copFollowers[id] ?? 0) - decay) * 10) / 10);
    s.copFollowers[id] = next;
    if (next < threshold) s.copBreached = true;
  }
}

/** Refresh one follower's COP freshness (on a delivered COP sync). */
export function refreshFollower(s: GameState, id: NodeId, value: number): void {
  if (s.copFollowers && id in s.copFollowers) {
    s.copFollowers[id] = Math.max(s.copFollowers[id] ?? 0, value);
  }
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

// structuredClone is a host global (Node 17+ / browsers); declared here so the
// core stays free of @types/node and DOM libs (tsconfig `types: []`).
declare function structuredClone<T>(value: T): T;
