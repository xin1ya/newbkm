/**
 * REN-004 · 卡通云：由若干压扁的块状球体合并而成的“棉花团”，实例化，
 * 在玩家周围 1.2 km 的环带里缓慢漂移（循环平铺），颜色随天空光照变化。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createToonMaterial } from '@/render';
import { seeded } from '../util/hash';

const RANGE = 2400;

export class Clouds {
  readonly mesh: THREE.InstancedMesh;
  private readonly bases: THREE.Vector3[] = [];
  private readonly scales: THREE.Vector3[] = [];
  readonly material: THREE.MeshToonMaterial;
  private drift = new THREE.Vector2();

  constructor(count = 36) {
    const rnd = seeded(99);
    const parts: THREE.BufferGeometry[] = [];
    const blobs = [
      [0, 0, 0, 1],
      [0.9, -0.1, 0.2, 0.75],
      [-0.9, -0.15, -0.1, 0.7],
      [0.35, 0.35, -0.2, 0.7],
      [-0.4, 0.3, 0.25, 0.6],
      [1.6, -0.25, 0, 0.5],
      [-1.6, -0.3, 0.1, 0.45],
    ];
    for (const [x, y, z, r] of blobs) parts.push(new THREE.IcosahedronGeometry(r!, 2).translate(x!, y!, z!));
    const geo = mergeGeometries(parts)!.scale(1, 0.55, 0.8);
    // 底面压平
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.2) p.setY(i, -0.2 + (p.getY(i) + 0.2) * 0.15);
    geo.computeVertexNormals();
    this.material = createToonMaterial({ kind: 'scene', color: 0xffffff, rim: false, specular: false, fog: false, cacheKey: 'cloud', emissive: 0x7f8fa6, emissiveIntensity: 0.35 });
    this.material.userData.outline = false;
    this.mesh = new THREE.InstancedMesh(geo, this.material, count);
    this.mesh.name = 'clouds';
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    for (let i = 0; i < count; i++) {
      this.bases.push(new THREE.Vector3((rnd() - 0.5) * RANGE, 160 + rnd() * 120, (rnd() - 0.5) * RANGE));
      const s = 28 + rnd() * 40;
      this.scales.push(new THREE.Vector3(s, s * (0.8 + rnd() * 0.4), s));
    }
  }

  update(dt: number, center: THREE.Vector3, windX: number, windZ: number, cover: number, tint: THREE.Color): void {
    this.drift.x += windX * dt * 3;
    this.drift.y += windZ * dt * 3;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const wrap = (v: number) => ((((v + RANGE / 2) % RANGE) + RANGE) % RANGE) - RANGE / 2;
    for (let i = 0; i < this.bases.length; i++) {
      const b = this.bases[i]!;
      const visible = i / this.bases.length < 0.45 + cover * 0.55;
      pos.set(center.x + wrap(b.x + this.drift.x - center.x), b.y, center.z + wrap(b.z + this.drift.y - center.z));
      scl.copy(this.scales[i]!).multiplyScalar(visible ? 1 + cover * 0.4 : 0.0001);
      m.compose(pos, q, scl);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.material.color.copy(tint).lerp(new THREE.Color(0x8a94a3), cover * 0.6);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
