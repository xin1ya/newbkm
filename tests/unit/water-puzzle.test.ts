/** M1-11 · 道馆 1 水位机关：纯逻辑 + 实际道馆配置可解、无死局 */
import { describe, expect, it } from 'vitest';
import { blockerRects, isStandable, reachableStates, solve, toggleLevel, valveAt, type Rect, type WaterPuzzleConfig } from '@/systems/puzzles/waterLevel';
import { getInterior, getRoom } from '@/config/interiors';

const room = getRoom(getInterior('gym-cuilan'), 'hall');
const cfg = room.waterPuzzle!;
const bounds: Rect = [-room.size[0] / 2, -room.size[1] / 2, room.size[0] / 2, room.size[1] / 2];
const DOOR: [number, number] = [0, 18.5];
const COURT: [number, number] = [0, -10];

describe('水位机关（纯逻辑）', () => {
  const tiny: WaterPuzzleConfig = {
    pool: [0, 0, 10, 4],
    start: 'high',
    levels: { high: 0, low: -1 },
    tiles: [
      { id: 'a', kind: 'island', when: 'always', rect: [0, 0, 2, 4] },
      { id: 'w', kind: 'walkway', when: 'low', rect: [2, 1, 8, 3] },
      { id: 'b', kind: 'island', when: 'always', rect: [8, 0, 10, 4] },
    ],
    valves: [{ id: 'v', position: [1, 2] }],
  };
  it('可站立判定按水位变化，池外永远可站', () => {
    expect(isStandable(tiny, 'high', 5, 2)).toBe(false);
    expect(isStandable(tiny, 'low', 5, 2)).toBe(true);
    expect(isStandable(tiny, 'high', 1, 1)).toBe(true);
    expect(isStandable(tiny, 'high', -3, 2)).toBe(true);
    expect(toggleLevel('high')).toBe('low');
  });
  it('阀门互动范围', () => {
    expect(valveAt(tiny, 1.5, 2.5)?.id).toBe('v');
    expect(valveAt(tiny, 5, 2)).toBeNull();
  });
  it('阻挡矩形恰好覆盖池中不可站立区域', () => {
    for (const level of ['high', 'low'] as const) {
      const rects = blockerRects(tiny, level);
      for (let x = 0.25; x < 10; x += 0.5)
        for (let z = 0.25; z < 4; z += 0.5) {
          const inBlock = rects.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
          expect(inBlock, `${level} ${x},${z}`).toBe(!isStandable(tiny, level, x, z));
        }
    }
    expect(blockerRects(tiny, 'high').length).toBeLessThanOrEqual(3);
  });
  it('BFS：需要一次阀门操作', () => {
    expect(solve(tiny, [0, 0, 10, 4], [1, 1], [9, 1])).toEqual({ toggles: 1, valves: ['v'] });
    expect(solve(tiny, [0, 0, 10, 4], [9, 1], [1, 1])).toBeNull(); // 对岸没有阀门：走不回来
  });
});

describe('翠澜道馆实际布局', () => {
  it('门口 → 馆主台：最少 2 次阀门（A 放水、B 蓄水）', () => {
    expect(solve(cfg, bounds, DOOR, COURT)).toEqual({ toggles: 2, valves: ['valve-a', 'valve-b'] });
  });
  it('不能绕过机关：只用一次阀门到不了馆主台', () => {
    const r = solve(cfg, bounds, DOOR, COURT)!;
    expect(r.toggles).toBeGreaterThan(1);
  });
  it('馆主台 → 门口：原路返回可行', () => {
    expect(solve(cfg, bounds, COURT, DOOR, 'high')).not.toBeNull();
  });
  it('无死局：任何可达状态（区域 × 水位）都能回到门口', () => {
    const states = reachableStates(cfg, bounds, DOOR);
    expect(states.length).toBeGreaterThan(6);
    for (const s of states) expect(solve(cfg, bounds, [s.x, s.z], DOOR, s.level), `${s.x},${s.z}@${s.level}`).not.toBeNull();
  });
  it('装饰石台永远到不了；训练家与阀门都站在石岛上', () => {
    const states = reachableStates(cfg, bounds, DOOR);
    expect(states.some((s) => s.x > -2 && s.x < 2 && s.z > 8.5 && s.z < 11.5)).toBe(false);
    for (const v of cfg.valves) expect(isStandable(cfg, 'high', ...v.position) && isStandable(cfg, 'low', ...v.position)).toBe(true);
    for (const n of room.npcs!.filter((q) => q.id.startsWith('gym-trainer'))) expect(isStandable(cfg, 'high', ...n.position) && isStandable(cfg, 'low', ...n.position), n.id).toBe(true);
  });
  it('战斗舞台与馆主在馆主台（池外）', () => {
    const [sx, sz] = room.battleStage!.position;
    expect(sz).toBeLessThan(cfg.pool[1]);
    expect(isStandable(cfg, 'low', sx, sz)).toBe(true);
  });
});
