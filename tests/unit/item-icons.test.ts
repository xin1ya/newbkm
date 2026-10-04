import { describe, expect, it } from 'vitest';
import items from '@/config/data/items.json';
import { KEY_ITEMS } from '@/config/items';
import { hasItemIcon, itemIconSvg } from '@/ui/core/itemIcons';

describe('道具图标', () => {
  const ids = [...(items as { id: string }[]).map((i) => i.id), ...KEY_ITEMS.map((k) => k.id)];
  it('所有道具都有专属图标', () => {
    expect(ids.filter((id) => !hasItemIcon(id))).toEqual([]);
  });
  it('输出合法 SVG，未知道具按口袋回退', () => {
    for (const id of ids) expect(itemIconSvg(id)).toMatch(/^<svg [^>]*viewBox="0 0 48 48"[\s\S]*<\/svg>$/);
    expect(itemIconSvg('unknown-thing', { pocket: 'medicine' })).toContain('<svg');
    expect(itemIconSvg('tm-x', { tmColor: '#123456' })).toContain('#123456');
  });
});
