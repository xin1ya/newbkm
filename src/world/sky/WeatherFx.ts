/**
 * 天气粒子：雨丝（线段，GPU 端按时间下落并围绕相机循环平铺，CPU 零更新）、雪花（点）、闪电（全屏闪白 + 雷光 + 可见的折线雷柱）。
 * M3-06：雷柱落点 80–250 m，优先劈向附近的避雷塔塔顶；onStrike(距离) 供场景按声速延迟播放雷声。
 */
import * as THREE from 'three';
import { seeded } from '../util/hash';
import { signalLightning } from '@/core/weatherSignal';

const BOX = 36;

function precipitation(count: number, snow: boolean): THREE.LineSegments | THREE.Points {
  const rnd = seeded(snow ? 5 : 3);
  const verts = snow ? count : count * 2;
  const offset = new Float32Array(verts * 3);
  const tip = new Float32Array(verts);
  for (let i = 0; i < count; i++) {
    const x = rnd() * BOX;
    const y = rnd() * BOX;
    const z = rnd() * BOX;
    if (snow) {
      offset.set([x, y, z], i * 3);
    } else {
      offset.set([x, y, z, x, y, z], i * 6);
      tip[i * 2 + 1] = 1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(offset, 3));
  g.setAttribute('aTip', new THREE.BufferAttribute(tip, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const mat = new THREE.ShaderMaterial({
    name: snow ? 'snow' : 'rain',
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uAmount: { value: 0 },
      uWind: { value: new THREE.Vector2(0.5, 0.2) },
      uColor: { value: new THREE.Color(snow ? 0xffffff : 0xbfd4ea) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCam; uniform float uAmount; uniform vec2 uWind;
      attribute float aTip; varying float vA;
      void main() {
        float speed = ${snow ? '1.6' : '17.0'};
        vec3 p = position;
        p.y = mod(p.y - uTime * speed, ${BOX.toFixed(1)});
        p.xz += uWind * (${BOX.toFixed(1)} - p.y) * ${snow ? '0.25' : '0.08'};
        ${snow ? 'p.x += sin(uTime * 1.3 + position.z) * 0.6; p.z += cos(uTime * 1.1 + position.x) * 0.6;' : ''}
        vec3 w;
        w.xz = uCam.xz + mod(p.xz - uCam.xz, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
        w.y = uCam.y - ${(BOX / 2 - 6).toFixed(1)} + p.y;
        ${snow ? '' : 'w.y += aTip * 0.9; w.xz += aTip * uWind * 0.07;'}
        // 数量控制：丢弃一部分粒子
        float keep = step(fract(position.x * 12.9898 + position.z * 78.233), uAmount);
        vA = keep * smoothstep(0.0, 4.0, p.y) * smoothstep(${BOX.toFixed(1)}, ${(BOX - 6).toFixed(1)}, p.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        ${snow ? 'gl_PointSize = keep * 3.0 * (30.0 / max(1.0, length(w - uCam)));' : ''}
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vA;
      void main() {
        if (vA <= 0.01) discard;
        ${snow ? 'vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25) discard;' : ''}
        gl_FragColor = vec4(uColor, vA * ${snow ? '0.9' : '0.45'});
      }`,
  });
  const obj = snow ? new THREE.Points(g, mat) : new THREE.LineSegments(g, mat);
  obj.frustumCulled = false;
  obj.renderOrder = 5;
  return obj;
}

const BOLT_SEGS = 22;
const BOLT_VERTS = (BOLT_SEGS + 6) * 2;

export class WeatherFx {
  /** 闪电雷柱（主干 + 一条分叉），复用一个 LineSegments */
  private bolt: THREE.LineSegments;
  private boltLife = 0;
  /** 避雷塔塔顶等优先落点（世界坐标） */
  targets: readonly THREE.Vector3[] = [];
  /** 落雷回调：距离相机的水平距离（米） */
  onStrike: ((dist: number) => void) | null = null;
  /** 中档以上画质才绘制雷柱 */
  boltsEnabled = true;
  /** 最近一次落点（测试 / 调试用） */
  readonly lastStrike = new THREE.Vector3();
  readonly group = new THREE.Group();
  private rain: THREE.LineSegments | THREE.Points;
  private snow: THREE.Points | THREE.LineSegments;
  private lightningTimer = 4;
  /** 当前闪电强度（0–1），由 Sky 叠加到光照与后处理闪白 */
  flash = 0;

  constructor(particles: number) {
    this.rain = precipitation(particles, false);
    this.snow = precipitation(Math.floor(particles / 2), true);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOLT_VERTS * 3), 3));
    bg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.bolt = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: 0xeef4ff, transparent: true, fog: false, depthWrite: false }));
    this.bolt.frustumCulled = false;
    this.bolt.visible = false;
    this.bolt.renderOrder = 6;
    this.group.add(this.rain, this.snow, this.bolt);
    this.group.name = 'weather-fx';
  }

  update(dt: number, time: number, cam: THREE.Vector3, rain: number, snow: number, wind: THREE.Vector2, lightning: number, rnd: () => number): void {
    for (const [o, amt] of [
      [this.rain, rain],
      [this.snow, snow],
    ] as const) {
      const u = (o.material as THREE.ShaderMaterial).uniforms;
      u.uTime!.value = time;
      (u.uCam!.value as THREE.Vector3).copy(cam);
      u.uAmount!.value = amt;
      (u.uWind!.value as THREE.Vector2).copy(wind);
      o.visible = amt > 0.01;
    }
    // 闪电：随机间隔 4–14 秒，双闪
    this.flash = Math.max(0, this.flash - dt * 3.5);
    if (lightning > 0.5) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        const double = this.lightningTimer > -1 && this.boltLife > 0;
        this.flash = 1;
        if (!double) {
          this.strike(cam, rnd);
          signalLightning(Math.hypot(this.lastStrike.x - cam.x, this.lastStrike.z - cam.z));
        }
        else this.boltLife = 0.22;
        this.lightningTimer = rnd() < 0.3 ? 0.18 : 4 + rnd() * 10;
      }
    }
    if (this.boltLife > 0) {
      this.boltLife -= dt;
      const m = this.bolt.material as THREE.LineBasicMaterial;
      m.opacity = Math.max(0, Math.min(1, this.boltLife / 0.12)) * (0.75 + 0.25 * Math.sin(time * 90));
      this.bolt.visible = this.boltLife > 0;
    }
  }

  /** 选落点并生成折线雷柱；返回水平距离 */
  strike(cam: THREE.Vector3, rnd: () => number): number {
    const near = this.targets.filter((t) => {
      const d = Math.hypot(t.x - cam.x, t.z - cam.z);
      return d >= 40 && d <= 320;
    });
    const p = this.lastStrike;
    if (near.length && rnd() < 0.6) {
      p.copy(near[Math.floor(rnd() * near.length)]!);
    } else {
      const a = rnd() * Math.PI * 2;
      const r = 80 + rnd() * 170;
      p.set(cam.x + Math.cos(a) * r, Math.max(0, cam.y - 20), cam.z + Math.sin(a) * r);
    }
    const dist = Math.hypot(p.x - cam.x, p.z - cam.z);
    if (this.boltsEnabled) {
      const pos = (this.bolt.geometry.getAttribute('position') as THREE.BufferAttribute);
      const arr = pos.array as Float32Array;
      arr.fill(0);
      const top = p.y + 160;
      let x = p.x + (rnd() - 0.5) * 30;
      let z = p.z + (rnd() - 0.5) * 30;
      let k = 0;
      let branchAt: THREE.Vector3 | null = null;
      for (let i = 0; i < BOLT_SEGS; i++) {
        const t0 = i / BOLT_SEGS;
        const t1 = (i + 1) / BOLT_SEGS;
        const y0 = top + (p.y - top) * t0;
        const y1 = top + (p.y - top) * t1;
        // 越往下越收拢到落点
        const nx = i === BOLT_SEGS - 1 ? p.x : x + (p.x - x) / (BOLT_SEGS - i) + (rnd() - 0.5) * 9;
        const nz = i === BOLT_SEGS - 1 ? p.z : z + (p.z - z) / (BOLT_SEGS - i) + (rnd() - 0.5) * 9;
        arr.set([x, y0, z, nx, y1, nz], k);
        k += 6;
        if (i === 7) branchAt = new THREE.Vector3(nx, y1, nz);
        x = nx;
        z = nz;
      }
      if (branchAt) {
        const dir = rnd() * Math.PI * 2;
        let bx = branchAt.x;
        let by = branchAt.y;
        let bz = branchAt.z;
        for (let i = 0; i < 6; i++) {
          const nx = bx + Math.cos(dir) * 6 + (rnd() - 0.5) * 5;
          const nz = bz + Math.sin(dir) * 6 + (rnd() - 0.5) * 5;
          const ny = by - 7 - rnd() * 4;
          arr.set([bx, by, bz, nx, ny, nz], k);
          k += 6;
          bx = nx;
          by = ny;
          bz = nz;
        }
      }
      pos.needsUpdate = true;
      this.bolt.visible = true;
      this.boltLife = 0.35;
    }
    this.onStrike?.(dist);
    return dist;
  }

  dispose(): void {
    for (const o of [this.rain, this.snow, this.bolt]) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  }
}
