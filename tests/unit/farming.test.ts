import { describe, expect, it } from 'vitest';
import { FARM_PLOTS } from '@/config/farm';
import { KEY_ITEM_BY_ID } from '@/config/items';
import { SHOP_BY_ID } from '@/config/shops';
import { NPC_BY_ID } from '@/config/npcs';
import { createNewGame, deserializeSave, serializeSave } from '@/systems/state';
import { createRng, sequenceRng } from '@/systems/rng';
import {
  applyMulch,
  clearWeeds,
  expectedYield,
  farmState,
  fieldUnlocked,
  growMinutes,
  harvest,
  plant,
  settlePlot,
  stageOf,
  water,
  type PlotDef,
} from '@/systems/farming';

const newGame = () => createNewGame({ name: '小翠', gender: 'boy', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] } });
const plot: PlotDef = { id: 'home-1', field: 'home', position: [0, 0] };
const never = () => sequenceRng([0.99]);

describe('计划文档 §9.3 种植', () => {
  it('田地：自家 4 块 + 翠澜镇 6 块 + 港湾市 6 块，id 唯一、互不重叠', () => {
    const defs = FARM_PLOTS.map((p) => p.def);
    expect(defs.filter((d) => d.field === 'home').length).toBe(4);
    expect(defs.filter((d) => d.field === 'cuilan').length).toBe(6);
    expect(defs.filter((d) => d.field === 'harbor').length).toBe(6);
    expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
    for (const a of defs) for (const b of defs) if (a !== b) expect(Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1])).toBeGreaterThanOrEqual(2.4);
  });

  it('开放条件：蒲婆婆教学后开放自家田，公共田需要培育家 3 级；蒲婆婆的赠礼需要先完成药草支线', () => {
    expect(fieldUnlocked('home', {})).toBe(false);
    expect(fieldUnlocked('home', { 'farm-unlocked': true })).toBe(true);
    expect(fieldUnlocked('cuilan', { 'farm-unlocked': true })).toBe(false);
    expect(fieldUnlocked('cuilan', { 'farm-unlocked': true, 'breeder-lv3': true })).toBe(true);
    const pu = NPC_BY_ID.get('elder-pu')!;
    expect(pu.gift?.item).toBe('watering-can');
    expect(pu.gift?.requires).toContain('herbs-delivered');
    expect(KEY_ITEM_BY_ID.get('watering-can')?.pocket).toBe('key');
    expect(SHOP_BY_ID.get('harbor-fruit')!.stock.some((s) => s.item === 'rich-mulch')).toBe(true);
  });

  it('种植 → 浇水 → 生长 5 个阶段 → 收获，浇满 4 个阶段收获 6 个', () => {
    const s = newGame();
    s.bag['oran-berry'] = 1;
    s.bag['watering-can'] = 1;
    expect(plant(s, plot, 'oran-berry', 0)).toBe(true);
    expect(s.bag['oran-berry']).toBeUndefined();
    const p = farmState(s).plots['home-1']!;
    const gh = 8;
    const total = growMinutes(gh);
    expect(stageOf(p, gh)).toBe(0);
    for (let st = 0; st < 4; st++) {
      water(s, plot, gh);
      settlePlot(p, gh, ((st + 1) * total) / 4, false, never());
    }
    expect(stageOf(p, gh)).toBe(4);
    expect(p.watered).toEqual([true, true, true, true]);
    expect(expectedYield(p)).toBe(6);
    const r = harvest(s, plot, gh, createRng(1))!;
    expect(r.qty).toBe(6);
    expect(s.bag['oran-berry']).toBe(6);
    expect(farmState(s).plots['home-1']).toBeUndefined();
  });

  it('不浇水只收 2 个；杂草 −1；丰收肥 +2；成长肥缩短 25%；下雨自动浇水', () => {
    const s = newGame();
    s.bag['oran-berry'] = 3;
    plant(s, plot, 'oran-berry', 0);
    const p = farmState(s).plots['home-1']!;
    settlePlot(p, 8, 480, false, never());
    expect(stageOf(p, 8)).toBe(4);
    expect(expectedYield(p)).toBe(2);
    p.weeds = true;
    expect(expectedYield(p)).toBe(1);
    expect(clearWeeds(s, plot)).toBe(true);
    harvest(s, plot, 8, createRng(1));

    s.bag['rich-mulch'] = 1;
    s.bag['growth-mulch'] = 1;
    plant(s, plot, 'oran-berry', 0);
    expect(applyMulch(s, plot, 'rich-mulch', 8)).toBe(true);
    expect(applyMulch(s, plot, 'growth-mulch', 8)).toBe(false);
    const q = farmState(s).plots['home-1']!;
    settlePlot(q, 8, 480, true, never());
    expect(q.watered.every(Boolean)).toBe(true);
    expect(expectedYield(q)).toBe(8);
    expect(growMinutes(8, 'growth-mulch')).toBe(360);
  });

  it('发芽后不能施肥；生长期间会随机长杂草', () => {
    const s = newGame();
    s.bag['oran-berry'] = 1;
    s.bag['damp-mulch'] = 1;
    plant(s, plot, 'oran-berry', 0);
    const p = farmState(s).plots['home-1']!;
    settlePlot(p, 8, 200, false, sequenceRng([0]));
    expect(stageOf(p, 8)).toBeGreaterThan(0);
    expect(p.weeds).toBe(true);
    expect(applyMulch(s, plot, 'damp-mulch', 8)).toBe(false);
  });

  it('存档：田地随存档保存，损坏时重置', () => {
    const s = newGame();
    s.bag['oran-berry'] = 1;
    plant(s, plot, 'oran-berry', 30);
    const back = deserializeSave(serializeSave(s)).state;
    expect(back.farm?.plots['home-1']?.berry).toBe('oran-berry');
    const broken = JSON.parse(serializeSave(s));
    broken.data.farm = 5;
    expect(deserializeSave(JSON.stringify(broken)).state.farm).toEqual({ plots: {} });
  });
});
