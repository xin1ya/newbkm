/**
 * M1-16 · 世界中的任务标记（设计 §7.3「世界标记」的 3D 部分）：
 * - 精确目标：从地面升起的光柱（加色混合、上端渐隐、缓慢脉动），远处也能看到方向；走近后淡出。
 * - 搜索范围：贴合地形的地面光环（按角度采样地形高度），玩家在范围附近时显示。
 * 与 DOM 浮空图标（QuestHud.setWorldMarker）配合；设置「任务标记」关闭时全部隐藏。
 */
import * as THREE from 'three';

const BEAM_HEIGHT = 46;
const RING_SEGMENTS = 96;
const RING_WIDTH = 1.1;

const beamVert = /* glsl */ `
varying float vH;
void main() {
  vH = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const beamFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying float vH;
void main() {
  float fade = pow(clamp(1.0 - vH, 1e-4, 1.0), 1.6);
  float pulse = 0.75 + 0.25 * sin(uTime * 2.4 - vH * 12.0);
  gl_FragColor = vec4(uColor, clamp(fade * pulse * uOpacity, 0.0, 1.0));
}`;
const ringFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying float vH;
void main() {
  // vH：0 = 内沿，1 = 外沿；中间亮、两侧柔和
  float edge = 1.0 - abs(vH - 0.5) * 2.0;
  float dash = 0.65 + 0.35 * sin(uTime * 1.5);
  gl_FragColor = vec4(uColor, clamp(edge * dash * uOpacity, 0.0, 1.0));
}`;

export class QuestBeacon {
  readonly group = new THREE.Group();
  private beam: THREE.Mesh;
  private beamMat: THREE.ShaderMaterial;
  private ring: THREE.Mesh | null = null;
  private ringMat: THREE.ShaderMaterial;
  private ringKey = '';
  private time = 0;
  private opacity = 0;
  private ringOpacity = 0;

  constructor(color = '#ffcf4a') {
    const c = new THREE.Color(color);
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: c }, uOpacity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const geo = new THREE.CylinderGeometry(0.45, 0.8, BEAM_HEIGHT, 20, 1, true);
    geo.translate(0, BEAM_HEIGHT / 2, 0);
    this.beam = new THREE.Mesh(geo, this.beamMat);
    this.beam.frustumCulled = false;
    this.beam.renderOrder = 5;
    this.beam.name = 'quest-beam';
    this.ringMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: c.clone() }, uOpacity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: beamVert,
      fragmentShader: ringFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.group.name = 'quest-beacon';
    this.group.add(this.beam);
    this.group.visible = false;
  }

  /**
   * target：null 隐藏。exact 目标显示光柱；radius > 0 显示地面光环（玩家离范围不远时）。
   */
  update(
    dt: number,
    target: { x: number; z: number; radius: number } | null,
    player: { x: number; z: number },
    heightAt: (x: number, z: number) => number,
    enabled: boolean,
  ): void {
    this.time += dt;
    const k = 1 - Math.exp(-dt * 6);
    let wantBeam = 0;
    let wantRing = 0;
    if (target && enabled) {
      const d = Math.hypot(target.x - player.x, target.z - player.z);
      if (target.radius > 0) {
        // 范围标记：远处用细光柱指示中心，靠近（2 倍半径内）换成地面光环
        wantRing = d < target.radius * 2.2 ? 1 : 0;
        wantBeam = d > target.radius * 1.2 ? 0.55 : 0;
        this.ensureRing(target, heightAt);
      } else {
        // 精确目标：走到 10 m 内淡出，避免挡住 NPC / 建筑
        wantBeam = THREE.MathUtils.clamp((d - 6) / 10, 0, 1);
      }
      this.beam.position.set(target.x, heightAt(target.x, target.z) - 0.5, target.z);
    }
    this.opacity += (wantBeam - this.opacity) * k;
    this.ringOpacity += (wantRing - this.ringOpacity) * k;
    this.beamMat.uniforms.uOpacity!.value = this.opacity * 0.85;
    this.beamMat.uniforms.uTime!.value = this.time;
    this.ringMat.uniforms.uOpacity!.value = this.ringOpacity * 0.9;
    this.ringMat.uniforms.uTime!.value = this.time;
    this.beam.visible = this.opacity > 0.01;
    if (this.ring) this.ring.visible = this.ringOpacity > 0.01;
    this.group.visible = this.beam.visible || !!this.ring?.visible;
  }

  /** 按地形采样生成贴地光环（目标变化时重建） */
  private ensureRing(t: { x: number; z: number; radius: number }, heightAt: (x: number, z: number) => number): void {
    const key = `${t.x},${t.z},${t.radius}`;
    if (key === this.ringKey) return;
    this.ringKey = key;
    if (this.ring) {
      this.group.remove(this.ring);
      this.ring.geometry.dispose();
    }
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const r0 = t.radius - RING_WIDTH / 2;
    const r1 = t.radius + RING_WIDTH / 2;
    for (let i = 0; i <= RING_SEGMENTS; i++) {
      const a = (i / RING_SEGMENTS) * Math.PI * 2;
      const cx = Math.cos(a);
      const sz = Math.sin(a);
      for (const [r, v] of [
        [r0, 0],
        [r1, 1],
      ] as const) {
        const x = t.x + cx * r;
        const z = t.z + sz * r;
        pos.push(x, heightAt(x, z) + 0.35, z);
        uv.push(i / RING_SEGMENTS, v);
      }
      if (i < RING_SEGMENTS) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.ring = new THREE.Mesh(g, this.ringMat);
    this.ring.name = 'quest-ring';
    this.ring.frustumCulled = false;
    this.ring.renderOrder = 5;
    this.group.add(this.ring);
  }

  get beamVisible(): boolean {
    return this.beam.visible;
  }

  get ringVisible(): boolean {
    return !!this.ring?.visible;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.beam.geometry.dispose();
    this.beamMat.dispose();
    this.ring?.geometry.dispose();
    this.ringMat.dispose();
  }
}
