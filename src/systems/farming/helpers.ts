/**
 * 农田 · 宝可梦照料（纯逻辑）：
 * 1) 驻场打工：把箱子里的宝可梦派到某块田地（每块田地最多 3 只），按属性自动干活
 *    · 水 / 冰系：自动浇水（水分保持在 60% 以上，每个阶段都算浇过水）
 *    · 草系：生长加速 25%，顺手拔草
 *    · 虫 / 飞行系：驱虫
 *    · 地面 / 岩石 / 格斗 / 一般系：除草、翻土（收获 +1）
 *    · 任何驻场宝可梦：结果后自动收获进背包；打开「自动续种」时收获后用 1 个果实原地续种，
 *      背包里有同种肥料时一并施肥
 *    · 每工作 6 游戏小时亲密度 +1
 * 2) 照料宝可梦：喂树果 / 梳毛 / 玩耍（每只每游戏日有次数上限），提升亲密度；
 *    喂普通树果按主要风味给 2 点努力值（辣攻击 / 酸防御 / 涩特攻 / 苦特防 / 甜速度），喜欢的口味亲密度加倍
 */
import type { GameState } from '../state';
import type { PokemonInstance } from '../pokemon';
import type { BaseStatId, TypeId } from '../data/types';
import type { Rng } from '../rng';
import { addItem, removeItem } from '../state';
import { farmState, growMinutes, settlePlot, stageOf, expectedYield, SURPRISE_BERRIES, SURPRISE_CHANCE, type FarmField, type Mulch, type PlotDef, type PlotState } from './index';

export const HELPERS_PER_FIELD = 3;
export const HELPER_FRIENDSHIP_MIN = 360;
export const CARE_FEED_PER_DAY = 5;
export const FLAVOR_EV = 2;

export interface HelperPerks {
  water: boolean;
  growth: boolean;
  weeds: boolean;
  pests: boolean;
  tiller: boolean;
  /** 有驻场宝可梦：自动收获 */
  harvest: boolean;
}

export const NO_PERKS: HelperPerks = { water: false, growth: false, weeds: false, pests: false, tiller: false, harvest: false };

export function perksOf(typesList: ReadonlyArray<readonly TypeId[]>): HelperPerks {
  const has = (...ts: TypeId[]) => typesList.some((types) => ts.some((t) => types.includes(t)));
  return {
    water: has('water', 'ice'),
    growth: has('grass'),
    weeds: has('grass', 'ground', 'rock', 'fighting', 'normal'),
    pests: has('bug', 'flying'),
    tiller: has('ground', 'rock', 'fighting', 'normal'),
    harvest: typesList.length > 0,
  };
}

/** 每种属性在田里的工作（面板说明用） */
export function jobsOf(types: readonly TypeId[]): string[] {
  const p = perksOf([types]);
  const out: string[] = [];
  if (p.water) out.push('浇水');
  if (p.growth) out.push('催生 +25%');
  if (p.weeds) out.push('除草');
  if (p.pests) out.push('驱虫');
  if (p.tiller) out.push('翻土 收获+1');
  out.push('自动收获');
  return out;
}

export interface FarmCare {
  /** 田地 → 驻场宝可梦 uid（来自箱子） */
  helpers: Partial<Record<FarmField, string[]>>;
  /** 田地 → 自动续种 */
  replant: Partial<Record<FarmField, boolean>>;
  /** uid → 累计工作分钟（满 6 小时换 1 点亲密度） */
  work: Record<string, number>;
  /** uid → 当天照料记录 */
  care: Record<string, { day: number; fed: number; brushed: boolean; played: boolean }>;
  /** 上次给驻场宝可梦结算工作时间的游戏分钟 */
  paidAt?: number | undefined;
}

export function farmCare(s: GameState): FarmCare {
  const f = farmState(s);
  const c = f.care;
  if (!c || typeof c !== 'object') {
    f.care = { helpers: {}, replant: {}, work: {}, care: {} };
    return f.care;
  }
  c.helpers ??= {};
  c.replant ??= {};
  c.work ??= {};
  c.care ??= {};
  return c;
}

/** 驻场宝可梦（只认还在箱子里的；被取回队伍 / 放生的自动移除） */
export function fieldHelpers(s: GameState, field: FarmField): PokemonInstance[] {
  const c = farmCare(s);
  const uids = c.helpers[field] ?? [];
  const out = uids.map((u) => s.box.find((p) => p.uid === u)).filter((p): p is PokemonInstance => !!p);
  if (out.length !== uids.length) c.helpers[field] = out.map((p) => p.uid);
  return out;
}

/** 派驻 / 撤回；同一只只能在一块田地 */
export function assignHelper(s: GameState, field: FarmField, uid: string): boolean {
  if (!s.box.some((p) => p.uid === uid)) return false;
  const c = farmCare(s);
  for (const k of Object.keys(c.helpers) as FarmField[]) c.helpers[k] = (c.helpers[k] ?? []).filter((u) => u !== uid);
  const list = c.helpers[field] ?? [];
  if (list.length >= HELPERS_PER_FIELD) return false;
  c.helpers[field] = [...list, uid];
  return true;
}

export function recallHelper(s: GameState, uid: string): boolean {
  const c = farmCare(s);
  let ok = false;
  for (const k of Object.keys(c.helpers) as FarmField[]) {
    const before = c.helpers[k] ?? [];
    c.helpers[k] = before.filter((u) => u !== uid);
    if (c.helpers[k]!.length !== before.length) ok = true;
  }
  return ok;
}

export function helperField(s: GameState, uid: string): FarmField | null {
  const c = farmCare(s);
  for (const k of Object.keys(c.helpers) as FarmField[]) if ((c.helpers[k] ?? []).includes(uid)) return k;
  return null;
}

export interface AutoHarvest {
  plotId: string;
  berry: string;
  qty: number;
  bonus: string | null;
  replanted: boolean;
}

/**
 * 带驻场宝可梦的结算：分段推进，期间按属性干活；结果后自动收获（进背包）并按设置续种。
 * 没有驻场宝可梦的田地走原来的 settlePlot。
 */
export function settlePlotWithHelpers(s: GameState, def: PlotDef, perks: HelperPerks, growHours: number, now: number, raining: boolean, rng: Rng, replant: boolean): AutoHarvest[] {
  const f = farmState(s);
  const out: AutoHarvest[] = [];
  let guard = 0;
  for (;;) {
    const p = f.plots[def.id];
    if (!p || p.at >= now || guard++ > 64) break;
    // 一次最多推进 60 分钟，便于在中途结果时收获 / 续种
    const t = Math.min(now, p.at + 60);
    workStep(p, perks, growHours, t, raining, rng);
    if (perks.harvest && stageOf(p, growHours) === 4) {
      const qty = expectedYield(p) + (perks.tiller ? 1 : 0);
      let bonus: string | null = null;
      if (p.mulch === 'surprise-mulch' && rng.chance(SURPRISE_CHANCE)) bonus = rng.pick(SURPRISE_BERRIES);
      const mulch = p.mulch;
      delete f.plots[def.id];
      let replanted = false;
      let give = qty;
      if (replant) {
        give -= 1;
        f.plots[def.id] = { berry: p.berry, plantedAt: t, grown: 0, water: perks.water ? 100 : 0, watered: [false, false, false, false], weeds: false, pests: false, at: t };
        if (mulch && removeItem(s, mulch, 1)) f.plots[def.id]!.mulch = mulch as Mulch;
        replanted = true;
      }
      if (give > 0) addItem(s, p.berry, give);
      if (bonus) addItem(s, bonus, 1);
      out.push({ plotId: def.id, berry: p.berry, qty: give, bonus, replanted });
    }
  }
  return out;
}

function workStep(p: PlotState, perks: HelperPerks, growHours: number, t: number, raining: boolean, rng: Rng): void {
  if (perks.water && p.water < 60) p.water = 100;
  const before = p.at;
  settlePlot(p, growHours, t, raining || perks.water, rng);
  if (perks.growth) {
    const total = growMinutes(growHours, p.mulch);
    p.grown = Math.min(total, p.grown + (t - before) * 0.25);
  }
  if (perks.weeds) p.weeds = false;
  if (perks.pests) p.pests = false;
}

/** 驻场工作累计 → 亲密度（每 6 小时 +1） */
export function payHelpers(s: GameState, helpers: readonly PokemonInstance[], minutes: number): void {
  if (minutes <= 0) return;
  const c = farmCare(s);
  for (const h of helpers) {
    const w = (c.work[h.uid] ?? 0) + minutes;
    const pts = Math.floor(w / HELPER_FRIENDSHIP_MIN);
    c.work[h.uid] = w - pts * HELPER_FRIENDSHIP_MIN;
    if (pts > 0) h.friendship = Math.min(255, h.friendship + pts);
  }
}

// ———————————————— 照料 ————————————————

export function careRecord(s: GameState, uid: string, day: number): FarmCare['care'][string] {
  const c = farmCare(s);
  const r = c.care[uid];
  if (!r || r.day !== day) {
    c.care[uid] = { day, fed: 0, brushed: false, played: false };
    return c.care[uid]!;
  }
  return r;
}

export const FLAVOR_STAT: Record<string, BaseStatId> = { spicy: 'atk', sour: 'def', dry: 'spa', bitter: 'spd', sweet: 'spe' };

/** 喂普通树果的努力值（总量 510、单项 252 封顶），返回实际增加量 */
export function flavorEv(p: PokemonInstance, stat: BaseStatId, amount = FLAVOR_EV): number {
  const total = Object.values(p.evs).reduce((a, b) => a + b, 0);
  const add = Math.max(0, Math.min(amount, 252 - p.evs[stat], 510 - total));
  p.evs[stat] += add;
  return add;
}

export function addFriendship(p: PokemonInstance, n: number): number {
  const before = p.friendship;
  p.friendship = Math.max(0, Math.min(255, p.friendship + n));
  return p.friendship - before;
}
