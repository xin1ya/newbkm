/**
 * M1-16 · 任务运行时纯函数：追踪选择、进度差异（用于通知）、奖励发放、罗盘方位。
 * 不依赖 DOM / three；场景侧的 QuestDirector 负责监听事件并调用这里。
 */
import type { Dex } from '../data/Dex';
import { createPokemon } from '../pokemon/Pokemon';
import { GIFT_SHINY_CHANCE } from '../pokemon/judge';
import type { Rng } from '../rng';
import { addItem, addMoney, receivePokemon, setFlag, type GameState, type IslandId } from '../state/GameState';
import { currentObjective, questStatus, type QuestRegistry } from './index';
import type { Flags, Quest, QuestMarker, QuestObjective, QuestStatus } from './types';

// ——————————————————— 追踪 ———————————————————

/** 追踪设置的特殊值：玩家主动取消追踪 */
export const TRACK_NONE = 'none';

const CATEGORY_ORDER: Record<Quest['category'], number> = { main: 0, side: 1, hidden: 2 };

/**
 * 当前应追踪的任务：玩家指定且仍在进行 → 该任务；取消追踪 → null；
 * 否则自动选择（主线优先，其次支线，同类按注册顺序）。
 */
export function resolveTracked(registry: QuestRegistry, flags: Flags, preferred: string | null): Quest | null {
  if (preferred === TRACK_NONE) return null;
  if (preferred) {
    const q = registry.get(preferred);
    if (q && questStatus(q, flags) === 'active') return q;
  }
  const active = registry.getActiveQuests(flags);
  return [...active].sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category])[0] ?? null;
}

// ——————————————————— 进度与通知 ———————————————————

export interface QuestSnapshot {
  status: QuestStatus;
  /** 当前目标下标（全部完成 = objectives.length） */
  objective: number;
}

export type QuestProgress = Record<string, QuestSnapshot>;

export function snapshotQuests(registry: QuestRegistry, flags: Flags): QuestProgress {
  const out: QuestProgress = {};
  for (const q of registry.all) {
    const cur = currentObjective(q, flags);
    out[q.id] = { status: questStatus(q, flags), objective: cur ? q.objectives.indexOf(cur) : q.objectives.length };
  }
  return out;
}

export type QuestNotice =
  | { kind: 'available'; quest: Quest }
  | { kind: 'started'; quest: Quest }
  | { kind: 'objective'; quest: Quest; done: QuestObjective; next: QuestObjective | null }
  | { kind: 'completed'; quest: Quest };

/**
 * 前后两次快照的差异 → 通知列表（按注册顺序）。
 * - locked → available：可接取（只对有 startNpc 的支线提示）
 * - → active：任务开始
 * - active 中当前目标前进：目标完成（可能一次跳过多个，逐个通知）
 * - → completed：任务完成（之前在进行中的目标不再单独通知）
 */
export function diffProgress(registry: QuestRegistry, prev: QuestProgress, next: QuestProgress): QuestNotice[] {
  const out: QuestNotice[] = [];
  for (const q of registry.all) {
    const a = prev[q.id];
    const b = next[q.id];
    if (!a || !b) continue;
    if (b.status === 'completed') {
      if (a.status !== 'completed') out.push({ kind: 'completed', quest: q });
      continue;
    }
    if (b.status === 'available' && a.status === 'locked' && q.startNpc && q.category !== 'hidden') out.push({ kind: 'available', quest: q });
    if (b.status === 'active' && a.status !== 'active') out.push({ kind: 'started', quest: q });
    if (b.status === 'active' && a.status === 'active' && b.objective > a.objective) {
      for (let i = a.objective; i < b.objective; i++) {
        out.push({ kind: 'objective', quest: q, done: q.objectives[i]!, next: q.objectives[b.objective] ?? null });
      }
    }
  }
  return out;
}

// ——————————————————— 奖励 ———————————————————

/** 奖励已发放的记录 flag（防止读档 / 重复触发时重复发放） */
export const rewardFlag = (questId: string): string => `quest-rewarded:${questId}`;

export interface RewardLine {
  kind: 'item' | 'money' | 'ability' | 'pokemon';
  id: string;
  qty: number;
}

/** 奖励明细（日志展示与发放共用） */
export function rewardLines(q: Quest): RewardLine[] {
  const r = q.reward;
  if (!r) return [];
  const out: RewardLine[] = [];
  for (const it of r.items ?? []) out.push({ kind: 'item', id: it.id, qty: it.qty });
  if (r.money) out.push({ kind: 'money', id: 'money', qty: r.money });
  if (r.hm) out.push({ kind: 'ability', id: r.hm, qty: 1 });
  if (r.pokemon) out.push({ kind: 'pokemon', id: String(r.pokemon), qty: r.pokemonLevel ?? 10 });
  return out;
}

/**
 * 发放已完成任务的奖励（每个任务只发一次）。返回实际发放的明细；已发过返回 null。
 * 宝可梦奖励按队伍 / 盒子规则接收。
 */
export function grantReward(dex: Dex, s: GameState, q: Quest, rng: Rng): RewardLine[] | null {
  if (s.flags[rewardFlag(q.id)]) return null;
  if (!s.flags[q.completeFlag]) return null;
  const lines = rewardLines(q);
  for (const l of lines) {
    if (l.kind === 'item') addItem(s, l.id, l.qty);
    else if (l.kind === 'money') addMoney(s, l.qty);
    else if (l.kind === 'ability') setFlag(s, l.id);
    else if (l.kind === 'pokemon') receivePokemon(s, createPokemon(dex, Number(l.id), l.qty, rng, { ot: s.player.name, shiny: rng.chance(GIFT_SHINY_CHANCE) }));
  }
  setFlag(s, rewardFlag(q.id));
  return lines;
}

/** 已完成但未发奖励的任务（读档后补发、剧情直接置位 completeFlag 的情况） */
export function unrewarded(registry: QuestRegistry, flags: Flags): Quest[] {
  return registry.all.filter((q) => flags[q.completeFlag] && !flags[rewardFlag(q.id)]);
}

// ——————————————————— 计数目标 ———————————————————

export function objectiveProgress(o: QuestObjective, vars: Readonly<Record<string, number>>): { current: number; target: number } | null {
  if (!o.counter) return null;
  return { current: Math.min(o.counter.target, Math.max(0, Math.floor(vars[o.counter.var] ?? 0))), target: o.counter.target };
}

/** 计数达到目标时应置位的目标 flag（只看进行中任务的当前目标） */
export function counterCompletions(registry: QuestRegistry, flags: Flags, vars: Readonly<Record<string, number>>): string[] {
  const out: string[] = [];
  for (const q of registry.getActiveQuests(flags)) {
    const o = currentObjective(q, flags);
    const p = o && objectiveProgress(o, vars);
    if (o && p && p.current >= p.target) out.push(o.completeFlag);
  }
  return out;
}

// ——————————————————— 标记与罗盘 ———————————————————

export const ISLAND_NAMES: Record<IslandId, string> = {
  sprout: '萌芽群岛',
  tide: '碧潮群岛',
  thunder: '雷鸣群岛',
  glaze: '未开放的岛屿',
  secret: '未开放的岛屿',
};

export interface MarkerTarget {
  island: IslandId;
  x: number;
  z: number;
  /** 搜索范围半径（0 = 精确点） */
  radius: number;
  /** 区域标记（zoneId）：到达区域即视为抵达 */
  zoneId: string | null;
}

/** 把标记解析为平面坐标；区域标记用 zoneCenter 取多边形中心（找不到区域返回 null） */
export function resolveMarker(m: QuestMarker, zoneCenter: (zoneId: string) => { x: number; z: number } | null): MarkerTarget | null {
  if (m.position) return { island: m.island, x: m.position[0], z: m.position[2], radius: m.radius ?? 0, zoneId: m.zoneId ?? null };
  if (m.zoneId) {
    const c = zoneCenter(m.zoneId);
    if (!c) return null;
    return { island: m.island, x: c.x, z: c.z, radius: m.radius ?? 0, zoneId: m.zoneId };
  }
  return null;
}

/** 多边形面积重心（退化时取顶点平均） */
export function polygonCentroid(poly: readonly (readonly [number, number])[]): { x: number; z: number } {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i]!;
    const [x1, z1] = poly[(i + 1) % poly.length]!;
    const f = x0 * z1 - x1 * z0;
    a += f;
    cx += (x0 + x1) * f;
    cz += (z0 + z1) * f;
  }
  if (Math.abs(a) < 1e-6) {
    const n = poly.length || 1;
    return { x: poly.reduce((s, p) => s + p[0], 0) / n, z: poly.reduce((s, p) => s + p[1], 0) / n };
  }
  return { x: cx / (3 * a), z: cz / (3 * a) };
}

/**
 * 方位角（度，0 = 北 = -Z，顺时针，东 = +X）。
 */
export function bearingDeg(dx: number, dz: number): number {
  const d = (Math.atan2(dx, -dz) * 180) / Math.PI;
  return (d + 360) % 360;
}

/** 把角度差折算到 (-180, 180] */
export function wrapDeg(d: number): number {
  let r = ((d + 180) % 360 + 360) % 360 - 180;
  if (r === -180) r = 180;
  return r;
}

export interface CompassReading {
  /** 镜头朝向方位（度） */
  heading: number;
  /** 目标相对镜头朝向的角度（度，负 = 左） */
  relative: number;
  /** 水平距离（米） */
  distance: number;
  /** 在搜索范围 / 目标区域内 */
  inside: boolean;
}

export function compassReading(
  player: { x: number; z: number },
  forward: { x: number; z: number },
  target: MarkerTarget,
  inZone = false,
): CompassReading {
  const heading = bearingDeg(forward.x, forward.z);
  const dx = target.x - player.x;
  const dz = target.z - player.z;
  const distance = Math.hypot(dx, dz);
  const relative = distance < 1e-3 ? 0 : wrapDeg(bearingDeg(dx, dz) - heading);
  const inside = inZone || (target.radius > 0 && distance <= target.radius);
  return { heading, relative, distance, inside };
}

/** 距离显示：< 1000 m 显示整数米，否则 x.x km */
export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
