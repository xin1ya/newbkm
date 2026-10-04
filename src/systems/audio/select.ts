/**
 * M1-20 · 音频情境 → BGM / 环境音层（纯函数）。
 * 优先级：战斗 > 水上骑乘 > 室内 > 区域；夜间由引擎在 BGM 总线上加低通（不换曲）。
 */
import type { FieldWeather, TimeOfDay } from '../encounters';

export type BattleKind = 'wild' | 'trainer' | 'gym' | 'boss';

export interface MusicSituation {
  battle: BattleKind | null;
  /** 战斗胜利后的凯旋曲（播到回到大地图为止） */
  victory: BattleKind | null;
  surfing: boolean;
  interiorBgm: string | null;
  zoneBgm: string | null;
}

export const BATTLE_BGM: Record<BattleKind, string> = { wild: 'battle-wild', trainer: 'battle-trainer', gym: 'battle-gym', boss: 'battle-boss' };
export const VICTORY_BGM: Record<BattleKind, string> = { wild: 'victory-wild', trainer: 'victory-trainer', gym: 'victory-trainer', boss: 'victory-trainer' };
export const SURF_BGM = 'surf';

export function pickBgm(s: MusicSituation): string | null {
  if (s.victory) return VICTORY_BGM[s.victory];
  if (s.battle) return BATTLE_BGM[s.battle];
  if (s.interiorBgm) return s.interiorBgm;
  if (s.surfing) return SURF_BGM;
  return s.zoneBgm;
}

export type AmbienceLayer = 'wind' | 'birds' | 'crickets' | 'waves' | 'lap' | 'rain' | 'forest' | 'gulls' | 'room' | 'cave' | 'frogs' | 'stream' | 'insects';
export const AMBIENCE_LAYERS: readonly AmbienceLayer[] = ['wind', 'birds', 'crickets', 'waves', 'lap', 'rain', 'forest', 'gulls', 'room', 'cave', 'frogs', 'stream', 'insects'];

export interface AmbienceSituation {
  indoor: 'room' | 'cave' | null;
  zoneKind: 'town' | 'wild' | 'sea' | 'dungeon-entrance' | null;
  /** 区域 bgm id，用于区分森林 / 海崖等 */
  zoneBgm: string | null;
  time: TimeOfDay;
  weather: FieldWeather;
  /** 周围海面比例 0–1（玩家周围采样） */
  sea: number;
  /** 周围湖 / 河面比例 0–1 */
  fresh: number;
  /** 其中流动的河 / 溪比例 0–1（溪流声）；缺省按 0 */
  river?: number | undefined;
  /** 高出海平面的高度（m） */
  altitude: number;
  surfing: boolean;
  /** 战斗中环境音压低 */
  battle: boolean;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function ambienceMix(a: AmbienceSituation): Record<AmbienceLayer, number> {
  const out = Object.fromEntries(AMBIENCE_LAYERS.map((l) => [l, 0])) as Record<AmbienceLayer, number>;
  const duck = a.battle ? 0.25 : 1;
  if (a.indoor === 'room') {
    out.room = 0.5 * duck;
    if (a.weather === 'rain' || a.weather === 'storm') out.rain = 0.18 * duck; // 屋檐外的雨声
    return out;
  }
  if (a.indoor === 'cave') {
    out.cave = 0.7 * duck;
    return out;
  }
  const wet = a.weather === 'rain' || a.weather === 'storm';
  const night = a.time === 'night';
  const forest = a.zoneBgm === 'field-phantom-forest';
  const cliffs = a.zoneBgm === 'field-cliffs';
  // 风：高处 / 海崖 / 海面更大，暴风雨最大
  const windBase = 0.12 + clamp01(a.altitude / 40) * 0.35 + (cliffs ? 0.2 : 0) + a.sea * 0.12 + (a.surfing ? 0.1 : 0);
  out.wind = clamp01(windBase + (a.weather === 'storm' ? 0.4 : 0) + (a.weather === 'snow' ? 0.15 : 0)) * duck;
  // 雨
  out.rain = (a.weather === 'storm' ? 0.85 : a.weather === 'rain' ? 0.6 : 0) * duck;
  // 海浪：看周围海面比例；水上骑乘时贴近水面
  out.waves = clamp01(a.sea * 0.9 + (a.surfing && a.sea > 0 ? 0.25 : 0)) * duck;
  // 湖岸拍水
  out.lap = clamp01(a.fresh * 0.8 + (a.surfing && a.fresh > 0 ? 0.2 : 0)) * duck;
  // 海鸥：海边白天
  out.gulls = !night && !wet && a.sea > 0.15 ? clamp01(0.25 + a.sea * 0.5) * duck : 0;
  // 鸟鸣：白天陆地（森林更密），雨天停
  const land = a.surfing ? 0.2 : 1 - clamp01(a.sea * 1.2);
  out.birds = !night && !wet && a.weather !== 'storm' ? clamp01((a.zoneKind === 'town' ? 0.35 : 0.55) + (forest ? 0.2 : 0)) * land * duck : 0;
  // 虫鸣：夜晚陆地
  out.crickets = night && !wet ? clamp01((a.zoneKind === 'town' ? 0.35 : 0.6) * land) * duck : 0;
  // 森林：低沉嗡鸣 + 枝叶 / 猫头鹰
  out.forest = forest ? (night ? 0.7 : 0.45) * duck : 0;
  // 蛙鸣：淡水边，夜晚最盛，小雨天白天也叫（暴风雨停）
  out.frogs = (night || wet) && a.weather !== 'storm' && a.fresh > 0.04 ? clamp01(0.3 + a.fresh * 0.9 + (wet ? 0.15 : 0)) * (night ? 1 : 0.6) * duck : 0;
  // 溪流：流动水面的潺潺声，不分昼夜
  const river = a.river ?? 0;
  out.stream = river > 0.02 ? clamp01(0.25 + river * 1.2) * duck : 0;
  // 昆虫：晴朗白天的野外（蜜蜂嗡嗡 / 蝉鸣），城镇少、森林里和鸟鸣叠加
  out.insects = !night && !wet && a.weather !== 'snow' && a.zoneKind !== 'sea' ? clamp01((a.zoneKind === 'town' ? 0.12 : 0.35) + (forest ? 0.1 : 0)) * land * duck : 0;
  return out;
}

/** 按周围水面采样估计 sea / fresh 比例：samples 为 (水深, 是否海水) 列表 */
export function waterProximity(samples: readonly { depth: number; sea: boolean; river?: boolean }[]): { sea: number; fresh: number; river: number } {
  if (!samples.length) return { sea: 0, fresh: 0, river: 0 };
  let s = 0;
  let f = 0;
  let r = 0;
  for (const x of samples) {
    if (x.depth <= 0.05) continue;
    if (x.sea) s++;
    else {
      f++;
      if (x.river) r++;
    }
  }
  return { sea: s / samples.length, fresh: f / samples.length, river: r / samples.length };
}
