import type { ExitConfig, InteriorConfig, RoomConfig } from './types';
import { SPROUT_INTERIORS } from './sprout';
import { TIDE_INTERIORS } from './tide';
import { THUNDER_INTERIORS } from './thunder';
import { GLAZE_INTERIORS } from './glaze';

export type * from './types';

export const INTERIORS: Readonly<Record<string, InteriorConfig>> = Object.fromEntries([...SPROUT_INTERIORS, ...TIDE_INTERIORS, ...THUNDER_INTERIORS, ...GLAZE_INTERIORS].map((i) => [i.id, i]));

export function getInterior(id: string): InteriorConfig {
  const i = INTERIORS[id];
  if (!i) throw new Error(`未知室内场景：${id}`);
  return i;
}

export function getRoom(interior: InteriorConfig, roomId: string): RoomConfig {
  const r = interior.rooms.find((r) => r.id === roomId);
  if (!r) throw new Error(`室内场景 ${interior.id} 没有房间 ${roomId}`);
  return r;
}

export function getExit(room: RoomConfig, exitId: string): ExitConfig {
  const e = room.exits.find((e) => e.id === exitId);
  if (!e) throw new Error(`房间 ${room.id} 没有出口 ${exitId}`);
  return e;
}

/** 从某个出口进入房间时的出生点与朝向 */
export function spawnAtExit(exit: ExitConfig): { x: number; z: number; yaw: number } {
  const [ox, oz] = exit.spawnOffset ?? [0, -1.2];
  return { x: exit.position[0] + ox, z: exit.position[1] + oz, yaw: exit.spawnYaw ?? Math.PI };
}
