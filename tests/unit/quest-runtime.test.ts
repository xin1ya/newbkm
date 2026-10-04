/** M1-16：任务运行时（追踪、进度差异、奖励、计数目标、罗盘） */
import { describe, expect, it } from 'vitest';
import { QUEST_REGISTRY } from '@/config/quests';
import { evaluateTriggers, pendingCompletions } from '@/systems/quests';
import {
  TRACK_NONE,
  bearingDeg,
  compassReading,
  counterCompletions,
  diffProgress,
  formatDistance,
  grantReward,
  objectiveProgress,
  polygonCentroid,
  resolveMarker,
  resolveTracked,
  rewardFlag,
  rewardLines,
  snapshotQuests,
  unrewarded,
  wrapDeg,
} from '@/systems/quests/runtime';
import { createNewGame, type GameState } from '@/systems/state/GameState';
import { createRng } from '@/systems/rng';
import { dex } from './helpers';

const R = QUEST_REGISTRY;
const newGame = (): GameState => createNewGame({ name: '小翠', gender: 'girl', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] }, now: new Date('2026-09-29T00:00:00Z') });
const f = (...names: string[]) => Object.fromEntries(names.map((n) => [n, true]));

describe('追踪选择', () => {
  it('自动追踪优先主线；指定且进行中的任务优先；取消追踪返回 null', () => {
    const flags = f('game-started', 'dream-prelude-done', 'starter-chosen', 'lab-visited', 'zorua-quest-start');
    expect(resolveTracked(R, flags, null)?.id).toBe('main-gym-verdant');
    expect(resolveTracked(R, flags, 'side-zorua-forest')?.id).toBe('side-zorua-forest');
    expect(resolveTracked(R, flags, TRACK_NONE)).toBeNull();
    // 指定的任务已完成 / 未开始 → 回到自动
    expect(resolveTracked(R, flags, 'side-fisherman-lost')?.id).toBe('main-gym-verdant');
  });
  it('没有进行中的任务时为 null', () => {
    expect(resolveTracked(R, {}, null)).toBeNull();
  });
});

describe('进度差异通知', () => {
  it('开始 → 目标完成 → 任务完成', () => {
    const a = snapshotQuests(R, f('game-started', 'dream-prelude-done'));
    const b = snapshotQuests(R, f('game-started', 'dream-prelude-done', 'lab-visited'));
    const n1 = diffProgress(R, a, b);
    expect(n1.map((n) => `${n.kind}:${n.quest.id}`)).toEqual(['objective:main-get-starter']);
    const c = snapshotQuests(R, f('game-started', 'dream-prelude-done', 'lab-visited', 'starter-chosen'));
    const n2 = diffProgress(R, b, c).map((n) => `${n.kind}:${n.quest.id}`);
    expect(n2).toContain('completed:main-get-starter');
    expect(n2).toContain('started:main-gym-verdant');
    // 前置满足的支线：可接取提示
    expect(n2).toContain('available:side-zorua-forest');
    expect(n2).toContain('available:side-elder-herbs');
  });
  it('一次跳过多个目标时逐个通知', () => {
    const base = f('starter-chosen', 'fisher-tackle-returned', 'fishing-contest-start');
    const a = snapshotQuests(R, base);
    const b = snapshotQuests(R, { ...base, 'contest-magikarp': true, 'contest-tentacool': true });
    const n = diffProgress(R, a, b).filter((x) => x.quest.id === 'side-fishing-contest');
    expect(n.map((x) => (x.kind === 'objective' ? x.done.id : x.kind))).toEqual(['magikarp', 'tentacool']);
  });
});

describe('奖励', () => {
  it('完成后发放一次：道具 / 金钱 / 能力 flag / 宝可梦', () => {
    const s = newGame();
    const q = R.get('side-fishing-contest')!;
    expect(grantReward(dex, s, q, createRng(1))).toBeNull(); // 未完成
    s.flags['fishing-contest-done'] = true;
    const money = s.money;
    const lines = grantReward(dex, s, q, createRng(1))!;
    expect(lines.map((l) => l.kind)).toEqual(['item', 'money']);
    expect(s.bag['super-rod']).toBe(1);
    expect(s.money).toBe(money + 2000);
    expect(s.flags[rewardFlag(q.id)]).toBe(true);
    expect(grantReward(dex, s, q, createRng(1))).toBeNull(); // 不重复
    const gym = R.get('main-gym-verdant')!;
    s.flags['badge-verdant'] = true;
    grantReward(dex, s, gym, createRng(1));
    expect(s.flags['hm03-surf']).toBe(true);
    const zorua = R.get('side-zorua-forest')!;
    s.flags['zorua-quest-done'] = true;
    grantReward(dex, s, zorua, createRng(1));
    expect(s.party.at(-1)).toMatchObject({ speciesId: 570, level: 12 });
  });
  it('unrewarded 找出已完成但未发奖励的任务', () => {
    expect(unrewarded(R, f('starter-chosen')).map((q) => q.id)).toEqual(['main-get-starter']);
    expect(unrewarded(R, f('starter-chosen', rewardFlag('main-get-starter')))).toEqual([]);
  });
  it('每个任务的奖励明细都能生成', () => {
    for (const q of R.all) for (const l of rewardLines(q)) expect(l.qty).toBeGreaterThan(0);
  });
});

describe('计数目标', () => {
  it('药草 0/3 → 3/3 时置位目标 flag', () => {
    const flags = f('starter-chosen', 'herbs-quest-start');
    const obj = R.get('side-elder-herbs')!.objectives[0]!;
    expect(objectiveProgress(obj, {})).toEqual({ current: 0, target: 3 });
    expect(objectiveProgress(obj, { 'herbs-collected': 5 })).toEqual({ current: 3, target: 3 });
    expect(counterCompletions(R, flags, { 'herbs-collected': 2 })).toEqual([]);
    expect(counterCompletions(R, flags, { 'herbs-collected': 3 })).toEqual(['herbs-collected']);
  });
});

describe('触发链', () => {
  it('reach-point 完成「前往研究所」；最后一个目标由 trigger 完成时同时置位任务 flag', () => {
    const flags = f('game-started', 'dream-prelude-done');
    expect(evaluateTriggers(R, flags, { type: 'position', island: 'sprout', position: [-20, 0, 347] })).toEqual(['lab-visited']);
    const g = f('starter-chosen', 'arrived-cuilan-town');
    expect(evaluateTriggers(R, g, { type: 'defeat', trainerId: 'gym-cuilan-leader' })).toEqual(['badge-verdant']);
    expect(pendingCompletions(R, f('herbs-quest-start', 'starter-chosen'))).toEqual([]);
  });
});

describe('罗盘', () => {
  it('方位角：北 0°，东 90°，南 180°，西 270°', () => {
    expect(bearingDeg(0, -1)).toBeCloseTo(0);
    expect(bearingDeg(1, 0)).toBeCloseTo(90);
    expect(bearingDeg(0, 1)).toBeCloseTo(180);
    expect(bearingDeg(-1, 0)).toBeCloseTo(270);
    expect(wrapDeg(270)).toBe(-90);
    expect(wrapDeg(-180)).toBe(180);
  });
  it('相对角度与范围判断', () => {
    const t = { island: 'sprout' as const, x: 10, z: 0, radius: 0, zoneId: null };
    // 面向北，目标在正东 → +90°
    const r = compassReading({ x: 0, z: 0 }, { x: 0, z: -1 }, t);
    expect(r.relative).toBeCloseTo(90);
    expect(r.distance).toBeCloseTo(10);
    expect(r.inside).toBe(false);
    expect(compassReading({ x: 8, z: 0 }, { x: 1, z: 0 }, { ...t, radius: 5 }).inside).toBe(true);
    expect(formatDistance(128.4)).toBe('128 m');
    expect(formatDistance(1530)).toBe('1.5 km');
  });
  it('区域标记解析为多边形中心', () => {
    expect(polygonCentroid([[0, 0], [10, 0], [10, 10], [0, 10]])).toEqual({ x: 5, z: 5 });
    const m = resolveMarker({ island: 'sprout', zoneId: 'z' }, () => ({ x: 3, z: 4 }));
    expect(m).toMatchObject({ x: 3, z: 4, zoneId: 'z', radius: 0 });
    expect(resolveMarker({ island: 'sprout', zoneId: 'missing' }, () => null)).toBeNull();
  });
  it('所有任务的区域标记都能在岛屿配置里找到', async () => {
    const { SPROUT } = await import('@/config/islands/sprout');
    const zones = new Set(SPROUT.zones.map((z) => z.id));
    for (const q of R.all) for (const o of q.objectives) if (o.marker?.island === 'sprout' && o.marker.zoneId) expect(zones, `${q.id}/${o.id}`).toContain(o.marker.zoneId);
  });
});
