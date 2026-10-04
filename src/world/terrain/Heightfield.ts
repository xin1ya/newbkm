/**
 * WLD-001 · 高度场与地表材质数据（纯数据，不依赖 three，可在单测中使用）。
 * - 高度：16 位 PNG 解码后线性映射到 heightRange，双线性采样
 * - 法线 / 坡度：中心差分
 * - 材质权重：两张 RGBA splat（8 通道，顺序见 SURFACE_CHANNELS）
 * - 水体：海平面 + 湖泊（椭圆内且地形低于湖面）
 */
import { decode } from 'fast-png';
import { SURFACE_CHANNELS, type IslandConfig, type SurfaceChannel } from '@/config/islands/types';

export interface WaterInfo {
  /** 水面高度 */
  level: number;
  /** 水深（水面 - 地面），≤ 0 表示不在水中 */
  depth: number;
  body: 'sea' | string;
}

export class Heightfield {
  readonly size: number;
  readonly cell: number;
  readonly half: number;
  readonly splatSize: number;

  constructor(
    readonly config: IslandConfig,
    readonly heights: Float32Array,
    readonly splat: Uint8Array[],
    splatSize: number,
  ) {
    this.size = Math.round(Math.sqrt(heights.length));
    this.half = config.size[0] / 2;
    this.cell = config.size[0] / (this.size - 1);
    this.splatSize = splatSize;
  }

  /** 从 PNG 字节构建 */
  static fromPng(config: IslandConfig, heightPng: ArrayBuffer, splatPngs: ArrayBuffer[]): Heightfield {
    const img = decode(new Uint8Array(heightPng));
    if (img.width !== img.height) throw new Error('高度图必须为正方形');
    const [lo, hi] = config.heightRange;
    const n = img.width * img.height;
    const src = img.data;
    const ch = img.channels;
    const max = img.depth === 16 ? 65535 : 255;
    const heights = new Float32Array(n);
    for (let i = 0; i < n; i++) heights[i] = lo + ((src[i * ch] as number) / max) * (hi - lo);
    const splat: Uint8Array[] = [];
    let splatSize = 0;
    for (const buf of splatPngs) {
      const s = decode(new Uint8Array(buf));
      splatSize = s.width;
      if (s.channels === 4 && s.depth === 8) splat.push(s.data as Uint8Array);
      else {
        const out = new Uint8Array(s.width * s.height * 4);
        for (let i = 0; i < s.width * s.height; i++) for (let c = 0; c < 4; c++) out[i * 4 + c] = c < s.channels ? (s.data[i * s.channels + c] as number) : 0;
        splat.push(out);
      }
    }
    return new Heightfield(config, heights, splat, splatSize);
  }

  /** 平地测试用 */
  static flat(config: IslandConfig, h = 1, size = 65): Heightfield {
    return new Heightfield(config, new Float32Array(size * size).fill(h), [], 0);
  }

  private at(i: number, j: number): number {
    const n = this.size;
    i = i < 0 ? 0 : i >= n ? n - 1 : i;
    j = j < 0 ? 0 : j >= n ? n - 1 : j;
    return this.heights[j * n + i]!;
  }

  /** 网格顶点高度（地形网格构建用） */
  vertexHeight(i: number, j: number): number {
    return this.at(i, j);
  }

  heightAt(x: number, z: number): number {
    const fx = (x + this.half) / this.cell;
    const fz = (z + this.half) / this.cell;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    // 按网格三角剖分插值（与渲染网格一致，脚不会穿地/悬空）
    const h00 = this.at(i, j);
    const h11 = this.at(i + 1, j + 1);
    if (tx > tz) {
      const h10 = this.at(i + 1, j);
      return h00 + (h10 - h00) * tx + (h11 - h10) * tz;
    }
    const h01 = this.at(i, j + 1);
    return h00 + (h11 - h01) * tx + (h01 - h00) * tz;
  }

  normalAt(x: number, z: number, out: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 }) {
    const e = this.cell;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const l = Math.hypot(dx, 2 * e, dz);
    out.x = -dx / l;
    out.y = (2 * e) / l;
    out.z = -dz / l;
    return out;
  }

  /** 坡度（度） */
  slopeAt(x: number, z: number): number {
    const n = this.normalAt(x, z);
    return (Math.acos(Math.min(1, n.y)) * 180) / Math.PI;
  }

  inBounds(x: number, z: number): boolean {
    return Math.abs(x) <= this.half && Math.abs(z) <= this.half;
  }

  /** 8 通道权重（0–1），out 长度 8 */
  surfaceAt(x: number, z: number, out = new Float32Array(8)): Float32Array {
    out.fill(0);
    if (!this.splat.length) {
      out[0] = 1;
      return out;
    }
    const s = this.splatSize;
    const i = Math.min(s - 1, Math.max(0, Math.floor(((x + this.half) / this.config.size[0]) * s)));
    const j = Math.min(s - 1, Math.max(0, Math.floor(((z + this.half) / this.config.size[1]) * s)));
    const k = (j * s + i) * 4;
    for (let c = 0; c < 8; c++) out[c] = (this.splat[c >> 2]?.[k + (c & 3)] ?? 0) / 255;
    return out;
  }

  /** M2 扩展覆盖层权重（0–1）：[赭石, 火山灰, 熔岩, 苔藓]；没有第三张 splat 时全为 0 */
  extAt(x: number, z: number, out = new Float32Array(4)): Float32Array {
    out.fill(0);
    const ext = this.splat[2];
    if (!ext) return out;
    const s = this.splatSize;
    const i = Math.min(s - 1, Math.max(0, Math.floor(((x + this.half) / this.config.size[0]) * s)));
    const j = Math.min(s - 1, Math.max(0, Math.floor(((z + this.half) / this.config.size[1]) * s)));
    const k = (j * s + i) * 4;
    for (let c = 0; c < 4; c++) out[c] = ext[k + c]! / 255;
    return out;
  }

  /** 是否是熔岩（不可踏入） */
  isLava(x: number, z: number): boolean {
    const ext = this.splat[2];
    if (!ext) return false;
    const s = this.splatSize;
    const i = Math.min(s - 1, Math.max(0, Math.floor(((x + this.half) / this.config.size[0]) * s)));
    const j = Math.min(s - 1, Math.max(0, Math.floor(((z + this.half) / this.config.size[1]) * s)));
    return ext[(j * s + i) * 4 + 2]! > 140;
  }

  surfaceWeight(x: number, z: number, channel: SurfaceChannel): number {
    const c = SURFACE_CHANNELS.indexOf(channel);
    return this.surfaceAt(x, z)[c]!;
  }

  /** 权重最大的地表 */
  dominantSurface(x: number, z: number): SurfaceChannel {
    const w = this.surfaceAt(x, z);
    let m = 0;
    for (let c = 1; c < 8; c++) if (w[c]! > w[m]!) m = c;
    return SURFACE_CHANNELS[m]!;
  }

  /**
   * M1-01 河流水面：返回离 (x, z) 最近的河段在该处的水面高度（在河道范围内时），否则 null。
   * 用各河段的包围盒先行排除，waterAt 高频调用时开销很小。
   */
  riverAt(x: number, z: number): { level: number; id: string; dist: number } | null {
    const rivers = this.config.rivers;
    if (!rivers?.length) return null;
    let best: { level: number; id: string; dist: number } | null = null;
    for (const r of rivers) {
      const reach = r.width / 2 + 3;
      for (let s = 0; s + 1 < r.points.length; s++) {
        const [ax, az] = r.points[s]!;
        const [bx, bz] = r.points[s + 1]!;
        if (x < Math.min(ax, bx) - reach || x > Math.max(ax, bx) + reach || z < Math.min(az, bz) - reach || z > Math.max(az, bz) + reach) continue;
        const dx = bx - ax;
        const dz = bz - az;
        const l2 = dx * dx + dz * dz;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
        const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
        if (d > reach || (best && d >= best.dist)) continue;
        const la = r.levels[s]!;
        const lb = r.levels[s + 1]!;
        best = { level: la + (lb - la) * t, id: r.id, dist: d };
      }
    }
    return best;
  }

  waterAt(x: number, z: number): WaterInfo | null {
    const g = this.heightAt(x, z);
    for (const b of this.config.waterBodies) {
      const e = ((x - b.center[0]) / b.radius[0]) ** 2 + ((z - b.center[1]) / b.radius[1]) ** 2;
      if (e < 1.3 && g < b.level) return { level: b.level, depth: b.level - g, body: b.id };
    }
    const r = this.riverAt(x, z);
    if (r && g < r.level && r.level > this.config.seaLevel + 0.05) return { level: r.level, depth: r.level - g, body: r.id };
    const sea = this.config.seaLevel;
    if (g < sea) return { level: sea, depth: sea - g, body: 'sea' };
    return null;
  }
}
