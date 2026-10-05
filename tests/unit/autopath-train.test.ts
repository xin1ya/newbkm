import { describe, expect, it } from 'vitest';
import { battle, mon } from './helpers';
import { autoSwitchIndex, decideAutoAction, defaultAutoConfig, pickCarrier, sanitizeAutoConfig, type AutoBattleConfig } from '@/systems/autobattle';
import type { BattleRequest } from '@/systems/battle/engine';
import { SceneAutoPath, type AutoPathTarget } from '@/scenes/common/SceneAutoPath';
import type { PlayerController } from '@/actors/player';

type Act = Extract<BattleRequest, { kind: 'action' }>;
const cfg = (o: Partial<AutoBattleConfig> = {}): AutoBattleConfig => ({ ...defaultAutoConfig(), ...o });
const req = (b: ReturnType<typeof battle>): Act => {
  const r = b.request(0);
  if (r.kind !== 'action') throw new Error('expected action');
  return r;
};

describe('自动战斗 · 代练', () => {
  it('pickCarrier 选等级最高且高于首发、能打到对手的同伴', () => {
    expect(pickCarrier([{ level: 5, hp: 10, canHit: true }, { level: 20, hp: 30, canHit: true }, { level: 30, hp: 0, canHit: true }, { level: 25, hp: 40, canHit: false }])).toBe(1);
    expect(pickCarrier([{ level: 20, hp: 10, canHit: true }, { level: 15, hp: 30, canHit: true }])).toBeNull();
    expect(pickCarrier([])).toBeNull();
  });

  it('开启代练：首发在场 → 换高等级打手；关闭时直接攻击', () => {
    const b = battle([mon(722, 4), mon(155, 30)], [mon(16, 5)]);
    expect(decideAutoAction(b, req(b), 'defeat', cfg({ train: true }), {})).toMatchObject({ kind: 'act', action: { type: 'switch', partyIndex: 1 }, note: 'train' });
    expect(decideAutoAction(b, req(b), 'defeat', cfg(), {})).toMatchObject({ action: { type: 'move' } });
    // 非目标仍然逃跑；捕捉目标不换人
    expect(decideAutoAction(b, req(b), null, cfg({ train: true }), {})).toMatchObject({ action: { type: 'run' } });
    const cap = decideAutoAction(b, req(b), 'capture', cfg({ train: true }), { 'poke-ball': 3 });
    expect(cap.kind === 'act' ? cap.action.type : 'stop').not.toBe('switch');
  });

  it('打手上场后正常出招；首发两只都参战（照面）', () => {
    const b = battle([mon(722, 4), mon(155, 30)], [mon(16, 5)]);
    b.submit({ type: 'switch', partyIndex: 1 });
    const r = b.request(0);
    if (r.kind !== 'action') return; // 对手被打倒等
    expect(b.sides[0].active).toBe(1);
    expect(decideAutoAction(b, r, 'defeat', cfg({ train: true }), {})).toMatchObject({ action: { type: 'move' } });
    expect(b.sides[0].party[0]!.faced.size).toBeGreaterThan(0);
  });

  it('指定打手：首发濒死、开场的是别的同伴时也换成指定打手；打手在场后不再换', () => {
    const b = battle([mon(722, 4), mon(155, 30), mon(258, 28)], [mon(16, 5)]);
    const uid = b.sides[0].party[2]!.pokemon.uid;
    expect(decideAutoAction(b, req(b), 'defeat', cfg({ train: true, carrierUid: uid }), {})).toMatchObject({ action: { type: 'switch', partyIndex: 2 }, note: 'train' });
    b.sides[0].active = 1;
    expect(decideAutoAction(b, req(b), 'defeat', cfg({ train: true, carrierUid: uid }), {})).toMatchObject({ action: { type: 'switch', partyIndex: 2 } });
    b.sides[0].active = 2;
    expect(decideAutoAction(b, req(b), 'defeat', cfg({ train: true, carrierUid: uid }), {})).toMatchObject({ action: { type: 'move' } });
  });

  it('代练时打手倒下，换人优先另一只高等级同伴而不是首发', () => {
    const b = battle([mon(722, 4), mon(155, 30), mon(258, 28)], [mon(16, 5)]);
    b.sides[0].party[1]!.pokemon.hp = 0;
    b.sides[0].active = 1;
    expect(autoSwitchIndex(b, cfg({ train: true }))).toBe(2);
    expect(autoSwitchIndex(b, cfg())).toBe(0);
  });

  it('配置读取兼容旧存档（train 缺省 false）', () => {
    expect(sanitizeAutoConfig({ targets: {} }).train).toBe(false);
    expect(sanitizeAutoConfig({ train: true }).train).toBe(true);
  });
});

/** 只实现自动寻路用到的玩家接口 */
function fakePlayer(x: number, z: number) {
  const position = { x, y: 0, z };
  return {
    position,
    mode: 'walk',
    grounded: true,
    moveWithVelocity(dt: number, vx: number, vz: number) {
      position.x += vx * dt;
      position.z += vz * dt;
    },
  };
}

describe('任务自动寻路', () => {
  const mk = (t: AutoPathTarget | null, cost = (_x: number, _z: number) => 1, island = 'tide') => {
    const pl = fakePlayer(0, 0);
    const toasts: string[] = [];
    const ap = new SceneAutoPath({
      player: pl as unknown as PlayerController,
      island: () => island,
      target: () => t,
      questName: () => '测试任务',
      zoneAt: () => null,
      cost: (x, z) => (Math.abs(x) > 200 || Math.abs(z) > 200 ? Infinity : cost(x, z)),
      toast: (s) => toasts.push(s),
      idle: () => true,
      blocked: () => null,
      mountBike: () => false,
      islandName: (id) => id,
    });
    return { pl, ap, toasts };
  };

  it('绕开墙走到目标并自动停止', () => {
    // x=20 处有一堵墙（z ∈ [-30, 30]）
    const wall = (x: number, z: number) => (Math.abs(x - 20) < 2 && Math.abs(z) < 30 ? Infinity : 1);
    const { pl, ap, toasts } = mk({ island: 'tide', x: 50, z: 0, radius: 0, zoneId: null }, wall);
    expect(ap.start()).toBe(true);
    let n = 0;
    while (ap.active && n++ < 3000) {
      ap.fixedUpdate(1 / 30, false);
      // 允许贴着墙角擦过（真实场景的代价函数已外扩 0.6 m，且有碰撞），但不能穿墙
      expect(Math.abs(pl.position.x - 20) < 2 && Math.abs(pl.position.z) < 28).toBe(false);
    }
    expect(ap.active).toBe(false);
    expect(Math.hypot(pl.position.x - 50, pl.position.z)).toBeLessThan(7);
    expect(toasts.at(-1)).toContain('已到达');
  });

  it('按移动键停止；目标在别的岛 / 没有路线时不启动', () => {
    const a = mk({ island: 'tide', x: 60, z: 0, radius: 0, zoneId: null });
    a.ap.start();
    a.ap.fixedUpdate(1 / 30, true);
    expect(a.ap.active).toBe(false);
    const b = mk({ island: 'sprout', x: 60, z: 0, radius: 0, zoneId: null });
    expect(b.ap.start()).toBe(false);
    expect(b.toasts[0]).toContain('sprout');
    const c = mk({ island: 'tide', x: 60, z: 0, radius: 0, zoneId: null }, (x) => (x > 30 ? Infinity : 1));
    expect(c.ap.start()).toBe(false);
    const d = mk(null);
    expect(d.ap.start()).toBe(false);
  });
});
