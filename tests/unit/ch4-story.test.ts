/** M3-25 第四章主线 20–27：三度跨海、亡魂低吟（异变碎片·幽）、道馆 / 冠军之路 / 联盟衔接 */
import { describe, expect, it } from 'vitest';
import { STORY_SCRIPTS } from '@/config/story';
import { QUEST_REGISTRY } from '@/config/quests';
import { INTERIORS } from '@/config/interiors';
import { ALL_INTERACTIONS } from '@/config/interactions';
import { NPC_BY_ID } from '@/config/npcs';
import { KEY_ITEMS } from '@/config/items';
import items from '@/config/data/items.json';
import moves from '@/config/data/moves.json';
import type { StoryStep } from '@/systems/story';

const MOVES = new Set((moves as Array<{ id: string }>).map((m) => m.id));
const flagsSet = (steps: StoryStep[]): string[] =>
  steps.flatMap((s) => (s.kind === 'flag' ? [s.set] : s.kind === 'battle' ? [...flagsSet(s.onWin ?? []), ...flagsSet(s.onLose ?? [])] : []));

describe('M3-25 第四章主线', () => {
  it('第四章 8 条主线齐全，标题与 07-22 §3.6 一致', () => {
    const want: Array<[string, string]> = [
      ['main-cross-sea-3', '三度跨海'],
      ['main-gym-mirage', '精神异变'],
      ['main-ghost-event', '亡魂低吟'],
      ['main-gym-ghost', '幽之试炼'],
      ['main-gym-lily', '水之试炼·终'],
      ['main-victory-road', '冠军之路'],
      ['main-league', '精灵联盟'],
    ];
    for (const [id, title] of want) expect(QUEST_REGISTRY.get(id)?.title, id).toBe(title);
    expect(QUEST_REGISTRY.get('main-gym-ghost')!.summary).toContain('幽冥镇');
  });

  it('三度跨海衔接第三章；琉璃道馆以它为前置', () => {
    expect(QUEST_REGISTRY.get('main-cross-sea-3')!.prerequisites).toContain('snow-ruins-shard');
    for (const id of ['main-gym-mirage', 'main-gym-ghost', 'main-gym-lily', 'main-ghost-event']) expect(QUEST_REGISTRY.get(id)!.prerequisites, id).toEqual(['glaze-arrival-card']);
  });

  it('亡魂低吟：巫女接取 → 洞口 → 祭坛 BOSS → 碎片·幽', () => {
    const q = QUEST_REGISTRY.get('main-ghost-event')!;
    expect(NPC_BY_ID.get('ghost-priestess')!.dialogByQuest!.some((d) => d.when === 'available' && d.setFlags?.includes('ghost-event-start'))).toBe(true);
    const trig = INTERIORS['shadow-cave']!.rooms.flatMap((r) => r.triggers ?? []);
    for (const o of q.objectives) {
      const t = trig.find((x) => x.doneFlag === o.completeFlag)!;
      expect(t, o.id).toBeTruthy();
      expect(flagsSet(STORY_SCRIPTS.get(t.script)!.steps)).toContain(o.completeFlag);
    }
    const altar = trig.find((t) => t.id === 'shadow-altar')!;
    expect(altar.repeat && altar.showIf?.includes('ghost-event-start')).toBe(true);
    const b = STORY_SCRIPTS.get('shadow-altar')!.steps.find((s) => s.kind === 'battle')!;
    if (b.kind !== 'battle') throw new Error();
    expect(b.boss && b.noCapture).toBe(true);
    for (const m of b.moves ?? []) expect(MOVES.has(m), m).toBe(true);
    expect(flagsSet(b.onLose ?? [])).not.toContain('ghost-event-solved');
    const ids = new Set([...KEY_ITEMS.map((i) => i.id), ...(items as Array<{ id: string }>).map((i) => i.id)]);
    for (const r of q.reward!.items!) expect(ids.has(r.id), r.id).toBe(true);
    expect(ALL_INTERACTIONS.find((i) => i.id === 'sc-shrine')!.byFlag!.some((f) => f.when === 'ghost-event-solved')).toBe(true);
  });
});
