import { describe, expect, it } from 'vitest';
import { BOX_COUNT, BOX_SIZE, boxPage, createNewGame, deposit, release, sortBox, swapWithParty, withdraw, type GameState } from '@/systems/state';
import { mon, SPECIES } from './helpers';

const newGame = (): GameState => createNewGame({ name: '小翠', gender: 'girl', trainerId: 1, spawn: { island: 'sprout', xyz: [0, 0, 0] }, now: new Date('2026-10-03T00:00:00Z') });

describe('宝可梦寄放系统', () => {
  it('16 个盒子 × 30', () => {
    expect(BOX_COUNT).toBe(16);
    expect(BOX_SIZE).toBe(30);
  });

  it('存入 / 取出，队伍至少留 1 只', () => {
    const s = newGame();
    s.party.push(mon(SPECIES.rowlet, 5), mon(SPECIES.pidgey, 3));
    expect(deposit(s, 1).ok).toBe(true);
    expect(s.box.length).toBe(1);
    expect(deposit(s, 0).ok).toBe(false);
    expect(withdraw(s, 0).ok).toBe(true);
    expect(s.party.length).toBe(2);
    expect(s.box.length).toBe(0);
  });

  it('不能把最后一只能战斗的存走 / 换成濒死的', () => {
    const s = newGame();
    const a = mon(SPECIES.rowlet, 5);
    const b = mon(SPECIES.pidgey, 3);
    b.hp = 0;
    s.party.push(a, b);
    expect(deposit(s, 0).ok).toBe(false);
    expect(deposit(s, 1).ok).toBe(true);
    const c = mon(SPECIES.pidgey, 4);
    c.hp = 0;
    s.box.push(c);
    expect(swapWithParty(s, 1, 0).ok).toBe(false);
    expect(swapWithParty(s, 0, 0).ok).toBe(false);
  });

  it('队伍满时不能取出，可以交换', () => {
    const s = newGame();
    for (let i = 0; i < 6; i++) s.party.push(mon(SPECIES.pidgey, 3, {}, i));
    const x = mon(SPECIES.rowlet, 9);
    s.box.push(x);
    expect(withdraw(s, 0).ok).toBe(false);
    expect(swapWithParty(s, 0, 2).ok).toBe(true);
    expect(s.party[2]).toBe(x);
    expect(s.box[0]!.speciesId).toBe(SPECIES.pidgey);
  });

  it('放生归还携带道具；整理与分页', () => {
    const s = newGame();
    s.party.push(mon(SPECIES.rowlet, 5));
    const h = mon(SPECIES.pidgey, 7);
    h.heldItem = 'oran-berry';
    s.box.push(mon(SPECIES.rowlet, 2), h, mon(SPECIES.pidgey, 3));
    sortBox(s, 'level');
    expect(s.box.map((p) => p.level)).toEqual([7, 3, 2]);
    expect(release(s, 'box', 0).ok).toBe(true);
    expect(s.bag['oran-berry']).toBe(1);
    expect(release(s, 'party', 0).ok).toBe(false);
    expect(boxPage(s, 0).length).toBe(2);
    expect(boxPage(s, 1).length).toBe(0);
  });
});
