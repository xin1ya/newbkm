import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TIDE } from '@/config/islands/tide';
import { TIDE_ENCOUNTERS } from '@/config/encounters/tide';
import { ENCOUNTER_TABLES } from '@/config/encounters';
import { BEHAVIOR } from '@/config/encounters/behavior';

const manifest = JSON.parse(readFileSync('assets/models/pokemon/manifest.json', 'utf8')) as { models: { id: number }[] };
const modelIds = new Set(manifest.models.map((m) => m.id));

describe('M2-18 碧潮群岛生态', () => {
  const wild = TIDE.zones.filter((z) => z.kind !== 'town' && z.encounterTable);

  it('每个野区的遇敌表都已登记，且等级落在区域 levelRange 内', () => {
    expect(wild.length).toBeGreaterThanOrEqual(10);
    for (const z of wild) {
      const t = ENCOUNTER_TABLES[z.encounterTable!];
      expect(t, z.id).toBeDefined();
      const [lo, hi] = z.levelRange!;
      for (const e of t!.entries) {
        expect(e.levels[0], `${z.id}:${e.speciesId}`).toBeGreaterThanOrEqual(lo);
        expect(e.levels[1], `${z.id}:${e.speciesId}`).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('所有条目有模型和行为，昼夜都有常见种', () => {
    for (const t of Object.values(TIDE_ENCOUNTERS)) {
      for (const e of t.entries) {
        expect(e.weight).toBeGreaterThan(0);
        expect(modelIds.has(e.speciesId), `${t.id}:${e.speciesId} 缺模型`).toBe(true);
        expect(BEHAVIOR[e.speciesId], `${t.id}:${e.speciesId} 缺行为`).toBeDefined();
      }
      for (const time of ['day', 'night'] as const) {
        const any = t.entries.some((e) => (!e.time || e.time === time) && !e.weather && e.formation !== 'rare');
        expect(any, `${t.id} ${time}`).toBe(true);
      }
    }
  });

  it('萌芽—碧潮海域出现玛瑙水母 / 海星星 / 鲤鱼王（设计 E2）', () => {
    const ids = TIDE_ENCOUNTERS['tide-sea-route']!.entries.map((e) => e.speciesId);
    for (const id of [72, 120, 129]) expect(ids).toContain(id);
  });
});
