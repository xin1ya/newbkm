/**
 * SYS-001 · PokeAPI 数据抓取（构建期脚本，游戏运行时不联网）
 *
 * 规格：07-21 §5.1，3D 版不下载图片（模型全部手工制作）。
 *   - 限速：请求间隔 ≥ 200 ms
 *   - 重试：网络错误 / 5xx 指数退避重试 4 次
 *   - 幂等：原始响应缓存在 scripts/.cache/，重复运行只补抓缺失部分（可断点续抓）
 *   - 校验：生成后逐条检查字段完整性，缺失字段写日志；关键字段缺失时退出码 1
 *
 * 输出（src/config/data/）：species / moves / types / abilities / items / natures .json
 *
 * 用法：pnpm fetch-data [--offline]   （--offline 只用缓存，不发请求）
 * 之后运行 pnpm data:moves（scripts/augment-moves.ts）补充招式学习器 / 教学 / 蛋招式及学习方式列表
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  SpeciesData,
  MoveData,
  TypeChartData,
  AbilityData,
  ItemData,
  NatureData,
  StatId,
  EvolutionData,
  LearnsetEntry,
} from '../src/systems/data/types';
import { SEED_SPECIES, CORE_ITEMS, NON_CONTACT_PHYSICAL } from './data-manifest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'scripts/.cache');
const OUT = join(ROOT, 'src/config/data');
const API = 'https://pokeapi.co/api/v2/';
const OFFLINE = process.argv.includes('--offline');
const DELAY_MS = 200;

/** 学招表优先使用的版本组（按新到旧），取第一个有升级招式的 */
const VERSION_GROUPS = ['scarlet-violet', 'sword-shield', 'ultra-sun-ultra-moon', 'sun-moon', 'omega-ruby-alpha-sapphire', 'x-y', 'black-2-white-2'];

// —————————————————— 网络层 ——————————————————

let lastRequest = 0;
let requestCount = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cachePath(url: string): string {
  const key = url.replace(API, '').replace(/[/?=&]+/g, '_').replace(/_$/, '');
  return join(CACHE, `${key}.json`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get(pathOrUrl: string): Promise<any> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : API + pathOrUrl;
  const file = cachePath(url);
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
      if (requestCount % 25 === 0) console.info(`  … 已请求 ${requestCount} 次`);
      return json;
    } catch (e) {
      const err = e as Error & { fatal?: boolean };
      if (err.fatal || attempt >= 4) throw err;
      const backoff = 500 * 2 ** attempt;
      console.warn(`  ! ${err.message}，${backoff} ms 后重试（${attempt + 1}/4）`);
      await sleep(backoff);
    }
  }
}

const idFromUrl = (url: string): number => Number(url.split('/').filter(Boolean).pop());

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

const STAT_MAP: Record<string, StatId> = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  'special-attack': 'spa',
  'special-defense': 'spd',
  speed: 'spe',
  accuracy: 'acc',
  evasion: 'eva',
};

// —————————————————— 抓取 ——————————————————

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function walkChain(node: any, out: number[], evo: Map<number, EvolutionData[]>): void {
  const from = idFromUrl(node.species.url);
  out.push(from);
  for (const next of node.evolves_to) {
    const to = idFromUrl(next.species.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of next.evolution_details as any[]) {
      const list = evo.get(from) ?? [];
      list.push({
        to,
        trigger: d.trigger.name,
        minLevel: d.min_level ?? undefined,
        item: d.item?.name ?? undefined,
        heldItem: d.held_item?.name ?? undefined,
        timeOfDay: d.time_of_day || undefined,
        minHappiness: d.min_happiness ?? undefined,
        knownMoveType: d.known_move_type?.name ?? undefined,
        knownMove: d.known_move?.name ?? undefined,
        gender: d.gender ?? undefined,
      });
      evo.set(from, list);
    }
    walkChain(next, out, evo);
  }
}

async function main(): Promise<void> {
  console.info(`[fetch-data] ${OFFLINE ? '离线' : '在线'}模式，种子物种 ${SEED_SPECIES.length} 个`);
  const problems: string[] = [];
  const critical: string[] = [];

  // 1) 展开完整进化线
  const speciesIds = new Set<number>();
  const evolutions = new Map<number, EvolutionData[]>();
  const seenChains = new Set<string>();
  for (const id of SEED_SPECIES) {
    const sp = await get(`pokemon-species/${id}`);
    if (seenChains.has(sp.evolution_chain.url)) continue;
    seenChains.add(sp.evolution_chain.url);
    const chain = await get(sp.evolution_chain.url);
    const members: number[] = [];
    walkChain(chain.chain, members, evolutions);
    members.forEach((m) => speciesIds.add(m));
  }
  const ids = [...speciesIds].sort((a, b) => a - b);
  console.info(`[fetch-data] 展开进化线后共 ${ids.length} 个物种`);

  // 2) 物种
  const species: SpeciesData[] = [];
  const moveNames = new Set<string>();
  const abilityNames = new Set<string>();
  for (const id of ids) {
    const sp = await get(`pokemon-species/${id}`);
    const pk = await get(`pokemon/${id}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stat = (n: string) => pk.stats.find((s: any) => s.stat.name === n)?.base_stat as number;
    const baseStats = { hp: stat('hp'), atk: stat('attack'), def: stat('defense'), spa: stat('special-attack'), spd: stat('special-defense'), spe: stat('speed') };
    const evYield = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    for (const s of pk.stats) if (s.effort) evYield[STAT_MAP[s.stat.name] as keyof typeof evYield] = s.effort;

    // 学招表：选第一个有数据的版本组
    let learnset: LearnsetEntry[] = [];
    let versionGroup = '';
    for (const vg of VERSION_GROUPS) {
      const list: LearnsetEntry[] = [];
      for (const m of pk.moves) {
        for (const d of m.version_group_details) {
          if (d.version_group.name === vg && d.move_learn_method.name === 'level-up') {
            list.push({ level: d.level_learned_at, move: m.move.name });
          }
        }
      }
      if (list.length) {
        learnset = list.sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
        versionGroup = vg;
        break;
      }
    }
    learnset.forEach((l) => moveNames.add(l.move));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const abilities = pk.abilities.map((a: any) => ({ id: a.ability.name as string, hidden: a.is_hidden as boolean, slot: a.slot as number }));
    abilities.forEach((a: { id: string }) => abilityNames.add(a.id));

    const s: SpeciesData = {
      id,
      key: sp.name,
      name: localName(sp.names, sp.name),
      genus: localName(sp.genera.map((g: { genus: string; language: unknown }) => ({ name: g.genus, language: g.language })), ''),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      types: pk.types.sort((a: any, b: any) => a.slot - b.slot).map((t: any) => t.type.name),
      baseStats,
      abilities,
      captureRate: sp.capture_rate,
      baseExp: pk.base_experience ?? 50,
      growthRate: sp.growth_rate.name,
      genderRate: sp.gender_rate,
      baseHappiness: sp.base_happiness ?? 50,
      evYield,
      heightM: pk.height / 10,
      weightKg: pk.weight / 10,
      color: sp.color?.name ?? 'white',
      evolvesFrom: sp.evolves_from_species ? idFromUrl(sp.evolves_from_species.url) : null,
      evolutions: evolutions.get(id) ?? [],
      learnset,
      learnsetVersion: versionGroup,
      flavor: flavor(sp.flavor_text_entries),
    };
    if (!learnset.length) problems.push(`species ${id} 没有升级学招数据`);
    for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const) if (!Number.isFinite(baseStats[k])) critical.push(`species ${id} 缺少种族值 ${k}`);
    if (!s.types.length) critical.push(`species ${id} 缺少属性`);
    if (s.name.zh === s.name.en) problems.push(`species ${id} 缺少中文名`);
    species.push(s);
  }

  // 3) 招式（额外加入战斗逻辑中直接引用的招式）
  ['struggle', 'tackle', 'rain-dance', 'sunny-day', 'sandstorm', 'hail', 'protect', 'rest'].forEach((m) => moveNames.add(m));
  const moves: MoveData[] = [];
  for (const name of [...moveNames].sort()) {
    const m = await get(`move/${name}`);
    const meta = m.meta ?? {};
    const mv: MoveData = {
      id: m.name,
      num: m.id,
      name: localName(m.names, m.name),
      type: m.type.name,
      category: m.damage_class.name,
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
      statChanges: m.stat_changes.map((s: any) => ({ stat: STAT_MAP[s.stat.name] ?? s.stat.name, change: s.change })),
      flags: { contact: false },
      shortEffect: flavor(m.flavor_text_entries),
    };
    if (!m.meta) problems.push(`move ${name} 缺少 meta，按 unique 处理`);
    moves.push(mv);
  }
  // 接触类招式：PokeAPI 没有直接字段，用官方分类名单（招式表 scripts/data-manifest.ts）
  const { CONTACT_MOVES } = await import('./data-manifest');
  for (const mv of moves) mv.flags.contact = CONTACT_MOVES.has(mv.id) || (mv.category === 'physical' && !NON_CONTACT_PHYSICAL.has(mv.id));

  // 4) 属性克制表
  const typeList = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
  const chart: TypeChartData = { types: typeList as TypeChartData['types'], names: {}, chart: {} };
  for (const t of typeList) {
    const td = await get(`type/${t}`);
    chart.names[t] = localName(td.names, t).zh;
    const row: Record<string, number> = {};
    for (const d of typeList) row[d] = 1;
    for (const x of td.damage_relations.double_damage_to) row[x.name] = 2;
    for (const x of td.damage_relations.half_damage_to) row[x.name] = 0.5;
    for (const x of td.damage_relations.no_damage_to) row[x.name] = 0;
    chart.chart[t] = row;
  }

  // 5) 特性
  const abilities: AbilityData[] = [];
  for (const name of [...abilityNames].sort()) {
    const a = await get(`ability/${name}`);
    abilities.push({ id: a.name, name: localName(a.names, a.name), shortEffect: flavor(a.flavor_text_entries) });
  }

  // 6) 道具
  const items: ItemData[] = [];
  for (const name of CORE_ITEMS) {
    const it = await get(`item/${name}`);
    items.push({
      id: it.name,
      name: localName(it.names, it.name),
      category: it.category.name,
      cost: it.cost,
      flingPower: it.fling_power ?? null,
      shortEffect: flavor(it.flavor_text_entries),
    });
  }

  // 7) 性格
  const natures: NatureData[] = [];
  const natureList = await get('nature?limit=100');
  for (const n of natureList.results) {
    const nd = await get(n.url);
    natures.push({
      id: nd.name,
      name: localName(nd.names, nd.name),
      plus: nd.increased_stat ? STAT_MAP[nd.increased_stat.name] as StatId : null,
      minus: nd.decreased_stat ? STAT_MAP[nd.decreased_stat.name] as StatId : null,
    });
  }
  natures.sort((a, b) => a.id.localeCompare(b.id));
  if (natures.length !== 25) critical.push(`性格数量 ${natures.length} ≠ 25`);
  if (items.length !== CORE_ITEMS.length) critical.push('道具数量不符');

  // 8) 写出
  mkdirSync(OUT, { recursive: true });
  const write = (f: string, data: unknown) => writeFileSync(join(OUT, f), JSON.stringify(data, null, 1) + '\n');
  write('species.json', species);
  write('moves.json', moves);
  write('types.json', chart);
  write('abilities.json', abilities);
  write('items.json', items);
  write('natures.json', natures);
  write('manifest.json', {
    source: 'https://pokeapi.co',
    note: '由 scripts/fetch-data.ts 生成，请勿手改；如需调整改 scripts/data-manifest.ts 后重新运行',
    counts: { species: species.length, moves: moves.length, abilities: abilities.length, items: items.length, natures: natures.length },
  });

  problems.forEach((p) => console.warn(`  ⚠ ${p}`));
  critical.forEach((p) => console.error(`  ✖ ${p}`));
  console.info(
    `[fetch-data] 完成：物种 ${species.length} / 招式 ${moves.length} / 特性 ${abilities.length} / 道具 ${items.length} / 性格 ${natures.length}；新请求 ${requestCount} 次，警告 ${problems.length} 条`,
  );
  if (critical.length) process.exit(1);
}

main().catch((e) => {
  console.error('[fetch-data] 失败：', e);
  process.exit(1);
});

