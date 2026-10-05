/**
 * M3-20 · 冠军之路：推石谜题可解、房间连通、能力门槛、徽章检查、高原乱流（只挡飞行）。
 */
import { describe, expect, it } from 'vitest';
import species from '@/config/data/species.json';
import { INTERIORS } from '@/config/interiors';
import { VICTORY_ROAD_BADGES, VR_BOULDERS } from '@/config/interiors/victoryRoad';
import { ISLANDS } from '@/config/islands';
import { GYMS } from '@/config/encounters';
import { GLAZE_ENCOUNTERS } from '@/config/encounters/glaze';
import { NPC_BY_ID } from '@/config/npcs';
import { TRAINER_BY_ID } from '@/config/trainers';
import { STORY_SCRIPTS } from '@/config/story';
import { GLAZE_QUESTS } from '@/config/quests/glaze';
import { blockerContains, blockerOpen } from '@/systems/interaction';
import { cellAt, loadBoulderState, pushBoulder, solveBoulders, walkable } from '@/systems/puzzles/boulders';

const VR = INTERIORS['victory-road']!;
const room = (id: string) => VR.rooms.find((r) => r.id === id)!;
const GLAZE = ISLANDS.glaze!;
const DEX = new Set((species as Array<{ id: number }>).map((s) => s.id));

describe('M3-20 冠军之路 · 推石谜题', () => {
  it(
    '可解，且至少 13 推',
    () => {
      const r = solveBoulders(VR_BOULDERS);
      expect(r.solvable).toBe(true);
      expect(r.minPushes).toBeGreaterThanOrEqual(13);
    },
    120000,
  );
  it('不推石头过不了裂谷（起点与终点不连通）', () => {
    const st = loadBoulderState(VR_BOULDERS);
    const seen = new Set<string>();
    const q: Array<[number, number]> = [[...VR_BOULDERS.start]];
    seen.add(VR_BOULDERS.start.join());
    while (q.length) {
      const [c, r] = q.pop()!;
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const k = `${c + dc},${r + dr}`;
        if (seen.has(k) || !walkable(VR_BOULDERS, st, c + dc, r + dr)) continue;
        seen.add(k);
        q.push([c + dc, r + dr]);
      }
    }
    expect(seen.has(VR_BOULDERS.goal.join())).toBe(false);
  });
  it('石头推进洞里会填平洞', () => {
    const st = loadBoulderState(VR_BOULDERS, {});
    // 构造：把一块石头放到洞正下方再往北推
    st.boulders[0] = [10, 6];
    const res = pushBoulder(VR_BOULDERS, st, 10, 6, 0, -1);
    expect(res.ok && res.filledHole).toBe(0);
  });
  it('房间入口 / 出口落在谜题的起点 / 终点格', () => {
    const hall = room('boulder-hall');
    const w = hall.exits.find((e) => e.id === 'west')!;
    const d = hall.exits.find((e) => e.id === 'down')!;
    const at = (e: typeof w) => cellAt(VR_BOULDERS, e.position[0] + (e.spawnOffset?.[0] ?? 0), e.position[1] + (e.spawnOffset?.[1] ?? 0));
    expect(at(w)).toEqual([...VR_BOULDERS.start]);
    expect(at(d)).toEqual([...VR_BOULDERS.goal]);
  });
});

describe('M3-20 冠军之路 · 房间与门槛', () => {
  it('所有房间之间的出口互相对应', () => {
    for (const r of VR.rooms) {
      for (const e of r.exits) {
        if ('overworld' in e.to) continue;
        const t = room(e.to.room);
        expect(t, `${r.id}.${e.id}`).toBeTruthy();
        const back = t.exits.find((x) => x.id === (e.to as { exit: string }).exit);
        expect(back, `${r.id}.${e.id}`).toBeTruthy();
        expect(back!.to).toEqual({ room: r.id, exit: e.id });
      }
    }
  });
  it('两个洞口各对应一个 POI，POI.room 指向对应房间', () => {
    for (const [poiId, roomId] of [
      ['victory-road-south', 'south-gate'],
      ['victory-road-north', 'summit'],
    ] as const) {
      const poi = GLAZE.pois.find((p) => p.id === poiId)!;
      expect(poi.interior).toBe('victory-road');
      expect(poi.room).toBe(roomId);
      expect(room(roomId).exits.some((e) => 'overworld' in e.to && e.to.poi === poiId)).toBe(true);
    }
  });
  it('南关所徽章检查 = 全部 11 座道馆的徽章', () => {
    const gate = room('south-gate').exits.find((e) => e.id === 'north')!;
    const all = GYMS.map((g) => g.badgeFlag).sort();
    expect([...VICTORY_ROAD_BADGES].sort()).toEqual(all);
    expect([...(gate.requires ?? [])].sort()).toEqual(all);
    expect(gate.lockedHint).toBeTruthy();
  });
  it('能力门槛：怪力（推石）→ 闪光（暗河）→ 攀瀑 → 攀岩', () => {
    expect(room('boulder-hall').boulders).toBeTruthy();
    expect(room('river-b1').dark?.flag).toBe('field-flash');
    const falls = room('river-b1').exits.find((e) => e.id === 'falls')!;
    expect(falls.action).toBe('waterfall');
    expect(falls.requires).toEqual(['hm07-waterfall']);
    const climb = room('cliff-2f').exits.find((e) => e.id === 'climb-up')!;
    expect(climb.action).toBe('climb');
    expect(climb.requires).toEqual(['hm08-rock-climb']);
    // 所有能力出口都有门槛
    for (const r of VR.rooms) for (const e of r.exits) if (e.action) expect(e.requires?.length, `${r.id}.${e.id}`).toBeGreaterThan(0);
  });
  it('攀瀑老人在瀑布下游，剧情给出 hm07-waterfall', () => {
    expect(room('river-b1').npcs?.some((n) => n.id === 'vr-falls-master')).toBe(true);
    const s = STORY_SCRIPTS.get('vr-hm07')!;
    expect(JSON.stringify(s.steps)).toContain('hm07-waterfall');
    const npc = NPC_BY_ID.get('vr-falls-master')!;
    expect(npc.dialogByQuest?.some((q) => q.story === 'vr-hm07' && q.unless?.includes('hm07-waterfall'))).toBe(true);
  });
  it('山顶洞口的触发器设置 victory-road-cleared', () => {
    const t = room('summit').triggers!.find((x) => x.doneFlag === 'victory-road-cleared')!;
    expect(STORY_SCRIPTS.get(t.script)).toBeTruthy();
  });
  it('训练家：7 位、都摆在房间里、物种在图鉴内、等级 51–55', () => {
    const placed = VR.rooms.flatMap((r) => r.npcs ?? []).map((n) => NPC_BY_ID.get(n.id)).filter((n) => n?.trainer);
    expect(placed.length).toBe(7);
    for (const n of placed) {
      const t = TRAINER_BY_ID.get(n!.trainer!)!;
      expect(t, n!.id).toBeTruthy();
      for (const m of t.party) {
        expect(DEX.has(m.species), `${t.id}:${m.species}`).toBe(true);
        expect(m.level).toBeGreaterThanOrEqual(51);
        expect(m.level).toBeLessThanOrEqual(55);
      }
    }
  });
  it('遭遇表存在且物种在图鉴内', () => {
    for (const r of VR.rooms) {
      if (!r.encounters) continue;
      const tab = GLAZE_ENCOUNTERS[r.encounters.table];
      expect(tab, r.id).toBeTruthy();
      for (const e of tab!.entries) expect(DEX.has(e.speciesId), `${tab!.id}:${e.speciesId}`).toBe(true);
    }
  });
  it('主线任务：前置 11 枚徽章，完成 = victory-road-cleared', () => {
    const q = GLAZE_QUESTS.find((x) => x.id === 'main-victory-road')!;
    expect([...q.prerequisites].sort()).toEqual([...VICTORY_ROAD_BADGES].sort());
    expect(q.completeFlag).toBe('victory-road-cleared');
  });
});

describe('M3-20 联盟高原乱流', () => {
  const wall = GLAZE.blockers.find((b) => b.id === 'plateau-windwall')!;
  it('只挡飞行，通关后打开', () => {
    expect(wall.flyOnly).toBe(true);
    expect(wall.fx).toBe('windwall');
    expect(blockerOpen(wall, () => false)).toBe(false);
    expect(blockerOpen(wall, (f) => f === 'victory-road-cleared')).toBe(true);
  });
  it('圈住彩幽市与北口，不圈南口', () => {
    const p = (id: string) => GLAZE.pois.find((x) => x.id === id)!.position;
    for (const id of ['pokecenter-ever', 'mart-ever', 'ever-champion-statues', 'victory-road-north']) {
      const [x, , z] = p(id);
      expect(blockerContains(wall, x, z), id).toBe(true);
    }
    const [sx, , sz] = p('victory-road-south');
    expect(blockerContains(wall, sx, sz)).toBe(false);
  });
});
