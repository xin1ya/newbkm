/**
 * SYS-009 · 天气：雨 / 晴 / 沙暴 / 冰雹。
 */
import type { TypeId } from '../../data/types';
import type { Weather } from '../types';

export const WEATHER_TURNS = 5;

export const WEATHER_NAMES: Record<Weather, string> = {
  none: '无',
  rain: '下雨',
  sun: '大晴天',
  sand: '沙暴',
  hail: '冰雹',
};

/** 招式威力的天气修正 */
export function weatherDamageModifier(weather: Weather, moveType: TypeId): number {
  if (weather === 'rain') return moveType === 'water' ? 1.5 : moveType === 'fire' ? 0.5 : 1;
  if (weather === 'sun') return moveType === 'fire' ? 1.5 : moveType === 'water' ? 0.5 : 1;
  return 1;
}

/** 沙暴中岩石属性特防 ×1.5 */
export function weatherSpDefModifier(weather: Weather, types: readonly TypeId[]): number {
  return weather === 'sand' && types.includes('rock') ? 1.5 : 1;
}

/** 回合末天气伤害（1/16），免疫属性返回 false */
export function takesWeatherDamage(weather: Weather, types: readonly TypeId[]): boolean {
  if (weather === 'sand') return !types.some((t) => t === 'rock' || t === 'ground' || t === 'steel');
  if (weather === 'hail') return !types.includes('ice');
  return false;
}

/** 设置天气的招式 */
export const WEATHER_MOVES: Record<string, Weather> = {
  'rain-dance': 'rain',
  'sunny-day': 'sun',
  sandstorm: 'sand',
  hail: 'hail',
  snowscape: 'hail',
};

/** 大地图天气 → 战斗天气（设计 §4.5：天气影响战斗） */
export function fieldWeatherToBattle(field: string): Weather {
  switch (field) {
    case 'rain':
    case 'storm':
      return 'rain';
    case 'sandstorm':
      return 'sand';
    case 'snow':
      return 'hail';
    case 'harsh-sun':
      return 'sun';
    default:
      return 'none';
  }
}
