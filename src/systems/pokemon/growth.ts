/**
 * 经验曲线：6 种成长速度（PokeAPI growth_rate 名称）。
 */
import type { GrowthRate } from '../data/types';

export const MAX_LEVEL = 100;

export function expForLevel(rate: GrowthRate, level: number): number {
  const n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  if (n === 1) return 0;
  const n3 = n ** 3;
  switch (rate) {
    case 'fast':
      return Math.floor((4 * n3) / 5);
    case 'medium':
      return n3;
    case 'medium-slow':
      return Math.max(0, Math.floor((6 / 5) * n3 - 15 * n * n + 100 * n - 140));
    case 'slow':
      return Math.floor((5 * n3) / 4);
    case 'slow-then-very-fast': // Erratic
      if (n < 50) return Math.floor((n3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n3 * (150 - n)) / 100);
      if (n < 98) return Math.floor((n3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n3 * (160 - n)) / 100);
    case 'fast-then-very-slow': // Fluctuating
      if (n < 15) return Math.floor((n3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n < 36) return Math.floor((n3 * (n + 14)) / 50);
      return Math.floor((n3 * (Math.floor(n / 2) + 32)) / 50);
    default:
      return n3;
  }
}

/** 由总经验反推等级 */
export function levelForExp(rate: GrowthRate, exp: number): number {
  let lv = 1;
  while (lv < MAX_LEVEL && expForLevel(rate, lv + 1) <= exp) lv++;
  return lv;
}
