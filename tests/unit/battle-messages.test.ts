/**
 * SCN-001 · 战斗事件 → 中文播报文本。对真实战斗产生的所有事件都要有确定的输出（不能抛异常）。
 */
import { describe, expect, it } from 'vitest';
import { describeEvent, who, type MessageContext } from '@/ui/battle/messages';
import type { BattleEvent } from '@/systems/battle';
import { battle, mon } from './helpers';

const wild: MessageContext = { kind: 'wild', playerName: '小澜' };
const trainer: MessageContext = { kind: 'trainer', playerName: '小澜', foeTrainer: '馆主沧澜' };

describe('battle messages', () => {
  it('阵营前缀：我方直呼其名，野生/训练家分别加前缀', () => {
    expect(who(0, '木木枭', wild)).toBe('木木枭');
    expect(who(1, '波波', wild)).toBe('野生的波波');
    expect(who(1, '海星星', trainer)).toBe('对手的海星星');
  });

  it('出场：野生出现 / 训练家派出 / 我方上场', () => {
    const e = (side: 0 | 1): BattleEvent => ({ type: 'switch-in', side, index: 0, uid: 'u', name: side ? '海星星' : '木木枭', hp: 10, maxHp: 10, level: 5 });
    expect(describeEvent(e(1), wild)).toBe('野生的海星星出现了！');
    expect(describeEvent(e(1), trainer)).toBe('馆主沧澜派出了海星星！');
    expect(describeEvent(e(0), wild)).toBe('上吧！木木枭！');
  });

  it('伤害：要害 + 效果拼接；非招式来源给出原因', () => {
    const base = { type: 'damage', side: 1, name: '波波', amount: 5, hp: 5, maxHp: 10 } as const;
    expect(describeEvent({ ...base, source: 'move', crit: true, effectiveness: 2 }, wild)).toBe('击中了要害！效果绝佳！');
    expect(describeEvent({ ...base, source: 'move', effectiveness: 0.5 }, wild)).toBe('效果不好……');
    expect(describeEvent({ ...base, source: 'move', effectiveness: 1 }, wild)).toBeNull();
    expect(describeEvent({ ...base, source: 'brn' }, wild)).toBe('野生的波波受到了灼伤的伤害！');
  });

  it('能力阶：按幅度与阻挡原因变化措辞', () => {
    const e = (delta: number, blocked?: 'max' | 'min') => describeEvent({ type: 'stage', side: 0, name: '木木枭', stat: 'atk', delta, now: 0, ...(blocked ? { blocked } : {}) }, wild);
    expect(e(1)).toBe('木木枭的攻击提高了！');
    expect(e(2)).toBe('木木枭的攻击大幅提高了！');
    expect(e(-3)).toBe('木木枭的攻击巨幅降低了！');
    expect(e(-1, 'min')).toBe('木木枭的攻击已经无法再降低了！');
  });

  it('捕获：按摇晃次数给出不同文案', () => {
    expect(describeEvent({ type: 'capture', success: true, shakes: 3, name: '波波' }, wild)).toBe('抓到了波波！');
    expect(describeEvent({ type: 'capture', success: false, shakes: 0, name: '波波' }, wild)).toContain('出来了');
    expect(describeEvent({ type: 'capture', success: false, shakes: 2, name: '波波' }, wild)).toContain('只差一点点');
  });

  it('真实战斗的全部事件都能生成文本或显式跳过', () => {
    const b = battle([mon(722, 12)], [mon(16, 8)], {}, 99);
    const events: BattleEvent[] = [];
    for (let i = 0; i < 30 && !b.outcome; i++) {
      const req = b.request(0);
      if (req.kind === 'switch') break;
      if (req.kind !== 'action') break;
      const move = req.moves.find((m) => !m.disabled) ?? req.moves[0]!;
      events.push(...b.submit({ type: 'move', moveIndex: move.index }));
    }
    expect(events.length).toBeGreaterThan(5);
    for (const e of events) {
      const t = describeEvent(e, wild);
      expect(t === null || (typeof t === 'string' && t.length > 0)).toBe(true);
    }
    expect(events.some((e) => e.type === 'move' && describeEvent(e, wild)?.includes('使用了'))).toBe(true);
  });
});
