/**
 * 计划文档 §9.4 · 培育家职业路线（纯逻辑）：
 * - 导师蒲婆婆；拿到第 1 枚徽章、学会种树果后接「培育家之路」（flag breeder-start）才开始累计经验；
 * - 经验来源：收获树果、制作能量方块、喂食、培育屋领回、工坊合成（薄荷更多）；
 * - 等级 1–10，到级置位 flag `breeder-lv<N>`（任务 / 商店货架 / 功能按 flag 解锁）；
 *   每 3 级授予一枚「培育章」，9 级送金色喷壶，10 级获得「翠澜培育大师」称号；
 * - 培育屋（5 级）：最多寄放 2 只，按经过的游戏分钟获得经验（每分钟 2 点），可设训练方向
 *   （每 6 分钟该项努力值 +1，受单项 252 / 合计 510 上限）；领回时付费 100 + 每升 1 级 100 円；
 *   升级时学会新招式，招式已满则忘掉最早的招式（与正作培育屋一致）。
 */
import type { Dex } from '../data/Dex';
import type { BaseStatId } from '../data/types';
import type { PokemonInstance } from '../pokemon';
import { addEvs } from '../pokemon';
import { gainExp, teachMove } from '../progression';
import { addItem, type GameState } from '../state';

export type BreederAct = 'harvest' | 'block' | 'feed' | 'daycare' | 'craft' | 'mint';

export const BREEDER_START = 'breeder-start';
export const BREEDER_MAX_LEVEL = 10;
/** 各级累计经验门槛（下标 = 等级 − 1） */
export const BREEDER_XP: readonly number[] = [0, 12, 60, 140, 250, 390, 570, 790, 1050, 1350];
export const GOLDEN_CAN = 'golden-watering-can';
export const BREEDER_TITLE = '翠澜培育大师';

/** 各等级解锁说明（界面 / 测试用） */
export const BREEDER_UNLOCKS: Record<number, string> = {
  1: '喷壶、自家 4 块田、工坊基础配方（伤药 / 解毒药）',
  2: '能量方块机（自家 1F）、工坊：好伤药 / 精灵球',
  3: '翠澜镇 / 港湾市公共田、商店出售成长肥 / 丰收肥、工坊：肥料',
  4: '个体值评估（蒲婆婆）、工坊：超级球',
  5: '培育屋（蒲婆婆家）、工坊：活力碎片',
  6: '商店出售变异肥、工坊：变异肥 / 厉害伤药',
  7: '工坊：性格薄荷（头目之鳞 + 稀有树果）',
  8: '（牧场：后续版本开放）',
  9: '金色喷壶（浇一次管两个阶段）',
  10: `「${BREEDER_TITLE}」称号`,
};

export interface DaycareSlot {
  mon: PokemonInstance;
  /** 寄放时的游戏总分钟 */
  since: number;
  /** 寄放时的等级（计算费用） */
  level0: number;
  /** 训练方向：只加这一项努力值；null 不训练 */
  focus: BaseStatId | null;
}

export interface BreederState {
  xp: number;
  daycare: DaycareSlot[];
}

export function breederState(s: GameState): BreederState {
  if (!s.breeder || typeof s.breeder !== 'object') s.breeder = { xp: 0, daycare: [] };
  if (!Array.isArray(s.breeder.daycare)) s.breeder.daycare = [];
  if (typeof s.breeder.xp !== 'number' || !Number.isFinite(s.breeder.xp)) s.breeder.xp = 0;
  return s.breeder;
}

export function levelForXp(xp: number): number {
  let lv = 1;
  for (let i = 0; i < BREEDER_XP.length; i++) if (xp >= BREEDER_XP[i]!) lv = i + 1;
  return lv;
}

/** 当前等级（未开始培育家之路 = 0） */
export function breederLevel(s: GameState): number {
  if (!s.flags[BREEDER_START]) return 0;
  return levelForXp(breederState(s).xp);
}

export function xpToNext(s: GameState): { cur: number; need: number } | null {
  const lv = breederLevel(s);
  if (lv <= 0 || lv >= BREEDER_MAX_LEVEL) return null;
  const xp = breederState(s).xp;
  return { cur: xp - BREEDER_XP[lv - 1]!, need: BREEDER_XP[lv]! - BREEDER_XP[lv - 1]! };
}

export function breederBadges(level: number): number {
  return Math.floor(level / 3);
}

export function levelFlag(lv: number): string {
  return `breeder-lv${lv}`;
}

/** 各项行为的经验 */
export function actXp(act: BreederAct, extra = 0): number {
  switch (act) {
    case 'harvest':
      return 4 + extra; // extra = 收获数量
    case 'block':
      return extra; // 调用方按方块品质给（黑色 1 / 普通 6 / 金色 15）
    case 'feed':
      return 3;
    case 'daycare':
      return 8;
    case 'craft':
      return 4;
    case 'mint':
      return 20;
  }
}

export interface BreederGain {
  act: BreederAct;
  xp: number;
  from: number;
  to: number;
  /** 本次新获得的奖励说明 */
  rewards: string[];
}

type Listener = (g: BreederGain, s: GameState) => void;
const listeners = new Set<Listener>();

/** 场景层订阅（升级提示 / 任务统计）；返回取消函数 */
export function onBreederGain(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * 记一次培育行为：未开始培育家之路时不记经验（仍通知，便于任务统计忽略）。
 * 升级时置位等级 flag、发放奖励（9 级金色喷壶）。
 */
export function gainBreederXp(s: GameState, act: BreederAct, xp: number): BreederGain {
  const b = breederState(s);
  const started = !!s.flags[BREEDER_START];
  const from = started ? levelForXp(b.xp) : 0;
  if (started) b.xp += Math.max(0, Math.round(xp));
  const to = started ? levelForXp(b.xp) : 0;
  const rewards: string[] = [];
  for (let lv = 1; lv <= to; lv++) {
    if (s.flags[levelFlag(lv)]) continue;
    s.flags[levelFlag(lv)] = true;
    if (lv > from && lv > 1) rewards.push(`培育家 ${lv} 级：${BREEDER_UNLOCKS[lv]}`);
    if (lv % 3 === 0 && lv > from) rewards.push(`获得了第 ${lv / 3} 枚「培育章」！`);
    if (lv === 9 && !(s.bag[GOLDEN_CAN] ?? 0)) {
      addItem(s, GOLDEN_CAN, 1);
      rewards.push('获得了金色喷壶！');
    }
  }
  const g: BreederGain = { act, xp: started ? xp : 0, from, to, rewards };
  for (const fn of listeners) fn(g, s);
  return g;
}

// ———————————————— 培育屋 ————————————————

export const DAYCARE_SLOTS = 2;
export const DAYCARE_EXP_PER_MIN = 2;
export const DAYCARE_EV_EVERY_MIN = 6;
export const DAYCARE_BASE_FEE = 100;
export const DAYCARE_FEE_PER_LEVEL = 100;

export function daycareUnlocked(s: GameState): boolean {
  return breederLevel(s) >= 5;
}

/** 寄放（从队伍取出；队伍至少保留 1 只能战斗的宝可梦） */
export function depositDaycare(s: GameState, partyIndex: number, now: number, focus: BaseStatId | null): boolean {
  const b = breederState(s);
  if (b.daycare.length >= DAYCARE_SLOTS) return false;
  const p = s.party[partyIndex];
  if (!p) return false;
  const others = s.party.filter((x, i) => i !== partyIndex && x.hp > 0);
  if (!others.length) return false;
  s.party.splice(partyIndex, 1);
  b.daycare.push({ mon: p, since: now, level0: p.level, focus });
  return true;
}

/** 结算寄放期间的成长（不修改存档，返回预览用的克隆） */
export function previewDaycare(dex: Dex, slot: DaycareSlot, now: number): { mon: PokemonInstance; levels: number; fee: number; learned: string[]; forgot: string[]; evs: number } {
  const mon = structuredClone(slot.mon);
  const minutes = Math.max(0, now - slot.since);
  const learned: string[] = [];
  const forgot: string[] = [];
  const recs = gainExp(dex, mon, minutes * DAYCARE_EXP_PER_MIN);
  for (const r of recs) {
    learned.push(...r.learned);
    for (const m of r.pending) {
      // 招式已满：忘掉最早的招式，学会新招式
      if (mon.moves.some((x) => x.id === m)) continue;
      const old = mon.moves[0]?.id;
      if (teachMove(dex, mon, m, 0)) {
        mon.moves.push(mon.moves.shift()!);
        if (old) forgot.push(old);
        learned.push(m);
      }
    }
  }
  let evs = 0;
  if (slot.focus) {
    const add = addEvs(mon.evs, { [slot.focus]: Math.floor(minutes / DAYCARE_EV_EVERY_MIN) });
    evs = add[slot.focus];
  }
  const levels = mon.level - slot.level0;
  return { mon, levels, fee: DAYCARE_BASE_FEE + Math.max(0, levels) * DAYCARE_FEE_PER_LEVEL, learned, forgot, evs };
}

/** 领回：付费后放回队伍（队伍满了不能领） */
export function withdrawDaycare(dex: Dex, s: GameState, index: number, now: number): ReturnType<typeof previewDaycare> | null {
  const b = breederState(s);
  const slot = b.daycare[index];
  if (!slot || s.party.length >= 6) return null;
  const r = previewDaycare(dex, slot, now);
  if (s.money < r.fee) return null;
  s.money -= r.fee;
  b.daycare.splice(index, 1);
  s.party.push(r.mon);
  return r;
}
