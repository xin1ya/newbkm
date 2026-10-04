/**
 * 招式库补全（在 fetch-data 之后运行，增量、幂等）
 *
 * fetch-data 只收录各物种「升级学会」的招式。这里按各物种学招表所用的版本组（learnsetVersion），
 * 把「招式学习器 / 教学 / 蛋招式」也补进 moves.json，并把这三类学习方式写进 species.json：
 *   species.machineMoves / tutorMoves / eggMoves（招式 id 列表，排序）
 * 外加 data-manifest 的 EXTRA_MOVES（头目招式等）。
 *
 * 只追加，不改动已有招式条目（已有条目可能做过平衡调整）。网络与缓存同 fetch-data（scripts/.cache/）。
 *
 * 用法：pnpm data:moves [--offline]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MoveData, SpeciesData, StatId } from '../src/systems/data/types';
import { CONTACT_MOVES, EXTRA_MOVES, NON_CONTACT_PHYSICAL } from './data-manifest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'scripts/.cache');
const OUT = join(ROOT, 'src/config/data');
const API = 'https://pokeapi.co/api/v2/';
const OFFLINE = process.argv.includes('--offline');
const DELAY_MS = 200;

let lastRequest = 0;
let requestCount = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get(path: string): Promise<any> {
  const url = API + path;
  const file = join(CACHE, `${path.replace(/[/?=&]+/g, '_').replace(/_$/, '')}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (OFFLINE) throw new Error(`离线模式缺少缓存：${url}`);
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequest + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'cuilan-archipelago-internal-build' } });
      if (res.status === 404) throw Object.assign(new Error(`404 ${url}`), { fatal: true });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const json = await res.json();
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(file, JSON.stringify(json));
      requestCount++;
      return json;
    } catch (e) {
      const err = e as Error & { fatal?: boolean };
      if (err.fatal || attempt >= 4) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function localName(names: any[], fallback: string): { en: string; zh: string } {
  const pick = (lang: string) => names.find((n) => n.language.name === lang)?.name as string | undefined;
  const en = pick('en') ?? fallback;
  return { en, zh: pick('zh-hans') ?? pick('zh-hant') ?? en };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flavor(entries: any[]): string {
  const e = entries.find((x) => x.language.name === 'zh-hans') ?? entries.find((x) => x.language.name === 'en');
  return ((e?.flavor_text ?? e?.text ?? '') as string).replace(/\s+/g, ' ').trim();
}
const STAT_MAP: Record<string, StatId> = { hp: 'hp', attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe', accuracy: 'acc' as StatId, evasion: 'eva' as StatId };

async function main(): Promise<void> {
  const species = JSON.parse(readFileSync(join(OUT, 'species.json'), 'utf8')) as SpeciesData[];
  const moves = JSON.parse(readFileSync(join(OUT, 'moves.json'), 'utf8')) as MoveData[];
  const have = new Set(moves.map((m) => m.id));
  const want = new Set<string>(EXTRA_MOVES);
  const METHODS = { machine: 'machineMoves', tutor: 'tutorMoves', egg: 'eggMoves' } as const;

  for (const s of species) {
    const pk = await get(`pokemon/${s.id}`);
    const lists: Record<string, Set<string>> = { machine: new Set(), tutor: new Set(), egg: new Set() };
    for (const m of pk.moves) {
      for (const d of m.version_group_details) {
        if (d.version_group.name !== s.learnsetVersion) continue;
        const set = lists[d.move_learn_method.name as string];
        if (set) set.add(m.move.name as string);
      }
    }
    for (const [method, key] of Object.entries(METHODS)) {
      const ids = [...lists[method]!].sort();
      (s as unknown as Record<string, string[]>)[key] = ids;
      ids.forEach((id) => want.add(id));
    }
  }

  const added: string[] = [];
  for (const name of [...want].sort()) {
    if (have.has(name)) continue;
    const m = await get(`move/${name}`);
    const meta = m.meta ?? {};
    const category = m.damage_class.name as MoveData['category'];
    moves.push({
      id: m.name,
      num: m.id,
      name: localName(m.names, m.name),
      type: m.type.name,
      category,
      power: m.power ?? 0,
      accuracy: m.accuracy ?? null,
      pp: m.pp ?? 1,
      priority: m.priority,
      target: m.target.name,
      effectChance: m.effect_chance ?? null,
      meta: {
        category: meta.category?.name ?? 'unique',
        ailment: meta.ailment?.name ?? 'none',
        ailmentChance: meta.ailment_chance ?? 0,
        critRate: meta.crit_rate ?? 0,
        drain: meta.drain ?? 0,
        flinchChance: meta.flinch_chance ?? 0,
        healing: meta.healing ?? 0,
        minHits: meta.min_hits ?? null,
        maxHits: meta.max_hits ?? null,
        minTurns: meta.min_turns ?? null,
        maxTurns: meta.max_turns ?? null,
        statChance: meta.stat_chance ?? 0,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      statChanges: m.stat_changes.map((x: any) => ({ stat: STAT_MAP[x.stat.name] ?? x.stat.name, change: x.change })),
      flags: { contact: CONTACT_MOVES.has(m.name) || (category === 'physical' && !NON_CONTACT_PHYSICAL.has(m.name)) },
      shortEffect: flavor(m.flavor_text_entries),
    } as MoveData);
    have.add(name);
    added.push(name);
  }
  moves.sort((a, b) => a.id.localeCompare(b.id));
  const write = (f: string, data: unknown) => writeFileSync(join(OUT, f), JSON.stringify(data, null, 1) + '\n');
  write('moves.json', moves);
  write('species.json', species);
  console.info(`[augment-moves] 新增招式 ${added.length} 个（招式库共 ${moves.length}）；新请求 ${requestCount} 次`);
  if (added.length) console.info(added.join(' '));
}

main().catch((e) => {
  console.error('[augment-moves] 失败：', e);
  process.exit(1);
});
