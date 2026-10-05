import { describe, expect, it } from 'vitest';
import { GYMS } from '@/config/encounters/gyms';
import { INTERIORS } from '@/config/interiors';
import { DAWN_GYM_MECH, LARK_GYM_MECH, SNOW_GYM_MECH, THUNDER_GYM_MECH } from '@/config/interiors/thunderMechanisms';
import { NPC_BY_ID } from '@/config/npcs';
import { TRAINER_BY_ID } from '@/config/trainers';
import { QUEST_REGISTRY } from '@/config/quests';
import { TM_BY_ITEM } from '@/config/tms';
import { ALL_INTERACTIONS } from '@/config/interactions';
import { THUNDER_BADGES } from '@/config/story/thunder';
import species from '@/config/data/species.json';
import moves from '@/config/data/moves.json';
import { badgesOnIsland, gymTier } from '@/systems/encounters';
import { blockingRects, cardinal, cycleSwitch, gateOpen, gatesClosingOn, initialState, inRect, onIce, solveMechanism, type GymMechanismConfig } from '@/systems/puzzles/gymMechanism';

const SPECIES = new Map((species as Array<{ id: number; abilities: Array<{ id: string }> }>).map((s) => [s.id, s]));
const MOVES = new Set((moves as Array<{ id: string }>).map((m) => m.id));
const THUNDER_GYMS = GYMS.filter((g) => g.island === 'thunder');
const MECHS: Record<string, GymMechanismConfig> = { 'gym-thunder': THUNDER_GYM_MECH, 'gym-dawn': DAWN_GYM_MECH, 'gym-snow': SNOW_GYM_MECH, 'gym-lark': LARK_GYM_MECH };

describe('M3-15 雷鸣群岛道馆 · 定义', () => {
  it('4 座道馆，徽章 flag 与主线约定一致，4 档等级递增', () => {
    expect(THUNDER_GYMS.map((g) => g.badgeFlag).sort()).toEqual([...THUNDER_BADGES].sort());
    for (const g of THUNDER_GYMS) {
      expect(g.tierLevels).toHaveLength(4);
      for (let i = 1; i < 4; i++) expect(g.tierLevels[i]!).toBeGreaterThan(g.tierLevels[i - 1]!);
      expect(Object.keys(g.extraMembers ?? {}).map(Number).sort()).toEqual([1, 2, 3]);
    }
  });
  it('动态取档：本岛徽章 0..3 → 档位 0..3', () => {
    const g = THUNDER_GYMS.find((q) => q.id === 'gym-lark')!;
    const flags: Record<string, boolean> = {};
    expect(gymTier(g, badgesOnIsland(GYMS, 'thunder', flags, g.id))).toBe(0);
    flags['badge-thunder'] = flags['badge-dawn'] = flags['badge-snow'] = true;
    flags['badge-azure'] = true; // 外岛徽章不计
    expect(gymTier(g, badgesOnIsland(GYMS, 'thunder', flags, g.id))).toBe(3);
  });
  it('队伍物种 / 招式 / 特性有效', () => {
    for (const g of THUNDER_GYMS)
      for (const m of [...g.team, ...Object.values(g.extraMembers ?? {}).flat()]) {
        const sp = SPECIES.get(m.speciesId);
        expect(sp, `${g.id} ${m.speciesId}`).toBeTruthy();
        for (const mv of m.moves) expect(MOVES.has(mv), `${g.id} ${mv}`).toBe(true);
        if (m.ability) expect(sp!.abilities.map((a) => a.id), `${g.id} ${m.ability}`).toContain(m.ability);
      }
  });
  it('室内：NPC / 训练家 / 须知牌齐全，馆主绑定道馆', () => {
    const inter = new Set(ALL_INTERACTIONS.map((d) => d.id));
    for (const g of THUNDER_GYMS) {
      const room = INTERIORS[g.id]!.rooms[0]!;
      expect(room.mechanism).toBe(MECHS[g.id]);
      for (const n of room.npcs ?? []) {
        const def = NPC_BY_ID.get(n.id);
        expect(def, n.id).toBeTruthy();
        if (def!.trainer) {
          const t = TRAINER_BY_ID.get(def!.trainer);
          expect(t, def!.trainer).toBeTruthy();
          for (const p of t!.party) expect(SPECIES.has(p.species), `${t!.id} ${p.species}`).toBe(true);
          for (const p of t!.party) for (const mv of p.moves ?? []) expect(MOVES.has(mv), `${t!.id} ${mv}`).toBe(true);
        }
      }
      expect(room.npcs!.some((n) => TRAINER_BY_ID.get(NPC_BY_ID.get(n.id)!.trainer ?? '')?.gym === g.id)).toBe(true);
      expect(inter.has(`${g.id}-rules`)).toBe(true);
    }
  });
  it('任务奖励：TM 来自对应道馆；雪原道馆给「攀爬」', () => {
    for (const [q, gym] of [
      ['main-gym-thunder', 'gym-thunder'],
      ['main-gym-dawn', 'gym-dawn'],
      ['main-gym-snow', 'gym-snow'],
      ['main-gym-cloud', 'gym-lark'],
    ] as const) {
      const quest = QUEST_REGISTRY.get(q)!;
      const tm = TM_BY_ITEM.get(quest.reward!.items![0]!.id)!;
      expect(tm.source).toEqual({ kind: 'gym', gym });
    }
    expect(QUEST_REGISTRY.get('main-gym-snow')!.reward!.hm).toBe('hm08-rock-climb');
  });
});

describe('M3-15 馆内机关', () => {
  for (const [gym, cfg] of Object.entries(MECHS)) {
    it(`${gym}：昼 / 夜进门都可解、无死局`, () => {
      for (const night of [false, true]) {
        const r = solveMechanism(cfg, night);
        expect(r.solvable, `${gym} night=${night}`).toBe(true);
        expect(r.softlocks, `${gym} night=${night}`).toBe(0);
      }
    });
    it(`${gym}：NPC 与开关不站在闸门 / 墙 / 深谷里`, () => {
      const room = INTERIORS[gym]!.rooms[0]!;
      const all = [...cfg.walls.map((w) => w.rect), ...(cfg.pits ?? []), ...cfg.gates.map((g) => g.rect)];
      for (const n of room.npcs ?? []) expect(all.some((r) => inRect(r, n.position[0], n.position[1], 0.4)), n.id).toBe(false);
      for (const s of cfg.switches) expect(all.some((r) => inRect(r, s.position[0], s.position[1], 0.4)), s.id).toBe(false);
      // 冰场上不能站人（会挡住滑行）
      for (const n of room.npcs ?? []) expect(onIce(cfg, n.position[0], n.position[1]), n.id).toBe(false);
    });
  }
  it('非平凡：雷鸣要来回拉 4 次拉杆；晨辉白天进门要拨 2 次日晷；云翎至少 2 次', () => {
    expect(solveMechanism(THUNDER_GYM_MECH).minToggles).toBe(4);
    expect(solveMechanism(DAWN_GYM_MECH, false).minToggles).toBeGreaterThanOrEqual(2);
    expect(solveMechanism(DAWN_GYM_MECH, true).minToggles).toBeGreaterThanOrEqual(1);
    expect(solveMechanism(LARK_GYM_MECH).minToggles).toBeGreaterThanOrEqual(2);
  });
  it('滑冰：从入口直滑不能到出口（要绕冰块）', () => {
    // 入口缺口 x ∈ [−1, 1]，向 −z 直滑
    for (const x of [-0.5, 0.5]) {
      let z = 12.5;
      const blocked = (zz: number) => blockingRects(SNOW_GYM_MECH, {}).some((r) => inRect(r, x, zz));
      while (onIce(SNOW_GYM_MECH, x, z - 1) || z === 12.5) {
        if (blocked(z - 1)) break;
        z -= 1;
      }
      expect(z, `x=${x}`).toBeGreaterThan(-1);
    }
  });
  it('昼夜初值取时钟；日晷共享变量', () => {
    expect(initialState(DAWN_GYM_MECH, false).sun).toBe(0);
    expect(initialState(DAWN_GYM_MECH, true).sun).toBe(1);
    const st = cycleSwitch(DAWN_GYM_MECH, initialState(DAWN_GYM_MECH), 'dial-west');
    expect(st.sun).toBe(1);
    const sun = DAWN_GYM_MECH.gates.find((g) => g.style === 'sunlight')!;
    const shadow = DAWN_GYM_MECH.gates.find((g) => g.style === 'shadow')!;
    expect(gateOpen(sun, st)).toBe(true);
    expect(gateOpen(shadow, st)).toBe(false);
  });
  it('拨动不会把人关进闸门；滑冰方向取主轴', () => {
    const g = THUNDER_GYM_MECH.gates.find((q) => q.id === 'east')!;
    const st0 = initialState(THUNDER_GYM_MECH);
    const st1 = cycleSwitch(THUNDER_GYM_MECH, st0, 'A');
    expect(gatesClosingOn(THUNDER_GYM_MECH, st0, st1, (g.rect[0] + g.rect[2]) / 2, (g.rect[1] + g.rect[3]) / 2).map((q) => q.id)).toEqual(['east']);
    expect(cardinal(3, -1)).toEqual([1, 0]);
    expect(cardinal(0.2, -4)).toEqual([0, -1]);
    expect(cardinal(0.1, 0.1)).toBeNull();
  });
});
