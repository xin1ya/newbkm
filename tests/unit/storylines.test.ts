/** 2026-10-02：剧情引导（路径 / NPC 标记）+ 玩法覆盖剧情线（计数统计 / 夜间触发）+ 战斗设置 */
import { describe, expect, it } from 'vitest';
import { QUEST_REGISTRY } from '@/config/quests';
import { NPC_BY_ID } from '@/config/npcs';
import { evaluateTriggers, npcQuestMark, questStatus, selectDialog, statCounterVars, type QuestStat } from '@/systems/quests';
import { counterCompletions } from '@/systems/quests/runtime';
import { findPath, resample, simplify } from '@/world/nav/pathfind';
import { defaultSettings } from '@/systems/state/GameState';
import { cleanEffect, effectLabel, moveDetail } from '@/ui/battle/menus';
import { dex } from './helpers';

const R = QUEST_REGISTRY;
const f = (...names: string[]) => Object.fromEntries(names.map((n) => [n, true])) as Record<string, boolean>;
const BASE = ['game-started', 'dream-prelude-done', 'starter-chosen', 'lab-visited'];

const NEW_QUESTS = ['side-dex-first-page', 'side-trainer-road', 'side-travel-prep', 'side-lake-light', 'side-forest-whisper', 'side-partner-growth'];

describe('玩法覆盖剧情线', () => {
  it('六条新支线都存在、有发起 NPC，且所有玩法统计都被至少一个目标使用', () => {
    const stats = new Set<QuestStat>();
    for (const id of NEW_QUESTS) {
      const q = R.get(id);
      expect(q, id).toBeDefined();
      expect(NPC_BY_ID.get(q!.startNpc!), id).toBeDefined();
      for (const o of q!.objectives) if (o.counter?.stat) stats.add(o.counter.stat);
    }
    const all: QuestStat[] = ['catch', 'trainer-win', 'wild-win', 'fish', 'heal', 'buy', 'surf', 'evolve'];
    for (const s of all) expect(stats.has(s), s).toBe(true);
  });

  it('每条支线：发起 NPC 的对白能接任务（置位 startFlag）并在最后交付（置位 completeFlag）', () => {
    for (const id of NEW_QUESTS) {
      const q = R.get(id)!;
      const npc = NPC_BY_ID.get(q.startNpc!)!;
      const entries = (npc.dialogByQuest ?? []).filter((d) => d.questId === id);
      expect(entries.some((d) => d.when === 'available' && d.setFlags?.includes(q.startFlag!)), id).toBe(true);
      const last = q.objectives[q.objectives.length - 1]!;
      expect(last.completeFlag).toBe(q.completeFlag);
      expect(entries.some((d) => d.when === 'active' && d.setFlags?.includes(q.completeFlag)), id).toBe(true);
    }
  });

  it('计数只累加进行中目标：没接任务时捕获不计数，接了才计数，满 3 只完成目标', () => {
    expect(statCounterVars(R, f(...BASE), 'catch')).not.toContain('dexpage-caught');
    const flags = f(...BASE, 'dexpage-start');
    expect(statCounterVars(R, flags, 'catch')).toContain('dexpage-caught');
    expect(counterCompletions(R, flags, { 'dexpage-caught': 2 })).not.toContain('dexpage-caught');
    expect(counterCompletions(R, flags, { 'dexpage-caught': 3 })).toContain('dexpage-caught');
    // 目标完成后不再累加
    expect(statCounterVars(R, f(...BASE, 'dexpage-start', 'dexpage-caught'), 'catch')).not.toContain('dexpage-caught');
  });

  it('旅行准备按顺序：先回复后购物', () => {
    const flags = f(...BASE, 'arrived-cuilan-town', 'travelprep-start');
    expect(statCounterVars(R, flags, 'buy')).not.toContain('travelprep-buys');
    expect(statCounterVars(R, flags, 'heal')).toContain('travelprep-heals');
    expect(statCounterVars(R, { ...flags, 'travelprep-healed': true }, 'buy')).toContain('travelprep-buys');
  });

  it('森林的低语：足迹只在夜里触发', () => {
    const flags = f(...BASE, 'whisper-start');
    const at = { type: 'position' as const, island: 'sprout' as const, position: [-150, 0, -110] as [number, number, number] };
    expect(evaluateTriggers(R, flags, { ...at, night: false })).not.toContain('whisper-print-1');
    expect(evaluateTriggers(R, flags, { ...at, night: true })).toContain('whisper-print-1');
  });

  it('湖底的光需要冲浪能力才会出现', () => {
    const q = R.get('side-lake-light')!;
    expect(questStatus(q, f(...BASE))).toBe('locked');
    expect(questStatus(q, f(...BASE, 'main-harbor-ferry', 'hm03-surf', 'badge-verdant'))).not.toBe('locked');
  });
});

describe('NPC 任务标记', () => {
  const aide = NPC_BY_ID.get('lab-aide-1')!;
  it('可接 → !，进行中未达成 → 无，可交付 → ?，完成后 → 无', () => {
    expect(npcQuestMark(aide, R, f(...BASE), false)).toBe('!');
    expect(npcQuestMark(aide, R, f(...BASE, 'dexpage-start'), false)).toBeNull();
    expect(npcQuestMark(aide, R, f(...BASE, 'dexpage-start', 'dexpage-caught'), false)).toBe('?');
    expect(npcQuestMark(aide, R, f(...BASE, 'dexpage-start', 'dexpage-caught', 'dexpage-done'), false)).toBeNull();
  });
  it('标记与实际对白一致：显示 ? 时对白会置位交付 flag', () => {
    const flags = f(...BASE, 'dexpage-start', 'dexpage-caught');
    const lines = selectDialog(aide, R, flags, false);
    const entry = aide.dialogByQuest!.find((d) => d.dialog === lines)!;
    expect(entry.setFlags).toContain('dexpage-done');
  });
  it('普通闲聊 NPC 没有标记', () => {
    expect(npcQuestMark(NPC_BY_ID.get('sprout-gardener')!, R, f(...BASE), false)).toBeNull();
  });
});

describe('地面路径寻路', () => {
  // 中间一堵墙（x∈[-1,1], z<6 不可通行），只能从上方绕
  const wall = (x: number, z: number): number => (Math.abs(x) < 1 && z < 6 ? Infinity : 1);
  it('绕开障碍，起止点正确', () => {
    const p = findPath(-8, 0, 8, 0, wall, { minCell: 0.5 });
    expect(p).not.toBeNull();
    for (const [x, z] of p!) expect(Math.abs(x) < 1 && z < 6).toBe(false);
    const [ex, ez] = p![p!.length - 1]!;
    expect(Math.hypot(ex - 8, ez)).toBeLessThan(1.5);
  });
  it('简化后点数更少，重采样间距均匀', () => {
    const p = findPath(-8, 0, 8, 0, wall, { minCell: 0.5 })!;
    const s = simplify(p, wall, 0.5);
    expect(s.length).toBeLessThanOrEqual(p.length);
    const r = resample(s, 1);
    for (let i = 1; i < r.length; i++) expect(r[i]![2] - r[i - 1]![2]).toBeCloseTo(1, 5);
  });
});

describe('战斗体验', () => {
  it('效果提示文案', () => {
    expect(effectLabel(2)).toContain('效果绝佳');
    expect(effectLabel(0.5)).toContain('效果不好');
    expect(effectLabel(0)).toContain('没有效果');
    expect(effectLabel(1)).toBe('');
  });
  it('默认战斗速度 1×、动画开启', () => {
    const s = defaultSettings();
    expect(s.battleSpeed).toBe(1);
    expect(s.battleAnims).toBe(true);
  });
  it('招式详情：威力 / 命中 / PP / 本系与相性', () => {
    const m = { index: 0, id: 'tackle', pp: 3, maxPp: 35, disabled: false };
    const x = moveDetail(dex, m, { foeTypes: ['ghost'], userTypes: ['normal'] });
    expect(x.power).toBe(String(dex.move('tackle').power));
    expect(x.accuracy).toBe('100');
    expect(x.ppLow).toBe(true);
    expect(x.mult).toBe(0);
    expect(x.stab).toBe(true);
    expect(x.effect.length).toBeGreaterThan(0);
    const g = moveDetail(dex, { index: 1, id: 'growl', pp: 40, maxPp: 40, disabled: false }, { foeTypes: ['ghost'] });
    expect(g.power).toBe('—');
    expect(g.mult).toBeNull();
  });
  it('招式说明去掉全角断行空格', () => {
    expect(cleanEffect('吸取对手的养分进行攻击。 可以回复给予对手 伤害的一半ＨＰ。')).toBe('吸取对手的养分进行攻击。可以回复给予对手 伤害的一半ＨＰ。');
  });
});
