/** M3-05 雷鸣—琉璃海域：连接、换算、放行条件、剧情触发 */
import { describe, expect, it } from 'vitest';
import { canUseLink, glazeToThunderX, linkAt, thunderToGlazeX } from '@/systems/travel';
import { STORY_SCRIPTS, STORY_TRIGGERS } from '@/config/story';
import { THUNDER_BADGES } from '@/config/story/thunder';
import { GLAZE } from '@/config/islands/glaze';
import { THUNDER } from '@/config/islands/thunder';
import { createNewGame } from '@/systems/state/GameState';

describe('M3-05 雷鸣—琉璃海域', () => {
  it('雷鸣北缘 ↔ 琉璃礁石迷宫南口，往返换算一致且落点不在对面连接里', () => {
    const go = linkAt('thunder', -150, -1015)!;
    expect(go.to).toBe('glaze');
    const a = go.arrive(-150, -1015);
    expect(a.z).toBe(1000);
    expect(linkAt('glaze', a.x, a.z)).toBeNull();
    expect(linkAt('glaze', a.x, 1015)!.to).toBe('thunder');
    for (const x of [-300, -150, 0]) expect(Math.abs(glazeToThunderX(thunderToGlazeX(x)) - x)).toBeLessThan(1);
    expect(thunderToGlazeX(-1000)).toBeGreaterThanOrEqual(-580);
    expect(thunderToGlazeX(1000)).toBeLessThanOrEqual(-180);
  });

  it('未放行时挡回，放行后冲浪可过；飞行需到访过琉璃', () => {
    const s = createNewGame({ name: 'T', gender: 'boy', trainerId: 1, spawn: { island: 'thunder', xyz: [0, 0, 0] } });
    const go = linkAt('thunder', -150, -1015)!;
    expect(canUseLink(s, go, 'surf').ok).toBe(false);
    s.flags['glaze-route-open'] = true;
    expect(canUseLink(s, go, 'surf').ok).toBe(true);
    expect(canUseLink(s, go, 'fly').ok).toBe(false);
  });

  it('放行剧情需要雷鸣四枚徽章；到达卡在迷宫南口与幻影镇都会触发', () => {
    const t = STORY_TRIGGERS.find((q) => q.id === 'glaze-route-open')!;
    expect(t.showIf).toEqual([...THUNDER_BADGES]);
    expect(STORY_SCRIPTS.get('glaze-route-open')!.steps.some((s) => s.kind === 'flag' && s.set === 'glaze-route-open')).toBe(true);
    expect(STORY_TRIGGERS.filter((q) => q.script === 'glaze-arrival').length).toBe(2);
  });

  it('两张地图的冲浪范围都包含走廊，海域常年海雾', () => {
    expect(THUNDER.travelBounds!.some(([x, z]) => z === -1024 && x <= -300)).toBe(true);
    expect(GLAZE.travelBounds!.filter(([, z]) => z === 1024).map(([x]) => x)).toEqual([-640, -120]);
    const route = GLAZE.zones.find((z) => z.id === 'glaze-sea-route')!;
    expect(route.weather![0]!.weather).toBe('seafog');
    expect(THUNDER.zones.find((z) => z.id === 'thunder-glaze-route')!.encounterTable).toBe('glaze-sea-route');
  });
});
