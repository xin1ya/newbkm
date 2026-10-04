/**
 * 宝可梦个体（存档与战斗共用的数据结构）。
 */
import type { Dex } from '../data/Dex';
import type { StatTable, SpeciesData } from '../data/types';
import type { Rng } from '../rng';
import { calcAllStats, randomIvs, zeroStats } from './stats';
import { expForLevel } from './growth';

export type MajorStatus = 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz';

export interface StatusState {
  kind: MajorStatus;
  /** 睡眠剩余回合 */
  sleepTurns?: number;
}

export interface MoveSlot {
  id: string;
  pp: number;
  maxPp: number;
}

export type Gender = 'male' | 'female' | 'none';

export interface PokemonInstance {
  uid: string;
  speciesId: number;
  nickname?: string;
  level: number;
  exp: number;
  nature: string;
  ability: string;
  gender: Gender;
  shiny: boolean;
  ivs: StatTable;
  evs: StatTable;
  moves: MoveSlot[];
  /** 当前 HP（0 = 濒死） */
  hp: number;
  status: StatusState | null;
  heldItem: string | null;
  friendship: number;
  ball: string;
  /** 头目个体（§5.2） */
  alpha?: boolean;
  /** 头目类型（计划文档 §3）：den = 巢穴头目（×1.8），roaming = 游荡头目（×1.5）；旧存档缺省按 roaming */
  alphaKind?: 'den' | 'roaming';
  /** 头目素材喂食失败次数（按招式 id，领悟后清除；用于保底） */
  alphaInsight?: Record<string, number> | undefined;
  /** 外观状态与光泽（计划文档 §9.5，能量方块喂食）。缺省为全 0 */
  condition?: { cool: number; beauty: number; cute: number; smart: number; tough: number; sheen: number } | undefined;
  metAt?: { island: string; zone?: string; level: number };
  ot?: string;
}

export interface CreatePokemonOptions {
  nature?: string;
  abilitySlot?: 'first' | 'random' | 'hidden';
  ivs?: StatTable;
  evs?: StatTable;
  moves?: string[];
  heldItem?: string | null;
  shiny?: boolean;
  gender?: Gender;
  ball?: string;
  alpha?: boolean;
  nickname?: string;
  metAt?: PokemonInstance['metAt'];
  ot?: string;
}

let uidCounter = 0;
export function newUid(rng: Rng): string {
  uidCounter = (uidCounter + 1) % 1e6;
  return `${Date.now().toString(36)}-${rng.int(0, 0xffffff).toString(36)}-${uidCounter.toString(36)}`;
}

/** 按升级学招表取该等级前最后学会的 4 个招式 */
export function defaultMoves(species: SpeciesData, level: number): string[] {
  const learned: string[] = [];
  for (const e of species.learnset) {
    if (e.level > level) break;
    if (learned.includes(e.move)) continue;
    learned.push(e.move);
  }
  return learned.slice(-4);
}

export function rollGender(species: SpeciesData, rng: Rng): Gender {
  if (species.genderRate < 0) return 'none';
  return rng.next() < species.genderRate / 8 ? 'female' : 'male';
}

export function createPokemon(dex: Dex, speciesId: number, level: number, rng: Rng, opts: CreatePokemonOptions = {}): PokemonInstance {
  const species = dex.species(speciesId);
  const normal = species.abilities.filter((a) => !a.hidden);
  const hidden = species.abilities.find((a) => a.hidden);
  let ability = normal[0]?.id ?? species.abilities[0]?.id ?? 'none';
  if (opts.abilitySlot === 'random' && normal.length) ability = rng.pick(normal).id;
  if (opts.abilitySlot === 'hidden' && hidden) ability = hidden.id;

  const moves = (opts.moves ?? defaultMoves(species, level)).filter((m) => dex.hasMove(m));
  if (!moves.length) moves.push('tackle');

  const p: PokemonInstance = {
    uid: newUid(rng),
    speciesId,
    level,
    exp: expForLevel(species.growthRate, level),
    nature: opts.nature ?? rng.pick(dex.natureIds()),
    ability,
    gender: opts.gender ?? rollGender(species, rng),
    shiny: opts.shiny ?? false,
    ivs: opts.ivs ?? randomIvs(rng),
    evs: opts.evs ?? zeroStats(),
    moves: moves.slice(0, 4).map((id) => {
      const pp = dex.move(id).pp;
      return { id, pp, maxPp: pp };
    }),
    hp: 1,
    status: null,
    heldItem: opts.heldItem ?? null,
    friendship: species.baseHappiness,
    ball: opts.ball ?? 'poke-ball',
  };
  if (opts.alpha) p.alpha = true;
  if (opts.nickname) p.nickname = opts.nickname;
  if (opts.metAt) p.metAt = opts.metAt;
  if (opts.ot) p.ot = opts.ot;
  p.hp = getStats(dex, p).hp;
  return p;
}

export function getStats(dex: Dex, p: PokemonInstance): StatTable {
  const s = dex.species(p.speciesId);
  return calcAllStats(s.baseStats, p.ivs, p.evs, p.level, dex.nature(p.nature));
}

export function maxHp(dex: Dex, p: PokemonInstance): number {
  return getStats(dex, p).hp;
}

export function displayName(dex: Dex, p: PokemonInstance): string {
  return p.nickname ?? dex.species(p.speciesId).name.zh;
}

/** 完全恢复（宝可梦中心） */
export function healFully(dex: Dex, p: PokemonInstance): void {
  p.hp = maxHp(dex, p);
  p.status = null;
  for (const m of p.moves) m.pp = m.maxPp;
}

export const isFainted = (p: PokemonInstance): boolean => p.hp <= 0;
