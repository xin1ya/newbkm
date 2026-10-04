import { describe, expect, it } from 'vitest';
import { dex } from '@/config/data';
import { ALL_TRAINERS, TRAINER_BY_ID, TRAINER_NPCS } from '@/config/trainers';
import { ALL_NPCS } from '@/config/npcs';
import { getIsland } from '@/config/islands';
import type { IslandId } from '@/systems/state/GameState';
import { blackoutPenalty, contactEmote, encounterOpening } from '@/systems/encounters';
import { FollowerTrail, followSpeed, followerMood, followerOf, talkFriendship, type MoodContext } from '@/systems/follower';
import { approachPoint, buildTrainerParty, canSee, isDefeated, prizeMoney, terrainBlocks, trainerFlag, trainerInfo } from '@/systems/trainers';
import { createPokemon } from '@/systems/pokemon';
import { createRng } from '@/systems/rng';

describe('M1-09 遇敌流程', () => {
  it('开场提示：背后接近 / 被冲撞 / 睡眠 / 头目 / 闪光 / 暗雷', () => {
    const base = { name: '波波', method: 'visible' as const, initiative: null, sleeping: false, alpha: false, shiny: false };
    expect(encounterOpening(base)).toEqual(['野生的波波出现了！']);
    expect(encounterOpening({ ...base, initiative: 'player' }).join()).toContain('抢先行动');
    expect(encounterOpening({ ...base, initiative: 'wild' }).join()).toContain('被抢先了');
    expect(encounterOpening({ ...base, sleeping: true, initiative: 'player' }).join()).toContain('还在睡觉');
    const big = encounterOpening({ ...base, alpha: true, shiny: true });
    expect(big).toHaveLength(3);
    expect(big[2]).toContain('头目');
    expect(encounterOpening({ ...base, method: 'grass', initiative: 'wild' })).toEqual(['草丛里跳出了野生的波波！']);
  });

  it('接触表情', () => {
    expect(contactEmote('player', false)).toBe('?');
    expect(contactEmote('wild', false)).toBe('!');
    expect(contactEmote(null, true)).toBe('z');
  });

  it('黑屏付款：最高等级 × 徽章档位，不超过持有金额', () => {
    expect(blackoutPenalty(3000, 5, 0)).toBe(40);
    expect(blackoutPenalty(3000, 20, 1)).toBe(320);
    expect(blackoutPenalty(100, 50, 8)).toBe(100);
    expect(blackoutPenalty(0, 50, 3)).toBe(0);
    expect(blackoutPenalty(99999, 10, 99)).toBe(1200);
  });
});

describe('M1-08 跟随宝可梦', () => {
  it('面包屑：沿轨迹弧长取身后的点（拐弯时不抄近路）', () => {
    const t = new FollowerTrail();
    t.reset(0, 0);
    for (let x = 0.5; x <= 3.01; x += 0.5) t.push(x, 0); // 向东 3 m
    for (let z = 0.5; z <= 3.01; z += 0.5) t.push(3, z); // 再向南 3 m
    const p = t.pointBehind(4);
    // 身后 4 m：拐角 (3,0) 往回再 1 m → (2, 0)，而不是直线距离上的点
    expect(p.x).toBeCloseTo(2, 1);
    expect(p.z).toBeCloseTo(0, 1);
    expect(t.pointBehind(1).x).toBeCloseTo(3);
  });

  it('间隔不足不记录；瞬移重置；轨迹不够长返回最旧点', () => {
    const t = new FollowerTrail();
    t.reset(0, 0);
    t.push(0.1, 0);
    expect(t.length).toBe(1);
    t.push(50, 50);
    expect(t.length).toBe(1);
    expect(t.pointBehind(10)).toEqual({ x: 50, z: 50 });
  });

  it('跟随者 = 第一只未濒死；速度随距离增加并能追上奔跑', () => {
    const rng = createRng(1);
    const a = createPokemon(dex, 722, 5, rng);
    const b = createPokemon(dex, 155, 5, rng);
    a.hp = 0;
    expect(followerOf([a, b])?.uid).toBe(b.uid);
    b.hp = 0;
    expect(followerOf([a, b])).toBeNull();
    expect(followSpeed(0.1, 5)).toBe(0);
    expect(followSpeed(4, 6)).toBeGreaterThan(6);
    expect(followSpeed(0.5, 0)).toBeLessThan(followSpeed(3, 0));
  });

  it('心情优先级：异常状态 > 低 HP > 天气 > 深夜 > 亲密度 > 区域', () => {
    const c: MoodContext = { name: '木木枭', hpRatio: 1, status: null, friendship: 70, hour: 12, weather: 'clear', zoneKind: 'town', type: 'grass', roll: 0 };
    expect(followerMood({ ...c, status: 'psn', hpRatio: 0.1 }).lines[0]).toContain('中毒');
    expect(followerMood({ ...c, hpRatio: 0.2 }).emote).toBe('💧');
    expect(followerMood({ ...c, weather: 'rain', type: 'water' }).emote).toBe('♪');
    expect(followerMood({ ...c, weather: 'rain', type: 'fire' }).lines[0]).toContain('躲雨');
    expect(followerMood({ ...c, hour: 1 }).emote).toBe('z');
    expect(followerMood({ ...c, friendship: 230 }).emote).toBe('♥');
    expect(followerMood(c).emote).toBe('?');
    expect(followerMood({ ...c, zoneKind: 'wild' }).emote).toBe('!');
  });

  it('对话亲密度每天一次', () => {
    const p = createPokemon(dex, 722, 5, createRng(2));
    const f0 = p.friendship;
    const vars: Record<string, number> = {};
    expect(talkFriendship(p, 3, vars)).toBe(true);
    expect(talkFriendship(p, 3, vars)).toBe(false);
    expect(talkFriendship(p, 4, vars)).toBe(true);
    expect(p.friendship).toBe(f0 + 2);
  });
});

describe('M1-10 训练家', () => {
  const T = { x: 0, z: 0, yaw: 0 }; // 面朝 +Z
  const sight = { range: 10, fov: 60 };

  it('视线：锥形 + 距离 + 贴身察觉 + 遮挡', () => {
    expect(canSee({ trainer: T, player: { x: 0, z: 8 }, sight })).toBe(true);
    expect(canSee({ trainer: T, player: { x: 0, z: 11 }, sight })).toBe(false);
    expect(canSee({ trainer: T, player: { x: 6, z: 6 }, sight })).toBe(false); // 45° 在 30° 半角外
    expect(canSee({ trainer: T, player: { x: 0, z: -5 }, sight })).toBe(false); // 身后
    expect(canSee({ trainer: T, player: { x: 0.8, z: -0.5 }, sight })).toBe(true); // 贴身
    expect(canSee({ trainer: T, player: { x: 0, z: 8 }, sight, blocked: () => true })).toBe(false);
    expect(canSee({ trainer: T, player: { x: 0, z: 2 }, sight: { range: 0, fov: 0 } })).toBe(false);
  });

  it('地形遮挡：中间有土丘挡住眼高连线', () => {
    const flat = () => 0;
    const hill = (x: number) => (x > 4 && x < 6 ? 3 : 0);
    expect(terrainBlocks(flat, 0, 0, 10, 0)).toBe(false);
    expect(terrainBlocks(hill, 0, 0, 10, 0)).toBe(true);
  });

  it('接近点：停在玩家前 stop 米，朝向玩家', () => {
    const a = approachPoint({ x: 0, z: 0 }, { x: 0, z: 10 }, 1.8);
    expect(a.z).toBeCloseTo(8.2);
    expect(a.yaw).toBeCloseTo(0);
    expect(approachPoint({ x: 0, z: 0 }, { x: 0, z: 1 }, 1.8).z).toBe(0); // 已经很近就不动
  });

  it('配置：每个训练家有 NPC、队伍物种存在、奖金 = 基数 × 末只等级、flag 唯一', () => {
    expect(ALL_TRAINERS.length).toBeGreaterThanOrEqual(7);
    const ids = new Set<string>();
    for (const t of ALL_TRAINERS) {
      expect(ids.has(t.def.id)).toBe(false);
      ids.add(t.def.id);
      expect(t.def.intro.length && t.def.defeat.length && t.def.after.length).toBeTruthy();
      for (const m of t.def.party) expect(dex.hasSpecies(m.species)).toBe(true);
      expect(prizeMoney(t.def)).toBe(t.def.prizeBase * t.def.party[t.def.party.length - 1]!.level);
      expect(ALL_NPCS.some((n) => n.trainer === t.def.id)).toBe(true);
    }
    expect(TRAINER_NPCS.every((n) => n.dialog?.length)).toBe(true);
  });

  it('训练家站位在所在岛屿陆地范围内，等级与区域等级相符（±2）', () => {
    for (const t of ALL_TRAINERS) {
      const at = t.npc.schedule?.[0]?.at as { island?: string; position: [number, number] };
      expect(['sprout', 'tide']).toContain(at.island);
      const island = getIsland(at.island as IslandId);
      const [x, z] = at.position;
      expect(Math.abs(x)).toBeLessThan(island.size[0] / 2);
      expect(Math.abs(z)).toBeLessThan(island.size[1] / 2);
      const zone = island.zones.find((zz) => {
        let c = false;
        const poly = zz.polygon;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, zi] = poly[i]!;
          const [xj, zj] = poly[j]!;
          if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
        }
        return c;
      });
      if (zone?.levelRange) {
        const top = Math.max(...t.def.party.map((m) => m.level));
        expect(top, `${t.def.id}@${zone.id}`).toBeLessThanOrEqual(zone.levelRange[1] + 2);
        expect(top, `${t.def.id}@${zone.id}`).toBeGreaterThanOrEqual(zone.levelRange[0] - 2);
      }
    }
  });

  it('队伍生成、TrainerInfo、击败 flag', () => {
    const def = TRAINER_BY_ID.get('bugcatcher-sen')!;
    const party = buildTrainerParty(dex, def, createRng(3));
    expect(party.map((p) => [p.speciesId, p.level])).toEqual([[10, 3], [10, 4], [11, 5]]);
    expect(party.every((p) => p.moves.length > 0)).toBe(true);
    const info = trainerInfo(def);
    expect(info).toMatchObject({ id: 'bugcatcher-sen', title: '捕虫少年', prizeMoney: 80 });
    expect(isDefeated({ [trainerFlag('bugcatcher-sen')]: true }, 'bugcatcher-sen')).toBe(true);
    expect(isDefeated({}, 'bugcatcher-sen')).toBe(false);
  });
});
