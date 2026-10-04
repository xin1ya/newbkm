import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SPROUT } from '@/config/islands/sprout';
import { SPROUT_ENCOUNTERS } from '@/config/encounters/sprout';
import { BEHAVIOR } from '@/config/encounters/behavior';
import { ZoneMap } from '@/world/island/ZoneMap';

const manifest = JSON.parse(readFileSync('assets/models/pokemon/manifest.json', 'utf8')) as { models: { id: number }[] };
const modelIds = new Set(manifest.models.map((m) => m.id));

describe('2026-10 生态扩充：新野区', () => {
  const wild = SPROUT.zones.filter((z) => z.kind !== 'town');

  it('每个野区都有独立且存在的遇敌表', () => {
    for (const z of wild) {
      expect(z.encounterTable, z.id).toBeTruthy();
      expect(SPROUT_ENCOUNTERS[z.encounterTable!], z.id).toBeDefined();
    }
    expect(SPROUT.zones.find((z) => z.id === 'cuilan-river')!.encounterTable).toBe('cuilan-river');
  });

  it('新野区覆盖原先的空白陆地', () => {
    const map = new ZoneMap(SPROUT);
    expect(map.at(-285, 250)?.id).toBe('west-beach');
    expect(map.at(-250, -30)?.id).toBe('sprout-woodland');
    expect(map.at(50, -320)?.id).toBe('lanyuan-highlands');
    expect(map.at(150, 450)?.id).toBe('river-delta');
    expect(map.at(-40, -10)?.kind).toBe('town');
  });

  it('遇敌条目合法：权重 > 0、等级有序、有模型和行为', () => {
    for (const t of Object.values(SPROUT_ENCOUNTERS)) {
      for (const e of t.entries) {
        expect(e.weight).toBeGreaterThan(0);
        expect(e.levels[0]).toBeLessThanOrEqual(e.levels[1]);
        expect(modelIds.has(e.speciesId), `${t.id}:${e.speciesId} 缺模型`).toBe(true);
        expect(BEHAVIOR[e.speciesId], `${t.id}:${e.speciesId} 缺行为`).toBeDefined();
      }
    }
  });

  it('新野区种类 ≥ 8，且白天与夜晚都有可遇到的地面宝可梦', () => {
    for (const id of ['west-beach', 'sprout-woodland', 'lanyuan-highlands', 'river-delta', 'cuilan-river']) {
      const t = SPROUT_ENCOUNTERS[id]!;
      expect(new Set(t.entries.map((e) => e.speciesId)).size, id).toBeGreaterThanOrEqual(8);
      for (const time of ['day', 'night'] as const) {
        const any = t.entries.some((e) => (!e.time || e.time === time) && !e.weather && e.formation !== 'rare');
        expect(any, `${id} ${time}`).toBe(true);
      }
    }
  });
});
