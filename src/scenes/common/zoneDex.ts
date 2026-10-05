/**
 * 区域图鉴数据：岛屿配置（区域多边形 / 等级 / 天气 / 头目巢穴）+ 遇敌表 → 菜单「区域图鉴」页。
 */
import type { IslandConfig } from '@/config/islands/types';
import type { EncounterTable } from '@/systems/encounters';
import { ZONE_VISITED_PREFIX } from '@/systems/state/GameState';
import type { ZoneDexSpecies, ZoneDexZone } from '@/ui/menu/types';

const WEATHER_ZH: Record<string, string> = { clear: '晴天', rain: '雨天', fog: '雾天', snow: '雪天', storm: '暴风雨', sandstorm: '沙暴', anomaly: '异象', blizzard: '暴雪', seafog: '海雾', nightfog: '常夜雾' };
const METHOD_ZH: Record<string, string> = { grass: '草丛', visible: '可见', surf: '水面', fish: '钓鱼', cave: '洞窟' };

export function buildZoneDex(island: IslandConfig, tables: Readonly<Record<string, EncounterTable>>, flags: Readonly<Record<string, boolean>>): { island: string; zones: ZoneDexZone[] } {
  const zones: ZoneDexZone[] = [];
  for (const z of island.zones) {
    const table = z.encounterTable ? tables[z.encounterTable] : undefined;
    if (!table && z.kind !== 'wild' && z.kind !== 'sea') continue;
    const total = table ? table.entries.reduce((s, e) => s + e.weight, 0) : 0;
    const map = new Map<number, ZoneDexSpecies & { m: Set<string>; n: Set<string> }>();
    for (const e of table?.entries ?? []) {
      let s = map.get(e.speciesId);
      if (!s) {
        s = { speciesId: e.speciesId, levels: [e.levels[0], e.levels[1]], methods: [], notes: [], share: 0, m: new Set(), n: new Set() };
        map.set(e.speciesId, s);
      }
      s.levels = [Math.min(s.levels[0], e.levels[0]), Math.max(s.levels[1], e.levels[1])];
      s.share += total > 0 ? e.weight / total : 0;
      for (const m of e.methods ?? ['grass', 'visible']) s.m.add(METHOD_ZH[m] ?? m);
      if (e.time === 'day') s.n.add('白天');
      if (e.time === 'night') s.n.add('夜晚');
      for (const w of e.weather ?? []) s.n.add(WEATHER_ZH[w] ?? w);
      if (e.formation === 'rare') s.n.add('稀有');
      if (e.formation === 'group') s.n.add('成群');
    }
    const species = [...map.values()]
      .map(({ m, n, ...s }) => ({ ...s, methods: [...m], notes: [...n] }))
      .sort((a, b) => b.share - a.share);
    let cx = 0;
    let cz = 0;
    for (const [x, y] of z.polygon) {
      cx += x;
      cz += y;
    }
    const k = Math.max(1, z.polygon.length);
    const wsum = (z.weather ?? []).reduce((s, w) => s + w.weight, 0);
    const weather = [...new Set((z.weather ?? []).filter((w) => wsum > 0 && w.weight / wsum >= 0.1).map((w) => WEATHER_ZH[w.weather] ?? w.weather))];
    const den = (island.alphaDens ?? []).find((d) => d.zone === z.id);
    zones.push({
      id: z.id,
      name: z.name,
      kind: z.kind,
      levelRange: z.levelRange ?? null,
      weather,
      visited: flags[`${ZONE_VISITED_PREFIX}${z.id}`] === true,
      center: [cx / k, cz / k],
      alpha: den ? { speciesId: den.speciesId, level: den.level } : null,
      species,
    });
  }
  return { island: island.name, zones };
}
