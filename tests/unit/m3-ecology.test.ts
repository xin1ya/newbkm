/** M3-28 · 雷鸣 / 琉璃生态：遇敌表、头目巢穴、采集点、巢穴 TM、地区图鉴 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THUNDER } from '@/config/islands/thunder';
import { GLAZE } from '@/config/islands/glaze';
import type { IslandConfig, PropsFile } from '@/config/islands/types';
import { Heightfield } from '@/world/terrain/Heightfield';
import { CollisionWorld } from '@/world/collision/CollisionWorld';
import { GrayboxProps } from '@/world/props/GrayboxProps';
import { THUNDER_ENCOUNTERS } from '@/config/encounters/thunder';
import { GLAZE_ENCOUNTERS } from '@/config/encounters/glaze';
import { BEHAVIOR } from '@/config/encounters/behavior';
import { GATHER_POINTS } from '@/config/gather';
import { TM_BY_DEN } from '@/config/tms';
import { CUILAN_DEX } from '@/config/pokedex';
import { dex } from '@/config/data';

const NEW_WILD = [81, 82, 100, 101, 239, 125, 179, 180, 181, 403, 404, 299, 476, 220, 221, 215, 361, 362, 478, 225, 459, 460, 86, 87, 363, 364, 365,
  63, 64, 280, 281, 282, 475, 177, 178, 200, 355, 356, 477, 429, 425, 426, 592, 593, 170, 171, 116, 117, 230, 246, 247, 443, 444, 147, 148, 149];

describe('M3-28 雷鸣 / 琉璃生态', () => {
  it('新物种都在野外出现、有行为性格、已入翠澜图鉴', () => {
    const wild = new Set([...Object.values(THUNDER_ENCOUNTERS), ...Object.values(GLAZE_ENCOUNTERS)].flatMap((t) => t.entries.map((e) => e.speciesId)));
    for (const id of NEW_WILD) {
      expect(wild.has(id), `${id} 不在遇敌表`).toBe(true);
      expect(BEHAVIOR[id], `${id} 没有行为`).toBeTruthy();
      expect(CUILAN_DEX.species.includes(id), `${id} 不在图鉴`).toBe(true);
    }
    for (const id of CUILAN_DEX.species) expect(dex.species(id)).toBeTruthy();
  });

  it('每个野区一个头目巢穴，巢穴首次击败奖励 TM，招式存在', () => {
    for (const isl of [THUNDER, GLAZE]) {
      const wildZones = isl.zones.filter((z) => z.kind === 'wild').map((z) => z.id);
      const dens = isl.alphaDens ?? [];
      expect(dens.map((d) => d.zone).sort()).toEqual(wildZones.sort());
      for (const d of dens) {
        expect(TM_BY_DEN.get(d.id), d.id).toBeTruthy();
        for (const m of d.moves ?? []) expect(dex.hasMove(m), `${d.id} ${m}`).toBe(true);
        const z = isl.zones.find((x) => x.id === d.zone)!;
        expect(d.level).toBeGreaterThanOrEqual(z.levelRange![1]);
      }
    }
  });

  const load = (isl: IslandConfig) => {
    const dir = join(__dirname, '../../assets');
    const buf = (p: string) => {
      const b = readFileSync(join(dir, p));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    };
    const hf = Heightfield.fromPng(isl, buf(isl.heightmap), isl.splatmaps.map(buf));
    const col = new CollisionWorld();
    new GrayboxProps(hf, col, JSON.parse(readFileSync(join(dir, `islands/${isl.id}/props.json`), 'utf8')) as PropsFile);
    return { hf, col };
  };

  it('巢穴与采集点都在陆地上、不被摆放物挡住', () => {
    for (const isl of [THUNDER, GLAZE]) {
      const { hf, col } = load(isl);
      for (const d of isl.alphaDens ?? []) {
        expect(hf.waterAt(d.position[0], d.position[1])?.depth ?? 0, d.id).toBeLessThanOrEqual(0);
        expect(col.query(d.position[0], d.position[1], d.radius).length, d.id).toBe(0);
      }
      const pts = GATHER_POINTS.filter((p) => p.island === isl.id);
      expect(pts.length).toBeGreaterThan(50);
      for (const { def } of pts) {
        expect(hf.waterAt(def.position[0], def.position[1])?.depth ?? 0, def.id).toBeLessThanOrEqual(0);
        expect(col.query(def.position[0], def.position[1], 1.5).length, def.id).toBe(0);
      }
    }
  });
});
