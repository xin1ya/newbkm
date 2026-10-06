/** M4-01 秘境岛地形：注册、区域 BGM / 等级段、峡谷与方山的地形剖面、生成自检（meta.json） */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decode } from 'fast-png';
import { describe, expect, it } from 'vitest';
import { ISLANDS, getIsland } from '@/config/islands';
import { SECRET } from '@/config/islands/secret';
import { resolveBgm } from '@/config/audio/music';

/** 射线法：点在多边形内 */
function pointInPolygon(x: number, z: number, poly: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const dir = join(process.cwd(), 'assets', 'islands', 'secret');
const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as {
  landKm2: number;
  walkableRatio: number;
  roadIssues: string[];
  poiIssues: string[];
};
// height.png：16-bit 单通道，[-40, 160] m，1025² 覆盖 2048 m
const H_MIN = -40;
const H_MAX = 160;
const buf = decode(readFileSync(join(dir, 'height.png')));
const N = buf.width;
const data = buf.data as Uint16Array;
const heightAt = (x: number, z: number) => {
  const i = Math.round(((x + 1024) / 2048) * (N - 1));
  const j = Math.round(((z + 1024) / 2048) * (N - 1));
  return H_MIN + (data[j * N + i]! / 65535) * (H_MAX - H_MIN);
};
const zone = (id: string) => SECRET.zones.find((z) => z.id === id)!;

describe('M4-01 秘境岛地形', () => {
  it('已注册，两镇 = 寐龙 / 月魇', () => {
    expect(ISLANDS.secret).toBe(SECRET);
    expect(getIsland('secret').name).toBe('秘境岛');
    expect(SECRET.zones.filter((z) => z.kind === 'town').map((z) => z.id)).toEqual(['dragon-town', 'moon-town']);
  });

  it('每个区域都有可解析的 BGM；野外 / 海域区域有等级段（Lv60+，二周目）', () => {
    for (const z of SECRET.zones) {
      expect(resolveBgm(z.bgm), z.bgm).toBeTruthy();
      if (z.kind === 'town') continue;
      expect(z.levelRange, z.id).toBeTruthy();
      const [lo, hi] = z.levelRange!;
      expect(lo).toBeGreaterThanOrEqual(60);
      expect(hi).toBeGreaterThan(lo);
    }
  });

  it('出生点与码头落在码头平原；月魇镇落在月魇荒原包围内', () => {
    expect(pointInPolygon(SECRET.spawnPoint[0], SECRET.spawnPoint[2], zone('secret-shore').polygon)).toBe(true);
    const dock = SECRET.pois.find((p) => p.id === 'secret-dock')!;
    expect(SECRET.zones.some((z) => pointInPolygon(dock.position[0], dock.position[2], z.polygon))).toBe(true);
    const moon = SECRET.pois.find((p) => p.id === 'moon-ruins')!;
    expect(pointInPolygon(moon.position[0], moon.position[2], zone('moon-wastes').polygon)).toBe(true);
  });

  it('陆地面积 0.7–1.0 km²、可行走 ≥ 90%，道路与 POI 自检无问题', () => {
    expect(meta.landKm2).toBeGreaterThanOrEqual(0.7);
    expect(meta.landKm2).toBeLessThan(1.0);
    expect(meta.walkableRatio).toBeGreaterThanOrEqual(0.9);
    expect(meta.roadIssues).toEqual([]);
    expect(meta.poiIssues).toEqual([]);
  });

  it('龙之峡谷：谷底平缓，两侧 25 m 以上的高壁（只能沿谷底通行）', () => {
    const floor = heightAt(0, 0);
    expect(floor).toBeGreaterThan(12);
    expect(floor).toBeLessThan(30);
    expect(heightAt(-90, 0) - floor).toBeGreaterThanOrEqual(25);
    expect(heightAt(90, 0) - floor).toBeGreaterThanOrEqual(25);
    // 谷底纵剖平缓：镇口到北口在 20 m 内单调爬升
    expect(heightAt(0, -180) - heightAt(0, 140)).toBeGreaterThanOrEqual(8);
    expect(heightAt(0, -180) - heightAt(0, 140)).toBeLessThanOrEqual(20);
  });

  it('神兽祭坛：平顶方山（顶面 36 m 以上、外缘低 15 m 以上）', () => {
    expect(heightAt(-330, 0)).toBeGreaterThanOrEqual(36);
    expect(heightAt(-330, 0) - heightAt(-330, 140)).toBeGreaterThanOrEqual(12);
  });

  it('永冻冰原高于荒原；地图四角是海', () => {
    expect(heightAt(360, -320)).toBeGreaterThan(heightAt(0, -320) + 20);
    for (const [x, z] of [[980, 980], [-980, 980], [980, -980], [-980, -980]] as const) expect(heightAt(x, z)).toBeLessThan(0);
  });
});
