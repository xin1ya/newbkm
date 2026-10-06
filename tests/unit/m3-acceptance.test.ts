/**
 * M3-33 · 全流程数据级验收：从开局旗标出发，反复「接取所有已解锁任务 → 完成其全部目标」直到不动点，
 * 断言所有任务（含雷鸣 7 馆、冠军之路、联盟通关）都可达；并验证道馆可按任意顺序挑战（仅依赖抵达本岛）。
 * 每个目标的 completeFlag 是否真有来源由各岛测试（thunder-side / glaze-side / ch3 / ch4 / league / victory-road）保证。
 */
import { describe, expect, it } from 'vitest';
import { QUEST_REGISTRY } from '@/config/quests';
import { questStatus } from '@/systems/quests';

/** 前置已按任务 id → completeFlag 归一化 */
const ALL = QUEST_REGISTRY.all;
/** 开局旗标 + 玩法系统（育成等级 / 农场）产生的旗标，不由任务产生 */
const BASE = ['game-started', 'dream-prelude-done', 'starter-chosen', 'lab-visited', 'breeder-lv5', 'breeder-lv7', 'farm-unlocked'];
const M3_GYMS: Record<string, 'thunder' | 'glaze'> = { 'main-gym-thunder': 'thunder', 'main-gym-dawn': 'thunder', 'main-gym-snow': 'thunder', 'main-gym-cloud': 'thunder', 'main-gym-mirage': 'glaze', 'main-gym-ghost': 'glaze', 'main-gym-lily': 'glaze' };

function closure(start: string[], skip: (id: string) => boolean = () => false): { flags: Record<string, boolean>; done: Set<string> } {
  const flags: Record<string, boolean> = Object.fromEntries(start.map((f) => [f, true]));
  const done = new Set<string>();
  for (let changed = true; changed; ) {
    changed = false;
    for (const q of ALL) {
      if (done.has(q.id) || skip(q.id)) continue;
      if (questStatus(q, flags) === 'locked') continue;
      if (q.startFlag) flags[q.startFlag] = true;
      for (const o of q.objectives) flags[o.completeFlag] = true;
      flags[q.completeFlag] = true;
      if (q.reward?.hm) flags[q.reward.hm] = true;
      done.add(q.id);
      changed = true;
    }
  }
  return { flags, done };
}

describe('M3-33 全流程可通关（数据级）', () => {
  const all = ALL;
  const { flags, done } = closure(BASE);

  it('从开局出发，全部任务都能解锁并完成', () => {
    const missing = all.filter((q) => !done.has(q.id)).map((q) => `${q.id} ← ${q.prerequisites.filter((p) => !flags[p]).join(',')}`);
    expect(missing).toEqual([]);
  });

  it('七枚岛 3 / 岛 4 徽章与联盟冠军都可达', () => {
    for (const b of ['badge-thunder', 'badge-dawn', 'badge-snow', 'badge-lark', 'badge-mirage', 'badge-ghost', 'badge-glaze']) expect(flags[b], b).toBe(true);
    const league = all.filter((q) => /champion|league|victory-road/.test(q.id));
    expect(league.length).toBeGreaterThan(0);
    for (const q of league) expect(done.has(q.id), q.id).toBe(true);
  });

  it('岛 3 / 岛 4 道馆任意顺序：跳过任一道馆任务，其余同岛道馆仍可完成', () => {
    const gyms = all.filter((q) => q.id in M3_GYMS);
    expect(gyms.length).toBe(7);
    for (const g of gyms) {
      const r = closure(BASE, (id) => id === g.id);
      for (const other of gyms) if (other.id !== g.id && M3_GYMS[other.id] === M3_GYMS[g.id]) expect(r.done.has(other.id), `${g.id} 未打时 ${other.id}`).toBe(true);
    }
  });
});
