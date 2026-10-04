import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import species from '@/config/data/species.json';
import { SPROUT_ENCOUNTERS } from '@/config/encounters/sprout';
import { TIDE_ENCOUNTERS } from '@/config/encounters/tide';
import { BEHAVIOR } from '@/config/encounters/behavior';

// 第 7 步「进化线闭合」：凡是野外可遇到的物种，其后续所有进化形态都必须有模型和野外行为，
// 这样玩家进化后的宝可梦在战斗/跟随/野外重生时都不会缺模型。
const manifest = JSON.parse(readFileSync('assets/models/pokemon/manifest.json', 'utf8')) as { models: { id: number }[] };
const modelIds = new Set(manifest.models.map((m) => m.id));
type Sp = { id: number; evolutions?: { to: number }[] };
const byId = new Map((species as unknown as Sp[]).map((s) => [s.id, s]));

function descendants(id: number, out = new Set<number>()): Set<number> {
  for (const e of byId.get(id)?.evolutions ?? []) {
    if (!out.has(e.to)) {
      out.add(e.to);
      descendants(e.to, out);
    }
  }
  return out;
}

describe('进化线闭合', () => {
  const wild = new Set<number>();
  for (const t of [...Object.values(SPROUT_ENCOUNTERS), ...Object.values(TIDE_ENCOUNTERS)]) for (const e of t.entries) wild.add(e.speciesId);

  it('野外物种的所有进化形态都有模型和行为', () => {
    const missing: string[] = [];
    for (const id of wild) {
      for (const d of descendants(id)) {
        if (!modelIds.has(d)) missing.push(`${id}→${d} 缺模型`);
        if (!BEHAVIOR[d]) missing.push(`${id}→${d} 缺行为`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('进化目标都存在于物种数据中', () => {
    for (const id of wild) for (const d of descendants(id)) expect(byId.has(d), `${id}→${d}`).toBe(true);
  });
});
