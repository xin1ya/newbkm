/**
 * WLD-002 · 水体：海面（覆盖整个世界 + 外延到地平线）与湖面。
 */
import * as THREE from 'three';
import type { Heightfield } from '../terrain/Heightfield';
import { LAKE_STYLE, SEA_STYLE, bakeDepthTexture, createWaterMaterial, waterShared } from './WaterMaterial';

export class Water {
  readonly group = new THREE.Group();
  private textures: THREE.Texture[] = [];
  private materials: THREE.ShaderMaterial[] = [];

  constructor(
    private readonly hf: Heightfield,
    full: boolean,
  ) {
    this.group.name = 'water';
    const size = hf.config.size[0];
    const seaDepth = bakeDepthTexture(hf, hf.config.seaLevel, 512);
    const seaMat = createWaterMaterial(seaDepth, size, SEA_STYLE, full);
    // 中心细分（波浪、泡沫精度），外圈一个大平面延伸到地平线
    const seaR = size / 2 + 160;
    const seaGeo = new THREE.RingGeometry(0.001, seaR, full ? 128 : 48, full ? 64 : 16).rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.position.y = hf.config.seaLevel;
    sea.name = 'sea';
    sea.renderOrder = 2;
    const outer = new THREE.Mesh(new THREE.RingGeometry(seaR, 6000, full ? 128 : 48, 1).rotateX(-Math.PI / 2), seaMat);
    outer.position.y = hf.config.seaLevel;
    outer.renderOrder = 2;
    this.group.add(sea, outer);
    this.textures.push(seaDepth);
    this.materials.push(seaMat);
    for (const b of hf.config.waterBodies) {
      const tex = bakeDepthTexture(hf, b.level, 512);
      const mat = createWaterMaterial(tex, size, LAKE_STYLE, full);
      const geo = new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2);
      const lake = new THREE.Mesh(geo, mat);
      lake.scale.set(b.radius[0] * 1.2, 1, b.radius[1] * 1.2);
      lake.position.set(b.center[0], b.level, b.center[1]);
      lake.name = `lake-${b.id}`;
      lake.renderOrder = 2;
      this.group.add(lake);
      this.textures.push(tex);
      this.materials.push(mat);
    }
    this.addRivers(size, full);
  }

  /**
   * M1-01 河流：沿中线每 2 m 取一个截面的带状网格，顶点高度 = 该处水面高度（下游逐渐降低），
   * 两侧比水面宽 3 m 插进河岸（深度贴图在岸上为 0，岸线自然透明）。
   */
  private addRivers(size: number, full: boolean): void {
    const rivers = this.hf.config.rivers ?? [];
    if (!rivers.length) return;
    const tex = bakeDepthTexture(this.hf, (x, z) => this.hf.riverAt(x, z)?.level ?? null, 512);
    const mat = createWaterMaterial(tex, size, LAKE_STYLE, full);
    mat.side = THREE.DoubleSide;
    this.textures.push(tex);
    this.materials.push(mat);
    for (const r of rivers) {
      const pos: number[] = [];
      const idx: number[] = [];
      const half = r.width / 2 + 3;
      let row = 0;
      for (let s = 0; s + 1 < r.points.length; s++) {
        const [ax, az] = r.points[s]!;
        const [bx, bz] = r.points[s + 1]!;
        const len = Math.hypot(bx - ax, bz - az);
        const steps = Math.max(1, Math.ceil(len / 2));
        // 截面方向：取相邻两段方向的平均，拐角处不打折
        const dir = (k: number) => {
          const p = r.points[Math.max(0, Math.min(r.points.length - 2, k))]!;
          const q = r.points[Math.max(1, Math.min(r.points.length - 1, k + 1))]!;
          const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
          return [(q[0] - p[0]) / l, (q[1] - p[1]) / l] as const;
        };
        for (let i = s === 0 ? 0 : 1; i <= steps; i++) {
          const t = i / steps;
          const x = ax + (bx - ax) * t;
          const z = az + (bz - az) * t;
          const d0 = dir(s);
          const d1 = i === steps ? dir(s + 1) : d0;
          const dx = (d0[0] + d1[0]) / 2;
          const dz = (d0[1] + d1[1]) / 2;
          const dl = Math.hypot(dx, dz) || 1;
          const nx = -dz / dl;
          const nz = dx / dl;
          const y = r.levels[s]! + (r.levels[s + 1]! - r.levels[s]!) * t;
          pos.push(x + nx * half, y, z + nz * half, x - nx * half, y, z - nz * half);
          if (row > 0) {
            const a = (row - 1) * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
          row++;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `river-${r.id}`;
      mesh.renderOrder = 2;
      this.group.add(mesh);
    }
  }

  update(time: number): void {
    waterShared.uTime.value = time;
  }

  /** 由天空系统每帧同步 */
  setLighting(sunDir: THREE.Vector3, sunColor: THREE.Color, ambient: THREE.Color, rain: number): void {
    waterShared.uSunDir.value.copy(sunDir);
    waterShared.uSunColor.value.copy(sunColor);
    waterShared.uAmbient.value.copy(ambient);
    waterShared.uRain.value = rain;
  }

  get heightfield(): Heightfield {
    return this.hf;
  }

  dispose(): void {
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    for (const t of this.textures) t.dispose();
    for (const m of this.materials) m.dispose();
  }
}
