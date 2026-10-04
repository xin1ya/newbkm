/**
 * 天气：区域规则（ZoneConfig.weather）决定可能的天气，按权重抽取并维持 4–10 游戏小时；
 * 视觉参数在 8 秒内平滑过渡。天气也作为 encounters 的输入（雨天水系、雾天幽灵系出现率提升）。
 */
import type { FieldWeather } from '@/systems/encounters';
import type { WeatherRule } from '@/config/islands/types';

export interface WeatherVisual {
  /** 阴云覆盖 0–1：压暗阳光、增加云量 */
  cloud: number;
  rain: number;
  fog: number;
  snow: number;
  wind: number;
  lightning: number;
}

export const WEATHER_VISUALS: Record<FieldWeather, WeatherVisual> = {
  clear: { cloud: 0.05, rain: 0, fog: 0, snow: 0, wind: 0.6, lightning: 0 },
  rain: { cloud: 0.7, rain: 0.7, fog: 0.25, snow: 0, wind: 1.1, lightning: 0 },
  storm: { cloud: 0.95, rain: 1, fog: 0.35, snow: 0, wind: 2, lightning: 1 },
  fog: { cloud: 0.45, rain: 0, fog: 1, snow: 0, wind: 0.25, lightning: 0 },
  snow: { cloud: 0.6, rain: 0, fog: 0.35, snow: 1, wind: 0.7, lightning: 0 },
  sandstorm: { cloud: 0.5, rain: 0, fog: 0.7, snow: 0, wind: 2.2, lightning: 0 },
  anomaly: { cloud: 0.8, rain: 0, fog: 0.6, snow: 0, wind: 1.4, lightning: 0.4 },
};

export function pickWeather(rules: readonly WeatherRule[] | undefined, isNight: boolean, r: number): FieldWeather {
  const list = (rules ?? []).filter((x) => !x.time || x.time === (isNight ? 'night' : 'day'));
  if (!list.length) return 'clear';
  const total = list.reduce((a, b) => a + b.weight, 0);
  let t = r * total;
  for (const x of list) {
    t -= x.weight;
    if (t < 0) return x.weather;
  }
  return list[list.length - 1]!.weather;
}

export class WeatherState {
  current: FieldWeather = 'clear';
  /** 当前天气持续到（游戏分钟） */
  until = 0;
  zoneId: string | null = null;
  readonly visual: WeatherVisual = { ...WEATHER_VISUALS.clear };
  /** 调试：锁定天气 */
  forced: FieldWeather | null = null;

  constructor(private readonly random: () => number = Math.random) {}

  /**
   * 每帧调用。进入新区域或到期时重新抽取；返回是否发生变化。
   */
  update(dtReal: number, gameMinutes: number, zoneId: string | null, rules: readonly WeatherRule[] | undefined, isNight: boolean): boolean {
    let changed = false;
    const target = this.forced;
    if (target && target !== this.current) {
      this.current = target;
      changed = true;
    } else if (!target && (zoneId !== this.zoneId || gameMinutes >= this.until)) {
      const allowed = (rules ?? []).map((r) => r.weather);
      // 进入新区域：当前天气在新区域允许时保持（跨区域天气连续）
      const keep = zoneId !== this.zoneId && gameMinutes < this.until && allowed.includes(this.current);
      if (!keep) {
        const next = pickWeather(rules, isNight, this.random());
        if (next !== this.current) changed = true;
        this.current = next;
        this.until = gameMinutes + (4 + this.random() * 6) * 60;
      }
    }
    this.zoneId = zoneId;
    // 视觉平滑（约 8 秒）
    const goal = WEATHER_VISUALS[this.current];
    const k = 1 - Math.exp(-dtReal / 2.7);
    for (const key of Object.keys(goal) as (keyof WeatherVisual)[]) this.visual[key] += (goal[key] - this.visual[key]) * k;
    return changed;
  }
}
