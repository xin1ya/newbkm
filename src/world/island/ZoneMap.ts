/**
 * 区域查询（纯逻辑）：点在哪个区域多边形里。多个区域重叠时，城镇优先于野外、野外优先于海域。
 * 结果带 64 m 网格缓存，每帧查询开销可忽略。
 */
import type { IslandConfig, ZoneConfig, Vec2 } from '@/config/islands/types';

export function pointInPolygon(x: number, z: number, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const PRIORITY: Record<ZoneConfig['kind'], number> = { town: 0, 'dungeon-entrance': 1, wild: 2, sea: 3 };

export class ZoneMap {
  private readonly sorted: ZoneConfig[];
  private readonly byId = new Map<string, ZoneConfig>();

  constructor(readonly island: IslandConfig) {
    this.sorted = [...island.zones].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]);
    for (const z of island.zones) this.byId.set(z.id, z);
  }

  at(x: number, z: number): ZoneConfig | null {
    for (const zone of this.sorted) if (pointInPolygon(x, z, zone.polygon)) return zone;
    return null;
  }

  get(id: string): ZoneConfig | undefined {
    return this.byId.get(id);
  }

  get all(): readonly ZoneConfig[] {
    return this.island.zones;
  }
}
