/**
 * ACT-002 野生 AI 状态机 + WLD-004 分块规划（纯函数部分，无 three 渲染依赖）。
 */
import { describe, expect, it } from 'vitest';
import { contactInitiative, createBrain, perceive, stepBrain, CONTACT_DIST, LEASH_RADIUS, type Perception, type WildBrain } from '@/world/spawns/wildAI';
import { ChunkGrid, chunkId, type Lod } from '@/world/streaming/ChunkGrid';

const fixed = (v = 0.5) => () => v;
const opts = { sight: 16, speed: 3, sleepsAtNight: false };
const see = (b: WildBrain, px: number, pz: number, extra: Partial<Perception> = {}): Perception => ({ px, pz, playerRunning: false, playerInGrass: false, isNight: false, x: b.homeX, z: b.homeZ, ...extra });
/** 让个体面朝 +Z，玩家在正前方 dist 米 */
function facing(temperament: Parameters<typeof createBrain>[2], o = opts): WildBrain {
  const b = createBrain(0, 0, temperament, o, fixed());
  b.yaw = 0;
  return b;
}
function run(b: WildBrain, p: Perception, seconds: number, dt = 1 / 30) {
  let last = stepBrain(b, p, dt, fixed());
  for (let t = dt; t < seconds; t += dt) last = stepBrain(b, p, dt, fixed());
  return last;
}

describe('wildAI · 察觉', () => {
  it('视野锥内距离越近察觉越强，锥外只靠听觉', () => {
    const b = facing('calm');
    const near = perceive(b, see(b, 0, 4));
    const far = perceive(b, see(b, 0, 14));
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    // 正后方 10 m：走路听不到，奔跑能听到
    expect(perceive(b, see(b, 0, -10))).toBe(0);
    expect(perceive(b, see(b, 0, -8, { playerRunning: true }))).toBeGreaterThan(0);
  });

  it('草丛与夜晚缩短视距', () => {
    const b = facing('calm');
    expect(perceive(b, see(b, 0, 12))).toBeGreaterThan(0);
    expect(perceive(b, see(b, 0, 12, { playerInGrass: true }))).toBe(0);
    expect(perceive(b, see(b, 0, 12, { isNight: true }))).toBe(0);
  });
});

describe('wildAI · 性格反应', () => {
  it('胆小：察觉后逃离玩家', () => {
    const b = facing('timid');
    const out = run(b, see(b, 0, 5), 2.5);
    expect(b.state).toBe('flee');
    expect(out.mz).toBeLessThan(0);
    expect(out.speedScale).toBeGreaterThan(1);
  });

  it('好斗：追击并在接触距离内触发遭遇', () => {
    const b = facing('aggressive');
    run(b, see(b, 0, 6), 2.5);
    expect(b.state).toBe('chase');
    const out = stepBrain(b, see(b, 0, CONTACT_DIST * 0.5), 1 / 30, fixed());
    expect(out.engage).toBe(true);
    expect(out.emote).toBe('!');
  });

  it('好奇：靠近但停在 3 m 外，头顶显示问号', () => {
    const b = facing('curious');
    run(b, see(b, 0, 8), 2.5);
    expect(b.state).toBe('approach');
    expect(stepBrain(b, see(b, 0, 8), 1 / 30, fixed()).speedScale).toBeGreaterThan(0);
    expect(stepBrain(b, see(b, 0, 2.5), 1 / 30, fixed()).speedScale).toBe(0);
  });

  it('追击超出拴绳半径后返回出生点', () => {
    const b = facing('aggressive');
    run(b, see(b, 0, 6), 2.5);
    expect(b.state).toBe('chase');
    stepBrain(b, { ...see(b, 0, 6), x: 0, z: LEASH_RADIUS + 5, pz: LEASH_RADIUS + 8 }, 1 / 30, fixed());
    expect(b.state).toBe('return');
  });

  it('夜间嗜睡个体睡觉；玩家奔跑贴近会惊醒', () => {
    const b = facing('calm', { ...opts, sleepsAtNight: true });
    const out = stepBrain(b, see(b, 0, 10, { isNight: true }), 1 / 30, fixed());
    expect(b.state).toBe('sleep');
    expect(out.emote).toBe('z');
    stepBrain(b, see(b, 0, 2, { isNight: true, playerRunning: true }), 1 / 30, fixed());
    expect(b.state).not.toBe('sleep');
  });
});

describe('wildAI · 接触先手（设计 §5.3）', () => {
  it('追击中接触 → 野生先手；背后接近或睡觉 → 玩家先手；正面 → 按速度', () => {
    const b = facing('calm');
    expect(contactInitiative(b, 0, -1, 0, 0)).toBe('player');
    expect(contactInitiative(b, 0, 1, 0, 0)).toBeNull();
    b.state = 'chase';
    expect(contactInitiative(b, 0, 1, 0, 0)).toBe('wild');
    b.state = 'sleep';
    expect(contactInitiative(b, 0, 1, 0, 0)).toBe('player');
  });
});

describe('ChunkGrid · 分块规划（128 m 块）', () => {
  const grid = new ChunkGrid(8, 128, 512);

  it('坐标 ↔ 块号互逆，并夹在岛屿范围内', () => {
    expect(grid.chunkOf(-512, -512)).toEqual({ cx: 0, cz: 0 });
    expect(grid.chunkOf(0.1, 0.1)).toEqual({ cx: 4, cz: 4 });
    expect(grid.chunkOf(9999, -9999)).toEqual({ cx: 7, cz: 0 });
    const c = grid.center(4, 4);
    expect(grid.chunkOf(c.x, c.z)).toEqual({ cx: 4, cz: 4 });
  });

  it('空载时加载 LOD0 3×3 + LOD1 外圈（5×5），近处优先', () => {
    const tasks = grid.plan(0, 0, new Map(), 1, 2);
    const add = tasks.filter((t) => t.lod !== null);
    expect(add.filter((t) => t.lod === 0)).toHaveLength(9);
    expect(add.filter((t) => t.lod === 1)).toHaveLength(16);
    // 先建 LOD0 再建 LOD1；同一档内由近到远
    const lastL0 = tasks.map((t) => t.lod).lastIndexOf(0);
    const firstL1 = tasks.findIndex((t) => t.lod === 1);
    expect(lastL0).toBeLessThan(firstL1);
    for (let i = 1; i < tasks.length; i++) if (tasks[i]!.lod === tasks[i - 1]!.lod) expect(tasks[i]!.dist).toBeGreaterThanOrEqual(tasks[i - 1]!.dist);
  });

  it('全部就绪时无任务；移动一块后只处理边缘', () => {
    const loaded = new Map<string, Lod>();
    for (const t of grid.plan(0, 0, new Map(), 1, 2)) if (t.lod !== null) loaded.set(chunkId(t.cx, t.cz), t.lod as Lod);
    expect(grid.plan(0, 0, loaded, 1, 2)).toHaveLength(0);
    const moved = grid.plan(128, 0, loaded, 1, 2);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.length).toBeLessThan(25);
  });

  it('滞回：刚离开的 LOD0 块不会立刻降级', () => {
    const loaded = new Map<string, Lod>();
    for (const t of grid.plan(0, 0, new Map(), 1, 2)) if (t.lod !== null) loaded.set(chunkId(t.cx, t.cz), t.lod as Lod);
    const withH = grid.plan(128, 0, loaded, 1, 2, true).filter((t) => t.lod === 1 && loaded.get(chunkId(t.cx, t.cz)) === 0);
    const noH = grid.plan(128, 0, loaded, 1, 2, false).filter((t) => t.lod === 1 && loaded.get(chunkId(t.cx, t.cz)) === 0);
    expect(withH).toHaveLength(0);
    expect(noH.length).toBeGreaterThan(0);
  });

  it('岛屿边缘不会规划越界块', () => {
    for (const t of grid.plan(-512, -512, new Map(), 1, 2)) {
      expect(t.cx).toBeGreaterThanOrEqual(0);
      expect(t.cz).toBeGreaterThanOrEqual(0);
    }
  });
});
