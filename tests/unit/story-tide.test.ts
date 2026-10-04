/**
 * M2-16 / M2-17 · 碧潮群岛任务数据校验：
 * - 主线 6–13 + 支线 6 条都在、奖励符合设计；
 * - 每个目标的 completeFlag 都有来源（剧情脚本 / NPC 对话 / 室内触发器 / 互动 / 徽章 / 进入区域）；
 * - 支线 startFlag 由 startNpc 的「available」对话置位；
 * - 所有脚本、道具引用都存在；标记都在 tide。
 */
import { describe, expect, it } from 'vitest';
import { TIDE } from '@/config/islands/tide';
import { ALL_NPCS } from '@/config/npcs';
import { TIDE_QUESTS } from '@/config/quests/tide';
import { STORY_SCRIPTS, STORY_TRIGGERS } from '@/config/story';
import { TIDE_FURNITURE, TIDE_LANDMARKS } from '@/config/interactions/tide';
import { TIDE_INTERIORS } from '@/config/interiors/tide';
import { GYMS } from '@/config/encounters/gyms';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { dex } from '@/config/data';
import { flagsWritten, itemsGiven } from '@/systems/story';

const allSteps = [...STORY_SCRIPTS.values()].flatMap((s) => s.steps);
const sources = new Set<string>([
  ...flagsWritten(allSteps),
  ...ALL_NPCS.flatMap((n) => (n.dialogByQuest ?? []).flatMap((d) => d.setFlags ?? [])),
  ...TIDE_INTERIORS.flatMap((i) => i.rooms).flatMap((r) => (r.triggers ?? []).filter((t) => !t.repeat).map((t) => t.doneFlag)),
  ...[...TIDE_FURNITURE, ...TIDE_LANDMARKS].flatMap((d) => (d.effects ?? []).flatMap((e) => (e.kind === 'give-item' ? [e.flag] : []))),
  ...Object.values(GYMS).map((g) => g.badgeFlag),
]);

const MAIN = ['main-gym-azure', 'main-mine-anomaly', 'main-gym-ore', 'main-volcano-heat', 'main-gym-flame', 'main-ruins-seal', 'main-ruins-boss', 'main-hot-spring-info'];
const SIDE = ['side-forest-child', 'side-mine-rescue', 'side-volcano-egg', 'side-hot-spring-source', 'side-ancient-tablet', 'side-anomaly-survivor'];

describe('M2 碧潮群岛任务', () => {
  it('主线 8 条 + 支线 6 条都在，关键奖励正确', () => {
    const ids = TIDE_QUESTS.map((q) => q.id);
    for (const id of [...MAIN, ...SIDE]) expect(ids, id).toContain(id);
    const byId = new Map(TIDE_QUESTS.map((q) => [q.id, q]));
    expect(byId.get('side-volcano-egg')!.reward?.pokemon).toBe(636);
    expect(JSON.stringify(byId.get('side-mine-rescue')!.reward)).toContain('hm06-strength');
    expect(JSON.stringify(byId.get('main-ruins-boss')!.reward)).toContain('hm05-rock-smash');
    for (const q of TIDE_QUESTS) for (const o of q.objectives) if (o.marker) expect(o.marker.island, `${q.id}/${o.id}`).toBe(q.id === 'side-ancient-tablet' && o.id === 'deliver' ? 'sprout' : 'tide'); // 石板要带回萌芽研究所
  });

  it('每个目标的 completeFlag 都有来源', () => {
    const missing: string[] = [];
    for (const q of TIDE_QUESTS)
      for (const o of q.objectives) {
        const ok = !!o.trigger || !!o.counter || sources.has(o.completeFlag) || STORY_TRIGGERS.some((t) => t.id === o.completeFlag) || TIDE.blockers.some((b) => `cleared:${b.id}` === o.completeFlag); // 清除能力阻挡置位 cleared:<id>
        if (!ok) missing.push(`${q.id}/${o.id}:${o.completeFlag}`);
      }
    expect(missing).toEqual([]);
  });

  it('支线 startFlag 由 startNpc 的「available」对话置位', () => {
    for (const q of TIDE_QUESTS.filter((x) => x.category === 'side' && x.startNpc)) {
      const npc = ALL_NPCS.find((n) => n.id === q.startNpc);
      expect(npc, q.id).toBeTruthy();
      const d = npc!.dialogByQuest?.find((x) => x.questId === q.id && x.when === 'available');
      expect(d?.setFlags, q.id).toContain(q.startFlag);
    }
  });

  it('引用完整：脚本、道具都存在', () => {
    const refs = [
      ...ALL_NPCS.flatMap((n) => (n.dialogByQuest ?? []).map((d) => d.story).filter((x): x is string => !!x)),
      ...TIDE_INTERIORS.flatMap((i) => i.rooms).flatMap((r) => (r.triggers ?? []).map((t) => t.script)),
      ...[...TIDE_FURNITURE, ...TIDE_LANDMARKS].flatMap((f) => (f.effects ?? []).flatMap((e) => (e.kind === 'story' ? [e.script] : []))),
    ];
    for (const r of refs) expect(STORY_SCRIPTS.has(r), r).toBe(true);
    for (const id of itemsGiven(allSteps)) expect(!!dex.item(id) || KEY_ITEM_BY_ID.has(id), id).toBe(true);
    for (const q of TIDE_QUESTS) for (const it of q.reward?.items ?? []) expect(!!dex.item(it.id) || KEY_ITEM_BY_ID.has(it.id), `${q.id}:${it.id}`).toBe(true);
  });
});
