/**
 * 生态分区（纯逻辑）：区域 + 地表 + 海拔 + 离水距离 → 生态类型，决定植被物种、林下植物与环境生物。
 *
 * 萌芽群岛的生态特色：
 * - village   萌芽镇 / 翠澜镇：樱花树、果树、花坛边的野花，鸟和蝴蝶多
 * - meadow    萌芽草原：成片的阔叶树林（按噪声成簇，不是均匀撒点）、野花带、白桦点缀、蝴蝶 / 鸟群
 * - mistwood  幻影之森：密针叶 + 暗色阔叶、蕨类、蘑菇、倒木、落叶，夜晚萤火虫
 * - wetland   翠澜湖畔：垂柳、岸边芦苇 / 香蒲、湖面睡莲、蜻蜓，傍晚蛙鸣与萤火虫
 * - riverine  翠澜河谷：河岸桤木 / 垂柳、芦苇、卵石滩、溪流声
 * - cliff     港湾海崖：被海风压弯的松树、低矮灌丛、黄色野花、海鸥
 * - beach     海滩（任何区域的近海沙地）：椰子树、浮木、贝壳、沙滩草、海鸥
 * - harbor    港湾市：椰子树与少量行道树
 */
import type { IslandConfig } from '@/config/islands/types';
import { ZoneMap } from '../island/ZoneMap';
import type { Heightfield } from '../terrain/Heightfield';
import { hash2 } from '../util/hash';

export type Biome = 'village' | 'meadow' | 'mistwood' | 'wetland' | 'riverine' | 'cliff' | 'beach' | 'harbor';

export type TreeSpecies = 'broadleaf' | 'pine' | 'birch' | 'blossom' | 'willow' | 'palm' | 'windpine';

export interface BiomeProfile {
  /** 树种权重（总和不必为 1） */
  trees: Partial<Record<TreeSpecies, number>>;
  /** 树密度倍率（相对 splat 森林权重） */
  treeDensity: number;
  /** 草地上零散成簇树林的概率（0 = 只在森林地表长树） */
  groves: number;
  /** 树冠色调（HSL 色相偏移 / 饱和度 / 亮度倍率） */
  tint: { h: number; s: number; l: number };
  /** 林下植物密度（每 3 m 格子的概率） */
  undergrowth: { fern: number; mushroom: number; litter: number; log: number; stump: number; pebbles: number; reeds: number; lily: number; driftwood: number; shells: number };
  /** 野花配色 */
  flowers: readonly string[];
  /** 草色（HSL 色相 / 亮度偏移） */
  grass: { h: number; l: number };
}

const UG0 = { fern: 0, mushroom: 0, litter: 0, log: 0, stump: 0, pebbles: 0, reeds: 0, lily: 0, driftwood: 0, shells: 0 };

export const BIOMES: Record<Biome, BiomeProfile> = {
  village: {
    trees: { blossom: 0.45, broadleaf: 0.45, birch: 0.1 },
    treeDensity: 0.9,
    groves: 0.02,
    tint: { h: 0.01, s: 1.05, l: 1.05 },
    undergrowth: { ...UG0, pebbles: 0.01, stump: 0.004 },
    flowers: ['#ff8fb1', '#fff27a', '#ffffff', '#ff9d5c', '#ffb3d9'],
    grass: { h: 0.01, l: 0.03 },
  },
  meadow: {
    trees: { broadleaf: 0.7, birch: 0.2, blossom: 0.05, pine: 0.05 },
    treeDensity: 1,
    groves: 0.07,
    tint: { h: 0, s: 1, l: 1 },
    undergrowth: { ...UG0, litter: 0.02, stump: 0.006, log: 0.003, pebbles: 0.01, mushroom: 0.004 },
    flowers: ['#ff8fb1', '#fff27a', '#ffffff', '#b99cff', '#ff9d5c', '#8fd3ff'],
    grass: { h: 0, l: 0 },
  },
  mistwood: {
    trees: { pine: 0.55, broadleaf: 0.4, birch: 0.05 },
    treeDensity: 1.25,
    groves: 0.03,
    tint: { h: 0.03, s: 0.82, l: 0.8 },
    undergrowth: { ...UG0, fern: 0.22, mushroom: 0.05, litter: 0.16, log: 0.012, stump: 0.012, pebbles: 0.01 },
    flowers: ['#b99cff', '#8fd3ff', '#ffffff'],
    grass: { h: 0.03, l: -0.08 },
  },
  wetland: {
    trees: { willow: 0.6, broadleaf: 0.3, birch: 0.1 },
    treeDensity: 0.85,
    groves: 0.04,
    tint: { h: 0.02, s: 1, l: 1.02 },
    undergrowth: { ...UG0, reeds: 0.5, lily: 0.22, pebbles: 0.01, fern: 0.02, litter: 0.01 },
    flowers: ['#ffffff', '#b99cff', '#8fd3ff', '#fff27a'],
    grass: { h: 0.02, l: 0.01 },
  },
  riverine: {
    trees: { willow: 0.35, broadleaf: 0.4, birch: 0.25 },
    treeDensity: 0.95,
    groves: 0.05,
    tint: { h: 0.015, s: 1, l: 1 },
    undergrowth: { ...UG0, reeds: 0.35, pebbles: 0.08, fern: 0.03, log: 0.004, lily: 0.05 },
    flowers: ['#ffffff', '#fff27a', '#8fd3ff'],
    grass: { h: 0.015, l: 0 },
  },
  cliff: {
    trees: { windpine: 0.85, pine: 0.15 },
    treeDensity: 0.7,
    groves: 0.02,
    tint: { h: 0.02, s: 0.85, l: 0.92 },
    undergrowth: { ...UG0, pebbles: 0.05, stump: 0.004, shells: 0.002 },
    flowers: ['#fff27a', '#ffd34d', '#ffffff'],
    grass: { h: -0.02, l: 0.02 },
  },
  beach: {
    trees: { palm: 1 },
    treeDensity: 0.6,
    groves: 0.05,
    tint: { h: -0.01, s: 1.05, l: 1.05 },
    undergrowth: { ...UG0, driftwood: 0.012, shells: 0.05, pebbles: 0.01 },
    flowers: ['#fff27a', '#ffffff'],
    grass: { h: -0.03, l: 0.06 },
  },
  harbor: {
    trees: { palm: 0.6, broadleaf: 0.4 },
    treeDensity: 0.8,
    groves: 0.01,
    tint: { h: 0, s: 1, l: 1.02 },
    undergrowth: { ...UG0, pebbles: 0.01 },
    flowers: ['#ff9d5c', '#fff27a', '#ffffff'],
    grass: { h: -0.01, l: 0.02 },
  },
};

const ZONE_BIOME: Record<string, Biome> = {
  'sprout-town': 'village',
  'cuilan-town': 'village',
  'sprout-meadow': 'meadow',
  'phantom-forest': 'mistwood',
  'cuilan-lakeside': 'wetland',
  'cuilan-river': 'riverine',
  'harbor-cliffs': 'cliff',
  'harbor-city': 'harbor',
  'river-delta': 'wetland',
  'west-beach': 'beach',
  'sprout-woodland': 'meadow',
};

/** 平滑值噪声（双线性插值 + smoothstep），0–1；scale 为特征尺寸（米） */
export function valueNoise(x: number, z: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fz = z / scale;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

/** 两个八度的噪声：树林成簇、花带、林下密度 */
export function fbm(x: number, z: number, scale: number, seed: number): number {
  return valueNoise(x, z, scale, seed) * 0.65 + valueNoise(x, z, scale * 0.37, seed + 17) * 0.35;
}

export class EcologyMap {
  readonly zones: ZoneMap;
  constructor(
    readonly island: IslandConfig,
    private readonly hf: Heightfield,
  ) {
    this.zones = new ZoneMap(island);
  }

  /** 离最近水面（湖 / 河 / 海）的大致距离（米）：8 方向 × 4 档采样，超过 12 m 返回 99 */
  waterDistance(x: number, z: number): number {
    if (this.hf.waterAt(x, z)) return 0;
    for (const r of [1.5, 3.5, 7, 12]) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        if (this.hf.waterAt(x + Math.cos(a) * r, z + Math.sin(a) * r)) return r;
      }
    }
    return 99;
  }

  /** 该点是否在海水旁（海滩判定） */
  nearSea(x: number, z: number): boolean {
    const sea = this.hf.config.seaLevel;
    if (this.hf.heightAt(x, z) > sea + 4.5) return false;
    for (const r of [6, 14, 24]) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const w = this.hf.waterAt(x + Math.cos(a) * r, z + Math.sin(a) * r);
        if (w?.body === 'sea') return true;
      }
    }
    return false;
  }

  /** 生态类型：近海沙地一律是海滩；其余按区域，区域外按地表推断 */
  biomeAt(x: number, z: number, sandWeight: number): Biome {
    if (sandWeight > 0.35 && this.nearSea(x, z)) return 'beach';
    const zone = this.zones.at(x, z);
    const b = zone ? ZONE_BIOME[zone.id] : undefined;
    if (b) return b;
    if (this.hf.heightAt(x, z) > 24) return 'cliff';
    return 'meadow';
  }

  profile(b: Biome): BiomeProfile {
    return BIOMES[b];
  }
}
