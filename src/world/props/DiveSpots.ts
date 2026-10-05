/**
 * M3-18 · 大地图潜水点的海面表现（世界层）。逻辑见 scenes/common/SceneDive.ts。
 *
 * - 暗色水域：贴在海面上方 3 cm 的径向渐变圆盘（中心深靛、边缘淡出），缓慢旋转的涡纹让它远看就像「深不见底」；
 * - 气泡：从暗区里不断冒上来的小气泡，在水面破开时散出一圈涟漪；
 * - 浮标：暗区边缘一只红白浮标（带小旗），随浪起伏，标出「这里可以下潜」。
 * 只做显示，不加碰撞。
 */
import * as THREE from 'three';
import { createToonMaterial } from '@/render';
import type { DiveSpotConfig } from '@/config/islands/types';

const BUBBLES_PER_SPOT = 26;

interface SpotView {
  cfg: DiveSpotConfig;
  disc: THREE.Mesh;
  swirl: THREE.ShaderMaterial;
  bubbles: Array<{ mesh: THREE.Mesh; x: number; z: number; t: number; period: number }>;
  ripples: Array<{ mesh: THREE.Mesh; t: number; x: number; z: number }>;
  buoy: THREE.Group;
}

export class DiveSpots {
  readonly group = new THREE.Group();
  private spots: SpotView[] = [];
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private time = 0;

  constructor(
    spots: readonly DiveSpotConfig[],
    private readonly waterLevel: (x: number, z: number) => number,
  ) {
    this.group.name = 'dive-spots';
    for (const s of spots) this.spots.push(this.build(s));
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    for (const s of this.spots) {
      s.swirl.uniforms.uTime!.value = t;
      const lvl = this.waterLevel(s.cfg.center[0], s.cfg.center[1]);
      for (const b of s.bubbles) {
        b.t += dt;
        if (b.t > b.period) {
          // 破开：在水面留一圈涟漪，然后从水下重新冒
          const r = s.ripples.find((q) => q.t >= 1);
          if (r) {
            r.t = 0;
            r.x = b.x;
            r.z = b.z;
          }
          b.t = 0;
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * s.cfg.radius * 0.75;
          b.x = s.cfg.center[0] + Math.cos(a) * rr;
          b.z = s.cfg.center[1] + Math.sin(a) * rr;
        }
        const k = b.t / b.period;
        b.mesh.position.set(b.x + Math.sin(t * 3 + b.period) * 0.08, lvl - 0.25 + k * 0.4, b.z);
        b.mesh.scale.setScalar(0.08 + k * 0.1);
        (b.mesh.material as THREE.MeshToonMaterial).opacity = 0.8 * Math.sin(k * Math.PI);
      }
      for (const r of s.ripples) {
        r.t = Math.min(1, r.t + dt * 0.9);
        r.mesh.visible = r.t < 1;
        r.mesh.position.set(r.x, lvl + 0.05, r.z);
        r.mesh.scale.setScalar(0.3 + r.t * 1.6);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - r.t);
      }
      s.buoy.position.y = lvl + Math.sin(t * 1.7 + s.cfg.center[0]) * 0.12;
      s.buoy.rotation.z = Math.sin(t * 1.3) * 0.12;
      s.buoy.rotation.x = Math.cos(t * 1.1) * 0.1;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.geos = [];
    this.mats = [];
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  private build(cfg: DiveSpotConfig): SpotView {
    const [cx, cz] = cfg.center;
    const lvl = this.waterLevel(cx, cz);
    const swirl = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color('#061a3a') }, uMid: { value: new THREE.Color('#0d3a6a') } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uDeep; uniform vec3 uMid; varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;
          float a = atan(p.y, p.x);
          // 缓慢旋转的涡纹
          float sw = sin(a * 3.0 + r * 9.0 - uTime * 0.6) * 0.5 + 0.5;
          vec3 col = mix(uDeep, uMid, smoothstep(0.0, 1.0, r) * 0.7 + sw * 0.15);
          float alpha = (1.0 - smoothstep(0.55, 1.0, r)) * 0.62;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this.mats.push(swirl);
    const disc = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(cfg.radius * 2.3, cfg.radius * 2.3).rotateX(-Math.PI / 2)), swirl);
    disc.position.set(cx, lvl + 0.03, cz);
    disc.renderOrder = 2;
    disc.name = `dive-spot:${cfg.id}`;
    this.group.add(disc);
    const bubbleMat = () => {
      const m = createToonMaterial({ kind: 'scene', color: '#e8fbff', transparent: true, opacity: 0.8, emissive: '#9ae8ff', emissiveIntensity: 0.3 });
      this.mats.push(m);
      return m;
    };
    const bgeo = this.geo(new THREE.SphereGeometry(1, 8, 6));
    const bubbles: SpotView['bubbles'] = [];
    for (let i = 0; i < BUBBLES_PER_SPOT; i++) {
      const mesh = new THREE.Mesh(bgeo, bubbleMat());
      const a = (i / BUBBLES_PER_SPOT) * Math.PI * 2 * 3.7;
      const rr = Math.sqrt((i * 0.618) % 1) * cfg.radius * 0.75;
      bubbles.push({ mesh, x: cx + Math.cos(a) * rr, z: cz + Math.sin(a) * rr, t: (i * 0.37) % 1.6, period: 1.2 + ((i * 0.53) % 1) * 1.4 });
      this.group.add(mesh);
    }
    const rgeo = this.geo(new THREE.RingGeometry(0.8, 1, 24).rotateX(-Math.PI / 2));
    const ripples: SpotView['ripples'] = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0, depthWrite: false });
      this.mats.push(m);
      const mesh = new THREE.Mesh(rgeo, m);
      mesh.visible = false;
      this.group.add(mesh);
      ripples.push({ mesh, t: 1, x: cx, z: cz });
    }
    // 浮标：红白相间的浮筒 + 小旗（放在暗区东南缘）
    const buoy = new THREE.Group();
    buoy.name = `dive-buoy:${cfg.id}`;
    const red = createToonMaterial({ kind: 'scene', color: '#e8484a' });
    const white = createToonMaterial({ kind: 'scene', color: '#f4f4f0' });
    const flag = createToonMaterial({ kind: 'scene', color: '#3a7bd5', side: THREE.DoubleSide });
    this.mats.push(red, white, flag);
    const body = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.45, 0.55, 0.5, 14)), red);
    body.position.y = 0.05;
    const band = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.4, 0.45, 0.3, 14)), white);
    band.position.y = 0.45;
    const cap = new THREE.Mesh(this.geo(new THREE.ConeGeometry(0.38, 0.4, 14)), red);
    cap.position.y = 0.8;
    const pole = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6)), white);
    pole.position.y = 1.5;
    const fl = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(0.5, 0.32)), flag);
    fl.position.set(0.26, 1.9, 0);
    // 旗上画一个向下的箭头（白色三角）
    const arrow = new THREE.Mesh(this.geo(new THREE.CircleGeometry(0.1, 3)), white);
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(0.26, 1.9, 0.01);
    buoy.add(body, band, cap, pole, fl, arrow);
    for (const m of [body, band, cap]) m.castShadow = true;
    buoy.position.set(cx + cfg.radius * 0.72, lvl, cz + cfg.radius * 0.72);
    this.group.add(buoy);
    return { cfg, disc, swirl, bubbles, ripples, buoy };
  }
}
