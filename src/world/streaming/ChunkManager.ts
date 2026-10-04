/**
 * WLD-004 · 分块流式加载：地形网格 + 植被，按每帧时间预算执行 ChunkGrid 的任务。
 * - 初次进入（或传送）调用 loadAround() 同步建好近处块
 * - 每帧 update()：最多花 budgetMs 毫秒建块（至少完成 1 个）
 * - 远景由 Terrain.farMesh 常驻兜底
 */
import * as THREE from 'three';
import type { QualitySettings } from '@/render';
import type { Terrain } from '../terrain/Terrain';
import type { CollisionWorld } from '../collision/CollisionWorld';
import { ChunkFoliage } from '../foliage/ChunkFoliage';
import type { FoliageLibrary } from '../foliage/FoliageLibrary';
import { ChunkGrid, chunkId, type ChunkTask, type Lod } from './ChunkGrid';
import { HorizonCuller, type CullTarget } from './HorizonCuller';

interface LoadedChunk {
  cx: number;
  cz: number;
  lod: Lod;
  terrain: THREE.Mesh;
  foliage: ChunkFoliage;
  /** 地平线剔除目标（地形 + 植被一起显隐） */
  cull: CullTarget;
}

/** 植被高出地形包围盒的余量（最高的树约 12 m） */
const FOLIAGE_TOP = 14;

export interface StreamingStats {
  loaded: number;
  lod0: number;
  lod1: number;
  pending: number;
  lastBuildMs: number;
  builtTotal: number;
  instances: number;
  /** 当前提交绘制的草 / 花细节格数 */
  detailTiles: number;
  /** 性能 P1：地平线遮挡剔除掉的分块 / 使用树木替身的分块 */
  horizonCulled: number;
  impostorChunks: number;
}

export class ChunkManager {
  readonly group = new THREE.Group();
  readonly grid: ChunkGrid;
  private chunks = new Map<string, LoadedChunk>();
  private lodMap = new Map<string, Lod>();
  private pending: ChunkTask[] = [];
  private lastPlanKey = '';
  budgetMs = 4;
  readonly stats: StreamingStats = { loaded: 0, lod0: 0, lod1: 0, pending: 0, lastBuildMs: 0, builtTotal: 0, instances: 0, detailTiles: 0, horizonCulled: 0, impostorChunks: 0 };
  /** 相机位置（替身切换 / 遮挡剔除的观察点）；为空时用玩家位置、高度取地形 + 2 m */
  camera: THREE.Vector3 | null = null;
  /** 额外的剔除目标（城镇建筑块等，由场景注册） */
  readonly extraCull: CullTarget[] = [];
  readonly culler: HorizonCuller;
  private lastUpdate = 0;
  private readonly eye = new THREE.Vector3();

  constructor(
    private readonly terrain: Terrain,
    private readonly lib: FoliageLibrary,
    private readonly collision: CollisionWorld,
    private quality: QualitySettings,
  ) {
    const cs = terrain.config.chunkSize;
    this.grid = new ChunkGrid(Math.ceil(terrain.config.size[0] / cs), cs, terrain.config.size[0] / 2);
    this.group.name = 'chunks';
    this.culler = new HorizonCuller(terrain.hf);
  }

  setQuality(q: QualitySettings): void {
    this.quality = q;
    // 画质变化：重建全部（草密度、半径都可能变化）
    for (const id of [...this.chunks.keys()]) this.unload(id);
    this.lastPlanKey = '';
  }

  /** 同步加载玩家周围（进入场景 / 传送） */
  loadAround(x: number, z: number): void {
    this.plan(x, z, true);
    while (this.pending.length) this.exec(this.pending.shift()!);
    this.updateDetail(x, z);
    this.updateStats();
  }

  update(x: number, z: number): void {
    this.plan(x, z, false);
    const t0 = performance.now();
    let built = 0;
    while (this.pending.length && (built === 0 || performance.now() - t0 < this.budgetMs)) {
      const t = this.pending.shift()!;
      this.exec(t);
      if (t.lod !== null) built++;
    }
    if (built) this.stats.lastBuildMs = performance.now() - t0;
    this.updateDetail(x, z);
    this.updateCulling(x, z);
    this.updateStats();
  }

  /** 草 / 花细节格按距离显隐（观察点在玩家处，外加 10 m 余量覆盖跟随镜头的偏移） */
  private updateDetail(x: number, z: number): void {
    let n = 0;
    const d = this.quality.grassDistance + 10;
    for (const c of this.chunks.values()) n += c.foliage.updateDetailVisibility(x, z, d);
    this.stats.detailTiles = n;
  }

  /** 性能 P1：树木替身 + 地平线遮挡剔除 */
  private updateCulling(x: number, z: number): void {
    const now = performance.now() / 1000;
    const dt = this.lastUpdate ? Math.min(0.5, now - this.lastUpdate) : 0.2;
    this.lastUpdate = now;
    const hf = this.terrain.hf;
    if (this.camera) this.eye.copy(this.camera);
    else this.eye.set(x, (hf.inBounds(x, z) ? hf.heightAt(x, z) : 0) + 2, z);
    let imp = 0;
    const { cx, cz } = this.grid.chunkOf(this.eye.x, this.eye.z);
    for (const c of this.chunks.values()) {
      if (c.foliage.updateImpostors(this.eye.x, this.eye.z)) imp++;
      c.cull.pinned = Math.abs(c.cx - cx) <= 1 && Math.abs(c.cz - cz) <= 1;
    }
    this.stats.impostorChunks = imp;
    if (this.culler.update(dt, this.eye, this.cullTargets())) this.stats.horizonCulled = this.culler.culled;
  }

  private *cullTargets(): Iterable<CullTarget> {
    for (const c of this.chunks.values()) yield c.cull;
    yield* this.extraCull;
  }

  private plan(x: number, z: number, force: boolean): void {
    const { cx, cz } = this.grid.chunkOf(x, z);
    const key = `${cx},${cz}`;
    if (!force && key === this.lastPlanKey && this.pending.length === 0) return;
    this.lastPlanKey = key;
    this.pending = this.grid.plan(x, z, this.lodMap, this.quality.lod0Radius, this.quality.lod1Radius);
  }

  private exec(t: ChunkTask): void {
    const id = chunkId(t.cx, t.cz);
    if (t.lod === null) {
      this.unload(id);
      return;
    }
    const prev = this.chunks.get(id);
    const terrain = this.terrain.createChunkMesh(t.cx, t.cz, t.lod);
    const foliage = new ChunkFoliage(this.terrain.hf, this.lib, this.collision, t.cx, t.cz, t.lod, this.quality);
    if (prev) this.dispose(prev, false);
    this.group.add(terrain, foliage.group);
    terrain.geometry.computeBoundingBox();
    // 地形网格顶点就是世界坐标（网格本身无变换）
    const box = terrain.geometry.boundingBox!.clone();
    box.max.y += FOLIAGE_TOP;
    this.chunks.set(id, { cx: t.cx, cz: t.cz, lod: t.lod, terrain, foliage, cull: { box, objects: [terrain, foliage.group] } });
    this.terrain.setFarVisible(t.cx, t.cz, false);
    this.lodMap.set(id, t.lod);
    this.stats.builtTotal++;
  }

  private unload(id: string): void {
    const c = this.chunks.get(id);
    if (!c) return;
    this.dispose(c, true);
    this.terrain.setFarVisible(c.cx, c.cz, true);
    this.chunks.delete(id);
    this.lodMap.delete(id);
  }

  private dispose(c: LoadedChunk, removeColliders: boolean): void {
    this.group.remove(c.terrain, c.foliage.group);
    c.terrain.geometry.dispose();
    if (removeColliders) c.foliage.dispose();
    else
      c.foliage.group.traverse((o) => {
        const im = o as THREE.InstancedMesh;
        if (im.isInstancedMesh && !im.userData.outlineHull) im.dispose();
      });
  }

  private updateStats(): void {
    let l0 = 0;
    let inst = 0;
    for (const c of this.chunks.values()) {
      if (c.lod === 0) l0++;
      const s = c.foliage.stats;
      inst += s.grass + s.flowers * 2 + s.trees + s.rocks + s.bushes;
    }
    this.stats.loaded = this.chunks.size;
    this.stats.lod0 = l0;
    this.stats.lod1 = this.chunks.size - l0;
    this.stats.pending = this.pending.length;
    this.stats.instances = inst;
  }

  lodAt(x: number, z: number): Lod | null {
    const { cx, cz } = this.grid.chunkOf(x, z);
    return this.lodMap.get(chunkId(cx, cz)) ?? null;
  }

  dispose_all(): void {
    for (const id of [...this.chunks.keys()]) this.unload(id);
  }
}
