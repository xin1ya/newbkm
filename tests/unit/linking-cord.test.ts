import { describe, expect, it } from 'vitest';
import { itemInfo } from '@/systems/items';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { SHOP_BY_ID } from '@/config/shops';
import { checkEvolution, evolve, LINKING_CORD } from '@/systems/progression';
import { dex, mon } from './helpers';

describe('通信交换进化 → 携带联系绳升级', () => {
  it('鬼斯通不携带联系绳不会进化', () => {
    const p = mon(93, 30);
    expect(checkEvolution(dex, p, { timeOfDay: 'day' })).toBeNull();
    p.heldItem = 'oran-berry';
    expect(checkEvolution(dex, p, { timeOfDay: 'night' })).toBeNull();
  });

  it('携带联系绳升级后进化为耿鬼，联系绳被消耗', () => {
    const p = mon(93, 30);
    p.heldItem = LINKING_CORD;
    expect(checkEvolution(dex, p, { timeOfDay: 'day' })).toBe(94);
    evolve(dex, p, 94);
    expect(p.speciesId).toBe(94);
    expect(p.heldItem).toBeNull();
  });

  it('需要特定携带物的交换进化仍需该携带物（蚊香君 + 王者之证 → 蚊香蛙皇）', () => {
    const p = mon(61, 30);
    p.heldItem = LINKING_CORD;
    expect(checkEvolution(dex, p, { timeOfDay: 'day' })).toBeNull();
    p.heldItem = 'kings-rock';
    expect(checkEvolution(dex, p, { timeOfDay: 'day' })).toBe(186);
    evolve(dex, p, 186);
    expect(p.heldItem).toBeNull();
  });

  it('隆隆石、豪力同样走联系绳', () => {
    for (const [from, to] of [[75, 76], [67, 68]] as const) {
      const p = mon(from, 30);
      p.heldItem = LINKING_CORD;
      expect(checkEvolution(dex, p, { timeOfDay: 'day' })).toBe(to);
    }
  });

  it('联系绳可携带、可在海货摊（1 枚徽章后）买到', () => {
    const info = itemInfo(dex, LINKING_CORD, KEY_ITEM_BY_ID);
    expect(info.name).toBe('联系绳');
    expect(info.holdable).toBe(true);
    expect(SHOP_BY_ID.get('harbor-sea')?.stock).toContainEqual({ item: LINKING_CORD, badges: 1 });
  });
});
