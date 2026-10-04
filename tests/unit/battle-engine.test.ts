import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '@/systems/battle';
import { battle, dex, mon, SPECIES } from './helpers';
import { createRng } from '@/systems/rng';
import { maxHp } from '@/systems/pokemon/Pokemon';

const types = (evs: BattleEvent[]) => evs.map((e) => e.type);
const moveOrder = (evs: BattleEvent[]) => evs.filter((e): e is Extract<BattleEvent, { type: 'move' }> => e.type === 'move').map((e) => e.side);

describe('SYS-003 回合流程', () => {
  it('开场：双方出场事件', () => {
    const b = battle([mon(SPECIES.rowlet, 5)], [mon(SPECIES.pidgey, 3)]);
    expect(b.turn).toBe(0);
    expect(b.request(0).kind).toBe('action');
  });

  it('速度快者先行动；先制度优先于速度', () => {
    const slow = mon(SPECIES.krabby, 20, { moves: ['tackle', 'quick-attack'] });
    const fast = mon(SPECIES.pikachu, 20, { moves: ['tackle'] });
    const b = battle([slow], [fast]);
    let evs = b.submit({ type: 'move', moveIndex: 0 }, { type: 'move', moveIndex: 0 });
    expect(moveOrder(evs)).toEqual([1, 0]);
    evs = b.submit({ type: 'move', moveIndex: 1 }, { type: 'move', moveIndex: 0 });
    expect(moveOrder(evs)[0]).toBe(0);
  });

  it('麻痹速度 ×0.25 改变行动顺序', () => {
    const b = battle([mon(SPECIES.krabby, 20, { moves: ['tackle'] })], [mon(SPECIES.pikachu, 20, { moves: ['tackle'] })]);
    b.active(1).pokemon.status = { kind: 'par' };
    expect(b.effectiveSpeed(b.active(1))).toBeLessThan(b.effectiveSpeed(b.active(0)));
  });

  it('PP 消耗，全部耗尽时使用挣扎并受到反伤', () => {
    const p = mon(SPECIES.rattata, 20, { moves: ['tackle'] });
    const b = battle([p], [mon(SPECIES.magikarp, 30, { moves: ['splash'] })]);
    b.submit({ type: 'move', moveIndex: 0 });
    expect(p.moves[0]?.pp).toBe((p.moves[0]?.maxPp ?? 0) - 1);
    p.moves[0]!.pp = 0;
    const evs = b.submit({ type: 'move', moveIndex: 0 });
    expect(evs.some((e) => e.type === 'move' && e.move === 'struggle')).toBe(true);
    expect(evs.some((e) => e.type === 'damage' && e.source === 'struggle')).toBe(true);
  });

  it('濒死后等待玩家换人，训练家自动换下一只', () => {
    const weak = mon(SPECIES.caterpie, 3, { moves: ['tackle'] });
    const backup = mon(SPECIES.rowlet, 20, { moves: ['tackle'] });
    const b = battle([weak, backup], [mon(SPECIES.cyndaquil, 30, { moves: ['ember'] }), mon(SPECIES.pidgey, 5)], {
      kind: 'trainer',
      foe: { party: [mon(SPECIES.cyndaquil, 30, { moves: ['ember'] }), mon(SPECIES.pidgey, 5)], trainer: { id: 't', name: '短裤小子', ai: 'basic' } },
    });
    const evs = b.submit({ type: 'move', moveIndex: 0 });
    expect(types(evs)).toContain('faint');
    expect(b.request(0)).toEqual({ kind: 'switch', reason: 'faint' });
    expect(() => b.submit({ type: 'move', moveIndex: 0 })).toThrow();
    const sw = b.submitSwitch(0, 1);
    expect(sw.some((e) => e.type === 'switch-in' && e.side === 0)).toBe(true);
    expect(b.request(0).kind).toBe('action');
  });

  it('全灭即结束；击倒野生获得经验并可能升级', () => {
    const p = mon(SPECIES.rowlet, 10, { moves: ['leafage'] });
    const wild = mon(SPECIES.magikarp, 5, { moves: ['splash'] });
    const b = battle([p], [wild], { noExp: false });
    const exp0 = p.exp;
    let evs: BattleEvent[] = [];
    for (let i = 0; i < 10 && !b.outcome; i++) evs = evs.concat(b.submit({ type: 'move', moveIndex: 0 }));
    expect(b.outcome).toEqual({ winner: 0, reason: 'faint' });
    expect(p.exp).toBeGreaterThan(exp0);
    expect(evs.some((e) => e.type === 'exp')).toBe(true);
    expect(p.evs.spe).toBeGreaterThan(0); // 鲤鱼王给速度努力值
    expect(b.request(0).kind).toBe('ended');
  });

  it('训练家战不能逃跑、不能投球', () => {
    const b = battle([mon(SPECIES.rowlet, 10)], [mon(SPECIES.pidgey, 5)], {
      kind: 'trainer',
      foe: { party: [mon(SPECIES.pidgey, 5, { moves: ['splash'] })], trainer: { id: 't', name: '捕虫少年', ai: 'basic' } },
    });
    expect(b.request(0)).toMatchObject({ canRun: false, canCatch: false });
    const evs = b.submit({ type: 'run' });
    expect(evs.some((e) => e.type === 'fail' && e.reason === 'no-run-trainer')).toBe(true);
    expect(b.outcome).toBeNull();
  });

  it('速度更快必定逃跑成功', () => {
    const b = battle([mon(SPECIES.pikachu, 30)], [mon(SPECIES.krabby, 5, { moves: ['splash'] })]);
    const evs = b.submit({ type: 'run' });
    expect(evs).toContainEqual({ type: 'run', success: true });
    expect(b.outcome?.reason).toBe('run');
  });

  it('主动换人消耗回合且先于招式执行，能力阶清零', () => {
    const a = mon(SPECIES.rowlet, 20, { moves: ['growl'] });
    const c = mon(SPECIES.mudkip, 20, { moves: ['tackle'] });
    const b = battle([a, c], [mon(SPECIES.pidgey, 20, { moves: ['sand-attack'] })]);
    b.active(0).stages.atk = 2;
    const evs = b.submit({ type: 'switch', partyIndex: 1 }, { type: 'move', moveIndex: 0 });
    const iSwitch = evs.findIndex((e) => e.type === 'switch-in' && e.side === 0);
    const iMove = evs.findIndex((e) => e.type === 'move');
    expect(iSwitch).toBeGreaterThanOrEqual(0);
    expect(iSwitch).toBeLessThan(iMove);
    expect(b.sides[0].party[0]!.stages.atk).toBe(0);
  });

  it('精灵球：大师球必定成功并结束战斗', () => {
    const b = battle([mon(SPECIES.rowlet, 10)], [mon(SPECIES.gyarados, 40, { moves: ['splash'] })]);
    const evs = b.submit({ type: 'ball', itemId: 'master-ball' });
    expect(evs.find((e) => e.type === 'capture')).toMatchObject({ success: true, shakes: 3 });
    expect(b.outcome?.reason).toBe('capture');
    expect(b.captured?.ball).toBe('master-ball');
  });

  it('战斗中使用伤药', () => {
    const p = mon(SPECIES.rowlet, 20, { moves: ['tackle'] });
    p.hp = 5;
    const b = battle([p], [mon(SPECIES.magikarp, 5, { moves: ['splash'] })]);
    b.submit({ type: 'item', itemId: 'potion', partyIndex: 0 });
    expect(p.hp).toBe(25);
  });

  it('同一种子可以复现整场战斗', () => {
    const run = () => {
      const b = battle([mon(SPECIES.cyndaquil, 15)], [mon(SPECIES.oddish, 15)], { rng: createRng(99) });
      const log: BattleEvent[] = [];
      for (let i = 0; i < 20 && !b.outcome; i++) {
        const r = b.request(0);
        if (r.kind === 'action') log.push(...b.submit({ type: 'move', moveIndex: r.moves.find((m) => !m.disabled)?.index ?? 0 }));
      }
      return JSON.stringify(log.map((e) => ('uid' in e ? { ...e, uid: '' } : e)));
    };
    expect(run()).toBe(run());
  });
});

describe('SYS-009 异常与天气', () => {
  it('灼伤每回合 1/16，中毒 1/8，剧毒递增', () => {
    const p = mon(SPECIES.pikachu, 30, { moves: ['splash'] });
    const b = battle([p], [mon(SPECIES.magikarp, 30, { moves: ['splash'] })]);
    const foe = b.active(1);
    const max = maxHp(dex, foe.pokemon);
    b.trySetStatus(foe, 'tox', b.active(0));
    const hp0 = foe.pokemon.hp;
    b.submit({ type: 'move', moveIndex: 0 });
    const d1 = hp0 - foe.pokemon.hp;
    b.submit({ type: 'move', moveIndex: 0 });
    const d2 = hp0 - d1 - foe.pokemon.hp;
    expect(d1).toBe(Math.max(1, Math.floor(max / 16)));
    expect(d2).toBe(Math.max(1, Math.floor((max * 2) / 16)));
  });

  it('属性免疫异常：火系不会灼伤，电系不会麻痹', () => {
    const b = battle([mon(SPECIES.cyndaquil, 20)], [mon(SPECIES.pikachu, 20)]);
    expect(b.trySetStatus(b.active(0), 'brn', b.active(1))).toBe(false);
    expect(b.trySetStatus(b.active(1), 'par', b.active(0))).toBe(false);
    expect(b.trySetStatus(b.active(1), 'brn', b.active(0))).toBe(true);
    expect(b.trySetStatus(b.active(1), 'psn', b.active(0))).toBe(false); // 已有异常
  });

  it('睡眠 1–3 回合后醒来', () => {
    const p = mon(SPECIES.rattata, 20, { moves: ['tackle'] });
    const b = battle([p], [mon(SPECIES.gyarados, 50, { moves: ['splash'] })]);
    b.trySetStatus(b.active(0), 'slp', b.active(1));
    const turns = p.status?.sleepTurns ?? 0;
    expect(turns).toBeGreaterThanOrEqual(1);
    expect(turns).toBeLessThanOrEqual(3);
    let woke = false;
    for (let i = 0; i < 4; i++) {
      const evs = b.submit({ type: 'move', moveIndex: 0 });
      if (evs.some((e) => e.type === 'wake')) woke = true;
    }
    expect(woke).toBe(true);
    expect(p.status).toBeNull();
  });

  it('混乱会在 2–5 回合内解除', () => {
    const b = battle([mon(SPECIES.rattata, 20, { moves: ['tackle'] })], [mon(SPECIES.gyarados, 60, { moves: ['splash'] })]);
    b.tryConfuse(b.active(0), b.active(1));
    const n = b.active(0).v.confusion;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(5);
    let cured = false;
    for (let i = 0; i < 6; i++) if (b.submit({ type: 'move', moveIndex: 0 }).some((e) => e.type === 'cure' && e.status === 'confusion')) cured = true;
    expect(cured).toBe(true);
  });

  it('求雨持续 5 回合；沙暴伤害非岩地钢', () => {
    const b = battle([mon(SPECIES.poliwag, 30, { moves: ['rain-dance', 'splash'] })], [mon(SPECIES.magikarp, 30, { moves: ['splash'] })]);
    b.submit({ type: 'move', moveIndex: 0 });
    expect(b.weather).toBe('rain');
    for (let i = 0; i < 3; i++) b.submit({ type: 'move', moveIndex: 1 });
    expect(b.weather).toBe('rain');
    const evs = b.submit({ type: 'move', moveIndex: 1 });
    expect(evs.some((e) => e.type === 'weather-end')).toBe(true);
    expect(b.weather).toBe('none');

    const s = battle([mon(SPECIES.pidgey, 30, { moves: ['sandstorm', 'splash'] })], [mon(SPECIES.magikarp, 30, { moves: ['splash'] })]);
    const sevs = s.submit({ type: 'move', moveIndex: 0 });
    expect(sevs.filter((e) => e.type === 'damage' && e.source === 'weather')).toHaveLength(2);
  });

  it('大地图永久天气', () => {
    const b = battle([mon(SPECIES.rowlet, 10, { moves: ['growl'] })], [mon(SPECIES.magikarp, 10, { moves: ['splash'] })], { weather: 'rain' });
    for (let i = 0; i < 8; i++) b.submit({ type: 'move', moveIndex: 0 });
    expect(b.weather).toBe('rain');
  });
});
