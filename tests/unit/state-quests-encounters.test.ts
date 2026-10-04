import { describe, expect, it } from 'vitest';
import {
  addItem,
  createNewGame,
  deserializeSave,
  exploredRatio,
  isExplored,
  markExplored,
  receivePokemon,
  removeItem,
  SaveError,
  serializeSave,
  SAVE_VERSION,
  type GameState,
} from '@/systems/state';
import {
  currentObjective,
  evaluateTriggers,
  pendingCompletions,
  questLogEntry,
  questStatus,
  QuestRegistry,
  selectDialog,
  type Quest,
} from '@/systems/quests';
import {
  badgesOnIsland,
  buildGymTeam,
  eligibleEntries,
  grassEncounterCheck,
  gymLevelRange,
  gymTier,
  rollEncounter,
  type EncounterTable,
  type GymDef,
} from '@/systems/encounters';
import { createRng } from '@/systems/rng';
import { dex, mon, SPECIES } from './helpers';
import { SPROUT_QUESTS } from '@/config/quests/sprout';
import { SPROUT_ENCOUNTERS } from '@/config/encounters/sprout';
import { GYMS } from '@/config/encounters/gyms';

const newGame = (): GameState => createNewGame({ name: '小翠', gender: 'girl', trainerId: 12345, spawn: { island: 'sprout', xyz: [0, 0, 0] }, now: new Date('2026-09-29T00:00:00Z') });

describe('SYS-002 GameState 与存档', () => {
  it('新游戏结构', () => {
    const s = newGame();
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.party).toEqual([]);
    expect(s.position.island).toBe('sprout');
  });

  it('序列化 → 反序列化保持一致', () => {
    const s = newGame();
    s.flags['starter-chosen'] = true;
    receivePokemon(s, mon(SPECIES.rowlet, 5));
    addItem(s, 'poke-ball', 5);
    const text = serializeSave(s);
    const { state, migratedFrom, repairs } = deserializeSave(text);
    expect(migratedFrom).toBeNull();
    expect(repairs).toEqual([]);
    expect(state.party[0]?.speciesId).toBe(SPECIES.rowlet);
    expect(state.flags['starter-chosen']).toBe(true);
    expect(state.pokedex.caught).toContain(SPECIES.rowlet);
    expect(JSON.parse(text).summary).toMatchObject({ playerName: '小翠', partySpecies: [SPECIES.rowlet] });
  });

  it('旧版本存档按迁移表逐级升级', () => {
    const s = newGame();
    const env = JSON.parse(serializeSave(s));
    env.version = 1;
    delete env.data.vars;
    const migrations = {
      1: (d: Record<string, unknown>) => ({ ...d, vars: { migrated: 1 } }),
      2: (d: Record<string, unknown>) => ({ ...d, extra: true }),
    };
    const res = deserializeSave(JSON.stringify(env), migrations, 3);
    expect(res.migratedFrom).toBe(1);
    expect(res.state.version).toBe(3);
    expect(res.state.vars).toEqual({ migrated: 1 });
  });

  it('缺少迁移步骤、未来版本、非存档时报错', () => {
    const env = JSON.parse(serializeSave(newGame()));
    env.version = 1;
    expect(() => deserializeSave(JSON.stringify(env), {}, 2)).toThrow(SaveError);
    env.version = 999;
    expect(() => deserializeSave(JSON.stringify(env))).toThrow(/更新/);
    expect(() => deserializeSave('{"hello":1}')).toThrow(SaveError);
    expect(() => deserializeSave('not json')).toThrow(SaveError);
  });

  it('可修复的损坏会被自动修复', () => {
    const env = JSON.parse(serializeSave(newGame()));
    env.data.bag = { potion: -3, 'poke-ball': 2 };
    env.data.money = -1;
    const { state, repairs } = deserializeSave(JSON.stringify(env));
    expect(state.bag).toEqual({ 'poke-ball': 2 });
    expect(state.money).toBe(0);
    expect(repairs.length).toBe(2);
  });

  it('背包 / 队伍上限', () => {
    const s = newGame();
    expect(removeItem(s, 'potion', 10)).toBe(false);
    expect(removeItem(s, 'potion', 3)).toBe(true);
    expect(s.bag.potion).toBeUndefined();
    for (let i = 0; i < 7; i++) receivePokemon(s, mon(SPECIES.pidgey, 3, {}, i));
    expect(s.party).toHaveLength(6);
    expect(s.box).toHaveLength(1);
  });

  it('探索迷雾位图', () => {
    const s = newGame();
    const grid = { size: [1024, 1024] as [number, number] };
    expect(isExplored(s, 'sprout', grid, 0, 0)).toBe(false);
    const added = markExplored(s, 'sprout', grid, 0, 0, 48);
    expect(added).toBeGreaterThan(20);
    expect(isExplored(s, 'sprout', grid, 0, 0)).toBe(true);
    expect(isExplored(s, 'sprout', grid, 300, 300)).toBe(false);
    expect(markExplored(s, 'sprout', grid, 0, 0, 48)).toBe(0);
    expect(exploredRatio(s, 'sprout', grid)).toBeGreaterThan(0);
    const { state } = deserializeSave(serializeSave(s));
    expect(isExplored(state, 'sprout', grid, 0, 0)).toBe(true);
  });
});

describe('SYS-006 任务', () => {
  const q: Quest = {
    id: 'q1',
    title: '测试',
    category: 'main',
    island: '萌芽群岛',
    summary: '',
    prerequisites: ['intro-done'],
    startFlag: 'q1-start',
    completeFlag: 'q1-done',
    objectives: [
      { id: 'a', text: '进入草原', completeFlag: 'q1-a', trigger: { type: 'enter-zone', zoneId: 'sprout-meadow' } },
      { id: 'b', text: '到达灯塔', completeFlag: 'q1-b', trigger: { type: 'reach-point', position: [100, 0, 100], radius: 5 } },
    ],
  };
  const reg = new QuestRegistry([q]);

  it('状态推导（07-22 §3.2）', () => {
    expect(questStatus(q, {})).toBe('locked');
    expect(questStatus(q, { 'intro-done': true })).toBe('available');
    expect(questStatus(q, { 'intro-done': true, 'q1-start': true })).toBe('active');
    expect(questStatus(q, { 'q1-done': true })).toBe('completed');
    expect(currentObjective(q, { 'q1-a': true })?.id).toBe('b');
  });

  it('trigger 只检查当前目标，全部完成时置位任务完成 flag', () => {
    const flags: Record<string, boolean> = { 'intro-done': true, 'q1-start': true };
    expect(evaluateTriggers(reg, flags, { type: 'position', island: 'sprout', position: [100, 0, 100] })).toEqual([]);
    expect(evaluateTriggers(reg, flags, { type: 'enter-zone', zoneId: 'sprout-meadow' })).toEqual(['q1-a']);
    flags['q1-a'] = true;
    expect(evaluateTriggers(reg, flags, { type: 'position', island: 'sprout', position: [103, 0, 101] })).toEqual(['q1-b', 'q1-done']);
    expect(evaluateTriggers(reg, flags, { type: 'position', island: 'sprout', position: [120, 0, 100] })).toEqual([]);
  });

  it('剧情脚本置位全部目标后，pendingCompletions 返回待完成任务', () => {
    expect(pendingCompletions(reg, { 'intro-done': true, 'q1-start': true, 'q1-a': true, 'q1-b': true }).map((x) => x.id)).toEqual(['q1']);
  });

  it('对话优先级：dialogByQuest → 昼夜 → 默认', () => {
    const npc = { dialog: ['默认'], dialogNight: ['晚上好'], dialogByQuest: [{ questId: 'q1', when: 'active' as const, dialog: ['任务中'] }] };
    expect(selectDialog(npc, reg, { 'intro-done': true, 'q1-start': true }, false)).toEqual(['任务中']);
    expect(selectDialog(npc, reg, {}, true)).toEqual(['晚上好']);
    expect(selectDialog(npc, reg, {}, false)).toEqual(['默认']);
  });

  it('任务日志：locked 显示 ???', () => {
    expect(questLogEntry(q, {}).title).toBe('???');
    const e = questLogEntry(q, { 'intro-done': true, 'q1-start': true, 'q1-a': true });
    expect(e.objectives.map((o) => [o.done, o.current])).toEqual([
      [true, false],
      [false, true],
    ]);
  });

  it('萌芽群岛任务数据：18 条（主线 1–5 + 支线 4 + 玩法剧情线 6 + 培育家之路 3），自检无问题', () => {
    const r = new QuestRegistry(SPROUT_QUESTS);
    expect(r.all.filter((x) => x.category === 'main')).toHaveLength(5);
    expect(r.all.filter((x) => x.category === 'side')).toHaveLength(13);
    // 系统产生的 flag：徽章、农田赠送（NPC 礼物）、培育家等级（gainBreederXp）
    expect(r.validate(new Set(['game-started', 'badge-verdant', 'farm-unlocked', ...Array.from({ length: 10 }, (_, i) => `breeder-lv${i + 1}`)]))).toEqual([]);
    expect(r.getActiveQuests({ 'game-started': true }).map((x) => x.id)).toContain('main-dream-prelude');
  });
});

describe('SYS-007 遇敌与动态等级', () => {
  const table: EncounterTable = {
    id: 't',
    density: [6, 10],
    alphaChance: 0,
    shinyChance: 0,
    entries: [
      { speciesId: SPECIES.pidgey, weight: 50, levels: [2, 4], time: 'day' },
      { speciesId: SPECIES.rattata, weight: 50, levels: [2, 4] },
      { speciesId: SPECIES.poliwag, weight: 20, levels: [3, 5], weather: ['rain'] },
    ],
  };

  it('按时段 / 天气过滤', () => {
    expect(eligibleEntries(table, { time: 'night', weather: 'clear', method: 'visible' }).map((e) => e.speciesId)).toEqual([SPECIES.rattata]);
    expect(eligibleEntries(table, { time: 'day', weather: 'rain', method: 'grass' })).toHaveLength(3);
  });

  it('等级在范围内；权重分布合理', () => {
    const rng = createRng(3);
    const counts: Record<number, number> = {};
    for (let i = 0; i < 2000; i++) {
      const e = rollEncounter(table, { time: 'day', weather: 'clear', method: 'visible' }, rng, dex)!;
      expect(e.level).toBeGreaterThanOrEqual(2);
      expect(e.level).toBeLessThanOrEqual(4);
      counts[e.speciesId] = (counts[e.speciesId] ?? 0) + 1;
    }
    expect(counts[SPECIES.poliwag]).toBeUndefined();
    expect(Math.abs((counts[SPECIES.pidgey] ?? 0) / 2000 - 0.5)).toBeLessThan(0.06);
  });

  it('雨天水系权重提高', () => {
    const rng = createRng(4);
    let rainy = 0;
    for (let i = 0; i < 3000; i++) if (rollEncounter(table, { time: 'night', weather: 'rain', method: 'visible' }, rng, dex)?.speciesId === SPECIES.poliwag) rainy++;
    // 夜间：拉达 50 vs 蚊香蝌蚪 20×1.5=30 → 37.5%
    expect(Math.abs(rainy / 3000 - 0.375)).toBeLessThan(0.05);
  });

  it('头目个体等级 +5', () => {
    const t = { ...table, alphaChance: 1 };
    const e = rollEncounter(t, { time: 'night', weather: 'clear', method: 'visible' }, createRng(1), dex)!;
    expect(e.alpha).toBe(true);
    expect(e.level).toBeGreaterThanOrEqual(7);
  });

  it('暗雷概率随距离增加', () => {
    const rng = createRng(8);
    let short = 0;
    let long = 0;
    for (let i = 0; i < 2000; i++) {
      if (grassEncounterCheck(table, 1, rng)) short++;
      if (grassEncounterCheck(table, 10, rng)) long++;
    }
    expect(long).toBeGreaterThan(short * 4);
  });

  it('道馆动态等级：按本岛徽章数取档位（设计 §5.4）', () => {
    const island2: GymDef[] = ['a', 'b', 'c'].map((id) => ({
      id,
      island: 'tide',
      leader: id,
      type: 'grass',
      badgeFlag: `badge-${id}`,
      tierLevels: [19, 24, 29],
      team: [
        { speciesId: SPECIES.oddish, levelOffset: -1, moves: ['absorb'] },
        { speciesId: SPECIES.rowlet, levelOffset: 1, moves: ['leafage'] },
      ],
      ivs: 20,
      prizeMoney: 2000,
    }));
    const gymB = island2[1]!;
    expect(badgesOnIsland(island2, 'tide', {}, 'b')).toBe(0);
    expect(gymTier(gymB, 0)).toBe(0);
    expect(gymLevelRange(gymB, 0)).toEqual([18, 20]);
    const flags = { 'badge-a': true, 'badge-c': true };
    const n = badgesOnIsland(island2, 'tide', flags, 'b');
    expect(n).toBe(2);
    expect(gymLevelRange(gymB, gymTier(gymB, n))).toEqual([28, 30]);
    expect(gymTier(gymB, 99)).toBe(2);
    const team = buildGymTeam(dex, gymB, 2, createRng(1));
    expect(team.map((p) => p.level)).toEqual([28, 30]);
    expect(team[0]!.ivs.atk).toBe(20);
  });

  it('萌芽群岛配置：道馆 1 沧澜 = 海星星 + 大钳蟹 + 暴鲤龙', () => {
    const g = GYMS.find((x) => x.id === 'gym-cuilan')!;
    expect(g.leader).toBe('沧澜');
    expect(g.team.map((m) => m.speciesId)).toEqual([SPECIES.staryu, SPECIES.krabby, SPECIES.gyarados]);
    const team = buildGymTeam(dex, g, 0, createRng(2));
    for (const p of team) for (const m of p.moves) expect(dex.hasMove(m.id)).toBe(true);
    for (const t of Object.values(SPROUT_ENCOUNTERS)) for (const e of t.entries) expect(dex.hasSpecies(e.speciesId)).toBe(true);
  });
});
