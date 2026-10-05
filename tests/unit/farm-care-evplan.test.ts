import { describe, expect, it } from 'vitest';
import { dex, mon } from './helpers';
import { createNewGame } from '@/systems/state';
import { createRng } from '@/systems/rng';
import {
  assignHelper,
  careRecord,
  farmCare,
  farmState,
  fieldHelpers,
  flavorEv,
  payHelpers,
  perksOf,
  plant,
  recallHelper,
  settlePlotWithHelpers,
  stageOf,
  HELPERS_PER_FIELD,
  type PlotDef,
} from '@/systems/farming';
import { clampEvGain, defaultEvPlan, evNeeds, evPlanDone, evUseful, sanitizeAutoConfig } from '@/systems/autobattle';

const DEF: PlotDef = { id: 'home-1', field: 'home', position: [0, 0] };

function farmGame() {
  const s = createNewGame({ name: 'T', gender: 'boy', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] } });
  s.bag['oran-berry'] = 3;
  s.bag['watering-can'] = 1;
  return s;
}

describe('农田 · 驻场宝可梦', () => {
  it('只能派驻箱子里的宝可梦，每块田地最多 3 只，同一只只在一处', () => {
    const s = farmGame();
    const ms = [mon(129, 10), mon(406, 10), mon(165, 10), mon(74, 10)];
    s.box.push(...ms);
    for (const m of ms.slice(0, 3)) expect(assignHelper(s, 'home', m.uid)).toBe(true);
    expect(assignHelper(s, 'home', ms[3]!.uid)).toBe(false);
    expect(fieldHelpers(s, 'home')).toHaveLength(HELPERS_PER_FIELD);
    expect(assignHelper(s, 'cuilan', ms[0]!.uid)).toBe(true);
    expect(fieldHelpers(s, 'home')).toHaveLength(2);
    expect(recallHelper(s, ms[0]!.uid)).toBe(true);
    // 被取回队伍后自动移除
    s.box.splice(s.box.indexOf(ms[1]!), 1);
    expect(fieldHelpers(s, 'home').map((p) => p.uid)).toEqual([ms[2]!.uid]);
    expect(assignHelper(s, 'home', mon(16, 3).uid)).toBe(false);
  });

  it('属性分工', () => {
    const p = perksOf([dex.species(129).types, dex.species(165).types]);
    expect(p).toMatchObject({ water: true, pests: true, growth: false, harvest: true });
    expect(perksOf([dex.species(74).types])).toMatchObject({ tiller: true, weeds: true });
    expect(perksOf([]).harvest).toBe(false);
  });

  it('水系驻场：全程浇水，结果后自动收获进背包，开启续种时原地续种', () => {
    const s = farmGame();
    expect(plant(s, DEF, 'oran-berry', 0)).toBe(true);
    // 加上除草 / 驱虫，避免随机杂草影响产量断言
    const perks = { ...perksOf([dex.species(129).types]), weeds: true, pests: true };
    const before = s.bag['oran-berry'] ?? 0;
    // 4 小时生长，推进 5 小时
    const got = settlePlotWithHelpers(s, DEF, perks, 4, 300, false, createRng(1), true);
    expect(got).toHaveLength(1);
    expect(got[0]!.replanted).toBe(true);
    // 4 个阶段都浇过：2+4=6，续种用掉 1 个
    expect(got[0]!.qty).toBe(5);
    expect((s.bag['oran-berry'] ?? 0) - before).toBe(5);
    const p = farmState(s).plots[DEF.id]!;
    expect(p.berry).toBe('oran-berry');
    expect(stageOf(p, 4)).toBeLessThan(4);
  });

  it('不续种时收获后田地空出；草系催生更快', () => {
    const s = farmGame();
    plant(s, DEF, 'oran-berry', 0);
    const got = settlePlotWithHelpers(s, DEF, perksOf([dex.species(406).types]), 4, 200, false, createRng(2), false);
    expect(got).toHaveLength(1); // 草系 ×1.25：约 3.2 小时结果
    expect(farmState(s).plots[DEF.id]).toBeUndefined();
  });

  it('工作满 6 小时亲密度 +1；照料记录按天重置', () => {
    const s = farmGame();
    const m = mon(129, 10);
    const f0 = m.friendship;
    payHelpers(s, [m], 700);
    expect(m.friendship).toBe(f0 + 1);
    expect(farmCare(s).work[m.uid]).toBe(340);
    const r = careRecord(s, m.uid, 3);
    r.fed = 5;
    expect(careRecord(s, m.uid, 3).fed).toBe(5);
    expect(careRecord(s, m.uid, 4).fed).toBe(0);
  });

  it('喂树果的努力值受单项 252 / 总量 510 限制', () => {
    const m = mon(129, 10);
    m.evs = { hp: 252, atk: 251, def: 0, spa: 0, spd: 0, spe: 0 };
    expect(flavorEv(m, 'atk')).toBe(1);
    m.evs = { hp: 252, atk: 252, def: 5, spa: 0, spd: 0, spe: 0 };
    expect(flavorEv(m, 'spe')).toBe(1);
  });
});

describe('代练 · 努力值计划', () => {
  const plan = { ...defaultEvPlan(), on: true, target: { hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 100 } };

  it('还缺的努力值 / 是否有用 / 达标', () => {
    const evs = { hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 40 };
    expect(evNeeds(evs, plan)).toMatchObject({ atk: 0, spe: 60 });
    expect(evUseful({ hp: 0, atk: 1, def: 0, spa: 0, spd: 0, spe: 0 }, evs, plan)).toBe(false);
    expect(evUseful({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 2 }, evs, plan)).toBe(true);
    expect(evUseful({ hp: 0, atk: 0, def: 1, spa: 0, spd: 0, spe: 0 }, evs, plan)).toBe(false);
    expect(evPlanDone(evs, plan)).toBe(false);
    expect(evPlanDone({ ...evs, spe: 100 }, plan)).toBe(true);
  });

  it('战后修正：超出目标与计划外的努力值不计入', () => {
    const before = { hp: 0, atk: 250, def: 0, spa: 0, spd: 0, spe: 99 };
    const after = { hp: 0, atk: 253, def: 2, spa: 0, spd: 0, spe: 101 };
    expect(clampEvGain(before, after, plan)).toEqual({ hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 100 });
    // 战前就超过目标的不会被削减
    expect(clampEvGain({ ...before, def: 50 }, { ...after, def: 50 }, plan).def).toBe(50);
  });

  it('配置兼容与清洗', () => {
    const c = sanitizeAutoConfig({ evPlan: { on: true, target: { atk: 999, spe: -3 } } });
    expect(c.evPlan).toMatchObject({ on: true, protectCarrier: true, target: { atk: 252, spe: 0, hp: 0 } });
    expect(sanitizeAutoConfig(null).evPlan.on).toBe(false);
  });
});
