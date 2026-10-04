import { describe, expect, it } from 'vitest';
import { RECIPES, RARE_BERRIES } from '@/config/workshop';
import items from '@/config/data/items.json';
import { KEY_ITEM_BY_ID } from '@/config/items';
const ITEM_IDS = new Set((items as { id: string }[]).map((i) => i.id));
import { SHOP_BY_ID } from '@/config/shops';
import { NPC_BY_ID } from '@/config/npcs';
import { createNewGame } from '@/systems/state';
import {
  BREEDER_START,
  BREEDER_XP,
  GOLDEN_CAN,
  breederBadges,
  breederLevel,
  breederState,
  depositDaycare,
  gainBreederXp,
  levelForXp,
  onBreederGain,
  previewDaycare,
  withdrawDaycare,
  xpToNext,
} from '@/systems/breeder';
import { canCraft, craft } from '@/systems/breeder/workshop';
import { dex, mon } from './helpers';

const newGame = () => createNewGame({ name: '小翠', gender: 'boy', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] } });

describe('培育家等级', () => {
  it('未开始不记经验，开始后按门槛升级并置位 flag', () => {
    const s = newGame();
    expect(gainBreederXp(s, 'harvest', 50).to).toBe(0);
    expect(breederLevel(s)).toBe(0);
    s.flags[BREEDER_START] = true;
    expect(breederLevel(s)).toBe(1);
    const g = gainBreederXp(s, 'harvest', BREEDER_XP[2]!);
    expect(g.to).toBe(3);
    expect(s.flags['breeder-lv3']).toBe(true);
    expect(g.rewards.some((r) => r.includes('培育章'))).toBe(true);
    expect(xpToNext(s)).toEqual({ cur: 0, need: BREEDER_XP[3]! - BREEDER_XP[2]! });
  });
  it('9 级送金色喷壶，10 级满级', () => {
    const s = newGame();
    s.flags[BREEDER_START] = true;
    const seen: number[] = [];
    const off = onBreederGain((g) => seen.push(g.to));
    gainBreederXp(s, 'mint', 99999);
    off();
    expect(seen).toEqual([10]);
    expect(s.bag[GOLDEN_CAN]).toBe(1);
    expect(KEY_ITEM_BY_ID.has(GOLDEN_CAN)).toBe(true);
    expect(levelForXp(99999)).toBe(10);
    expect(breederBadges(10)).toBe(3);
    expect(xpToNext(s)).toBeNull();
  });
});

describe('工坊', () => {
  it('等级与素材检查、扣料与产出', () => {
    const s = newGame();
    const potion = RECIPES.find((r) => r.id === 'potion')!;
    expect(canCraft(s, potion, 1)).toBe('materials');
    s.bag['medicinal-herb'] = 3;
    const before = s.bag.potion ?? 0;
    expect(craft(s, potion, 1)).toEqual({ item: 'potion', qty: 1 });
    expect(s.bag['medicinal-herb']).toBe(1);
    expect(s.bag.potion).toBe(before + 1);
    expect(canCraft(s, RECIPES.find((r) => r.id === 'revive')!, 4)).toBe('level');
  });
  it('薄荷：任选稀有树果 + 头目之鳞，产出指定性格薄荷', () => {
    const s = newGame();
    const mint = RECIPES.find((r) => r.mint)!;
    s.bag['alpha-scale'] = 1;
    s.bag[RARE_BERRIES[0]!] = 1;
    s.bag[RARE_BERRIES[1]!] = 1;
    expect(craft(s, mint, 7)).toBeNull();
    expect(craft(s, mint, 7, 'mint-adamant')).toEqual({ item: 'mint-adamant', qty: 1 });
    expect(s.bag['alpha-scale'] ?? 0).toBe(0);
    expect(s.bag['mint-adamant']).toBe(1);
  });
  it('所有配方产物与素材都是已登记物品', () => {
    for (const r of RECIPES) {
      if (!r.mint) expect(ITEM_IDS.has(r.out.item) || KEY_ITEM_BY_ID.has(r.out.item), r.id).toBe(true);
      for (const i of r.inputs) for (const id of i.item ? [i.item] : (i.anyOf ?? [])) expect(ITEM_IDS.has(id) || KEY_ITEM_BY_ID.has(id), id).toBe(true);
    }
  });
});

describe('培育屋', () => {
  it('寄放、按分钟成长、付费领回', () => {
    const s = newGame();
    s.flags[BREEDER_START] = true;
    s.party = [mon(722, 10), mon(155, 10)];
    expect(depositDaycare(s, 0, 100, 'atk')).toBe(true);
    expect(s.party.length).toBe(1);
    expect(depositDaycare(s, 0, 100, null)).toBe(false); // 至少留 1 只
    const slot = breederState(s).daycare[0]!;
    const p = previewDaycare(dex, slot, 100 + 600);
    expect(p.levels).toBeGreaterThan(0);
    expect(p.evs).toBe(100);
    expect(p.fee).toBe(100 + p.levels * 100);
    s.money = 0;
    expect(withdrawDaycare(dex, s, 0, 700)).toBeNull();
    s.money = 99999;
    expect(withdrawDaycare(dex, s, 0, 700)).not.toBeNull();
    expect(s.party.length).toBe(2);
    expect(breederState(s).daycare.length).toBe(0);
  });
});

describe('配置接线', () => {
  it('蒲婆婆是培育导师，工坊 NPC 存在，商店肥料按培育等级上架', () => {
    expect(NPC_BY_ID.get('elder-pu')?.service?.kind).toBe('breeder');
    expect(NPC_BY_ID.get('workshop-tie')?.service?.kind).toBe('workshop');
    const flags = [...SHOP_BY_ID.values()].flatMap((sh) => sh.stock.filter((x) => x.item.endsWith('mulch')).map((x) => (x as { flag?: string }).flag));
    expect(flags.length).toBeGreaterThan(0);
    for (const f of flags) expect(f).toMatch(/^breeder-lv/);
  });
});
