import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SPROUT } from '@/config/islands/sprout';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { ZoneMap } from '@/world/island/ZoneMap';
import {
  ALPHA_MATERIAL,
  ALPHA_SCALE,
  alphaIvs,
  alphaScale,
  denAlpha,
  denConditionMet,
  denCooldownLeft,
  denReward,
  denStatus,
  makeRoaming,
  roamingReward,
  settleDen,
  TERRITORY,
} from '@/systems/alpha';
import { createBrain, stepBrain, type Perception } from '@/world/spawns/wildAI';
import { createWild } from '@/systems/encounters';
import { validateAndRepair } from '@/systems/state/save';
import { battle, dex, mon, rng } from './helpers';

const manifest = JSON.parse(readFileSync('assets/models/pokemon/manifest.json', 'utf8')) as { models: { id: number }[] };
const modelIds = new Set(manifest.models.map((m) => m.id));
const dens = SPROUT.alphaDens ?? [];

describe('头目巢穴配置（计划文档 §3.3）', () => {
  it('6 个巢穴，各在所属野区内，物种有手工模型，招式都存在', () => {
    expect(dens.length).toBe(6);
    const zones = new ZoneMap(SPROUT);
    const ids = new Set<string>();
    for (const den of dens) {
      expect(ids.has(den.id), den.id).toBe(false);
      ids.add(den.id);
      expect(zones.at(den.position[0], den.position[1])?.id, den.id).toBe(den.zone);
      expect(modelIds.has(den.speciesId), `${den.id} 模型`).toBe(true);
      for (const m of den.moves ?? []) expect(dex.hasMove(m), `${den.id} ${m}`).toBe(true);
      const zone = SPROUT.zones.find((z) => z.id === den.zone)!;
      expect(den.level, den.id).toBeGreaterThan(zone.levelRange![1]);
    }
  });

  it('头目之鳞已注册', () => {
    expect(KEY_ITEM_BY_ID.get(ALPHA_MATERIAL)?.name).toBe('头目之鳞');
  });
});

describe('头目逻辑', () => {
  const den = dens.find((d) => d.id === 'den-forest')!;
  const lake = dens.find((d) => d.id === 'den-lakeside')!;

  it('冷却按游戏日：击败后 3 天内为 cooldown', () => {
    expect(denCooldownLeft(undefined, 5)).toBe(0);
    const rec = settleDen(undefined, 10, false);
    expect(denCooldownLeft(rec, 10)).toBe(3);
    expect(denCooldownLeft(rec, 12)).toBe(1);
    expect(denCooldownLeft(rec, 13)).toBe(0);
    expect(denStatus(dens[0]!, rec, 11, 'day', 'clear')).toBe('cooldown');
    expect(denStatus(dens[0]!, rec, 13, 'day', 'clear')).toBe('ready');
  });

  it('出现条件：时段或天气任一满足', () => {
    expect(denConditionMet(den, 'night', 'clear')).toBe(true);
    expect(denConditionMet(den, 'day', 'fog')).toBe(true);
    expect(denConditionMet(den, 'day', 'clear')).toBe(false);
    expect(denStatus(lake, undefined, 0, 'night', 'clear')).toBe('waiting');
    expect(denStatus(lake, undefined, 0, 'day', 'rain')).toBe('ready');
  });

  it('个体值：巢穴 3 项 31 其余 ≥ 20；游荡 2 项 31 其余 ≥ 15', () => {
    for (let s = 0; s < 20; s++) {
      const a = Object.values(alphaIvs(rng(s), 3, 20));
      expect(a.filter((v) => v === 31).length).toBeGreaterThanOrEqual(3);
      expect(Math.min(...a)).toBeGreaterThanOrEqual(20);
      const b = Object.values(alphaIvs(rng(s), 2, 15));
      expect(b.filter((v) => v === 31).length).toBeGreaterThanOrEqual(2);
      expect(Math.min(...b)).toBeGreaterThanOrEqual(15);
    }
  });

  it('巢穴头目个体：等级 / 招式 / 体型 ×1.8', () => {
    const d = dens.find((x) => x.id === 'den-meadow')!;
    const p = denAlpha(dex, d, rng(3));
    expect(p.alpha).toBe(true);
    expect(p.alphaKind).toBe('den');
    expect(p.level).toBe(11);
    expect(p.moves.map((m) => m.id)).toEqual(d.moves);
    expect(alphaScale(p)).toBe(ALPHA_SCALE.den);
  });

  it('游荡头目：区域上限 + 4，体型 ×1.5；旧存档头目按 ×1.5', () => {
    const base = createWild(dex, { speciesId: 19, level: 3, shiny: false, alpha: true, formation: 'single', count: 1 }, rng(1));
    expect(base.alphaKind).toBe('roaming');
    const p = makeRoaming(dex, base, 5, rng(2));
    expect(p.level).toBe(9);
    expect(alphaScale(p)).toBe(ALPHA_SCALE.roaming);
    expect(alphaScale({ alpha: true })).toBe(1.5);
    expect(alphaScale({ alpha: false })).toBe(1);
  });

  it('奖励：首次头目之鳞 ×3 + 奖金；之后头目之鳞 ×1 + 随机道具；游荡头目金钱 + 道具', () => {
    const first = denReward(15, undefined, rng(4));
    expect(first.firstClear).toBe(true);
    expect(first.items[ALPHA_MATERIAL]).toBe(3);
    expect(first.money).toBe(15 * 120 + 2000);
    const again = denReward(15, settleDen(undefined, 1, true), rng(4));
    expect(again.firstClear).toBe(false);
    expect(again.items[ALPHA_MATERIAL]).toBe(1);
    expect(Object.keys(again.items).length).toBe(2);
    const roam = roamingReward(9, rng(5));
    expect(roam.money).toBe(720);
    expect(Object.keys(roam.items).length).toBe(1);
    const rec = settleDen({ caught: true, discovered: true }, 7, false);
    expect(rec).toMatchObject({ defeatedDay: 7, caught: true, firstClear: true, discovered: true });
  });
});

describe('头目战斗钩子', () => {
  it('开场气场：双防 +1；巢穴头目半血咆哮攻击 +1（只一次）', () => {
    const foe = denAlpha(dex, dens.find((d) => d.id === 'den-meadow')!, rng(9));
    const b = battle([mon(25, 40)], [foe], { foeAlpha: 'den' });
    const f = b.active(1);
    expect(f.stages.def).toBe(1);
    expect(f.stages.spd).toBe(1);
    expect(f.stages.atk).toBe(0);
    b.damage(f, Math.ceil(b.maxHp(f) * 0.6), 'move');
    expect(f.stages.atk).toBe(1);
    b.damage(f, 1, 'move');
    expect(f.stages.atk).toBe(1);
  });

  it('游荡头目只有开场气场', () => {
    const foe = makeRoaming(dex, mon(19, 5), 5, rng(1));
    const b = battle([mon(25, 40)], [foe], { foeAlpha: 'roaming' });
    const f = b.active(1);
    expect(f.stages.def).toBe(1);
    b.damage(f, Math.ceil(b.maxHp(f) * 0.6), 'move');
    expect(f.stages.atk).toBe(0);
  });

  it('普通野生没有气场', () => {
    const b = battle([mon(25, 40)], [mon(19, 5)]);
    expect(b.active(1).stages.def).toBe(0);
  });
});

describe('领地 AI', () => {
  const brain = () => {
    const b = createBrain(0, 0, 'aggressive', { sight: 12, speed: 3, sleepsAtNight: true }, () => 0.5);
    b.territory = { ...TERRITORY, radius: 6, warned: false };
    return b;
  };
  const per = (px: number, pz: number, x = 0, z = 0): Perception => ({ px, pz, x, z, playerRunning: false, playerInGrass: false, isNight: true });

  it('警告圈：盯着玩家咆哮一次；冲锋圈：冲锋并接触开战；夜里不睡', () => {
    const b = brain();
    const r = () => 0.5;
    const i1 = stepBrain(b, per(20, 0), 0.1, r);
    expect(i1.roar).toBe(true);
    expect(b.state).toBe('alert');
    const i2 = stepBrain(b, per(20, 0), 0.1, r);
    expect(i2.roar).toBeFalsy();
    stepBrain(b, per(10, 0), 0.1, r);
    expect(b.state).toBe('chase');
    const i3 = stepBrain(b, per(10, 0, 9.5, 0), 0.1, r);
    expect(i3.engage).toBe(true);
  });

  it('离巢超过 leash 返回，玩家离开后警告重置', () => {
    const b = brain();
    const r = () => 0.5;
    stepBrain(b, per(10, 0), 0.1, r);
    expect(b.state).toBe('chase');
    stepBrain(b, per(50, 0, 41, 0), 0.1, r);
    expect(b.state).toBe('return');
    expect(b.territory!.warned).toBe(false);
  });
});

describe('存档', () => {
  it('旧存档没有 day / alpha 字段可以读取；无效值被修复', () => {
    const raw: Record<string, unknown> = { player: { name: '小翠' }, position: { xyz: [0, 0, 0] }, party: [], day: -3, alpha: 'x' };
    try { validateAndRepair(raw); } catch { /* 其它字段缺失无关 */ }
    expect(raw.day).toBe(0);
    expect(raw.alpha).toEqual({});
  });
});
