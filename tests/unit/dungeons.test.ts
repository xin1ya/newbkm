/**
 * M3-23 · 洞窟 / 塔：房间链、推石谜题（压力板 / 冰裂缝）可解、碎岩掉落、NPC / 训练家 / 互动 / 遇敌表引用完整。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CRYSTAL_GALLERY_PUZZLE, DUNGEON_INTERIORS, GLACIER_TABLET_PUZZLE } from '@/config/interiors/dungeons';
import { INTERIORS, spawnAtExit } from '@/config/interiors';
import { ISLANDS } from '@/config/islands';
import { THUNDER } from '@/config/islands/thunder';
import { NPC_BY_ID } from '@/config/npcs';
import { TRAINER_BY_ID } from '@/config/trainers';
import { ALL_INTERACTIONS } from '@/config/interactions';
import { ENCOUNTER_TABLES } from '@/config/encounters';
import { VICTORY_ROAD_INTERIOR } from '@/config/interiors/victoryRoad';
import { gateFlag, loadBoulderState, platesCovered, pushBoulder, solveBoulders, walkable } from '@/systems/puzzles/boulders';
import { DEFAULT_SMASH_LOOT, rollSmash, SMASH_ITEM_CHANCE, SMASH_WILD_CHANCE } from '@/systems/field/rockSmash';
import { createRng } from '@/systems/rng';
import { Heightfield } from '@/world/terrain/Heightfield';
import species from '@/config/data/species.json';
import items from '@/config/data/items.json';
import { KEY_ITEM_BY_ID } from '@/config/items';

const dexIds = new Set((species as { id: number }[]).map((s) => s.id));
const itemIds = new Set([...(items as { id: string }[]).map((i) => i.id), ...KEY_ITEM_BY_ID.keys()]);
const interactionIds = new Set(ALL_INTERACTIONS.map((i) => i.id));

describe('M3-23 洞窟 / 塔', () => {
  it('四个场景已注册，大地图 POI 都指向它们', () => {
    for (const id of ['crystal-cave', 'old-lighthouse', 'glacier-ruins', 'shadow-cave']) expect(INTERIORS[id], id).toBeTruthy();
    const pois = Object.values(ISLANDS).flatMap((c) => c?.pois ?? []);
    for (const i of DUNGEON_INTERIORS) expect(pois.some((p) => p.interior === i.id), i.id).toBe(true);
    expect(THUNDER.pois.find((p) => p.id === 'old-lighthouse')?.interior).toBe('old-lighthouse');
  });

  it('所有房间从入口可达（房间图连通）', () => {
    for (const i of DUNGEON_INTERIORS) {
      const seen = new Set([i.entryRoom]);
      const q = [i.entryRoom];
      while (q.length) {
        const id = q.pop();
        const r = i.rooms.find((x) => x.id === id)!;
        for (const e of r.exits) {
          if (!('room' in e.to) || seen.has(e.to.room)) continue;
          seen.add(e.to.room);
          q.push(e.to.room);
        }
      }
      expect([...seen].sort(), i.id).toEqual(i.rooms.map((r) => r.id).sort());
    }
  });

  it('NPC / 训练家 / 互动 / 遇敌表引用完整；训练家宝可梦都在图鉴里', () => {
    for (const i of DUNGEON_INTERIORS)
      for (const r of i.rooms) {
        for (const n of r.npcs ?? []) {
          const npc = NPC_BY_ID.get(n.id);
          expect(npc, n.id).toBeTruthy();
          if (npc?.trainer) {
            const t = TRAINER_BY_ID.get(npc.trainer);
            expect(t, npc.trainer).toBeTruthy();
            for (const m of t!.party) expect(dexIds.has(m.species), `${t!.id} ${m.species}`).toBe(true);
          }
        }
        for (const f of r.furniture) if (f.interact) expect(interactionIds.has(f.interact), f.interact).toBe(true);
        if (r.encounters) {
          const tb = ENCOUNTER_TABLES[r.encounters.table];
          expect(tb, r.encounters.table).toBeTruthy();
          for (const e of tb!.entries) expect(dexIds.has(e.speciesId), `${tb!.id} ${e.speciesId}`).toBe(true);
        }
        for (const l of r.smashRocks?.loot ?? []) expect(itemIds.has(l.item), l.item).toBe(true);
      }
    for (const l of DEFAULT_SMASH_LOOT) expect(itemIds.has(l.item), l.item).toBe(true);
    for (const it of ALL_INTERACTIONS) for (const ef of it.effects ?? []) if (ef.kind === 'give-item') expect(itemIds.has(ef.item), ef.item).toBe(true);
  });

  it('晶石回廊：压力板推石可解，石闸关闭时挡路、压满后打开', () => {
    const r = solveBoulders(CRYSTAL_GALLERY_PUZZLE);
    expect(r.solvable).toBe(true);
    expect(r.minPushes).toBeGreaterThanOrEqual(8);
    const st = loadBoulderState(CRYSTAL_GALLERY_PUZZLE);
    expect(st.gateOpen).toBe(false);
    expect(walkable(CRYSTAL_GALLERY_PUZZLE, st, 5, 3)).toBe(false);
    // 直接把石头放到压力板旁边推上去：第二块压上时打开
    const s1 = { ...st, boulders: [[1, 7], [10, 5], [5, 9]] as Array<[number, number] | null> };
    const a = pushBoulder(CRYSTAL_GALLERY_PUZZLE, s1, 1, 7, 0, -1);
    expect(a.ok && !a.openedGate).toBe(true);
    const b = a.ok ? pushBoulder(CRYSTAL_GALLERY_PUZZLE, a.state, 10, 5, 0, -1) : null;
    expect(b?.ok && b.openedGate).toBe(true);
    expect(b?.ok && platesCovered(CRYSTAL_GALLERY_PUZZLE, b.state.boulders)).toBe(true);
    expect(b?.ok && walkable(CRYSTAL_GALLERY_PUZZLE, b.state, 5, 3)).toBe(true);
    // 存档后再进来石闸保持打开
    expect(loadBoulderState(CRYSTAL_GALLERY_PUZZLE, { [gateFlag(CRYSTAL_GALLERY_PUZZLE)]: true }).gateOpen).toBe(true);
  });

  it('石碑之间：冰裂缝推石可解', () => {
    const r = solveBoulders(GLACIER_TABLET_PUZZLE);
    expect(r.solvable).toBe(true);
    expect(r.minPushes).toBeGreaterThanOrEqual(8);
  });

  it('谜题房间：出口出生点不落在谜题的墙 / 石头 / 洞上', () => {
    for (const i of DUNGEON_INTERIORS)
      for (const room of i.rooms) {
        const cfg = room.boulders;
        if (!cfg) continue;
        const st = loadBoulderState(cfg);
        for (const e of room.exits) {
          const s = spawnAtExit(e);
          const c = Math.floor((s.x - cfg.origin[0]) / cfg.cell);
          const rr = Math.floor((s.z - cfg.origin[1]) / cfg.cell);
          expect(walkable(cfg, st, c, rr), `${room.id}/${e.id}`).toBe(true);
        }
      }
  });

  it('裂纹小岩不挡出口 / 出生点 / NPC', () => {
    for (const i of [...DUNGEON_INTERIORS, VICTORY_ROAD_INTERIOR])
      for (const room of i.rooms)
        for (const [x, z] of room.smashRocks?.rocks ?? []) {
          expect(Math.abs(x) < room.size[0] / 2 - 0.8 && Math.abs(z) < room.size[1] / 2 - 0.8, `${room.id} (${x},${z}) 出界`).toBe(true);
          for (const e of room.exits) {
            expect(Math.hypot(x - e.position[0], z - e.position[1]), `${room.id} 挡出口 ${e.id}`).toBeGreaterThan(2);
            const s = spawnAtExit(e);
            expect(Math.hypot(x - s.x, z - s.z), `${room.id} 挡出生点 ${e.id}`).toBeGreaterThan(1.5);
          }
          for (const n of room.npcs ?? []) expect(Math.hypot(x - n.position[0], z - n.position[1]), `${room.id} 压住 ${n.id}`).toBeGreaterThan(1.5);
        }
  });

  it('碎岩掷骰：概率分布大致符合设定；没有遇敌表时不会跳出宝可梦', () => {
    const rng = createRng(42);
    const n = 4000;
    const cnt = { wild: 0, item: 0, none: 0 };
    for (let k = 0; k < n; k++) cnt[rollSmash(rng, { rocks: [] }, true).kind]++;
    expect(cnt.wild / n).toBeGreaterThan(SMASH_WILD_CHANCE - 0.04);
    expect(cnt.wild / n).toBeLessThan(SMASH_WILD_CHANCE + 0.04);
    expect(cnt.item / n).toBeGreaterThan(SMASH_ITEM_CHANCE - 0.05);
    for (let k = 0; k < 500; k++) expect(rollSmash(rng, { rocks: [] }, false).kind).not.toBe('wild');
    const r = rollSmash(createRng(1), { rocks: [], itemChance: 1, loot: [{ item: 'gravel', weight: 1, qty: [2, 2] }] }, false);
    expect(r).toEqual({ kind: 'item', item: 'gravel', qty: 2 });
  });

  it('古灯塔门口在陆地上（不在海里）', () => {
    const dir = join(__dirname, '../../assets');
    const buf = (p: string) => {
      const b = readFileSync(join(dir, p));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    };
    const hf = Heightfield.fromPng(THUNDER, buf(THUNDER.heightmap), THUNDER.splatmaps.map(buf));
    const props = JSON.parse(readFileSync(join(dir, 'islands/thunder/props.json'), 'utf-8')) as { props?: unknown[] } | unknown[];
    const list = (Array.isArray(props) ? props : (props.props ?? [])) as { type: string; ref?: string; position: [number, number]; yaw: number; size: [number, number, number] }[];
    const lh = list.find((p) => p.type === 'lighthouse' && p.ref === 'old-lighthouse')!;
    expect(lh).toBeTruthy();
    const d = lh.size[0] * 0.75 + 1.2;
    const dx = lh.position[0] + Math.sin(lh.yaw) * d;
    const dz = lh.position[1] + Math.cos(lh.yaw) * d;
    const w = hf.waterAt(dx, dz);
    expect(!w || w.depth < 0.3, `门口 (${dx.toFixed(1)}, ${dz.toFixed(1)}) 在水里`).toBe(true);
  });
});
