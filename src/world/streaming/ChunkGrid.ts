/**
 * WLD-004 · 分块调度（纯逻辑，可单测）。
 * - 玩家所在块为中心：切比雪夫距离 ≤ r0 → LOD0（默认 3×3）；≤ r1 → LOD1（默认 5×5 外圈）；其余卸载（远景整岛网格兜底）
 * - 滞回：已加载的块在距离超过阈值 +1 之后才降级/卸载，避免在块边界来回走动时反复重建
 * - 输出按距离排序的待办列表，由 ChunkManager 按每帧预算执行
 */
export type Lod = 0 | 1;

export interface ChunkKey {
  cx: number;
  cz: number;
}

export const chunkId = (cx: number, cz: number) => `${cx},${cz}`;

export interface ChunkTask {
  cx: number;
  cz: number;
  /** null = 卸载 */
  lod: Lod | null;
  dist: number;
}

export class ChunkGrid {
  constructor(
    readonly count: number,
    readonly chunkSize: number,
    readonly half: number,
  ) {}

  chunkOf(x: number, z: number): ChunkKey {
    return {
      cx: Math.min(this.count - 1, Math.max(0, Math.floor((x + this.half) / this.chunkSize))),
      cz: Math.min(this.count - 1, Math.max(0, Math.floor((z + this.half) / this.chunkSize))),
    };
  }

  /** 块中心的世界坐标 */
  center(cx: number, cz: number): { x: number; z: number } {
    return { x: -this.half + (cx + 0.5) * this.chunkSize, z: -this.half + (cz + 0.5) * this.chunkSize };
  }

  /**
   * 根据当前加载状态计算需要执行的任务。
   * @param loaded 当前每块的 LOD
   */
  plan(x: number, z: number, loaded: ReadonlyMap<string, Lod>, r0: number, r1: number, hysteresis = true): ChunkTask[] {
    const { cx, cz } = this.chunkOf(x, z);
    const tasks: ChunkTask[] = [];
    const want = new Map<string, Lod>();
    for (let dz = -r1; dz <= r1; dz++)
      for (let dx = -r1; dx <= r1; dx++) {
        const X = cx + dx;
        const Z = cz + dz;
        if (X < 0 || Z < 0 || X >= this.count || Z >= this.count) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dz));
        want.set(chunkId(X, Z), d <= r0 ? 0 : 1);
      }
    // 精确距离（块中心到玩家）用于排序：近处先建
    const distTo = (X: number, Z: number) => {
      const c = this.center(X, Z);
      return Math.hypot(c.x - x, c.z - z);
    };
    for (const [id, lod] of want) {
      const cur = loaded.get(id);
      if (cur === lod) continue;
      const [X, Z] = id.split(',').map(Number) as [number, number];
      // 滞回：LOD0 → LOD1 的降级要等到距离 > r0 + 1
      if (hysteresis && cur === 0 && lod === 1 && Math.max(Math.abs(X - cx), Math.abs(Z - cz)) <= r0 + 1) continue;
      tasks.push({ cx: X, cz: Z, lod, dist: distTo(X, Z) });
    }
    for (const [id] of loaded) {
      if (want.has(id)) continue;
      const [X, Z] = id.split(',').map(Number) as [number, number];
      const d = Math.max(Math.abs(X - cx), Math.abs(Z - cz));
      if (hysteresis && d <= r1 + 1) continue;
      tasks.push({ cx: X, cz: Z, lod: null, dist: distTo(X, Z) });
    }
    // 升级（null→0 / 1→0）优先，其次按距离；卸载最后
    const rank = (t: ChunkTask) => (t.lod === 0 ? 0 : t.lod === 1 ? 1 : 2);
    tasks.sort((a, b) => rank(a) - rank(b) || a.dist - b.dist);
    return tasks;
  }
}
