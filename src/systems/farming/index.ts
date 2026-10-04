/**
 * 计划文档 §9.3 · 种植（纯逻辑，单测覆盖）：
 * - 田地：萌芽镇自家后院 4 块（蒲婆婆教学后开放）、翠澜镇 / 港湾市公共田各 6 块（暂按 1 枚徽章开放，
 *   第 12 步培育家等级上线后改为培育家 3 级）；
 * - 生长阶段：种子 → 发芽 → 长高 → 开花 → 结果，按游戏分钟推进（树果 growHours，成长肥 −25%）；
 * - 水分：浇水补满，随时间下降（8 小时见底，恒久肥 16 小时）；下雨自动浇水；
 *   前 4 个阶段每个阶段只要水分有剩就算「浇过」，浇过的阶段越多产量越高；
 * - 杂草 / 虫害：生长期间随机出现（每游戏小时 3% / 2%），收获时各 −1；可手动清除，或交给草 / 虫系跟随宝可梦；
 * - 收获：2 + 浇过的阶段数（0–4）− 杂草 − 虫害，丰收肥 +2，至少 1；变异肥 25% 额外得到 1 个稀有树果；
 * - 结算：settle() 按经过的游戏时间推进；游戏时间只在游玩时流动，读档后从存档时刻继续，自然覆盖“离线”。
 */
import type { Rng } from '../rng';
import type { GameState } from '../state';
import { addItem, removeItem } from '../state';

export type FarmField = 'home' | 'cuilan' | 'harbor';

export interface PlotDef {
  id: string;
  field: FarmField;
  /** 世界坐标 [x, z] */
  position: [number, number];
}

export type Mulch = 'growth-mulch' | 'rich-mulch' | 'damp-mulch' | 'surprise-mulch';
export const MULCHES: readonly Mulch[] = ['growth-mulch', 'rich-mulch', 'damp-mulch', 'surprise-mulch'];

export interface PlotState {
  berry: string;
  /** 种下时的游戏总分钟数 */
  plantedAt: number;
  /** 已生长的有效分钟数 */
  grown: number;
  /** 水分 0–100 */
  water: number;
  /** 前 4 个阶段是否浇过 */
  watered: [boolean, boolean, boolean, boolean];
  mulch?: Mulch | undefined;
  weeds: boolean;
  pests: boolean;
  /** 上次结算的游戏总分钟数 */
  at: number;
}

export interface FarmState {
  plots: Record<string, PlotState>;
}

export const STAGE_ZH = ['种子', '发芽', '长高', '开花', '结果'] as const;
export type Stage = 0 | 1 | 2 | 3 | 4;
export const FARM_FLAG = 'farm-unlocked';
export const WATERING_CAN = 'watering-can';
export const WATER_DRAIN_MIN = 480;
export const DAMP_DRAIN_MIN = 960;
export const WEED_CHANCE_PER_HOUR = 0.03;
export const PEST_CHANCE_PER_HOUR = 0.02;
export const SURPRISE_CHANCE = 0.25;
export const SURPRISE_BERRIES = ['lum-berry', 'wiki-berry', 'occa-berry', 'passho-berry', 'wacan-berry', 'rindo-berry', 'yache-berry', 'chople-berry'];

export const MULCH_ZH: Record<Mulch, string> = { 'growth-mulch': '成长肥', 'rich-mulch': '丰收肥', 'damp-mulch': '恒久肥', 'surprise-mulch': '变异肥' };

export function emptyFarm(): FarmState {
  return { plots: {} };
}

export function farmState(s: GameState): FarmState {
  const f = s.farm;
  if (!f || typeof f !== 'object' || typeof f.plots !== 'object' || f.plots === null) {
    s.farm = emptyFarm();
    return s.farm;
  }
  return f;
}

/** 田地是否开放 */
/** 计划文档 §9.4：公共田在培育家 3 级开放 */
export const PUBLIC_FIELD_FLAG = 'breeder-lv3';
export const GOLDEN_WATERING_CAN = 'golden-watering-can';

export function fieldUnlocked(field: FarmField, flags: Readonly<Record<string, boolean>>): boolean {
  if (!flags[FARM_FLAG]) return false;
  return field === 'home' || !!flags[PUBLIC_FIELD_FLAG];
}

export function fieldLockHint(field: FarmField, flags: Readonly<Record<string, boolean>>): string {
  if (!flags[FARM_FLAG]) return '一块松软的空田……蒲婆婆好像很懂种树果，去请教一下吧。';
  return field === 'home' ? '' : '公共田要成为 3 级培育家后才能租用。去找蒲婆婆聊聊「培育家之路」吧。';
}

/** 生长所需分钟（成长肥 −25%） */
export function growMinutes(growHours: number, mulch?: Mulch): number {
  return Math.round(growHours * 60 * (mulch === 'growth-mulch' ? 0.75 : 1));
}

export function stageOf(p: PlotState, growHours: number): Stage {
  const total = growMinutes(growHours, p.mulch);
  if (p.grown >= total) return 4;
  return Math.min(3, Math.floor((p.grown / total) * 4)) as Stage;
}

/** 到结果还要多少游戏分钟 */
export function minutesToHarvest(p: PlotState, growHours: number): number {
  return Math.max(0, growMinutes(growHours, p.mulch) - p.grown);
}

export function plant(s: GameState, plot: PlotDef, berry: string, now: number): boolean {
  const f = farmState(s);
  if (f.plots[plot.id]) return false;
  if (!removeItem(s, berry, 1)) return false;
  f.plots[plot.id] = { berry, plantedAt: now, grown: 0, water: 0, watered: [false, false, false, false], weeds: false, pests: false, at: now };
  return true;
}

export function water(s: GameState, plot: PlotDef, growHours: number): boolean {
  const p = farmState(s).plots[plot.id];
  const golden = (s.bag[GOLDEN_WATERING_CAN] ?? 0) > 0;
  if (!p || (!s.bag[WATERING_CAN] && !golden)) return false;
  if (stageOf(p, growHours) === 4) return false;
  p.water = 100;
  const st = stageOf(p, growHours);
  if (st < 4) p.watered[st as 0 | 1 | 2 | 3] = true;
  // 计划文档 §9.4：金色喷壶浇一次管两个阶段
  if (golden && st < 3) p.watered[(st + 1) as 1 | 2 | 3] = true;
  return true;
}

/** 施肥：只能在种子阶段、每块田一次 */
export function applyMulch(s: GameState, plot: PlotDef, mulch: Mulch, growHours: number): boolean {
  const p = farmState(s).plots[plot.id];
  if (!p || p.mulch || stageOf(p, growHours) !== 0) return false;
  if (!removeItem(s, mulch, 1)) return false;
  p.mulch = mulch;
  return true;
}

export function clearWeeds(s: GameState, plot: PlotDef): boolean {
  const p = farmState(s).plots[plot.id];
  if (!p?.weeds) return false;
  p.weeds = false;
  return true;
}

export function clearPests(s: GameState, plot: PlotDef): boolean {
  const p = farmState(s).plots[plot.id];
  if (!p?.pests) return false;
  p.pests = false;
  return true;
}

/**
 * 推进到 now：分段（≤60 分钟）模拟水分下降、阶段浇水记录、杂草 / 虫害。
 * raining = 当前是否在下雨（只影响本次结算区间）。
 */
export function settlePlot(p: PlotState, growHours: number, now: number, raining: boolean, rng: Rng): void {
  let t = p.at;
  const total = growMinutes(growHours, p.mulch);
  const drain = p.mulch === 'damp-mulch' ? DAMP_DRAIN_MIN : WATER_DRAIN_MIN;
  while (t < now) {
    const step = Math.min(60, now - t);
    if (raining) p.water = 100;
    const st = stageOf(p, growHours);
    if (st < 4) {
      if (p.water > 0) p.watered[st as 0 | 1 | 2 | 3] = true;
      p.grown = Math.min(total, p.grown + step);
      const hrs = step / 60;
      if (!p.weeds && rng.chance(WEED_CHANCE_PER_HOUR * hrs)) p.weeds = true;
      if (!p.pests && st >= 1 && rng.chance(PEST_CHANCE_PER_HOUR * hrs)) p.pests = true;
    }
    p.water = Math.max(0, p.water - (100 * step) / drain);
    t += step;
  }
  p.at = Math.max(p.at, now);
}

export function settleFarm(s: GameState, growHoursOf: (berry: string) => number, now: number, raining: boolean, rng: Rng): void {
  for (const p of Object.values(farmState(s).plots)) settlePlot(p, growHoursOf(p.berry), now, raining, rng);
}

export function expectedYield(p: PlotState): number {
  const w = p.watered.filter(Boolean).length;
  return Math.max(1, 2 + w - (p.weeds ? 1 : 0) - (p.pests ? 1 : 0) + (p.mulch === 'rich-mulch' ? 2 : 0));
}

export interface HarvestResult {
  berry: string;
  qty: number;
  bonus: string | null;
}

export function harvest(s: GameState, plot: PlotDef, growHours: number, rng: Rng): HarvestResult | null {
  const f = farmState(s);
  const p = f.plots[plot.id];
  if (!p || stageOf(p, growHours) !== 4) return null;
  const qty = expectedYield(p);
  addItem(s, p.berry, qty);
  let bonus: string | null = null;
  if (p.mulch === 'surprise-mulch' && rng.chance(SURPRISE_CHANCE)) {
    bonus = rng.pick(SURPRISE_BERRIES);
    addItem(s, bonus, 1);
  }
  delete f.plots[plot.id];
  return { berry: p.berry, qty, bonus };
}
