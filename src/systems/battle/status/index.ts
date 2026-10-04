/**
 * SYS-009 · 主要异常（烧伤/麻痹/中毒/剧毒/睡眠/冰冻）与临时状态（混乱/着迷/畏缩）的规则常量与判定。
 * 执行流程在 engine.ts 中调用这里的纯函数。
 */
import type { TypeId } from '../../data/types';
import type { MajorStatus } from '../../pokemon/Pokemon';
import type { Rng } from '../../rng';

/** 麻痹速度倍率：按 07-21 §4.1 规格取 ×0.25（Gen6 及以前）；如需 Gen7+ 的 ×0.5 改这里 */
export const PARALYSIS_SPEED_MULTIPLIER = 0.25;
export const PARALYSIS_FULL_CHANCE = 0.25;
export const FREEZE_THAW_CHANCE = 0.2;
export const CONFUSION_SELF_HIT_CHANCE = 1 / 3;
export const ATTRACT_IMMOBILE_CHANCE = 0.5;
export const BURN_DAMAGE_FRACTION = 1 / 16;
export const POISON_DAMAGE_FRACTION = 1 / 8;

/** 属性免疫：火不会烧伤、电不会麻痹、冰不会冰冻、毒/钢不会中毒 */
export function typeBlocksStatus(status: MajorStatus, types: readonly TypeId[]): boolean {
  switch (status) {
    case 'brn':
      return types.includes('fire');
    case 'par':
      return types.includes('electric');
    case 'frz':
      return types.includes('ice');
    case 'psn':
    case 'tox':
      return types.includes('poison') || types.includes('steel');
    default:
      return false;
  }
}

export function sleepDuration(rng: Rng): number {
  return rng.int(1, 3);
}

export function confusionDuration(rng: Rng): number {
  return rng.int(2, 5);
}

/** 剧毒：第 n 回合受到 n/16 */
export function toxicDamage(maxHp: number, counter: number): number {
  return Math.max(1, Math.floor((maxHp * Math.min(15, counter)) / 16));
}

/** PokeAPI 的 ailment 名 → 主要异常 */
export function ailmentToStatus(ailment: string, moveId: string): MajorStatus | null {
  switch (ailment) {
    case 'burn':
      return 'brn';
    case 'paralysis':
      return 'par';
    case 'poison':
      return moveId === 'toxic' ? 'tox' : 'psn';
    case 'sleep':
      return 'slp';
    case 'freeze':
      return 'frz';
    default:
      return null;
  }
}

export const STATUS_NAMES: Record<MajorStatus, string> = {
  brn: '灼伤',
  par: '麻痹',
  psn: '中毒',
  tox: '剧毒',
  slp: '睡眠',
  frz: '冰冻',
};
