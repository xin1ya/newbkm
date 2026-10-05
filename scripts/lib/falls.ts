/**
 * M3-19 · 地形生成：瀑布石台（各岛 gen 在「编码高度图」之前调用 applyWaterfalls）。
 *
 * - 石台：半径 radius 内抬到台面高度（±0.25 m 起伏），外侧 3 m 内陡降回原地形（> 60° 绝壁，步行上不去）；
 * - 泉池：台面上挖出碗状池床（中心深 2 m），并沿瀑口方向刻一道 1.2 m 深的缺口通到石台边缘；
 * - 瀑潭：崖脚挖出碗状深潭（中心深 2.2 m，只挖石台半径外侧，崖面保持陡立）。
 * 只改 H，不碰海陆标记；水面由岛屿配置的 waterBodies（makeWaterfall 生成）提供。
 */
import type { WaterfallConfig } from '../../src/config/islands/types';
import { clamp, lerp, smoothstep } from './noise';

type Noise = (x: number, z: number) => number;

function segDist(x: number, z: number, a: readonly [number, number], b: readonly [number, number]): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}

export function applyWaterfalls(H: Float32Array, N: number, CELL: number, HALF: number, falls: readonly WaterfallConfig[], noise: Noise): number {
  let cells = 0;
  for (const f of falls) {
    const { center, radius, height } = f.mesa;
    const reach = radius + f.plungeRadius * 2 + 6;
    const i0 = Math.max(0, Math.floor((center[0] - reach + HALF) / CELL));
    const i1 = Math.min(N - 1, Math.ceil((center[0] + reach + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((center[1] - reach + HALF) / CELL));
    const j1 = Math.min(N - 1, Math.ceil((center[1] + reach + HALF) / CELL));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const x = -HALF + i * CELL;
        const z = -HALF + j * CELL;
        const k = j * N + i;
        const h0 = H[k]!;
        let h = h0;
        // 石台：边缘带一点噪声，不是正圆
        const d = Math.hypot(x - center[0], z - center[1]) + 0.9 * noise(x / 7 + 3.1, z / 7 - 1.7);
        if (d < radius) h = height + 0.25 * noise(x / 5, z / 5);
        else if (d < radius + 3) h = Math.max(h0, height + (h0 - height) * smoothstep(radius, radius + 3, d));
        // 泉池 + 瀑口缺口
        const e = Math.hypot(x - f.pool.center[0], z - f.pool.center[1]) / f.pool.radius;
        if (e < 1) h = Math.min(h, f.topLevel - (0.7 + 1.3 * (1 - e * e)));
        else if (e < 1.25 && d < radius) h = Math.max(h, f.topLevel + 0.3); // 池岸略高于水面
        if (d < radius + 0.5 && segDist(x, z, f.pool.center, f.lip) < f.width / 2) h = Math.min(h, f.topLevel - 0.7);
        // 瀑潭（石台外侧）
        const dp = Math.hypot(x - f.base[0], z - f.base[1]) / f.plungeRadius;
        if (dp < 1 && d > radius + 0.4) h = Math.min(h, f.baseLevel - (0.6 + 1.6 * (1 - dp * dp)));
        else if (dp < 1.3 && d > radius + 0.4 && h > f.baseLevel + 0.6) h = lerp(f.baseLevel + 0.6, h, smoothstep(1, 1.3, dp)); // 潭岸
        if (h !== h0) {
          H[k] = h;
          cells++;
        }
      }
  }
  return cells;
}
