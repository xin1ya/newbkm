/**
 * 天赋（个体值）评价与努力值汇总：与正作「评价功能」一致的分档。
 * - 单项：31 最棒 · 30 了不起 · 26–29 非常好 · 16–25 还不错 · 1–15 还行 · 0 不太行
 * - 总评（6 项合计）：≥151 了不起的能力 · 121–150 非常优秀 · 91–120 相当优秀 · ≤90 能力一般
 */
import type { BaseStatId, StatTable } from '../data/types';
import { EV_MAX_PER_STAT, EV_MAX_TOTAL, IV_MAX as IV_MAX_VALUE, STAT_IDS, evTotal } from './stats';

export type IvGrade = 'best' | 'fantastic' | 'very-good' | 'pretty-good' | 'decent' | 'no-good';

export const IV_GRADE_ZH: Record<IvGrade, string> = {
  best: '最棒',
  fantastic: '了不起',
  'very-good': '非常好',
  'pretty-good': '还不错',
  decent: '还行',
  'no-good': '不太行',
};

export function ivGrade(iv: number): IvGrade {
  if (iv >= 31) return 'best';
  if (iv >= 30) return 'fantastic';
  if (iv >= 26) return 'very-good';
  if (iv >= 16) return 'pretty-good';
  if (iv >= 1) return 'decent';
  return 'no-good';
}

export function ivTotal(ivs: StatTable): number {
  return STAT_IDS.reduce((a, k) => a + ivs[k], 0);
}

export function ivOverall(ivs: StatTable): string {
  const t = ivTotal(ivs);
  if (t >= 151) return '了不起的能力';
  if (t >= 121) return '非常优秀的能力';
  if (t >= 91) return '相当优秀的能力';
  return '能力一般';
}

/** 个体值最高的能力（并列时全部返回，按 STAT_IDS 顺序） */
export function bestIvStats(ivs: StatTable): BaseStatId[] {
  const m = Math.max(...STAT_IDS.map((k) => ivs[k]));
  return STAT_IDS.filter((k) => ivs[k] === m);
}

export interface EvSummary {
  total: number;
  remaining: number;
  /** 每项是否已满（252） */
  maxed: Record<BaseStatId, boolean>;
}

export function evSummary(evs: StatTable): EvSummary {
  const total = evTotal(evs);
  const maxed = {} as Record<BaseStatId, boolean>;
  for (const k of STAT_IDS) maxed[k] = evs[k] >= EV_MAX_PER_STAT;
  return { total, remaining: Math.max(0, EV_MAX_TOTAL - total), maxed };
}

/** 营养剂：每瓶 +10 努力值（第八世代起上限即单项 252） */
export const VITAMINS: Readonly<Record<string, BaseStatId>> = {
  'hp-up': 'hp',
  protein: 'atk',
  iron: 'def',
  calcium: 'spa',
  zinc: 'spd',
  carbos: 'spe',
};
export const VITAMIN_EV = 10;

/** 赠送 / 御三家等「非遭遇」获得的宝可梦也按全局异色概率判定（与野生一致 1/4096） */
export const GIFT_SHINY_CHANCE = 1 / 4096;

// ———————————————————— 个体值洗练道具 ————————————————————

export type IvItemKind = 'cap' | 'gold-cap' | 'reroll' | 'focus-reroll';

export interface IvItemDef {
  kind: IvItemKind;
  /** 使用时需要再选一项能力 */
  needsStat: boolean;
}

/**
 * - 银王冠：指定 1 项个体值直接变为 31（只升不降）
 * - 金王冠：6 项个体值全部变为 31
 * - 洗练石：6 项个体值全部重新随机（0–31，可能变好也可能变差）
 * - 单属性洗练石：指定 1 项个体值重新随机
 */
export const IV_ITEMS: Readonly<Record<string, IvItemDef>> = {
  'bottle-cap': { kind: 'cap', needsStat: true },
  'gold-bottle-cap': { kind: 'gold-cap', needsStat: false },
  'reroll-stone': { kind: 'reroll', needsStat: false },
  'focus-reroll-stone': { kind: 'focus-reroll', needsStat: true },
};

export interface IvChange {
  stat: BaseStatId;
  from: number;
  to: number;
}

/** 某项能力能否用这个道具（王冠：已经 31 的不能再用） */
export function ivItemStatUsable(id: string, ivs: StatTable, stat: BaseStatId): boolean {
  const def = IV_ITEMS[id];
  if (!def) return false;
  return def.kind === 'cap' ? ivs[stat] < IV_MAX_VALUE : true;
}

/** 这只宝可梦能否使用（不选能力时的预判） */
export function ivItemUsable(id: string, ivs: StatTable): boolean {
  const def = IV_ITEMS[id];
  if (!def) return false;
  if (def.kind === 'cap' || def.kind === 'gold-cap') return STAT_IDS.some((k) => ivs[k] < IV_MAX_VALUE);
  return true;
}

/**
 * 应用洗练道具（直接修改 ivs）。需要选能力的道具未给 stat 时返回 null。
 * roll() 返回 0–31 的整数（调用方传入 rng，测试可固定）。
 */
export function applyIvItem(id: string, ivs: StatTable, stat: BaseStatId | undefined, roll: () => number): IvChange[] | null {
  const def = IV_ITEMS[id];
  if (!def || !ivItemUsable(id, ivs)) return null;
  if (def.needsStat && (!stat || !ivItemStatUsable(id, ivs, stat))) return null;
  const targets = def.needsStat ? [stat!] : STAT_IDS;
  const out: IvChange[] = [];
  for (const k of targets) {
    const from = ivs[k];
    const to = def.kind === 'cap' || def.kind === 'gold-cap' ? IV_MAX_VALUE : Math.max(0, Math.min(IV_MAX_VALUE, Math.floor(roll())));
    ivs[k] = to;
    out.push({ stat: k, from, to });
  }
  return out;
}
