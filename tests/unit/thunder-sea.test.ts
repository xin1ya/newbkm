import { describe, expect, it } from 'vitest';
import { currentAt, whirlpoolAt, whirlpoolEject } from '@/systems/travel/sea';
import { canUseLink, linkAt, thunderToTideZ, tideToThunderZ } from '@/systems/travel';
import { THUNDER } from '@/config/islands/thunder';
import { ENCOUNTER_TABLES } from '@/config/encounters';
import { createNewGame } from '@/systems/state/GameState';

describe('M3-03 碧潮—雷鸣海域', () => {
  it('洋流沿折线方向推动，中心最强、带外为 0', () => {
    const c = THUNDER.currents!.find((x) => x.id === 'current-west')!;
    const mid = currentAt(THUNDER.currents, -900, 400);
    expect(mid.id).toBe('current-west');
    expect(mid.z).toBeLessThan(-c.speed * 0.9); // 向北（-z）
    expect(Math.abs(mid.x)).toBeLessThan(0.5);
    expect(currentAt(THUNDER.currents, -820, 400).id).toBeNull();
    expect(currentAt(THUNDER.currents, -740, 400).z).toBeGreaterThan(2); // 东流向南
  });
  it('漩涡卷入后甩到半径外', () => {
    const w = whirlpoolAt(THUNDER.whirlpools, -820, 195)!;
    expect(w.id).toBe('whirl-north');
    const o = whirlpoolEject(w, -820, 195);
    expect(Math.hypot(o.x - w.center[0], o.z - w.center[1])).toBeGreaterThan(w.radius);
    expect(whirlpoolAt(THUNDER.whirlpools, o.x, o.z)).toBeNull();
  });
  it('温泉乡码头放行后才能横渡；回程不设限', () => {
    const s = createNewGame({ name: 'T', gender: 'boy', trainerId: 1, spawn: { island: 'tide', xyz: [0, 0, 0] } });
    const go = linkAt('tide', 1015, 650)!;
    expect(go.to).toBe('thunder');
    const v = canUseLink(s, go, 'surf');
    expect(v.ok).toBe(false);
    s.flags['thunder-route-open'] = true;
    expect(canUseLink(s, go, 'surf').ok).toBe(true);
    expect(linkAt('thunder', -1015, 400)!.to).toBe('tide');
    // 坐标换算互逆（误差 < 1 m），到达点不会立刻落进对岸的连接矩形
    for (const z of [530, 650, 770]) expect(Math.abs(thunderToTideZ(tideToThunderZ(z)) - z)).toBeLessThan(1);
    expect(linkAt('thunder', go.arrive(1015, 650).x, go.arrive(1015, 650).z)).toBeNull();
  });
  it('雷鸣所有野外区域都有遇敌表', () => {
    for (const z of THUNDER.zones) if (z.encounterTable) expect(ENCOUNTER_TABLES[z.encounterTable], z.id).toBeTruthy();
  });
});
