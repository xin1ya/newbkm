/**
 * WLD-003 · 单个地形块的植被：按 splat 权重确定性散布（同一块每次加载结果相同）。
 *  - LOD0：草簇、高草（遇敌草丛）、花、灌木、树、岩石（全细节），树/岩石注册碰撞体
 *  - LOD1：只有树（低模）和大岩石
 * 实例化网格：每种植被每块 1 个 draw call（外加描边外壳）。
 */
import * as THREE from 'three';
import { SURFACE_CHANNELS } from '@/config/islands/types';
import type { QualitySettings } from '@/render';
import { addHullOutlines } from '@/render';
import type { Heightfield } from '../terrain/Heightfield';
import type { CollisionWorld } from '../collision/CollisionWorld';
import { hash2 } from '../util/hash';
import { BIOMES, fbm } from '../ecology/biome';
import type { Biome, TreeSpecies } from '../ecology/biome';
import { mergeTransformed } from './species';
import type { FoliageLibrary } from './FoliageLibrary';

const C = Object.fromEntries(SURFACE_CHANNELS.map((c, i) => [c, i])) as Record<(typeof SURFACE_CHANNELS)[number], number>;
const PALETTES = new Map<Biome, THREE.Color[]>();
const paletteOf = (b: Biome): THREE.Color[] => {
  let p = PALETTES.get(b);
  if (!p) PALETTES.set(b, (p = BIOMES[b].flowers.map((c) => new THREE.Color(c))));
  return p;
};

export interface ChunkFoliageStats {
  grass: number;
  flowers: number;
  trees: number;
  rocks: number;
  bushes: number;
  undergrowth: number;
}

/** 每块林下合并网格的顶点上限（超出后丢弃剩余小物件，保证三角面预算） */
const UNDERGROWTH_VERT_BUDGET = 120_000;

const TREE_COLLIDER: Record<TreeSpecies, number> = { broadleaf: 0.45, pine: 0.45, birch: 0.3, blossom: 0.45, willow: 0.55, palm: 0.32, windpine: 0.4 };

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function pickSpecies(weights: Partial<Record<TreeSpecies, number>>, r: number): TreeSpecies {
  let total = 0;
  for (const v of Object.values(weights)) total += v ?? 0;
  let acc = 0;
  for (const [k, v] of Object.entries(weights) as Array<[TreeSpecies, number]>) {
    acc += v / total;
    if (r <= acc) return k;
  }
  return 'broadleaf';
}

/** 草 / 花细节格边长（米）：块长 128 m → 4×4 格 */
export const DETAIL_TILE = 32;

/**
 * 性能 P1 · 草 / 花远景带：离观察点超过 grassDistance × LOD_FAR（high 档 = 40 m）的细节格
 * 只提交 1/3 实例，草簇换成 3 片单段草叶的远景几何（三角面约为近处的 1/15）。
 * 着色器的距离缩放淡出负责过渡（不用 alphaToCoverage：画质档已关闭 MSAA，A2C 无效）。
 */
const LOD_FAR = 0.5;
const FAR_FRACTION = 1 / 3;

export class ChunkFoliage {
  readonly group = new THREE.Group();
  readonly stats: ChunkFoliageStats = { grass: 0, flowers: 0, trees: 0, rocks: 0, bushes: 0, undergrowth: 0 };
  private readonly colliderGroup: string;

  /** 草 / 花细节格（仅 LOD0） */
  readonly detailTiles: Array<{ meshes: THREE.InstancedMesh[]; grass: THREE.InstancedMesh | null; x: number; z: number; half: number; far: boolean }> = [];
  /** 性能 P1 · LOD1 分块：树木低模与远景替身两套实例，按距离二选一 */
  private readonly treeLow: THREE.InstancedMesh[] = [];
  private readonly treeImpostor: THREE.InstancedMesh[] = [];
  private impostorOn = false;
  constructor(
    private readonly hf: Heightfield,
    private readonly lib: FoliageLibrary,
    private readonly collision: CollisionWorld,
    readonly cx: number,
    readonly cz: number,
    readonly lod: 0 | 1,
    q: QualitySettings,
  ) {
    this.group.name = `foliage-${cx}-${cz}-L${lod}`;
    this.colliderGroup = `foliage:${cx}:${cz}`;
    this.build(q);
  }

  private blocked(x: number, z: number, r: number): boolean {
    for (const c of this.collision.query(x, z, r)) {
      if (c.tag?.startsWith('foliage')) continue;
      if (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + r : Math.hypot(x - c.x, z - c.z) < Math.hypot(c.hx, c.hz) + r) return true;
    }
    return false;
  }

  private build(q: QualitySettings): void {
    const hf = this.hf;
    const cs = hf.config.chunkSize;
    const x0 = -hf.half + this.cx * cs;
    const z0 = -hf.half + this.cz * cs;
    const w = new Float32Array(8);
    const quat = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const nrm = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    const addColliders = !this.collision.hasGroup(this.colliderGroup);

    const tiltTo = (x: number, z: number, amount: number) => {
      const n = hf.normalAt(x, z);
      nrm.set(n.x, n.y, n.z);
      return new THREE.Quaternion().setFromUnitVectors(up, up.clone().lerp(nrm, amount).normalize());
    };

    // ——— 生态分区：16 m 粗格缓存（区域多边形 + 近海判定较贵，不逐点算） ———
    const eco = this.lib.ecology;
    const BG = 16;
    const bn = cs / BG + 1;
    const wb = new Float32Array(8);
    const biomes: Biome[] = [];
    for (let bz = 0; bz < bn; bz++)
      for (let bx = 0; bx < bn; bx++) {
        const sx = x0 + bx * BG;
        const sz = z0 + bz * BG;
        if (!eco || !hf.inBounds(sx, sz)) {
          biomes.push('meadow');
          continue;
        }
        hf.surfaceAt(sx, sz, wb);
        biomes.push(eco.biomeAt(sx, sz, wb[C.sand]!));
      }
    const biomeOf = (x: number, z: number): Biome => {
      const bx = Math.min(bn - 1, Math.max(0, Math.round((x - x0) / BG)));
      const bz = Math.min(bn - 1, Math.max(0, Math.round((z - z0) / BG)));
      return biomes[bz * bn + bx]!;
    };

    // ——— 树 / 岩石 / 灌木：抖动网格 ———
    type Item = { m: THREE.Matrix4; c: THREE.Color };
    const trees = new Map<TreeSpecies, Item[]>();
    const rocks: Item[] = [];
    const bushes: Item[] = [];
    let nTrees = 0;
    const treeSpots: Array<{ x: number; y: number; z: number; s: number; sp: TreeSpecies }> = [];
    const TS = 6;
    for (let gz = 0; gz < cs / TS; gz++)
      for (let gx = 0; gx < cs / TS; gx++) {
        const ix = Math.floor(x0 / TS) + gx;
        const iz = Math.floor(z0 / TS) + gz;
        const x = (ix + 0.15 + hash2(ix, iz, 1) * 0.7) * TS;
        const z = (iz + 0.15 + hash2(ix, iz, 2) * 0.7) * TS;
        if (!hf.inBounds(x, z)) continue;
        const y = hf.heightAt(x, z);
        if (y < hf.config.seaLevel + 0.8 || hf.waterAt(x, z)) continue;
        hf.surfaceAt(x, z, w);
        const slope = hf.slopeAt(x, z);
        const r = hash2(ix, iz, 3);
        const forest = w[C.forest]!;
        const biome = biomeOf(x, z);
        const prof = BIOMES[biome];
        const beach = biome === 'beach';
        const paved = w[C.dirt]! + w[C.stone]! + (beach ? 0 : w[C.sand]!);
        if (paved > 0.3) continue;
        // 树林成簇：低频噪声决定“林子”在哪，林心密、林缘稀，草地上偶有小树丛
        const grove = fbm(x, z, 42, 7);
        let treeP = forest * 0.85 * prof.treeDensity * (0.7 + grove * 0.6);
        if (w[C.grass]! > 0.45) treeP += prof.groves * smooth(0.58, 0.82, grove) * 6 + (w[C.grass]! > 0.6 ? 0.004 : 0);
        if (beach) treeP = w[C.sand]! * 0.07 * prof.treeDensity * (grove > 0.5 ? 1.8 : 0.35);
        if (slope < 32 && r < treeP) {
          if (this.blocked(x, z, 2.2)) continue;
          let sp: TreeSpecies = y > 22 && biome !== 'cliff' && !beach ? 'pine' : pickSpecies(prof.trees, hash2(ix, iz, 5));
          // 垂柳只长在水边，离水远的换成阔叶树
          if (sp === 'willow' && eco && eco.waterDistance(x, z) > 12) sp = 'broadleaf';
          // 林缘的树更小（林心 forest≈1，草地树丛 forest≈0）
          const edge = beach ? 1 : 0.72 + 0.28 * Math.min(1, forest / 0.6 + smooth(0.6, 0.9, grove) * 0.5);
          const s = (0.8 + hash2(ix, iz, 4) * 0.6) * edge;
          quat.setFromAxisAngle(up, sp === 'windpine' ? Math.atan2(-this.windZ(), this.windX()) + (hash2(ix, iz, 6) - 0.5) * 0.6 : hash2(ix, iz, 6) * Math.PI * 2);
          const t = prof.tint;
          if (sp === 'broadleaf' || sp === 'pine') {
            const pine = sp === 'pine';
            const dark = forest > 0.6 ? 0.82 : 1;
            col.setHSL((pine ? 0.36 : 0.27 + hash2(ix, iz, 7) * 0.05) + t.h, (pine ? 0.42 : 0.5) * t.s, ((pine ? 0.36 : 0.47) * dark + hash2(ix, iz, 8) * 0.05) * t.l);
          } else {
            // 真实颜色在顶点色里，实例色只做轻微明暗与冷暖
            const v = (0.9 + hash2(ix, iz, 8) * 0.16) * t.l;
            col.setRGB(v * (1 + (hash2(ix, iz, 7) - 0.5) * 0.06), v, v * (1 - (hash2(ix, iz, 7) - 0.5) * 0.06));
          }
          const list = trees.get(sp) ?? [];
          trees.set(sp, list);
          list.push({ m: new THREE.Matrix4().compose(pos.set(x, y - 0.15, z), quat, scl.set(s, s * (0.9 + hash2(ix, iz, 9) * 0.25), s)), c: col.clone() });
          nTrees++;
          treeSpots.push({ x, y, z, s, sp });
          if (addColliders) this.collision.add(this.colliderGroup, { kind: 'circle', x, z, r: TREE_COLLIDER[sp] * s, y0: y - 1, y1: y + 8 * s, tag: 'foliage-tree' });
        } else if (r > 0.985 - w[C.rock]! * 0.08 && slope < 45) {
          const s = 0.6 + hash2(ix, iz, 10) * (w[C.rock]! > 0.4 ? 1.8 : 0.8);
          if (this.lod === 1 && s <= 0.9) continue; // 与碰撞体阈值一致：LOD 切换不丢碰撞
          if (this.blocked(x, z, s)) continue;
          quat.copy(tiltTo(x, z, 0.6)).multiply(new THREE.Quaternion().setFromAxisAngle(up, hash2(ix, iz, 11) * 6.28));
          col.setHSL(0.08, 0.06, 0.55 + hash2(ix, iz, 12) * 0.12);
          rocks.push({ m: new THREE.Matrix4().compose(pos.set(x, y - 0.25 * s, z), quat, scl.set(s, s, s)), c: col.clone() });
          if (addColliders && s > 0.9) this.collision.add(this.colliderGroup, { kind: 'circle', x, z, r: 0.8 * s, y0: y - 1, y1: y + 0.9 * s, tag: 'foliage-rock' });
        } else if (this.lod === 0 && !beach && r > 0.93 - (forest > 0.12 && forest < 0.55 ? 0.07 : 0) - smooth(0.5, 0.62, grove) * 0.04 && (w[C.grass]! > 0.4 || forest > 0.2)) {
          // 灌木：林缘（forest 0.12–0.55）与树丛外圈更密，形成自然过渡
          if (this.blocked(x, z, 1)) continue;
          const s = 0.7 + hash2(ix, iz, 13) * 0.6;
          quat.setFromAxisAngle(up, hash2(ix, iz, 14) * 6.28);
          const t = prof.tint;
          col.setHSL(0.28 + t.h, 0.45 * t.s, (0.4 + hash2(ix, iz, 15) * 0.06) * t.l);
          bushes.push({ m: new THREE.Matrix4().compose(pos.set(x, y - 0.1, z), quat, scl.set(s, s, s)), c: col.clone() });
        }
      }

    const L = this.lod === 0 ? 0 : 1;
    for (const [sp, list] of trees) {
      const geo =
        sp === 'broadleaf' ? (L ? this.lib.broadleafLow : this.lib.broadleaf) : sp === 'pine' ? (L ? this.lib.pineLow : this.lib.pine) : this.lib.species[sp][L];
      const im = this.addInstanced(geo, this.lib.treeMaterial, list, true, true);
      const imp = this.lib.impostors;
      if (L && im && imp) {
        this.treeLow.push(im);
        const bb = this.addInstanced(imp.geometry[sp], imp.material, list, false, false);
        if (bb) {
          bb.visible = false;
          bb.name = `impostor-${sp}`;
          this.treeImpostor.push(bb);
        }
      }
    }
    this.addInstanced(this.lib.rock, this.lib.rockMaterial, rocks, true, this.lod === 0);
    this.addInstanced(this.lib.bush, this.lib.bushMaterial, bushes, false, true);
    this.stats.trees = nTrees;
    this.stats.rocks = rocks.length;
    this.stats.bushes = bushes.length;
    if (this.lod !== 0) return;
    this.buildUndergrowth(x0, z0, biomeOf, treeSpots);


    // ——— 草与花：密度按画质 ———
    // 按 DETAIL_TILE 米分格：每格独立 InstancedMesh，可视锥剔除 + 距离整格隐藏（REN-006 优化）
    const TPC = Math.max(1, Math.round(cs / DETAIL_TILE));
    const tileSize = cs / TPC;
    type Items = Array<{ m: THREE.Matrix4; c: THREE.Color }>;
    const tiles: Array<{ grass: Items; heads: Items; stems: Items }> = Array.from({ length: TPC * TPC }, () => ({ grass: [], heads: [], stems: [] }));
    const tileOf = (x: number, z: number) => {
      const tx = Math.min(TPC - 1, Math.max(0, Math.floor((x - x0) / tileSize)));
      const tz = Math.min(TPC - 1, Math.max(0, Math.floor((z - z0) / tileSize)));
      return tiles[tz * TPC + tx]!;
    };
    const spacing = 1 / Math.sqrt(Math.max(0.05, q.grassDensity));
    const n = Math.floor(cs / spacing);
    for (let gz = 0; gz < n; gz++)
      for (let gx = 0; gx < n; gx++) {
        const ix = gx + this.cx * 4096;
        const iz = gz + this.cz * 4096;
        const x = x0 + (gx + hash2(ix, iz, 21)) * spacing;
        const z = z0 + (gz + hash2(ix, iz, 22)) * spacing;
        if (!hf.inBounds(x, z)) continue;
        const y = hf.heightAt(x, z);
        if (y < hf.config.seaLevel + 0.6) continue;
        hf.surfaceAt(x, z, w);
        const tall = w[C.tallgrass]!;
        const g = w[C.grass]! * 0.75 + tall * 1.3 + w[C.flowers]! * 0.8 + w[C.forest]! * 0.35;
        const r = hash2(ix, iz, 23);
        if (r > g) continue;
        if (hf.waterAt(x, z) || hf.slopeAt(x, z) > 38) continue;
        const isTall = tall > 0.35 && hash2(ix, iz, 24) < tall + 0.2;
        const s = isTall ? 0.75 + hash2(ix, iz, 25) * 0.35 : 0.32 + hash2(ix, iz, 25) * 0.22;
        quat.copy(tiltTo(x, z, 0.5)).multiply(new THREE.Quaternion().setFromAxisAngle(up, hash2(ix, iz, 26) * 6.28));
        const wide = isTall ? 1.25 : 1;
        const gt = BIOMES[biomeOf(x, z)].grass;
        if (isTall) col.setHSL(0.26 + gt.h + hash2(ix, iz, 27) * 0.03, 0.52, 0.36 + gt.l * 0.7 + hash2(ix, iz, 28) * 0.05);
        else col.setHSL(0.24 + gt.h + hash2(ix, iz, 27) * 0.05, 0.5, 0.5 + gt.l + hash2(ix, iz, 28) * 0.07);
        tileOf(x, z).grass.push({ m: new THREE.Matrix4().compose(pos.set(x, y - 0.03, z), quat, scl.set(s * wide * 1.3, s, s * wide * 1.3)), c: col.clone() });
        // 花
        if (w[C.flowers]! > 0.25 && hash2(ix, iz, 29) < w[C.flowers]! * 0.55 * q.detailDensity) {
          const fx = x + (hash2(ix, iz, 30) - 0.5) * spacing * 0.8;
          const fz = z + (hash2(ix, iz, 31) - 0.5) * spacing * 0.8;
          const fy = hf.heightAt(fx, fz);
          const fs = 0.85 + hash2(ix, iz, 32) * 0.5;
          quat.setFromAxisAngle(up, hash2(ix, iz, 33) * 6.28);
          const fm = new THREE.Matrix4().compose(pos.set(fx, fy - 0.02, fz), quat, scl.set(fs, fs, fs));
          // 同一片花丛颜色一致（按 6 m 格子取色）
          const palette = paletteOf(biomeOf(fx, fz));
          const patch = Math.floor(hash2(Math.floor(fx / 6), Math.floor(fz / 6), 34) * palette.length);
          const tl = tileOf(x, z);
          tl.heads.push({ m: fm, c: palette[patch]! });
          tl.stems.push({ m: fm, c: new THREE.Color(1, 1, 1) });
        }
      }
    let nGrass = 0;
    let nFlowers = 0;
    tiles.forEach((t, i) => {
      // M1-22 密度 LOD：实例顺序按确定性哈希打乱，任取前 N 个都是均匀的随机子集，远处格子只画前一半
      const shuffle = <T,>(arrs: T[][], salt: number): void => {
        const len = arrs[0]!.length;
        for (let k = len - 1; k > 0; k--) {
          const j = Math.floor(hash2(this.cx * 131 + i, this.cz * 131 + k, salt) * (k + 1));
          for (const a of arrs) [a[k], a[j]] = [a[j]!, a[k]!];
        }
      };
      shuffle([t.grass], 41);
      shuffle([t.stems, t.heads], 42); // 花茎与花头一一对应，用同一个排列
      const grass = this.addInstanced(this.lib.grass, this.lib.grassMaterial, t.grass, false, false);
      const meshes = [
        grass,
        this.addInstanced(this.lib.flowerStem, this.lib.flowerMaterial, t.stems, false, false),
        this.addInstanced(this.lib.flowerHead, this.lib.flowerMaterial, t.heads, false, false),
      ].filter((m): m is THREE.InstancedMesh => !!m);
      nGrass += t.grass.length;
      nFlowers += t.heads.length;
      if (meshes.length)
        this.detailTiles.push({ meshes, grass, far: false, x: x0 + ((i % TPC) + 0.5) * tileSize, z: z0 + (Math.floor(i / TPC) + 0.5) * tileSize, half: tileSize / 2 });
    });
    this.stats.grass = nGrass;
    this.stats.flowers = nFlowers;
  }

  /** 风向（世界 XZ），风压松朝背风方向倾斜用：与场景默认风向 windDir(0.8, 0.6) 一致 */
  private windX(): number {
    return 0.8;
  }
  private windZ(): number {
    return 0.6;
  }

  /**
   * 林下层（仅 LOD0）：蕨类、蘑菇、落叶、倒木、树桩、卵石、岸边芦苇、湖面睡莲、海滩浮木与贝壳。
   * 3 m 抖动格散布，全部合并为每块 1 个静态网格（1 个 draw call），顶点数有上限。
   */
  private buildUndergrowth(x0: number, z0: number, biomeOf: (x: number, z: number) => Biome, treeSpots: ReadonlyArray<{ x: number; y: number; z: number; s: number; sp: TreeSpecies }>): void {
    const hf = this.hf;
    const cs = hf.config.chunkSize;
    const U = this.lib.undergrowth;
    const w = new Float32Array(8);
    const ox = x0 + cs / 2;
    const oz = z0 + cs / 2;
    const oy = hf.inBounds(ox, oz) ? hf.heightAt(ox, oz) : 0;
    const up = new THREE.Vector3(0, 1, 0);
    const items: Array<{ geo: THREE.BufferGeometry; matrix: THREE.Matrix4; tint: THREE.Color }> = [];
    let verts = 0;
    const night = (b: Biome) => b === 'mistwood';
    const fresh = (x: number, z: number): boolean => {
      const wt = hf.waterAt(x, z);
      return !!wt && wt.body !== 'sea';
    };
    const nearFresh = (x: number, z: number): boolean => fresh(x + 2.2, z) || fresh(x - 2.2, z) || fresh(x, z + 2.2) || fresh(x, z - 2.2);
    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw: number, s: number, tilt: number, light: number): void => {
      const n = geo.getAttribute('position').count;
      if (verts + n > UNDERGROWTH_VERT_BUDGET) return;
      verts += n;
      const q = new THREE.Quaternion();
      if (tilt > 0) {
        const nn = hf.normalAt(x, z);
        q.setFromUnitVectors(up, up.clone().lerp(new THREE.Vector3(nn.x, nn.y, nn.z), tilt).normalize());
      }
      q.multiply(new THREE.Quaternion().setFromAxisAngle(up, yaw));
      items.push({ geo, matrix: new THREE.Matrix4().compose(new THREE.Vector3(x - ox, y - oy, z - oz), q, new THREE.Vector3(s, s, s)), tint: new THREE.Color(light, light, light) });
    };
    // 树根部：根爪 + 树下的落叶 / 落瓣 / 松针 / 椰子（先放，保证顶点预算优先给“落地感”）
    for (const t of treeSpots) {
      const h = hash2(Math.round(t.x * 10), Math.round(t.z * 10), 61);
      const h2 = hash2(Math.round(t.x * 10), Math.round(t.z * 10), 62);
      if (t.sp !== 'palm') add(U.roots[t.sp], t.x, t.y - 0.12, t.z, h * 6.28, t.s, 0, 0.95 + h2 * 0.1);
      const b = biomeOf(t.x, t.z);
      if (t.sp === 'blossom') add(U.petals[h2 > 0.5 ? 1 : 0]!, t.x, t.y, t.z, h2 * 6.28, t.s * 1.3, 0.9, 1);
      else if (t.sp === 'pine' || t.sp === 'windpine') add(U.needles[h2 > 0.5 ? 1 : 0]!, t.x, t.y, t.z, h2 * 6.28, t.s * 1.2, 0.9, 0.9 + h * 0.2);
      else if (t.sp === 'palm') {
        if (h2 < 0.5) add(U.coconuts[h > 0.5 ? 1 : 0]!, t.x, t.y, t.z, h * 6.28, 1, 0.9, 1);
      } else if (h2 < (b === 'mistwood' ? 0.9 : 0.55)) add(U.litter[Math.floor(h2 * 3) % 3]!, t.x, t.y, t.z, h * 6.28, t.s * 1.4, 0.9, 0.9 + h * 0.2);
      // 幻影之森的树下常有一丛蕨或蘑菇
      if (b === 'mistwood' && h > 0.55) add(h > 0.8 ? U.mushroom[1]! : U.fern[0]!, t.x + Math.cos(h * 20) * 1.1, t.y - 0.02, t.z + Math.sin(h * 20) * 1.1, h2 * 6.28, 0.9, 0.6, 1);
    }
    const US = 3;
    const pick = <T,>(arr: readonly T[], r: number): T => arr[Math.floor(r * arr.length) % arr.length]!;
    for (let gz = 0; gz < cs / US; gz++)
      for (let gx = 0; gx < cs / US; gx++) {
        const ix = Math.floor(x0 / US) + gx;
        const iz = Math.floor(z0 / US) + gz;
        const x = (ix + 0.1 + hash2(ix, iz, 51) * 0.8) * US;
        const z = (iz + 0.1 + hash2(ix, iz, 52) * 0.8) * US;
        if (!hf.inBounds(x, z)) continue;
        const biome = biomeOf(x, z);
        const u = BIOMES[biome].undergrowth;
        const r = hash2(ix, iz, 53);
        const v = hash2(ix, iz, 54);
        const yaw = hash2(ix, iz, 55) * Math.PI * 2;
        const s = 0.8 + hash2(ix, iz, 56) * 0.5;
        const light = 0.88 + hash2(ix, iz, 57) * 0.22;
        const y = hf.heightAt(x, z);
        const wat = hf.waterAt(x, z);
        if (wat) {
          if (wat.body === 'sea') continue;
          // 睡莲成片：噪声决定“莲区”，静水（湖）比河里多
          const lilyP = u.lily * smooth(0.45, 0.68, fbm(x, z, 14, 9)) * (wat.body.includes('river') || wat.body.includes('creek') ? 0.4 : 1);
          if (wat.depth > 0.25 && wat.depth < 1.8 && r < lilyP) add(pick(U.lily, v), x, wat.level + 0.005, z, yaw, s, 0, light);
          else if (wat.depth < 0.35 && r < u.reeds * 0.8) add(pick(U.reeds, v), x, y, z, yaw, s, 0, light);
          continue;
        }
        if (y < hf.config.seaLevel + 0.15 || hf.slopeAt(x, z) > 40) continue;
        hf.surfaceAt(x, z, w);
        const path = w[C.dirt]! > 0.5 || w[C.stone]! > 0.5;
        const forest = w[C.forest]!;
        const sand = w[C.sand]!;
        const patch = fbm(x, z, 18, 11);
        const shore = u.reeds > 0 && nearFresh(x, z);
        if (shore && !path && r < u.reeds) {
          if (!this.blocked(x, z, 0.6)) add(pick(U.reeds, v), x, y, z, yaw, s, 0, light);
          continue;
        }
        const inWood = forest > 0.25 ? 1 : 0.15;
        // 累积概率：依次判断落在哪一类
        let acc = 0;
        const table: Array<[number, () => void]> = [
          [path ? 0 : u.fern * inWood * (0.4 + patch * 1.2), () => add(pick(U.fern, v), x, y - 0.02, z, yaw, s, 0.6, light)],
          [path ? 0 : u.mushroom * (forest > 0.2 ? 1 : 0.3), () => add(night(biome) && v > 0.45 ? pick(U.mushroomGlow, v) : pick(U.mushroom, v), x, y - 0.01, z, yaw, s, 0.8, 1)],
          [path ? 0 : u.litter * (forest > 0.2 ? 1 : 0.25) * (0.5 + patch), () => add(pick(U.litter, v), x, y, z, yaw, s, 0.95, light)],
          [path ? 0 : u.log * (forest > 0.3 ? 1 : 0.2), () => !this.blocked(x, z, 1.8) && add(pick(U.log, v), x, y - 0.05, z, yaw, s * 0.9, 0.8, light)],
          [path ? 0 : u.stump * (forest > 0.2 ? 1 : 0.4), () => !this.blocked(x, z, 0.7) && add(pick(U.stump, v), x, y - 0.05, z, yaw, s, 0.3, light)],
          [u.pebbles * (1 + w[C.rock]! * 3 + (path ? 1.5 : 0)), () => add(pick(U.pebbles, v), x, y, z, yaw, s, 0.9, light)],
          [sand > 0.4 ? u.driftwood : 0, () => !this.blocked(x, z, 1.2) && add(pick(U.driftwood, v), x, y - 0.03, z, yaw, s, 0.9, light)],
          [sand > 0.4 ? u.shells : 0, () => add(pick(U.shells, v), x, y, z, yaw, s, 0.9, light)],
        ];
        for (const [p, fn] of table) {
          acc += p;
          if (r < acc) {
            if (!this.blocked(x, z, 0.5)) fn();
            break;
          }
        }
      }
    this.stats.undergrowth = items.length;
    const geo = mergeTransformed(items);
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, this.lib.undergrowthMaterial);
    mesh.name = 'undergrowth';
    mesh.position.set(ox, oy, oz);
    mesh.receiveShadow = true;
    mesh.userData.ownedGeometry = true;
    this.group.add(mesh);
  }

  /**
   * 草 / 花细节格按距离整格显隐：格子到观察点的最近距离超过 maxDist 就不提交绘制。
   * 着色器里的淡出（FoliageLibrary）负责视觉过渡，这里负责省三角面。
   */
  updateDetailVisibility(px: number, pz: number, maxDist: number): number {
    let visible = 0;
    for (const t of this.detailTiles) {
      const dx = Math.max(0, Math.abs(px - t.x) - t.half);
      const dz = Math.max(0, Math.abs(pz - t.z) - t.half);
      const d2 = dx * dx + dz * dz;
      const on = d2 <= maxDist * maxDist;
      // 远景带：实例顺序已按哈希打乱，取前 1/3 即均匀稀疏的子集；草簇换远景几何
      const far = d2 > LOD_FAR * LOD_FAR * maxDist * maxDist;
      for (const m of t.meshes) {
        m.visible = on;
        const full = m.userData.fullCount as number;
        m.count = far ? Math.max(1, Math.ceil(full * FAR_FRACTION)) : full;
      }
      if (t.grass && far !== t.far) t.grass.geometry = far ? this.lib.grassFar : this.lib.grass;
      t.far = far;
      if (on) visible++;
    }
    return visible;
  }

  /**
   * 性能 P1 · LOD1 分块按到相机的距离切换树木替身。返回是否使用替身。
   * 带 10 m 滞回，避免在边界来回切换。
   */
  updateImpostors(camX: number, camZ: number): boolean {
    if (!this.treeImpostor.length) return false;
    const cs = this.hf.config.chunkSize;
    const x = -this.hf.half + (this.cx + 0.5) * cs;
    const z = -this.hf.half + (this.cz + 0.5) * cs;
    const d = Math.hypot(camX - x, camZ - z);
    const lim = this.lib.impostorDistance + (this.impostorOn ? -10 : 10);
    const on = d > lim;
    if (on !== this.impostorOn) {
      this.impostorOn = on;
      for (const m of this.treeImpostor) m.visible = on;
      for (const m of this.treeLow) m.visible = !on;
    }
    return on;
  }

  private addInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: Array<{ m: THREE.Matrix4; c: THREE.Color }>, castShadow: boolean, outline: boolean): THREE.InstancedMesh | null {
    if (!items.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    im.userData.fullCount = items.length;
    items.forEach((it, i) => {
      im.setMatrixAt(i, it.m);
      im.setColorAt(i, it.c);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = castShadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    im.computeBoundingBox();
    this.group.add(im);
    if (outline && this.lib.hullOutlines) {
      im.userData.outline = true;
      addHullOutlines(im, { darken: 0.42 });
    }
    return im;
  }

  dispose(): void {
    // 几何体与材质由 FoliageLibrary 共享，这里只释放实例缓冲
    this.group.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (im.isInstancedMesh && !im.userData.outlineHull) im.dispose();
      const m = o as THREE.Mesh;
      if (m.isMesh && m.userData.ownedGeometry) m.geometry.dispose();
    });
    this.collision.removeGroup(this.colliderGroup);
  }
}
