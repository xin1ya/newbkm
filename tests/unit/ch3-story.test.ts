/** M3-24 第三章主线 14–19：二度跨海、冰封秘密、天空异象 */
import { describe, expect, it } from 'vitest';
import { STORY_SCRIPTS, STORY_TRIGGERS } from '@/config/story';
import { THUNDER_BADGES } from '@/config/story/thunder';
import { QUEST_REGISTRY } from '@/config/quests';
import { INTERIORS } from '@/config/interiors';
import { ALL_INTERACTIONS } from '@/config/interactions';
import { NPC_BY_ID } from '@/config/npcs';
import { linkAt } from '@/systems/travel';
import moves from '@/config/data/moves.json';
import type { StoryStep } from '@/systems/story';

const MOVES = new Set((moves as Array<{ id: string }>).map((m) => m.id));
const flagsSet = (steps: StoryStep[]): string[] =>
  steps.flatMap((s) => (s.kind === 'flag' ? [s.set] : s.kind === 'battle' ? [...flagsSet(s.onWin ?? []), ...flagsSet(s.onLose ?? [])] : []));

describe('M3-24 第三章主线', () => {
  it('第三章 6 条主线任务齐全、顺序衔接', () => {
    for (const id of ['main-cross-sea-2', 'main-gym-thunder', 'main-gym-dawn', 'main-snow-ruins', 'main-gym-snow', 'main-gym-cloud']) expect(QUEST_REGISTRY.get(id), id).toBeTruthy();
    expect(QUEST_REGISTRY.get('main-cross-sea-2')!.prerequisites).toEqual(['hot-spring-info-heard']);
    expect(QUEST_REGISTRY.get('main-gym-thunder')!.prerequisites).toEqual(['thunder-arrival-card']);
    expect(QUEST_REGISTRY.get('main-snow-ruins')!.reward!.items![0]!.id).toBe('anomaly-shard-blue');
  });

  it('到达卡：冲浪落点在西缘触发区内，雷鸣镇也会触发', () => {
    const a = linkAt('tide', 1015, 650)!.arrive(1015, 650);
    const sea = STORY_TRIGGERS.find((t) => t.id === 'thunder-arrival-sea')!;
    const [x0, z0, x1, z1] = sea.rect!;
    expect(a.x >= x0 && a.x <= x1 && a.z >= z0 && a.z <= z1).toBe(true);
    expect(STORY_TRIGGERS.filter((t) => t.script === 'thunder-arrival').length).toBe(2);
    expect(flagsSet(STORY_SCRIPTS.get('thunder-arrival')!.steps)).toContain('thunder-arrival-card');
  });

  it('冰川遗迹：入口 / 圣所 / 圣坛三段触发都会产出任务目标 flag', () => {
    const gr = INTERIORS['glacier-ruins']!;
    const trig = gr.rooms.flatMap((r) => r.triggers ?? []);
    const quest = QUEST_REGISTRY.get('main-snow-ruins')!;
    for (const o of quest.objectives) {
      const t = trig.find((x) => x.doneFlag === o.completeFlag)!;
      expect(t, o.id).toBeTruthy();
      expect(flagsSet(STORY_SCRIPTS.get(t.script)!.steps)).toContain(o.completeFlag);
    }
    const altar = trig.find((t) => t.id === 'glacier-altar')!;
    expect(altar.repeat).toBe(true);
    expect(altar.showIf).toEqual(['glacier-sanctum-reached']);
  });

  it('守护者战：BOSS、不可捕获、招式存在；输了不给碎片', () => {
    const b = STORY_SCRIPTS.get('glacier-altar')!.steps.find((s) => s.kind === 'battle')!;
    if (b.kind !== 'battle') throw new Error();
    expect(b.boss && b.noCapture).toBe(true);
    for (const m of b.moves ?? []) expect(MOVES.has(m), m).toBe(true);
    expect(flagsSet(b.onLose ?? [])).not.toContain('snow-ruins-shard');
  });

  it('圣坛调查与学者对话随进度变化；天空异象需四徽章 + 蓝碎片', () => {
    expect(ALL_INTERACTIONS.find((i) => i.id === 'gr-altar')!.byFlag!.some((b) => b.when === 'snow-ruins-shard')).toBe(true);
    expect(NPC_BY_ID.get('gr-scholar')!.dialogByQuest!.length).toBe(2);
    const sky = STORY_TRIGGERS.find((t) => t.id === 'sky-anomaly')!;
    expect(sky.showIf).toEqual([...THUNDER_BADGES, 'snow-ruins-shard']);
    expect(flagsSet(STORY_SCRIPTS.get('sky-anomaly')!.steps)).toContain('sky-anomaly-seen');
  });
});
