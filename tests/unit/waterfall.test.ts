import { describe, expect, it } from 'vitest';
import { ISLANDS } from '@/config/islands';
import { WATERFALL_FLAG } from '@/config/islands/waterfalls';
import { WATERFALL_FLAG as VR_FLAG } from '@/config/interiors/victoryRoad';
import { ALL_INTERACTIONS } from '@/config/interactions';
import { fallEndNear, fallPath, sampleFall } from '@/systems/ride/waterfall';

const falls = Object.values(ISLANDS).flatMap((i) => (i!.waterfalls ?? []).map((f) => ({ island: i!, f })));

describe('M3-19 大地图瀑布', () => {
  it('三座岛各有一座瀑布，flag 与冠军之路一致', () => {
    expect(falls.map((x) => x.island.id).sort()).toEqual(['sprout', 'thunder', 'tide']);
    expect(WATERFALL_FLAG).toBe(VR_FLAG);
  });

  for (const { island, f } of falls) {
    describe(`${island.id} · ${f.id}`, () => {
      it('泉池 / 瀑潭水体存在且水位与配置一致', () => {
        const pool = island.waterBodies.find((w) => w.id === `${f.id}-pool`);
        const plunge = island.waterBodies.find((w) => w.id === `${f.id}-plunge`);
        expect(pool?.level).toBeCloseTo(f.topLevel, 3);
        expect(plunge?.level).toBeCloseTo(f.baseLevel, 3);
        expect(f.topLevel - f.baseLevel).toBeGreaterThan(8);
      });
      it('几何：泉池在石台内、瀑潭在石台外、瀑口在台缘', () => {
        const [cx, cz] = f.mesa.center;
        const d = (p: readonly [number, number]) => Math.hypot(p[0] - cx, p[1] - cz);
        expect(d(f.pool.center) + f.pool.radius).toBeLessThan(f.mesa.radius);
        expect(d(f.base)).toBeGreaterThan(f.mesa.radius + 2);
        expect(Math.abs(d(f.lip) - f.mesa.radius)).toBeLessThan(0.5);
        expect(d(f.top)).toBeLessThan(f.mesa.radius - 1);
      });
      it('石台有攀瀑阻挡、瀑顶石匣有互动并给道具', () => {
        const b = island.blockers.find((x) => x.id === `${f.id}-mesa`);
        expect(b?.requiresFlag).toBe(WATERFALL_FLAG);
        const cache = island.pois.find((p) => p.id === `${f.id}-cache`);
        expect(cache).toBeTruthy();
        const [cx, cz] = f.mesa.center;
        expect(Math.hypot(cache!.position[0] - cx, cache!.position[2] - cz)).toBeLessThan(f.mesa.radius - 1);
        const def = ALL_INTERACTIONS.find((d) => d.id === `${f.id}-cache`);
        expect(def?.effects?.some((e) => e.kind === 'give-item')).toBe(true);
      });
      it('端点判定 + 演出路径：攀上终点在泉池、攀下终点在瀑潭，俯仰有界', () => {
        expect(fallEndNear([f], f.base[0], f.base[1])?.end).toBe('base');
        expect(fallEndNear([f], f.top[0], f.top[1])?.end).toBe('top');
        expect(fallEndNear([f], f.base[0] + 30, f.base[1] + 30)).toBeNull();
        const up = fallPath(f, 'base', { x: f.base[0], z: f.base[1] });
        const end = sampleFall(up, up.duration);
        expect(Math.hypot(end.x - f.top[0], end.z - f.top[1])).toBeLessThan(0.01);
        expect(end.y).toBeGreaterThan(f.topLevel - 0.5);
        let maxPitch = 0;
        for (let t = 0; t <= up.duration; t += 0.05) maxPitch = Math.max(maxPitch, sampleFall(up, t).pitch);
        expect(maxPitch).toBeGreaterThan(0.5);
        expect(maxPitch).toBeLessThanOrEqual(1.2);
        const down = fallPath(f, 'top', { x: f.top[0], z: f.top[1] });
        const e2 = sampleFall(down, down.duration);
        expect(Math.hypot(e2.x - f.base[0], e2.z - f.base[1])).toBeLessThan(0.01);
        expect(e2.y).toBeLessThan(f.baseLevel);
        expect(down.duration).toBeLessThan(up.duration);
      });
    });
  }
});
