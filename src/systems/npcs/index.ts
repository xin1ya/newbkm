/**
 * M1-06 · NPC 日程 / 显示条件 / 放置解析 / 数据自检 / 对话目标选择（纯函数，Node 可跑）。
 */
import type { Flags } from '../quests/types';
export type { Flags } from '../quests/types';
import type { NpcActivity, NpcDef, NpcLocation, ScheduleEntry, Vec2 } from './types';

export * from './types';

/** 小时是否落在 [from, to)；支持跨午夜；from === to 表示全天 */
export function hourInRange(hour: number, from: number, to: number): boolean {
  const h = ((hour % 24) + 24) % 24;
  if (from === to) return true;
  return from < to ? h >= from && h < to : h >= from || h < to;
}

export function isNpcShown(def: NpcDef, flags: Flags): boolean {
  if (def.showIf?.some((f) => !flags[f])) return false;
  if (def.hideIf?.some((f) => flags[f])) return false;
  return true;
}

/** 当前生效的日程条目（按数组顺序首个匹配）；没有日程返回 undefined，日程未覆盖返回 null */
export function activeEntry(def: NpcDef, hour: number): ScheduleEntry | null | undefined {
  if (!def.schedule) return undefined;
  return def.schedule.find((e) => hourInRange(hour, e.from, e.to)) ?? null;
}

export type NpcPlace = { kind: 'island'; island: string } | { kind: 'interior'; interior: string; room: string };

/** 室内配置中的 NPC 固定位（与 config/interiors 的 NpcSpot 同形） */
export interface SpotRef {
  id: string;
  position: Vec2;
  yaw?: number;
}

export interface NpcPlacement {
  def: NpcDef;
  /** 实例键：同一 NPC 在同一处的放置不变时键不变（用于判断是否需要移动 / 重建） */
  key: string;
  position: Vec2;
  yaw: number;
  activity: NpcActivity;
}

function locationMatches(at: NpcLocation, place: NpcPlace): boolean {
  if (place.kind === 'island') return 'island' in at && at.island === place.island;
  return 'interior' in at && at.interior === place.interior && at.room === place.room;
}

/**
 * 求某个地点（岛屿 / 室内房间）此刻应出现的 NPC。
 * @param spots 室内房间的固定位（岛屿传空数组）
 */
export function placementsFor(defs: readonly NpcDef[], place: NpcPlace, hour: number, flags: Flags, spots: readonly SpotRef[] = []): NpcPlacement[] {
  const out: NpcPlacement[] = [];
  const byId = new Map(defs.map((d) => [d.id, d]));
  for (const def of defs) {
    if (!def.schedule || !isNpcShown(def, flags)) continue;
    const e = activeEntry(def, hour);
    if (!e || !locationMatches(e.at, place)) continue;
    const idx = def.schedule.indexOf(e);
    out.push({ def, key: `${def.id}@${idx}`, position: [...e.at.position] as Vec2, yaw: e.at.yaw ?? 0, activity: e.activity ?? { kind: 'stand' } });
  }
  spots.forEach((s, i) => {
    const def = byId.get(s.id);
    // 有日程的 NPC 只听日程；固定位只服务于无日程 NPC
    if (!def || def.schedule || !isNpcShown(def, flags)) return;
    out.push({ def, key: `${def.id}#${i}`, position: [...s.position] as Vec2, yaw: s.yaw ?? 0, activity: def.activity ?? { kind: 'stand' } });
  });
  return out;
}

// ——————————————————— 对话目标 ———————————————————

export interface TalkCandidate {
  key: string;
  x: number;
  z: number;
}

/**
 * 玩家前方扇形内最近的对象（设计 §8.5：前方 2 m 扇形；M1-07 的互动提示复用）。
 * facing：弧度，0 = +Z；halfAngle：扇形半角（弧度）。贴身（< 0.9 m）时不看朝向。
 */
export function pickInFront<T extends TalkCandidate>(px: number, pz: number, facing: number, items: readonly T[], range = 2, halfAngle = Math.PI / 3): T | null {
  const fx = Math.sin(facing);
  const fz = Math.cos(facing);
  const cosLimit = Math.cos(halfAngle);
  let best: T | null = null;
  let bestScore = Infinity;
  for (const it of items) {
    const dx = it.x - px;
    const dz = it.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > range) continue;
    const cos = d < 1e-6 ? 1 : (dx * fx + dz * fz) / d;
    if (d > 0.9 && cos < cosLimit) continue;
    // 距离为主，偏离正前方稍微加权
    const score = d + (1 - cos) * 0.6;
    if (score < bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

/** 朝向：从 (ax,az) 看向 (bx,bz) 的 yaw（0 = +Z） */
export function yawTo(ax: number, az: number, bx: number, bz: number): number {
  return Math.atan2(bx - ax, bz - az);
}

// ——————————————————— 数据自检 ———————————————————

export interface NpcValidationContext {
  /** 室内固定位：interior#room → spot id 列表 */
  spots: { interior: string; room: string; id: string }[];
  /** 存在的房间 `interior#room` */
  rooms: ReadonlySet<string>;
  islands: ReadonlySet<string>;
  questIds: ReadonlySet<string>;
  /** 任务的 startNpc / startFlag（检查接任务对话是否齐全） */
  questStarts: { questId: string; npc: string; startFlag?: string }[];
}

export function validateNpcs(defs: readonly NpcDef[], ctx: NpcValidationContext): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const d of defs) {
    if (ids.has(d.id)) problems.push(`NPC id 重复：${d.id}`);
    ids.add(d.id);
    if (!d.name) problems.push(`${d.id}: 缺少名字`);
    if (!d.dialog.length || d.dialog.some((l) => !l.trim())) problems.push(`${d.id}: 默认对话为空`);
    for (const q of d.dialogByQuest ?? []) {
      if (!ctx.questIds.has(q.questId)) problems.push(`${d.id}: dialogByQuest 引用未知任务 ${q.questId}`);
      if (!q.dialog.length && !q.story) problems.push(`${d.id}: ${q.questId}/${q.when} 对话为空`);
      if (q.story !== undefined && !q.story.trim()) problems.push(`${d.id}: ${q.questId}/${q.when} story 为空`);
    }
    const sched = d.schedule ?? [];
    sched.forEach((e, i) => {
      if (e.from < 0 || e.from > 24 || e.to < 0 || e.to > 24) problems.push(`${d.id}: 日程 ${i} 小时越界`);
      if ('interior' in e.at && !ctx.rooms.has(`${e.at.interior}#${e.at.room}`)) problems.push(`${d.id}: 日程 ${i} 房间不存在 ${e.at.interior}#${e.at.room}`);
      if ('island' in e.at && !ctx.islands.has(e.at.island)) problems.push(`${d.id}: 日程 ${i} 岛屿不存在 ${e.at.island}`);
      if (e.activity?.kind === 'wander' && e.activity.radius <= 0) problems.push(`${d.id}: 日程 ${i} 散步半径必须 > 0`);
      if (e.activity?.kind === 'patrol' && e.activity.path.length < 2) problems.push(`${d.id}: 日程 ${i} 巡逻路径至少 2 点`);
    });
    // 日程重叠：按半小时采样，同一时刻命中多条视为配置错误
    for (let h = 0; h < 24; h += 0.5) {
      const hits = sched.filter((e) => hourInRange(h, e.from, e.to)).length;
      if (hits > 1) {
        problems.push(`${d.id}: ${h} 点有 ${hits} 条日程重叠`);
        break;
      }
    }
    if (!d.schedule && !ctx.spots.some((s) => s.id === d.id)) problems.push(`${d.id}: 既没有日程也没有室内固定位，永远不会出现`);
  }
  for (const s of ctx.spots) if (!ids.has(s.id)) problems.push(`室内 ${s.interior}#${s.room} 引用了未定义的 NPC ${s.id}`);
  for (const qs of ctx.questStarts) {
    const d = defs.find((x) => x.id === qs.npc);
    if (!d) {
      problems.push(`任务 ${qs.questId} 的 startNpc ${qs.npc} 未定义`);
      continue;
    }
    if (qs.startFlag && !(d.dialogByQuest ?? []).some((q) => q.questId === qs.questId && q.when === 'available' && q.setFlags?.includes(qs.startFlag!))) {
      problems.push(`${d.id}: 缺少接取任务 ${qs.questId} 的对话（when: available，setFlags 含 ${qs.startFlag}）`);
    }
  }
  return problems;
}
