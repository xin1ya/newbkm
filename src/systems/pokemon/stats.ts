/**
 * SYS-008 · 个体值 / 努力值 / 性格 与能力值计算（Gen3+ 公式）。
 */
import type { BaseStatId, NatureData, StatTable } from '../data/types';
import type { Rng } from '../rng';

export const STAT_IDS: readonly BaseStatId[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const IV_MAX = 31;
export const EV_MAX_PER_STAT = 252;
export const EV_MAX_TOTAL = 510;

export const zeroStats = (): StatTable => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

export function randomIvs(rng: Rng): StatTable {
  const t = zeroStats();
  for (const k of STAT_IDS) t[k] = rng.int(0, IV_MAX);
  return t;
}

/** 固定个体值（馆主 / 剧情宝可梦） */
export const fixedIvs = (v: number): StatTable => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v });

/** 性格修正：+10% / -10%，HP 不受影响 */
export function natureMultiplier(nature: NatureData | undefined, stat: BaseStatId): number {
  if (!nature || stat === 'hp' || nature.plus === nature.minus) return 1;
  if (nature.plus === stat) return 1.1;
  if (nature.minus === stat) return 0.9;
  return 1;
}

export function calcStat(
  stat: BaseStatId,
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature?: NatureData,
): number {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (stat === 'hp') {
    if (base === 1) return 1; // 脱壳忍者特例
    return core + level + 10;
  }
  return Math.floor((core + 5) * natureMultiplier(nature, stat));
}

export function calcAllStats(
  base: StatTable,
  ivs: StatTable,
  evs: StatTable,
  level: number,
  nature?: NatureData,
): StatTable {
  const out = zeroStats();
  for (const k of STAT_IDS) out[k] = calcStat(k, base[k], ivs[k], evs[k], level, nature);
  return out;
}

export function evTotal(evs: StatTable): number {
  return STAT_IDS.reduce((a, k) => a + evs[k], 0);
}

/**
 * 获得努力值，遵守单项 252 / 总和 510 上限。返回实际增加量。
 */
export function addEvs(evs: StatTable, gain: Partial<StatTable>, multiplier = 1): StatTable {
  const added = zeroStats();
  for (const k of STAT_IDS) {
    const want = Math.floor((gain[k] ?? 0) * multiplier);
    if (want <= 0) continue;
    const room = Math.min(EV_MAX_PER_STAT - evs[k], EV_MAX_TOTAL - evTotal(evs));
    const inc = Math.max(0, Math.min(want, room));
    evs[k] += inc;
    added[k] = inc;
  }
  return added;
}

/** 能力阶倍率：攻防特攻特防速度 (2+n)/2 或 2/(2-n) */
export function stageMultiplier(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

/** 命中 / 闪避阶倍率 (3+n)/3 或 3/(3-n) */
export function accuracyStageMultiplier(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
}
