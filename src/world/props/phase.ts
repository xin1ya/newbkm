/**
 * M3-11 · 随时间出现 / 消失的摆放物（幻影镇的蜃楼建筑）。纯函数，不依赖 three。
 * PropInstance.hours = [起, 止)（小时，可跨午夜，如 [19, 5]）；mirage = 幻象（半透明闪烁、没有碰撞）。
 */
import type { PropInstance } from '@/config/islands/types';

/** h 是否在 [a, b) 时间窗内（跨午夜时 a > b） */
export function inHourWindow(h: number, w: readonly [number, number]): boolean {
  const [a, b] = w;
  const x = ((h % 24) + 24) % 24;
  return a <= b ? x >= a && x < b : x >= a || x < b;
}

/** 分组键：同一时间窗 + 同一类型（实体 / 幻象）的摆放物合并成一组 */
export function phaseKey(p: Pick<PropInstance, 'hours' | 'mirage' | 'requiresFlag'>): string | null {
  if (!p.hours) return null;
  return `phase:${p.hours[0]}-${p.hours[1]}${p.mirage ? ':mirage' : ''}${p.requiresFlag ? ':f' + p.requiresFlag : ''}`;
}

/** 幻象的最大不透明度（实体为 1） */
export const MIRAGE_OPACITY = 0.62;
/** 淡入淡出速度（每秒不透明度变化量；约 2.5 s 完成） */
export const PHASE_FADE = 0.4;

/** 目标不透明度：时间窗外 0；幻象带轻微闪烁（热浪） */
export function phaseOpacity(hour: number, w: readonly [number, number], mirage: boolean, t: number): number {
  if (!inHourWindow(hour, w)) return 0;
  return mirage ? MIRAGE_OPACITY * (0.82 + 0.18 * Math.sin(t * 2.3) * Math.sin(t * 0.7 + 1)) : 1;
}
