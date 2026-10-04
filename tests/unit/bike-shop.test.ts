import { describe, expect, it } from 'vitest';
import { buy, isOnceItem, shopInventory } from '@/systems/shop';
import { createNewGame } from '@/systems/state';
import { ITEM_PRICES, SHOP_BY_ID } from '@/config/shops';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { BIKE_SPEED } from '@/systems/ride';

const newGame = () => createNewGame({ name: '小翠', gender: 'girl', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] }, now: new Date('2026-10-03T00:00:00Z') });

describe('自行车（萌芽镇友好商店）', () => {
  const mart = SHOP_BY_ID.get('cuilan-mart')!;

  it('是重要物品，在友好商店限购 1 辆', () => {
    expect(KEY_ITEM_BY_ID.get('bicycle')?.pocket).toBe('key');
    expect(isOnceItem(mart, 'bicycle')).toBe(true);
    expect(BIKE_SPEED).toBeGreaterThan(7.6);
  });

  it('买过后下架，不能再买', () => {
    const s = newGame();
    s.money = 20000;
    expect(shopInventory(mart, s.flags, s.bag)).toContain('bicycle');
    expect(buy(s, ITEM_PRICES, mart, 'bicycle', 2).ok).toBe(false);
    expect(buy(s, ITEM_PRICES, mart, 'bicycle', 1).ok).toBe(true);
    expect(s.bag.bicycle).toBe(1);
    expect(s.money).toBe(20000 - ITEM_PRICES.bicycle!);
    expect(shopInventory(mart, s.flags, s.bag)).not.toContain('bicycle');
    expect(buy(s, ITEM_PRICES, mart, 'bicycle', 1).ok).toBe(false);
  });
});
