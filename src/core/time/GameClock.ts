/**
 * ENG-006 · 时间系统。
 * - 游戏时间：默认 1 现实秒 = 1 游戏分钟（一天 24 现实分钟，设计 §3.5）
 * - 时段：dawn 5–7、day 7–17、dusk 17–19、night 19–5；遇敌表只区分 day / night / any（dawn、day 算白天）
 * - 支持暂停（菜单/战斗时暂停世界时间）、倍速（调试）、直接设置时间
 */
import type { TimeOfDay } from '@/systems/encounters';

export type DayPeriod = 'dawn' | 'day' | 'dusk' | 'night';

export class GameClock {
  /** 从第 0 天 00:00 开始经过的游戏分钟数 */
  private minutes: number;
  /** 游戏分钟 / 现实秒 */
  scale = 1;
  paused = false;
  private lastPeriod: DayPeriod;
  private listeners = new Set<(p: DayPeriod, hour: number) => void>();

  constructor(startMinutes = 8 * 60) {
    this.minutes = startMinutes;
    this.lastPeriod = this.period;
  }

  /** 由主循环调用；dtReal 为现实秒 */
  tick(dtReal: number): void {
    if (this.paused) return;
    this.minutes += dtReal * this.scale;
    const p = this.period;
    if (p !== this.lastPeriod) {
      this.lastPeriod = p;
      for (const fn of this.listeners) fn(p, this.hour);
    }
  }

  onPeriodChange(fn: (p: DayPeriod, hour: number) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get totalMinutes(): number {
    return this.minutes;
  }
  set totalMinutes(v: number) {
    this.minutes = Math.max(0, v);
    this.lastPeriod = this.period;
  }
  get day(): number {
    return Math.floor(this.minutes / 1440);
  }
  /** 0–24 的小数小时 */
  get hour(): number {
    return (this.minutes % 1440) / 60;
  }
  /** 0–1 的一天进度（0 = 午夜） */
  get dayFraction(): number {
    return (this.minutes % 1440) / 1440;
  }
  setHour(h: number): void {
    this.totalMinutes = this.day * 1440 + (((h % 24) + 24) % 24) * 60;
  }
  get period(): DayPeriod {
    const h = this.hour;
    if (h >= 5 && h < 7) return 'dawn';
    if (h >= 7 && h < 17) return 'day';
    if (h >= 17 && h < 19) return 'dusk';
    return 'night';
  }
  /** 遇敌表使用的粗时段 */
  get timeOfDay(): TimeOfDay {
    const h = this.hour;
    return h >= 5 && h < 19 ? 'day' : 'night';
  }
  /** HH:MM */
  format(): string {
    const h = Math.floor(this.hour);
    const m = Math.floor(this.minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
