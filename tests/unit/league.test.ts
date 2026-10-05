import { describe, expect, it } from 'vitest';
import { LEAGUE_INTERIOR, LEAGUE_SEALED } from '@/config/interiors/league';
import { INTERIORS } from '@/config/interiors';
import { TRAINER_BY_ID } from '@/config/trainers';
import { NPC_BY_ID } from '@/config/npcs';
import { STORY_SCRIPTS } from '@/config/story';
import { ISLANDS } from '@/config/islands';
import { SHOPS } from '@/config/shops';
import { ALL_QUESTS } from '@/config/quests';
import { flagsWritten } from '@/systems/story';
import { LEAGUE_ELITES, LEAGUE_TRAINERS, LEAGUE_RUN_FLAG, leagueProgress, leagueRunResetFlags, recordHallOfFame, trainerDefeatedFlag, formatPlayTime } from '@/systems/league';
import { createNewGame } from '@/systems/state';

const room = (id: string) => LEAGUE_INTERIOR.rooms.find((r) => r.id === id)!;

describe('M3-21 精灵联盟', () => {
  it('已注册；房间链：大厅 → 4 × (四天王 + 回廊) → 冠军 → 名人堂', () => {
    expect(INTERIORS['pokemon-league']).toBe(LEAGUE_INTERIOR);
    const order = ['lobby', 'elite-1', 'corridor-1', 'elite-2', 'corridor-2', 'elite-3', 'corridor-3', 'elite-4', 'corridor-4', 'champion', 'hall-of-fame'];
    expect(LEAGUE_INTERIOR.rooms.map((r) => r.id)).toEqual(order);
    for (let i = 0; i < order.length - 1; i++) {
      const fwd = room(order[i]!).exits.find((e) => 'room' in e.to && e.to.room === order[i + 1]);
      expect(fwd, `${order[i]} → ${order[i + 1]}`).toBeTruthy();
      const target = fwd!.to as { room: string; exit: string };
      const back = room(target.room).exits.find((e) => e.id === target.exit);
      expect(back, `${target.room}.${target.exit}`).toBeTruthy();
      // 挑战途中身后的门全部锁上
      expect(back!.requires).toContain(LEAGUE_SEALED);
    }
  });

  it('锁门 flag 永远不会被置位', () => {
    const written = new Set<string>();
    for (const s of STORY_SCRIPTS.values()) flagsWritten(s.steps, written);
    for (const i of Object.values(INTERIORS)) for (const r of i.rooms) for (const e of r.exits) for (const f of e.onPass?.set ?? []) written.add(f);
    expect(written.has(LEAGUE_SEALED)).toBe(false);
    expect(written.has('league-champion-title')).toBe(true);
  });

  it('大厅进门需确认，并重置上一轮的击败记录', () => {
    const n = room('lobby').exits.find((e) => e.id === 'north')!;
    expect(n.confirm?.length).toBeGreaterThan(0);
    expect(n.onPass?.set).toContain(LEAGUE_RUN_FLAG);
    for (const id of LEAGUE_TRAINERS) expect(n.onPass?.clear).toContain(trainerDefeatedFlag(id));
    expect(room('lobby').npcs?.some((s) => NPC_BY_ID.get(s.id)?.service?.kind === 'heal')).toBe(true);
    expect(room('lobby').npcs?.some((s) => NPC_BY_ID.get(s.id)?.service?.kind === 'shop')).toBe(true);
  });

  it('四天王 / 冠军：NPC 站在对应房间，北门要求击败，等级递增，冠军 6 只', () => {
    const rooms = ['elite-1', 'elite-2', 'elite-3', 'elite-4', 'champion'];
    let lastMax = 55;
    LEAGUE_TRAINERS.forEach((tid, i) => {
      const def = TRAINER_BY_ID.get(tid)!;
      expect(def, tid).toBeTruthy();
      const r = room(rooms[i]!);
      const npc = r.npcs!.map((s) => NPC_BY_ID.get(s.id)!).find((n) => n.trainer === tid);
      expect(npc, `${tid} 在 ${r.id}`).toBeTruthy();
      expect(r.exits.find((e) => e.id === 'north')!.requires).toEqual([trainerDefeatedFlag(tid)]);
      expect(r.battleStage).toBeTruthy();
      const lv = def.party.map((m) => m.level);
      expect(Math.min(...lv)).toBeGreaterThanOrEqual(lastMax - 2);
      lastMax = Math.max(...lv);
      for (const m of def.party) expect(m.moves?.length).toBe(4);
      expect(def.sight.range).toBe(0);
    });
    expect(TRAINER_BY_ID.get('league-champion')!.party).toHaveLength(6);
    expect(TRAINER_BY_ID.get('league-e1')!.title).toBe('四天王');
  });

  it('回廊有补给台（只卖药，不能恢复）', () => {
    for (let n = 1; n <= 4; n++) {
      const r = room(`corridor-${n}`);
      const npcs = (r.npcs ?? []).map((s) => NPC_BY_ID.get(s.id)!);
      expect(npcs.some((x) => x.service?.kind === 'shop')).toBe(true);
      expect(npcs.some((x) => x.service?.kind === 'heal')).toBe(false);
      expect(r.furniture.some((f) => f.type === 'healer')).toBe(false);
    }
    const supply = SHOPS.find((s) => s.id === 'league-supply')!;
    expect(supply.stock.every((x) => !x.item.endsWith('-ball'))).toBe(true);
  });

  it('名人堂：触发器在入口、出口回到彩幽市；剧情脚本记录名人堂并结束本轮', () => {
    const r = room('hall-of-fame');
    const t = r.triggers![0]!;
    const entry = r.exits.find((e) => e.id === 'west')!;
    expect(Math.hypot(entry.position[0] + entry.spawnOffset![0] - t.position[0], entry.position[1] + entry.spawnOffset![1] - t.position[1])).toBeLessThan(t.radius);
    expect(r.exits.find((e) => e.id === 'front')!.to).toEqual({ overworld: true, poi: 'league-entrance' });
    const s = STORY_SCRIPTS.get(t.script)!;
    expect(s.steps.some((x) => x.kind === 'hall-of-fame')).toBe(true);
    expect(s.steps.some((x) => x.kind === 'unflag' && x.clear.includes(LEAGUE_RUN_FLAG))).toBe(true);
    expect(flagsWritten(s.steps).has(t.doneFlag)).toBe(true);
  });

  it('大地图入口：联盟大门中门，走完冠军之路后开放', () => {
    const poi = ISLANDS.glaze!.pois.find((p) => p.id === 'league-entrance')!;
    expect(poi.interior).toBe('pokemon-league');
    expect(poi.requires).toEqual(['victory-road-cleared']);
    expect(poi.lockedHint).toBeTruthy();
    const q = ALL_QUESTS.find((x) => x.id === 'main-league')!;
    expect(q.completeFlag).toBe('league-champion-title');
  });

  it('纯逻辑：进度 / 重置 / 名人堂记录', () => {
    const f: Record<string, boolean> = {};
    expect(leagueProgress(f)).toBe(0);
    f[trainerDefeatedFlag(LEAGUE_ELITES[0])] = true;
    f[trainerDefeatedFlag(LEAGUE_ELITES[2])] = true;
    expect(leagueProgress(f)).toBe(1);
    expect(leagueRunResetFlags()).toContain('league-hof-run');
    const st = createNewGame({ name: '小澜', gender: 'boy', trainerId: 1, spawn: { island: 'glaze', xyz: [0, 0, 0] } });
    st.playTime = 3723;
    const e1 = recordHallOfFame(st, []);
    const e2 = recordHallOfFame(st, []);
    expect([e1.n, e2.n]).toEqual([1, 2]);
    expect(st.hallOfFame).toHaveLength(2);
    expect(formatPlayTime(3723)).toBe('1 小时 02 分');
  });
});
