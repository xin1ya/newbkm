/**
 * SYS-006 · 任务注册表 + 状态推导纯函数（07-22 §3.2–3.5，设计 §7）。
 * 任务状态只由 flags 推导，GameState 不新增任务字段。
 */
import type { IslandId } from '../state/GameState';
import type { DialogSource, Flags, Quest, QuestMarker, QuestObjective, QuestStat, QuestStatus, QuestTrigger, Vec3 } from './types';

export * from './types';

export function questStatus(quest: Quest, flags: Flags): QuestStatus {
  if (flags[quest.completeFlag]) return 'completed';
  if (quest.startFlag && flags[quest.startFlag]) return 'active';
  const prereqMet = quest.prerequisites.every((p) => flags[p]);
  // 没有 startFlag 的任务在满足前置后直接视为进行中（例如主线自动推进）
  if (prereqMet && !quest.startFlag) return 'active';
  return prereqMet ? 'available' : 'locked';
}

export function currentObjective(quest: Quest, flags: Flags): QuestObjective | null {
  return quest.objectives.find((o) => !flags[o.completeFlag]) ?? null;
}

/** 前置条件既可以是 flag，也可以是任务 id（自动换算为该任务的 completeFlag） */
export class QuestRegistry {
  private readonly byId = new Map<string, Quest>();
  readonly all: readonly Quest[];

  constructor(quests: readonly Quest[]) {
    const normalized = quests.map((q) => ({ ...q }));
    for (const q of normalized) {
      if (this.byId.has(q.id)) throw new Error(`任务 id 重复：${q.id}`);
      this.byId.set(q.id, q);
    }
    for (const q of normalized) {
      q.prerequisites = q.prerequisites.map((p) => this.byId.get(p)?.completeFlag ?? p);
    }
    this.all = normalized;
  }

  get(id: string): Quest | undefined {
    return this.byId.get(id);
  }

  status(id: string, flags: Flags): QuestStatus {
    const q = this.byId.get(id);
    if (!q) throw new Error(`未知任务：${id}`);
    return questStatus(q, flags);
  }

  getAvailableQuests(flags: Flags): Quest[] {
    return this.all.filter((q) => questStatus(q, flags) === 'available');
  }

  getActiveQuests(flags: Flags): Quest[] {
    return this.all.filter((q) => questStatus(q, flags) === 'active');
  }

  getQuestsByIsland(island: string, flags: Flags): { quest: Quest; status: QuestStatus }[] {
    return this.all.filter((q) => q.island === island).map((quest) => ({ quest, status: questStatus(quest, flags) }));
  }

  /** 数据自检：返回问题列表（pnpm validate 与单测调用） */
  validate(knownFlags: ReadonlySet<string> = new Set()): string[] {
    const problems: string[] = [];
    const produced = new Set<string>(knownFlags);
    for (const q of this.all) {
      produced.add(q.completeFlag);
      if (q.startFlag) produced.add(q.startFlag);
      if (q.reward?.hm) produced.add(q.reward.hm);
      q.objectives.forEach((o) => produced.add(o.completeFlag));
    }
    for (const q of this.all) {
      if (!q.objectives.length) problems.push(`${q.id}: 没有目标`);
      const ids = new Set<string>();
      for (const o of q.objectives) {
        if (ids.has(o.id)) problems.push(`${q.id}: 目标 id 重复 ${o.id}`);
        ids.add(o.id);
        if (o.trigger?.type === 'reach-point' && o.trigger.radius <= 0) problems.push(`${q.id}/${o.id}: reach-point 半径必须 > 0`);
      }
      for (const p of q.prerequisites) if (!produced.has(p)) problems.push(`${q.id}: 前置 ${p} 不会被任何任务或已知 flag 产生`);
    }
    return problems;
  }
}

// ——————————————————— 自动完成（trigger） ———————————————————

export type QuestEvent =
  | { type: 'enter-zone'; zoneId: string }
  | { type: 'position'; island: IslandId; position: Vec3; night?: boolean }
  | { type: 'catch'; speciesId: number; totalCaughtOfSpecies: number }
  | { type: 'defeat'; trainerId: string };

export function triggerMatches(t: QuestTrigger, e: QuestEvent): boolean {
  switch (t.type) {
    case 'enter-zone':
      return e.type === 'enter-zone' && e.zoneId === t.zoneId;
    case 'reach-point': {
      if (e.type !== 'position') return false;
      if (t.night && !e.night) return false;
      const dx = e.position[0] - t.position[0];
      const dz = e.position[2] - t.position[2];
      // y = 0 表示配置没指定高度（任务点按地图坐标写），只比较水平距离；
      // 否则高地上的点（如幻影之森入口地面 26.7 m）永远够不到
      const dy = t.position[1] === 0 ? 0 : e.position[1] - t.position[1];
      return dx * dx + dz * dz + dy * dy * 0.25 <= t.radius * t.radius;
    }
    case 'catch':
      return e.type === 'catch' && e.speciesId === t.speciesId && e.totalCaughtOfSpecies >= (t.count ?? 1);
    case 'defeat':
      return e.type === 'defeat' && e.trainerId === t.trainerId;
  }
}

/**
 * 对进行中任务的**当前目标**检查 trigger，返回需要置位的 flag（目标 flag，以及全部完成时的任务 completeFlag）。
 * 只检查当前目标，保证目标按顺序完成。
 */
export function evaluateTriggers(registry: QuestRegistry, flags: Flags, e: QuestEvent): string[] {
  const out: string[] = [];
  for (const q of registry.getActiveQuests(flags)) {
    const obj = currentObjective(q, flags);
    if (!obj?.trigger || !triggerMatches(obj.trigger, e)) continue;
    out.push(obj.completeFlag);
    const next = { ...flags, [obj.completeFlag]: true };
    if (!currentObjective(q, next) && !next[q.completeFlag]) out.push(q.completeFlag);
  }
  return [...new Set(out)];
}

/** 玩法统计：返回此次应 +1 的计数变量（只看进行中任务的当前目标） */
export function statCounterVars(registry: QuestRegistry, flags: Flags, stat: QuestStat): string[] {
  const out: string[] = [];
  for (const q of registry.getActiveQuests(flags)) {
    const c = currentObjective(q, flags)?.counter;
    if (c?.stat === stat) out.push(c.var);
  }
  return [...new Set(out)];
}

/** 所有目标都已完成但任务 completeFlag 未置位的任务（剧情脚本置位目标后调用） */
export function pendingCompletions(registry: QuestRegistry, flags: Flags): Quest[] {
  return registry.all.filter((q) => !flags[q.completeFlag] && questStatus(q, flags) === 'active' && q.objectives.every((o) => flags[o.completeFlag]));
}

/** 追踪中任务的当前标记（罗盘 / 大地图） */
export function trackedMarker(quest: Quest, flags: Flags): QuestMarker | null {
  const m = currentObjective(quest, flags)?.marker ?? null;
  if (!m?.points?.length) return m;
  const next = m.points.find((p) => !flags[p.doneFlag]);
  return next ? { island: m.island, position: next.position } : m;
}

/**
 * 对话选择优先级（07-22 §3.5）：dialogByQuest（按数组顺序首个匹配）→ dialogNight/dialogDay → dialog
 */
export function selectDialog(src: DialogSource, registry: QuestRegistry, flags: Flags, isNight: boolean): string[] {
  for (const d of src.dialogByQuest ?? []) {
    const q = registry.get(d.questId);
    if (d.requires && !d.requires.every((f) => flags[f] === true)) continue;
    if (d.unless?.some((f) => flags[f] === true)) continue;
    if (q && questStatus(q, flags) === d.when) return d.dialog;
  }
  if (isNight && src.dialogNight?.length) return src.dialogNight;
  if (!isNight && src.dialogDay?.length) return src.dialogDay;
  return src.dialog;
}

/**
 * NPC 头顶任务标记：
 *  - '!'：这位 NPC 现在说话会接下一个任务（对话置位某任务的 startFlag，或是 available 任务的 startNpc）
 *  - '?'：这位 NPC 现在说话会推进进行中的任务（对话带剧情脚本，或会置位尚未完成的 flag）
 *  - null：普通闲聊
 * 与 selectDialog 用同一套优先级，保证“标记显示了，说话就一定有进展”。
 */
export function npcQuestMark(src: DialogSource & { id: string }, registry: QuestRegistry, flags: Flags, isNight: boolean): '!' | '?' | null {
  const lines = selectDialog(src, registry, flags, isNight);
  const entry = (src.dialogByQuest ?? []).find((d) => d.dialog === lines);
  if (entry) {
    const q = registry.get(entry.questId);
    const progresses = !!entry.story || (entry.setFlags ?? []).some((f) => flags[f] !== true);
    if (progresses) {
      const starts = !!q && (entry.setFlags ?? []).includes(q.startFlag ?? '\0') && questStatus(q, flags) !== 'active';
      return entry.when === 'available' || starts ? '!' : '?';
    }
  }
  for (const q of registry.all) if (q.startNpc === src.id && !q.startFlag && questStatus(q, flags) === 'available') return '!';
  return null;
}

/** 任务日志显示规则（07-22 §3.4） */
export function questLogEntry(quest: Quest, flags: Flags): {
  title: string;
  status: QuestStatus;
  showDetails: boolean;
  objectives: { text: string; done: boolean; current: boolean }[];
} {
  const status = questStatus(quest, flags);
  const cur = currentObjective(quest, flags);
  return {
    title: status === 'locked' ? '???' : quest.title,
    status,
    showDetails: status !== 'locked',
    objectives:
      status === 'locked'
        ? []
        : quest.objectives.map((o) => ({ text: o.text, done: status === 'completed' || !!flags[o.completeFlag], current: status === 'active' && o === cur })),
  };
}
