/** M1-18：背包道具逻辑、地区图鉴、设置项定义 */
import { describe, expect, it } from 'vitest';
import { KEY_ITEMS, KEY_ITEM_BY_ID } from '@/config/items';
import { CUILAN_DEX, SPROUT_DEX } from '@/config/pokedex';
import speciesJson from '@/config/data/species.json';
import { applyToPokemon, canUseOn, giveHeldItem, itemInfo, pocketItems, pocketOf, swapParty, takeHeldItem, tossItem, useFromBag, POCKETS } from '@/systems/items';
import { dexCounts, dexEntries, dexStatus, dexNo } from '@/systems/pokedex';
import { createNewGame, markCaught, markSeen, type GameState } from '@/systems/state/GameState';
import { maxHp } from '@/systems/pokemon';
import { dex, mon } from './helpers';

const K = KEY_ITEM_BY_ID;
const DAY = { timeOfDay: 'day' as const };
const newGame = (): GameState => createNewGame({ name: '小翠', gender: 'girl', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] }, now: new Date('2026-09-29T00:00:00Z') });

describe('道具口袋', () => {
  it('按分类归入口袋', () => {
    expect(pocketOf(dex, 'potion', K)).toBe('medicine');
    expect(pocketOf(dex, 'poke-ball', K)).toBe('balls');
    expect(pocketOf(dex, 'oran-berry', K)).toBe('berries');
    expect(pocketOf(dex, 'water-stone', K)).toBe('evolution');
    expect(pocketOf(dex, 'old-rod', K)).toBe('key');
    expect(pocketOf(dex, 'tm-water-pulse', K)).toBe('tms');
  });
  it('每个口袋都有中文名；重要物品 id 唯一且可查到', () => {
    expect(new Set(POCKETS.map((p) => p.id)).size).toBe(POCKETS.length);
    expect(new Set(KEY_ITEMS.map((k) => k.id)).size).toBe(KEY_ITEMS.length);
    for (const k of KEY_ITEMS) expect(itemInfo(dex, k.id, K).name).toBe(k.name);
    expect(itemInfo(dex, 'old-rod', K).tossable).toBe(false);
  });
  it('pocketItems 只列出数量 > 0 的对应口袋物品', () => {
    const bag = { potion: 3, 'poke-ball': 5, antidote: 0, 'old-rod': 1 };
    expect(pocketItems(dex, bag, 'medicine', K).map((i) => i.id)).toEqual(['potion']);
    expect(pocketItems(dex, bag, 'key', K)).toEqual([{ id: 'old-rod', qty: 1 }]);
  });
});

describe('对宝可梦使用道具', () => {
  it('伤药回复 20，满 HP 无效', () => {
    const p = mon(722, 20);
    expect(canUseOn(dex, 'potion', p, K)).toBe(false);
    p.hp = 5;
    const r = applyToPokemon(dex, 'potion', p, K, DAY);
    expect(r.ok).toBe(true);
    expect(p.hp).toBe(25);
  });
  it('解毒药只治中毒；濒死不能用伤药，活力碎片复活到一半', () => {
    const p = mon(258, 10);
    p.status = { kind: 'psn' } as NonNullable<typeof p.status>;
    expect(applyToPokemon(dex, 'paralyze-heal', p, K, DAY).ok).toBe(false);
    expect(applyToPokemon(dex, 'antidote', p, K, DAY).ok).toBe(true);
    expect(p.status).toBeNull();
    p.hp = 0;
    expect(applyToPokemon(dex, 'potion', p, K, DAY).ok).toBe(false);
    expect(applyToPokemon(dex, 'revive', p, K, DAY).ok).toBe(true);
    expect(p.hp).toBe(Math.floor(maxHp(dex, p) / 2));
  });
  it('进化石返回 evolveTo，不适用的宝可梦无效', () => {
    const r = applyToPokemon(dex, 'thunder-stone', mon(25, 12), K, DAY);
    expect(r.ok && r.evolveTo).toBe(26);
    expect(applyToPokemon(dex, 'thunder-stone', mon(722, 12), K, DAY).ok).toBe(false);
  });
  it('招式学习器：兼容时返回 learnMove，不消耗；不兼容 / 已学会给出原因', () => {
    const r = applyToPokemon(dex, 'tm-water-pulse', mon(258, 10), K, DAY);
    expect(r.ok && r.learnMove).toBe('water-pulse');
    expect(r.ok && r.consumed).toBe(false);
    const bad = applyToPokemon(dex, 'tm-water-pulse', mon(155, 10), K, DAY);
    expect(bad.ok).toBe(false);
  });
  it('useFromBag 生效后才扣除；无效时背包不变', () => {
    const s = newGame();
    s.party.push(mon(722, 10));
    s.bag.potion = 2;
    expect(useFromBag(dex, s, 'potion', 0, K, DAY).ok).toBe(false);
    expect(s.bag.potion).toBe(2);
    s.party[0]!.hp = 1;
    expect(useFromBag(dex, s, 'potion', 0, K, DAY).ok).toBe(true);
    expect(s.bag.potion).toBe(1);
  });
});

describe('携带 / 丢弃 / 调换', () => {
  it('携带换下的道具回到背包，收回也回到背包', () => {
    const s = newGame();
    s.party.push(mon(722, 10));
    s.bag = { 'oran-berry': 1, 'miracle-seed': 1 };
    expect(giveHeldItem(s, 0, 'oran-berry')).toEqual({ ok: true, previous: null });
    expect(giveHeldItem(s, 0, 'miracle-seed')).toEqual({ ok: true, previous: 'oran-berry' });
    expect(s.bag['oran-berry']).toBe(1);
    expect(takeHeldItem(s, 0)).toBe('miracle-seed');
    expect(s.bag['miracle-seed']).toBe(1);
    expect(s.party[0]!.heldItem).toBeNull();
  });
  it('丢弃数量夹取到持有数；调换队伍顺序', () => {
    const s = newGame();
    s.bag.potion = 3;
    expect(tossItem(s, 'potion', 10)).toBe(true);
    expect(s.bag.potion ?? 0).toBe(0);
    s.party.push(mon(722, 5), mon(155, 5));
    expect(swapParty(s, 0, 1)).toBe(true);
    expect(s.party.map((p) => p.speciesId)).toEqual([155, 722]);
    expect(swapParty(s, 0, 5)).toBe(false);
  });
});

describe('地区图鉴', () => {
  it('萌芽图鉴 40 种、无重复、全部存在于数据', () => {
    expect(SPROUT_DEX.species).toHaveLength(40);
    expect(new Set(SPROUT_DEX.species).size).toBe(40);
    for (const id of SPROUT_DEX.species) expect(dex.species(id).name.zh).toBeTruthy();
  });
  it('翠澜图鉴覆盖全部已实装物种（含碧潮群岛新宝可梦）、无重复', () => {
    const all = (speciesJson as { id: number }[]).map((x) => x.id).sort((a, b) => a - b);
    expect([...CUILAN_DEX.species].sort((a, b) => a - b)).toEqual(all);
    expect(CUILAN_DEX.species.slice(0, 40)).toEqual(SPROUT_DEX.species);
  });
  it('见过 / 捕获状态与计数', () => {
    const s = newGame();
    markSeen(s, 16);
    markCaught(s, 722);
    expect(dexStatus(s, 16)).toBe('seen');
    expect(dexStatus(s, 722)).toBe('caught');
    expect(dexStatus(s, 10)).toBe('unknown');
    expect(dexCounts(s, SPROUT_DEX.species)).toEqual({ seen: 2, caught: 1, total: 40 });
    const e = dexEntries(s, SPROUT_DEX.species);
    expect(e[0]).toMatchObject({ no: 1, speciesId: 722, status: 'caught' });
    expect(dexNo(7)).toBe('007');
  });
});
