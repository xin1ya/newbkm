/** M3-04 琉璃群岛地形配置：注册、区域 / 遇敌表 / BGM 齐全、POI 落在陆地区域内 */
import { describe, expect, it } from 'vitest';
import { ISLANDS, getIsland } from '@/config/islands';
import { ENCOUNTER_TABLES } from '@/config/encounters';
import { MUSIC_BY_ID } from '@/config/audio/music';
import { GLAZE } from '@/config/islands/glaze';

/** 射线法：点在多边形内为负 */
function sdPolygon(x: number, z: number, poly: ReadonlyArray<readonly [number, number]>): number {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside ? -1 : 1;
}

describe('M3-04 琉璃群岛', () => {
  it('已注册且四镇齐全', () => {
    expect(ISLANDS.glaze).toBe(GLAZE);
    expect(getIsland('glaze').name).toBe('琉璃群岛');
    const towns = GLAZE.zones.filter((z) => z.kind === 'town').map((z) => z.id);
    expect(towns).toEqual(['mirage-town', 'ghost-town', 'glaze-town', 'ever-city']);
  });

  it('每个野外 / 海域区域都有遇敌表与存在的 BGM，遇敌物种等级在区域范围内', () => {
    for (const z of GLAZE.zones) {
      expect(MUSIC_BY_ID.has(z.bgm), z.bgm).toBe(true);
      if (z.kind === 'town') continue;
      const t = ENCOUNTER_TABLES[z.encounterTable!];
      expect(t, z.id).toBeDefined();
      const [lo, hi] = z.levelRange!;
      for (const e of t!.entries) {
        expect(e.levels[0]).toBeGreaterThanOrEqual(lo - 4);
        expect(e.levels[1]).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('幽冥镇常年常夜雾，沼泽以常夜雾为主', () => {
    const ghost = GLAZE.zones.find((z) => z.id === 'ghost-town')!;
    expect(ghost.weather!.map((w) => w.weather)).toEqual(['nightfog']);
    const marsh = GLAZE.zones.find((z) => z.id === 'ghost-marsh')!;
    const top = [...marsh.weather!].sort((a, b) => b.weight - a.weight)[0]!;
    expect(top.weather).toBe('nightfog');
  });

  it('冠军之路两个洞口分别在冠军山南麓与联盟高原', () => {
    const s = GLAZE.pois.find((p) => p.id === 'victory-road-south')!;
    const n = GLAZE.pois.find((p) => p.id === 'victory-road-north')!;
    const plateau = GLAZE.zones.find((z) => z.id === 'league-plateau')!;
    expect(sdPolygon(n.position[0], n.position[2], plateau.polygon)).toBeLessThan(0);
    expect(sdPolygon(s.position[0], s.position[2], plateau.polygon)).toBeGreaterThan(0);
    expect(s.interior).toBe(n.interior);
  });
});
