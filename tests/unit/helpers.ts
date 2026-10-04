import { dex } from '@/config/data';
import { createPokemon, type CreatePokemonOptions, type PokemonInstance } from '@/systems/pokemon/Pokemon';
import { fixedIvs } from '@/systems/pokemon/stats';
import { createRng, type Rng } from '@/systems/rng';
import { Battle, type BattleSetup } from '@/systems/battle';

export { dex };

export const rng = (seed = 42): Rng => createRng(seed);

/** 固定个体值 31、中性性格的测试个体 */
export function mon(speciesId: number, level: number, opts: CreatePokemonOptions = {}, seed = 7): PokemonInstance {
  return createPokemon(dex, speciesId, level, createRng(seed), { ivs: fixedIvs(31), nature: 'hardy', gender: 'male', ...opts });
}

export function battle(player: PokemonInstance[], foe: PokemonInstance[], extra: Partial<BattleSetup> = {}, seed = 1234): Battle {
  const b = new Battle({ dex, rng: createRng(seed), kind: 'wild', player: { name: '小翠', party: player }, foe: { party: foe }, noExp: true, ...extra });
  b.start();
  return b;
}

export const SPECIES = {
  rowlet: 722,
  cyndaquil: 155,
  mudkip: 258,
  pidgey: 16,
  rattata: 19,
  caterpie: 10,
  pikachu: 25,
  oddish: 43,
  tentacool: 72,
  staryu: 120,
  krabby: 98,
  poliwag: 60,
  magikarp: 129,
  gyarados: 130,
  metapod: 11,
  zorua: 570,
  wingull: 278,
} as const;
