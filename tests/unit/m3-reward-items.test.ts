import { describe, expect, it } from 'vitest';
import { dex } from '@/config/data';
import { createRng } from '@/systems/rng';
import { createPokemon } from '@/systems/pokemon';
import { applyToPokemon, itemInfo } from '@/systems/items';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { ITEMS } from '@/systems/battle/items';
import { hasItemIcon } from '@/ui/core/itemIcons';

const NEW = ['shiny-stone', 'ice-stone', 'dusk-stone', 'exp-candy-l', 'soul-dew', 'flying-stone', 'spirit-veil', 'seer-eye', 'ancient-amulet'];

describe('M3 支线奖励道具', () => {
  it('道具都存在并有图标', () => {
    for (const id of NEW) {
      expect(!!dex.item(id) || KEY_ITEM_BY_ID.has(id), id).toBe(true);
      expect(hasItemIcon(id), id).toBe(true);
    }
  });
  it('妙蛙种子进化线已入库', () => {
    for (const id of [1, 2, 3]) expect(dex.species(id)).toBeTruthy();
  });
  it('自定义携带物可携带、飞之石可使用', () => {
    for (const id of ['spirit-veil', 'seer-eye', 'ancient-amulet', 'soul-dew']) expect(itemInfo(dex, id, KEY_ITEM_BY_ID).holdable, id).toBe(true);
    expect(itemInfo(dex, 'flying-stone', KEY_ITEM_BY_ID).usable).toBe(true);
    expect(itemInfo(dex, 'exp-candy-l', KEY_ITEM_BY_ID).usable).toBe(true);
  });
  it('属性加成钩子', () => {
    const fake = { type: 'ghost' } as never;
    expect(ITEMS['spirit-veil']!.modifyBasePower!(fake, 'ghost')).toBe(1.2);
    expect(ITEMS['seer-eye']!.modifyBasePower!(fake, 'psychic')).toBe(1.2);
    expect(ITEMS['ancient-amulet']!.modifyBasePower!(fake, 'water')).toBe(1.2);
    const lati = { pokemon: { speciesId: 381 } } as never;
    const other = { pokemon: { speciesId: 25 } } as never;
    expect(ITEMS['soul-dew']!.modifyBasePower!(fake, 'dragon', lati)).toBe(1.2);
    expect(ITEMS['soul-dew']!.modifyBasePower!(fake, 'dragon', other)).toBe(1);
  });
  it('经验糖果L 让宝可梦升级', () => {
    const p = createPokemon(dex, 1, 5, createRng(1));
    const r = applyToPokemon(dex, 'exp-candy-l', p, KEY_ITEM_BY_ID, { timeOfDay: 'day' });
    expect(r.ok).toBe(true);
    expect(p.level).toBeGreaterThan(5);
  });
  it('飞之石没有效果', () => {
    const p = createPokemon(dex, 1, 5, createRng(1));
    const r = applyToPokemon(dex, 'flying-stone', p, KEY_ITEM_BY_ID, { timeOfDay: 'day' });
    expect(r.ok).toBe(false);
  });
});
