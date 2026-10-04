/**
 * M1-18 · 图鉴（纯函数）：地区图鉴条目状态、计数。
 */
import type { GameState } from '../state';

export type DexStatus = 'unknown' | 'seen' | 'caught';

export interface DexEntry {
  /** 地区编号（从 1 开始） */
  no: number;
  speciesId: number;
  status: DexStatus;
}

export function dexStatus(s: Pick<GameState, 'pokedex'>, speciesId: number): DexStatus {
  if (s.pokedex.caught.includes(speciesId)) return 'caught';
  if (s.pokedex.seen.includes(speciesId)) return 'seen';
  return 'unknown';
}

export function dexEntries(s: Pick<GameState, 'pokedex'>, species: readonly number[]): DexEntry[] {
  return species.map((id, i) => ({ no: i + 1, speciesId: id, status: dexStatus(s, id) }));
}

export function dexCounts(s: Pick<GameState, 'pokedex'>, species: readonly number[]): { seen: number; caught: number; total: number } {
  let seen = 0;
  let caught = 0;
  for (const id of species) {
    const st = dexStatus(s, id);
    if (st !== 'unknown') seen++;
    if (st === 'caught') caught++;
  }
  return { seen, caught, total: species.length };
}

/** 格式化编号：7 → "007" */
export const dexNo = (n: number): string => String(n).padStart(3, '0');
