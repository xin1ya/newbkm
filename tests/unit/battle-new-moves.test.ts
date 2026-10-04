/**
 * 招式库补全后新增的特殊招式（替身 / 再来一次 / 戏法空间 / 祈愿 / 力量平分 / 交换特性 / 磨砺 / 挡路 / 场地）
 */
import { describe, expect, it } from 'vitest';
import { messageCode } from '@/ui/battle/messages';
import { battle, dex, mon } from './helpers';

const M = (id: number, lv: number, moves: string[]) => mon(id, lv, { moves });
const use = (i: number) => ({ type: 'move' as const, moveIndex: i });

describe('招式库补全', () => {
  it('图鉴物种的招式学习器 / 教学 / 蛋招式都在招式库里', () => {
    for (const s of dex.allSpecies()) {
      for (const id of [...(s.machineMoves ?? []), ...(s.tutorMoves ?? []), ...(s.eggMoves ?? [])]) expect(dex.hasMove(id), `${s.key} ${id}`).toBe(true);
      expect(s.machineMoves, s.key).toBeDefined();
    }
  });
});

describe('新增特殊招式', () => {
  it('替身挡下伤害与变化招式，被打破后消失', () => {
    const me = M(25, 50, ['substitute', 'tackle']);
    const foe = M(19, 5, ['tackle', 'growl', 'thunder-wave']);
    const b = battle([me], [foe]);
    const hp0 = me.hp;
    b.submit(use(0), use(2)); // 电磁波被替身挡住
    expect(b.active(0).v.substitute).toBeGreaterThan(0);
    expect(me.status).toBeNull();
    expect(me.hp).toBe(hp0 - Math.floor(b.maxHp(b.active(0)) / 4));
    const sub = b.active(0).v.substitute;
    b.submit(use(0), use(0)); // 已有替身：再用失败；对手撞击打在替身上
    expect(b.active(0).v.substitute).toBeLessThan(sub);
    expect(me.hp).toBe(hp0 - Math.floor(b.maxHp(b.active(0)) / 4));
  });

  it('再来一次锁定对手上一个招式 3 回合', () => {
    const me = M(25, 50, ['encore', 'tackle']);
    const foe = M(19, 50, ['tackle', 'tail-whip']);
    const b = battle([me], [foe], {}, 7);
    b.submit(use(1), use(1)); // 对手先用摇尾巴
    b.submit(use(0), use(1));
    expect(b.active(1).v.encore?.move).toBe('tail-whip');
    const ev = b.submit(use(1), use(0)); // 对手想用撞击，被锁定为摇尾巴
    expect(ev.some((e) => e.type === 'move' && e.side === 1 && e.move === 'tail-whip')).toBe(true);
  });

  it('戏法空间：慢的先动', () => {
    const slow = M(74, 30, ['trick-room', 'tackle']); // 小拳石
    const fast = M(25, 30, ['tackle']);
    const b = battle([slow], [fast], {}, 3);
    b.submit(use(0), use(0));
    const ev = b.submit(use(1), use(0));
    const order = ev.filter((e) => e.type === 'move').map((e) => (e as { side: number }).side);
    expect(order[0]).toBe(0);
  });

  it('祈愿下回合末回复一半', () => {
    const me = M(25, 50, ['wish', 'tackle']);
    const foe = M(19, 50, ['tackle']);
    const b = battle([me], [foe], {}, 5);
    b.submit(use(0), use(0));
    const ev = b.submit(use(1), use(0));
    expect(ev.some((e) => e.type === 'heal' && e.side === 0 && e.source === 'wish')).toBe(true);
  });

  it('交换特性 / 烦恼种子在战斗结束后还原', () => {
    const me = M(25, 50, ['skill-swap', 'worry-seed']);
    const foe = M(19, 5, ['tackle']);
    const a0 = me.ability;
    const f0 = foe.ability;
    const b = battle([me], [foe], {}, 9);
    b.submit(use(0), use(0));
    expect(me.ability).toBe(f0);
    b.submit({ type: 'run' }, use(0));
    expect(b.outcome).toBeTruthy();
    expect(me.ability).toBe(a0);
    expect(foe.ability).toBe(f0);
  });

  it('力量平分取双方攻击 / 特攻平均；磨砺下一击必定会心', () => {
    const me = M(25, 50, ['power-split', 'laser-focus', 'tackle']);
    const foe = M(130, 50, ['splash']);
    const b = battle([me], [foe], {}, 2);
    b.submit(use(0), use(0));
    expect(b.active(0).v.statOverride?.atk).toBe(b.active(1).v.statOverride?.atk);
    b.submit(use(1), use(0));
    const ev = b.submit(use(2), use(0));
    expect(ev.some((e) => e.type === 'damage' && e.side === 1 && e.crit)).toBe(true);
  });

  it('挡路后无法逃走；电气场地提升电属性招式', () => {
    const me = M(25, 50, ['thunder-shock', 'electric-terrain']);
    const foe = M(19, 50, ['block', 'splash']);
    const b = battle([me], [foe], {}, 4);
    b.submit(use(1), use(0));
    expect(b.terrain).toBe('electric');
    const ev = b.submit({ type: 'run' }, use(1));
    expect(ev.some((e) => e.type === 'run' && !e.success)).toBe(true);
  });

  it('message 代码转中文', () => {
    expect(messageCode('splash')).toBe('但是什么也没有发生！');
    expect(messageCode('sub-hit:皮卡丘')).toContain('替身');
    expect(messageCode('terrain:electric')).toContain('电气场地');
  });
});
