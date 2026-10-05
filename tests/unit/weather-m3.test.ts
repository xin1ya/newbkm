/** M3-06 完整天气系统：新天气类型、出现率加成、战斗映射、环境音、落雷 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WEATHER_VISUALS } from '@/world/sky/Weather';
import { WeatherFx } from '@/world/sky/WeatherFx';
import { ambienceMix, type AmbienceSituation } from '@/systems/audio/select';
import { ISLANDS } from '@/config/islands';
import { followerMood } from '@/systems/follower';

const base: AmbienceSituation = { indoor: null, zoneKind: 'wild', zoneBgm: null, time: 'day', weather: 'clear', sea: 0.5, fresh: 0, altitude: 5, surfing: false } as AmbienceSituation;

describe('M3-06 天气', () => {
  it('新天气视觉参数齐全，常夜雾最暗', () => {
    for (const w of ['blizzard', 'seafog', 'nightfog'] as const) {
      const v = WEATHER_VISUALS[w];
      expect(v.fog).toBeGreaterThan(0.8);
    }
    expect(WEATHER_VISUALS.nightfog.dark).toBeGreaterThan(WEATHER_VISUALS.blizzard.dark);
    expect(WEATHER_VISUALS.blizzard.snow).toBe(1);
    expect(WEATHER_VISUALS.blizzard.wind).toBeGreaterThan(WEATHER_VISUALS.storm.wind);
  });

  it('雷鸣群岛：冰川有暴雪，海岬有海雾，高地多雷暴', () => {
    const th = ISLANDS.thunder!;
    const z = (id: string) => th.zones.find((x) => x.id === id)!.weather!.map((r) => r.weather);
    expect(z('glacier')).toContain('blizzard');
    expect(z('lighthouse-cape')).toContain('seafog');
    expect(z('storm-highland')).toContain('storm');
  });

  it('环境音：暴雪风声更大，海雾无海鸥', () => {
    expect(ambienceMix({ ...base, weather: 'blizzard' }).wind).toBeGreaterThan(ambienceMix({ ...base, weather: 'snow' }).wind);
    expect(ambienceMix({ ...base, weather: 'seafog' }).gulls).toBe(0);
    expect(ambienceMix(base).gulls).toBeGreaterThan(0);
  });

  it('落雷优先劈避雷塔并回调距离', () => {
    const fx = new WeatherFx(100);
    const tower = new THREE.Vector3(100, 40, 0);
    fx.targets = [tower];
    let got = -1;
    fx.onStrike = (d) => (got = d);
    let n = 0;
    for (let i = 0; i < 20; i++) {
      fx.strike(new THREE.Vector3(0, 10, 0), () => 0.1);
      if (fx.lastStrike.equals(tower)) n++;
    }
    expect(n).toBe(20);
    expect(got).toBeCloseTo(100, 3);
    // 太远的塔不作为落点
    fx.targets = [new THREE.Vector3(900, 0, 0)];
    const d = fx.strike(new THREE.Vector3(0, 10, 0), () => 0.5);
    expect(d).toBeGreaterThanOrEqual(80);
    expect(d).toBeLessThanOrEqual(250);
    fx.dispose();
  });

  it('跟随宝可梦对天气有反应', () => {
    const m = followerMood({ name: '冰', status: null, hpRatio: 1, weather: 'blizzard', type: 'ice', hour: 12, friendship: 70, zoneKind: 'wild', roll: 0 });
    expect(m.emote).toBe('♪');
  });
});
