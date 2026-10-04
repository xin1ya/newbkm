/**
 * M1-05 · 室内场景配置校验：门与室内一一对应、出口互通、出生点可站立。
 */
import { describe, expect, it } from 'vitest';
import { INTERIORS, getExit, getRoom, spawnAtExit } from '@/config/interiors';
import type { FurnitureConfig, RoomConfig } from '@/config/interiors';
import { SPROUT } from '@/config/islands/sprout';

const NO_COLLIDE = new Set(['rug', 'poster', 'window', 'pc']);
const DEFAULT_FOOTPRINT: Record<string, [number, number]> = { chair: [0.5, 0.5], plant: [0.6, 0.6], lamp: [0.4, 0.4], barrel: [0.7, 0.7], crate: [0.8, 0.8], fridge: [0.9, 0.75], stove: [0.9, 0.7], tv: [1.3, 0.5], bed: [1.2, 2.1], sofa: [2, 0.9], table: [1.4, 0.9], machine: [1.6, 0.9], aquarium: [2, 0.8] };

function footprintHit(f: FurnitureConfig, x: number, z: number, pad: number): boolean {
  if (f.noCollide || NO_COLLIDE.has(f.type)) return false;
  const [w, d] = f.size ? [f.size[0], f.size[2]] : (DEFAULT_FOOTPRINT[f.type] ?? [1, 1]);
  const yaw = f.yaw ?? 0;
  const dx = x - f.position[0];
  const dz = z - f.position[1];
  const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  return Math.abs(lx) < w / 2 + pad && Math.abs(lz) < d / 2 + pad;
}

function inside(room: RoomConfig, x: number, z: number, margin = 0.35): boolean {
  return Math.abs(x) < room.size[0] / 2 - margin && Math.abs(z) < room.size[1] / 2 - margin;
}

describe('室内场景配置', () => {
  it('岛上每个带 interior 的 POI 都有对应室内场景', () => {
    const missing = SPROUT.pois.filter((p) => p.interior && !INTERIORS[p.interior]).map((p) => p.id);
    expect(missing).toEqual([]);
  });

  for (const interior of Object.values(INTERIORS)) {
    describe(interior.name, () => {
      it('入口房间与入口出口存在，且至少有一个回到大地图的出口', () => {
        const room = getRoom(interior, interior.entryRoom);
        expect(getExit(room, interior.entryExit)).toBeTruthy();
        expect(interior.rooms.some((r) => r.exits.some((e) => 'overworld' in e.to))).toBe(true);
      });

      for (const room of interior.rooms) {
        it(`${room.id}：楼梯出口双向互通`, () => {
          for (const e of room.exits) {
            if (!('room' in e.to)) continue;
            const target = getRoom(interior, e.to.room);
            const back = getExit(target, e.to.exit);
            expect('room' in back.to && back.to.room === room.id && back.to.exit === e.id).toBe(true);
          }
        });

        it(`${room.id}：从每个出口进入的出生点在房间内、不在家具里、不在任何出口触发区里`, () => {
          for (const e of room.exits) {
            const s = spawnAtExit(e);
            expect(inside(room, s.x, s.z), `${e.id} 出生点出界`).toBe(true);
            const blocked = room.furniture.filter((f) => footprintHit(f, s.x, s.z, 0.3)).map((f) => f.type);
            expect(blocked, `${e.id} 出生点被家具挡住`).toEqual([]);
            for (const o of room.exits) expect(Math.hypot(s.x - o.position[0], s.z - o.position[1]), `${e.id} 出生点落在出口 ${o.id} 里`).toBeGreaterThan(o.radius ?? 0.8);
          }
        });

        it(`${room.id}：正门在 +Z 墙、出口触发区在房间内`, () => {
          for (const e of room.exits) {
            expect(inside(room, e.position[0], e.position[1], 0)).toBe(true);
            if ('overworld' in e.to) expect(e.position[1]).toBeGreaterThan(room.size[1] / 2 - 1);
          }
        });

        it(`${room.id}：家具不挡住出口`, () => {
          for (const e of room.exits) {
            const blocked = room.furniture.filter((f) => footprintHit(f, e.position[0], e.position[1], 0.1)).map((f) => f.type);
            expect(blocked).toEqual([]);
          }
        });
      }
    });
  }
});
