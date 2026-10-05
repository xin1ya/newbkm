/**
 * M3-03 海面特效：洋流（沿折线的白色流纹带，纹理顺流滚动）与漩涡（旋转的螺旋水涡 + 白沫外圈）。
 * 只是表现层；推动 / 卷入逻辑在 systems/travel/sea.ts，由 OverworldScene 每步调用。
 * 平涂卡通风格：流纹 / 螺旋都量化成硬边色带，不做真实折射。
 */
import * as THREE from 'three';
import type { IslandConfig } from '@/config/islands/types';

const CURRENT_VS = /* glsl */ `
  attribute float aU;
  attribute float aV;
  varying float vU;
  varying float vV;
  void main() {
    vU = aU;
    vV = aV;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const CURRENT_FS = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  varying float vU;
  varying float vV;
  float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  void main() {
    // 顺流滚动的短流纹：沿 U 方向周期 9 m，横向分 5 条泳道，每条相位不同
    float lane = floor(vV * 5.0);
    float u = vU / 9.0 - uTime * uSpeed / 9.0 + h(vec2(lane, 3.0)) * 4.0;
    float seg = fract(u);
    float streak = step(0.62, seg) * step(seg, 0.92);
    float laneMid = abs(fract(vV * 5.0) - 0.5);
    streak *= step(laneMid, 0.12);
    // 带边缘淡出
    float edge = smoothstep(0.0, 0.18, vV) * smoothstep(1.0, 0.82, vV);
    float a = streak * edge * 0.75 + edge * 0.08;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(vec3(0.75, 0.9, 1.0), vec3(1.0), streak), a);
  }`;

const WHIRL_FS = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float a = atan(p.y, p.x);
    // 对数螺旋：角度 + log(r) 随时间旋转，量化成 3 档色带
    float s = fract((a / 6.2832) * 3.0 + log(r + 0.04) * 1.6 + uTime * 0.55);
    float band = step(0.5, s);
    vec3 deep = vec3(0.07, 0.24, 0.42);
    vec3 mid = vec3(0.16, 0.42, 0.62);
    vec3 foam = vec3(0.92, 0.97, 1.0);
    vec3 col = mix(deep, mid, band);
    col = mix(col, foam, step(0.86, s) * smoothstep(0.15, 0.5, r));
    col = mix(vec3(0.02, 0.1, 0.2), col, smoothstep(0.08, 0.3, r)); // 涡心
    float alpha = smoothstep(1.0, 0.82, r);
    gl_FragColor = vec4(col, alpha * 0.92);
  }`;
const WHIRL_VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

export class SeaFx {
  readonly group = new THREE.Group();
  private readonly mats: THREE.ShaderMaterial[] = [];
  private readonly spinners: THREE.Object3D[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];

  constructor(island: IslandConfig) {
    this.group.name = 'sea-fx';
    const y = island.seaLevel + 0.08;
    for (const c of island.currents ?? []) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: CURRENT_VS,
        fragmentShader: CURRENT_FS,
        uniforms: { uTime: { value: 0 }, uSpeed: { value: c.speed * 1.6 } },
        transparent: true,
        depthWrite: false,
      });
      const geo = ribbon(c.points, c.width, y);
      const m = new THREE.Mesh(geo, mat);
      m.name = `current:${c.id}`;
      m.renderOrder = 2;
      m.frustumCulled = false;
      this.group.add(m);
      this.mats.push(mat);
      this.geos.push(geo);
    }
    for (const w of island.whirlpools ?? []) {
      const mat = new THREE.ShaderMaterial({ vertexShader: WHIRL_VS, fragmentShader: WHIRL_FS, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false });
      const geo = new THREE.CircleGeometry(w.radius * 1.15, 64);
      geo.rotateX(-Math.PI / 2);
      const disc = new THREE.Mesh(geo, mat);
      disc.position.set(w.center[0], y + 0.02, w.center[1]);
      disc.name = `whirlpool:${w.id}`;
      disc.renderOrder = 3;
      // 外圈白沫环（缓慢反向旋转）
      const ringGeo = new THREE.RingGeometry(w.radius * 1.1, w.radius * 1.32, 48, 1);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xf2f8ff, transparent: true, opacity: 0.55, depthWrite: false });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(w.center[0], y + 0.01, w.center[1]);
      ring.renderOrder = 2;
      this.group.add(disc, ring);
      this.mats.push(mat);
      this.spinners.push(ring);
      this.geos.push(geo, ringGeo);
      ring.userData.mat = ringMat;
    }
  }

  update(time: number): void {
    for (const m of this.mats) m.uniforms.uTime!.value = time;
    for (const s of this.spinners) s.rotation.y = -time * 0.2;
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const s of this.spinners) (s.userData.mat as THREE.Material | undefined)?.dispose();
  }
}

/** 折线 → 水平飘带（aU = 沿线米数，aV = 0..1 横向） */
function ribbon(points: Array<[number, number]>, width: number, y: number): THREE.BufferGeometry {
  // 每 6 m 重采样，转角处平滑
  const pts: Array<[number, number]> = [];
  for (let s = 0; s + 1 < points.length; s++) {
    const [ax, az] = points[s]!;
    const [bx, bz] = points[s + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 6));
    for (let i = s === 0 ? 0 : 1; i <= n; i++) pts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
  }
  const pos: number[] = [];
  const au: number[] = [];
  const av: number[] = [];
  const idx: number[] = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i]!;
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    let dx = b[0] - a[0];
    let dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    if (i > 0) acc += Math.hypot(x - pts[i - 1]![0], z - pts[i - 1]![1]);
    const nx = -dz * (width / 2);
    const nz = dx * (width / 2);
    pos.push(x + nx, y, z + nz, x - nx, y, z - nz);
    au.push(acc, acc);
    av.push(0, 1);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(au, 1));
  g.setAttribute('aV', new THREE.Float32BufferAttribute(av, 1));
  g.setIndex(idx);
  return g;
}
