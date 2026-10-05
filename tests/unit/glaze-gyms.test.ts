import { describe, expect, it } from 'vitest';
import { GYMS } from '@/config/encounters/gyms';
import { INTERIORS } from '@/config/interiors';
import { GHOST_GYM_MECH, MIRAGE_GYM_MECH } from '@/config/interiors/glazeMechanisms';
import { GLAZE_WATER_PUZZLE } from '@/config/interiors/glazeGyms';
import { NPC_BY_ID } from '@/config/npcs';
import { TRAINER_BY_ID } from '@/config/trainers';
import { QUEST_REGISTRY } from '@/config/quests';
import { TM_BY_ITEM } from '@/config/tms';
import { ALL_INTERACTIONS } from '@/config/interactions';
import { GLAZE_BADGES } from '@/config/story/thunder';
import species from '@/config/data/species.json';
import moves from '@/config/data/moves.json';
import { badgesOnIsland, gymTier } from '@/systems/encounters';
import { blockingRects, cycleSwitch, gateOpen, initialState, inRect, mirrorAt, mirrorTarget, solveMechanism, type GymMechanismConfig } from '@/systems/puzzles/gymMechanism';
import { isStandable, reachableStates, solve } from '@/systems/puzzles/waterLevel';

const SPECIES = new Map((species as Array<{ id: number; abilities: Array<{ id: string }> }>).map((s) => [s.id, s]));
const MOVES = new Set((moves as Array<{ id: string }>).map((m) => m.id));
const GLAZE_GYMS = GYMS.filter((g) => g.island === 'glaze');
const MECHS: Record<string, GymMechanismConfig> = { 'gym-mirage': MIRAGE_GYM_MECH, 'gym-ghost': GHOST_GYM_MECH };
const POOL_BOUNDS = [-15, -20, 15, 20] as const;
const DOOR: [number, number] = [0, 18];
const COURT: [number, number] = [0, -8];

describe('M3-16 琉璃群岛道馆 · 定义', () => {
  it('3 座道馆，徽章 flag 一致，3 档等级递增且高于雷鸣', () => {
    expect(GLAZE_GYMS.map((g) => g.badgeFlag).sort()).toEqual([...GLAZE_BADGES].sort());
    const thunderMax = Math.max(...GYMS.filter((g) => g.island === 'thunder').flatMap((g) => g.tierLevels));
    for (const g of GLAZE_GYMS) {
      expect(g.tierLevels).toHaveLength(3);
      expect(g.tierLevels[0]!).toBeGreaterThan(thunderMax);
      for (let i = 1; i < 3; i++) expect(g.tierLevels[i]!).toBeGreaterThan(g.tierLevels[i - 1]!);
      expect(Object.keys(g.extraMembers ?? {}).map(Number).sort()).toEqual([1, 2]);
    }
  });
  it('动态取档：本岛徽章 0..2 → 档位 0..2，外岛徽章不计', () => {
    const g = GLAZE_GYMS.find((q) => q.id === 'gym-glaze')!;
    const flags: Record<string, boolean> = { 'badge-thunder': true, 'badge-lark': true };
    expect(gymTier(g, badgesOnIsland(GYMS, 'glaze', flags, g.id))).toBe(0);
    flags['badge-mirage'] = flags['badge-ghost'] = true;
    expect(gymTier(g, badgesOnIsland(GYMS, 'glaze', flags, g.id))).toBe(2);
  });
  it('队伍物种 / 招式 / 特性有效', () => {
    for (const g of GLAZE_GYMS)
      for (const m of [...g.team, ...Object.values(g.extraMembers ?? {}).flat()]) {
        const sp = SPECIES.get(m.speciesId);
        expect(sp, `${g.id} ${m.speciesId}`).toBeTruthy();
        for (const mv of m.moves) expect(MOVES.has(mv), `${g.id} ${mv}`).toBe(true);
        if (m.ability) expect(sp!.abilities.map((a) => a.id), `${g.id} ${m.ability}`).toContain(m.ability);
      }
  });
  it('室内：NPC / 训练家 / 须知牌齐全，馆主绑定道馆', () => {
    const inter = new Set(ALL_INTERACTIONS.map((d) => d.id));
    for (const g of GLAZE_GYMS) {
      const room = INTERIORS[g.id]!.rooms[0]!;
      if (MECHS[g.id]) expect(room.mechanism).toBe(MECHS[g.id]);
      else expect(room.waterPuzzle).toBe(GLAZE_WATER_PUZZLE);
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
  it('任务：前置为三度跨海（M3-25）；奖励 TM 29–31 来自对应道馆', () => {
    for (const [q, gym, no] of [
      ['main-gym-mirage', 'gym-mirage', 29],
      ['main-gym-ghost', 'gym-ghost', 30],
      ['main-gym-lily', 'gym-glaze', 31],
    ] as const) {
      const quest = QUEST_REGISTRY.get(q)!;
      expect(quest.prerequisites).toEqual(['glaze-arrival-card']);
      const tm = TM_BY_ITEM.get(quest.reward!.items![0]!.id)!;
      expect(tm.source).toEqual({ kind: 'gym', gym });
      expect(tm.no).toBe(no);
    }
  });
});

describe('M3-16 幻影 / 幽冥馆内机关', () => {
  for (const [gym, cfg] of Object.entries(MECHS)) {
    it(`${gym}：可解、无死局`, () => {
      const r = solveMechanism(cfg);
      expect(r.solvable).toBe(true);
      expect(r.softlocks).toBe(0);
    });
    it(`${gym}：NPC 与开关不站在墙 / 闸门 / 法阵上`, () => {
      const room = INTERIORS[gym]!.rooms[0]!;
      const all = [...cfg.walls.map((w) => w.rect), ...cfg.gates.map((g) => g.rect)];
      const pts = [...(room.npcs ?? []).map((n) => [n.id, n.position] as const), ...cfg.switches.map((s) => [s.id, s.position] as const)];
      for (const [id, p] of pts) {
        expect(all.some((r) => inRect(r, p[0], p[1], 0.4)), id).toBe(false);
        expect(mirrorAt(cfg, p[0], p[1], 1.3), id).toBeNull();
      }
    });
  }
  it('非平凡：幻影至少 2 次、幽冥恰好 4 次', () => {
    expect(solveMechanism(MIRAGE_GYM_MECH).minToggles).toBeGreaterThanOrEqual(2);
    expect(solveMechanism(GHOST_GYM_MECH).minToggles).toBe(4);
  });
  it('幻影：六间镜厅彼此封闭，没有镜子哪儿也去不了', () => {
    const noMirror: GymMechanismConfig = { ...MIRAGE_GYM_MECH, mirrors: [] };
    expect(solveMechanism(noMirror).solvable).toBe(false);
  });
  it('幻影：镜子落点在空地上，且不落在另一面镜子的法阵里', () => {
    const block = blockingRects(MIRAGE_GYM_MECH, {});
    for (const m of MIRAGE_GYM_MECH.mirrors!) {
      expect(block.some((r) => inRect(r, m.at[0], m.at[1], 0.6)), m.id).toBe(false);
      for (let v = 0; v < 3; v++) {
        const [x, z] = mirrorTarget(m, { orb: v });
        expect(block.some((r) => inRect(r, x, z, 0.4)), `${m.id}@${v}`).toBe(false);
        expect(mirrorAt(MIRAGE_GYM_MECH, x, z, 1.2), `${m.id}@${v}`).toBeNull();
      }
    }
  });
  it('幻影：水晶球同时转动中厅镜和终点镜；非金光时终点镜送回大厅', () => {
    const fin = MIRAGE_GYM_MECH.mirrors!.find((m) => m.id === 'bc-final')!;
    let st = initialState(MIRAGE_GYM_MECH);
    expect(mirrorTarget(fin, st)[1]).toBeGreaterThan(13);
    st = cycleSwitch(MIRAGE_GYM_MECH, cycleSwitch(MIRAGE_GYM_MECH, st, 'orb'), 'orb');
    expect(mirrorTarget(fin, st)[1]).toBeLessThan(-3);
    expect(mirrorTarget(MIRAGE_GYM_MECH.mirrors!.find((m) => m.id === 'fc-turn')!, st)[1]).toBeGreaterThan(13);
  });
  it('幽冥：常暗；中廊灵火要烛台照中廊 + 西灯', () => {
    expect(GHOST_GYM_MECH.dark).toBe(true);
    const nave = GHOST_GYM_MECH.gates.find((g) => g.id === 'nave')!;
    expect(gateOpen(nave, { C: 2, W: 0, E: 1 })).toBe(false);
    expect(gateOpen(nave, { C: 2, W: 1, E: 0 })).toBe(true);
    expect(gateOpen(nave, { C: 0, W: 1, E: 1 })).toBe(false);
  });
});

describe('M3-16 琉璃道馆水位机关', () => {
  it('门口 → 馆主台：最少 4 次阀门，四座石岛的阀门各一次', () => {
    expect(solve(GLAZE_WATER_PUZZLE, POOL_BOUNDS, DOOR, COURT)).toEqual({ toggles: 4, valves: ['valve-a', 'valve-b', 'valve-c', 'valve-d'] });
  });
  it('无死局：任何可达状态都能回到门口；馆主台可原路返回', () => {
    const states = reachableStates(GLAZE_WATER_PUZZLE, POOL_BOUNDS, DOOR);
    expect(states.length).toBeGreaterThan(10);
    for (const s of states) expect(solve(GLAZE_WATER_PUZZLE, POOL_BOUNDS, [s.x, s.z], DOOR, s.level), `${s.x},${s.z}@${s.level}`).not.toBeNull();
    expect(solve(GLAZE_WATER_PUZZLE, POOL_BOUNDS, COURT, DOOR, 'high')).not.toBeNull();
  });
  it('玻璃雕像台永远到不了；训练家与阀门都站在石岛上', () => {
    const states = reachableStates(GLAZE_WATER_PUZZLE, POOL_BOUNDS, DOOR);
    expect(states.some((s) => s.x > -3 && s.x < 0 && s.z > 2.5 && s.z < 5)).toBe(false);
    for (const v of GLAZE_WATER_PUZZLE.valves) expect(isStandable(GLAZE_WATER_PUZZLE, 'high', ...v.position) && isStandable(GLAZE_WATER_PUZZLE, 'low', ...v.position), v.id).toBe(true);
    const room = INTERIORS['gym-glaze']!.rooms[0]!;
    for (const n of room.npcs!.filter((q) => q.id.includes('trainer'))) expect(isStandable(GLAZE_WATER_PUZZLE, 'high', ...n.position) && isStandable(GLAZE_WATER_PUZZLE, 'low', ...n.position), n.id).toBe(true);
  });
});
