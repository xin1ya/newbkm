/**
 * WLD-001 · 地形门面：加载高度场与材质图，提供渲染网格工厂与碰撞查询。
 * 远景：整岛低模（16 m 步长，下沉 0.6 m），按分块切成小片；某块的近景网格加载后隐藏该块的远景片，
 *   避免两层地形叠在一起（低模在凹地会高出精细地形 → 穿模）。
 */
import * as THREE from 'three';
import type { AssetLoader } from '@/core/assets';
import type { IslandConfig } from '@/config/islands/types';
import { LAYER } from '@/render';
import { Heightfield } from './Heightfield';
import { createTerrainMaterial } from './TerrainMaterial';
import { buildTerrainGeometry } from './TerrainChunk';

export class Terrain {
  readonly material: THREE.MeshToonMaterial;
  /** 远景低模（每个分块一片，name = far-cx-cz） */
  readonly farMesh = new THREE.Group();
  private farPieces = new Map<string, THREE.Mesh>();

  private constructor(readonly hf: Heightfield) {
    this.material = createTerrainMaterial(hf);
    const size = hf.config.size[0];
    const cs = hf.config.chunkSize;
    const n = Math.round(size / cs);
    this.farMesh.name = 'terrain-far';
    for (let cz = 0; cz < n; cz++)
      for (let cx = 0; cx < n; cx++) {
        const m = new THREE.Mesh(buildTerrainGeometry(hf, -size / 2 + cx * cs, -size / 2 + cz * cs, cs, 8, 6, 0.6), this.material);
        m.name = `far-${cx}-${cz}`;
        m.receiveShadow = false;
        m.layers.set(LAYER.TERRAIN);
        this.farMesh.add(m);
        this.farPieces.set(`${cx},${cz}`, m);
      }
  }

  static async load(config: IslandConfig, loader: AssetLoader): Promise<Terrain> {
    const [h, ...s] = await Promise.all([loader.arrayBuffer(config.heightmap), ...config.splatmaps.map((p) => loader.arrayBuffer(p))]);
    return new Terrain(Heightfield.fromPng(config, h!, s));
  }

  static fromHeightfield(hf: Heightfield): Terrain {
    return new Terrain(hf);
  }

  get config(): IslandConfig {
    return this.hf.config;
  }

  /** 分块网格；lod 0 = 2 m，1 = 8 m */
  createChunkMesh(cx: number, cz: number, lod: 0 | 1): THREE.Mesh {
    const cs = this.config.chunkSize;
    const g = buildTerrainGeometry(this.hf, -this.hf.half + cx * cs, -this.hf.half + cz * cs, cs, lod === 0 ? 1 : 4);
    const m = new THREE.Mesh(g, this.material);
    m.name = `terrain-${cx}-${cz}-L${lod}`;
    m.receiveShadow = lod === 0;
    m.layers.set(LAYER.TERRAIN);
    return m;
  }

  /** 近景分块加载 / 卸载时切换对应远景片 */
  setFarVisible(cx: number, cz: number, visible: boolean): void {
    const m = this.farPieces.get(`${cx},${cz}`);
    if (m) m.visible = visible;
  }

  heightAt(x: number, z: number): number {
    return this.hf.heightAt(x, z);
  }

  /** 射线与高度场求交（相机碰撞、投球落点）；步进 + 二分 */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, out = new THREE.Vector3()): THREE.Vector3 | null {
    const step = Math.max(0.5, this.hf.cell * 0.5);
    let prevT = 0;
    let prevAbove = origin.y - this.heightAt(origin.x, origin.z);
    if (prevAbove < 0) return out.copy(origin);
    for (let t = step; t <= maxDist; t += step) {
      const x = origin.x + dir.x * t;
      const y = origin.y + dir.y * t;
      const z = origin.z + dir.z * t;
      const above = y - this.heightAt(x, z);
      if (above < 0) {
        let lo = prevT;
        let hi = t;
        for (let k = 0; k < 8; k++) {
          const mid = (lo + hi) / 2;
          const my = origin.y + dir.y * mid - this.heightAt(origin.x + dir.x * mid, origin.z + dir.z * mid);
          if (my < 0) hi = mid;
          else lo = mid;
        }
        return out.copy(origin).addScaledVector(dir, hi);
      }
      prevT = t;
      prevAbove = above;
    }
    void prevAbove;
    return null;
  }

  /** 熔岩流动动画（只有带第三张 splat 的岛屿可见） */
  tick(time: number): void {
    const u = this.material.userData.terrainUniforms as { uTime: { value: number } } | undefined;
    if (u) u.uTime.value = time;
  }

  dispose(): void {
    for (const m of this.farPieces.values()) m.geometry.dispose();
    (this.material.userData.dispose as (() => void) | undefined)?.();
    this.material.dispose();
  }
}
