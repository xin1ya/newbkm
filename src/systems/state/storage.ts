/**
 * 宝可梦寄放系统（电脑）：队伍 ⇄ 盒子。盒子在存档里是一个紧凑数组（BOX_MAX = 16 × 30），按页显示。
 * 规则：队伍里至少保留 1 只没有濒死的宝可梦；队伍满 6 只不能再取出（可以交换）；放生不可恢复。
 */
import type { PokemonInstance } from '../pokemon';
import { BOX_MAX, PARTY_MAX, type GameState } from './GameState';

export const BOX_SIZE = 30;
export const BOX_COUNT = BOX_MAX / BOX_SIZE;

export type StorageResult = { ok: true } | { ok: false; reason: string };

const fail = (reason: string): StorageResult => ({ ok: false, reason });

/** 去掉这只后，队伍里是否还有能战斗的宝可梦 */
function keepsFighter(party: PokemonInstance[], removeIndex: number, replacement?: PokemonInstance): boolean {
  return party.some((p, i) => (i === removeIndex ? (replacement?.hp ?? 0) > 0 : p.hp > 0));
}

export function boxPage(s: GameState, page: number): PokemonInstance[] {
  return s.box.slice(page * BOX_SIZE, page * BOX_SIZE + BOX_SIZE);
}

/** 存入：队伍 → 盒子末尾 */
export function deposit(s: GameState, partyIndex: number): StorageResult {
  const p = s.party[partyIndex];
  if (!p) return fail('没有这只宝可梦。');
  if (s.party.length <= 1) return fail('队伍里至少要留下 1 只宝可梦。');
  if (!keepsFighter(s.party, partyIndex)) return fail('队伍里至少要留下 1 只能战斗的宝可梦。');
  if (s.box.length >= BOX_MAX) return fail('盒子已经全满了。');
  s.party.splice(partyIndex, 1);
  s.box.push(p);
  return { ok: true };
}

/** 取出：盒子 → 队伍末尾 */
export function withdraw(s: GameState, boxIndex: number): StorageResult {
  const p = s.box[boxIndex];
  if (!p) return fail('没有这只宝可梦。');
  if (s.party.length >= PARTY_MAX) return fail(`队伍已经有 ${PARTY_MAX} 只了，先存入一只或选择交换。`);
  s.box.splice(boxIndex, 1);
  s.party.push(p);
  return { ok: true };
}

/** 交换：盒子里的一只与队伍里的一只互换位置 */
export function swapWithParty(s: GameState, boxIndex: number, partyIndex: number): StorageResult {
  const b = s.box[boxIndex];
  const p = s.party[partyIndex];
  if (!b || !p) return fail('没有这只宝可梦。');
  if (!keepsFighter(s.party, partyIndex, b)) return fail('队伍里至少要留下 1 只能战斗的宝可梦。');
  s.box[boxIndex] = p;
  s.party[partyIndex] = b;
  return { ok: true };
}

/** 放生（不可恢复）；携带的道具放回背包 */
export function release(s: GameState, where: 'party' | 'box', index: number): StorageResult {
  if (where === 'party') {
    const p = s.party[index];
    if (!p) return fail('没有这只宝可梦。');
    if (s.party.length <= 1 || !keepsFighter(s.party, index)) return fail('队伍里至少要留下 1 只能战斗的宝可梦。');
    s.party.splice(index, 1);
    if (p.heldItem) s.bag[p.heldItem] = (s.bag[p.heldItem] ?? 0) + 1;
  } else {
    const p = s.box[index];
    if (!p) return fail('没有这只宝可梦。');
    s.box.splice(index, 1);
    if (p.heldItem) s.bag[p.heldItem] = (s.bag[p.heldItem] ?? 0) + 1;
  }
  return { ok: true };
}

/** 整理盒子：按图鉴编号 / 等级（高→低） */
export function sortBox(s: GameState, by: 'dex' | 'level'): void {
  s.box.sort((a, b) => (by === 'dex' ? a.speciesId - b.speciesId || b.level - a.level : b.level - a.level || a.speciesId - b.speciesId));
}
