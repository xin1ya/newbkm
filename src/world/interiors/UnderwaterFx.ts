/**
 * M3-18 · 海底房间的氛围表现（世界层）。房间配置 RoomConfig.underwater 打开。
 *
 * - 礁岩墙：沿四面墙堆叠的礁石（遮住方盒墙体，剖切时随墙一起隐藏）+ 墙脚碎石；
 * - 光束：从水面斜射下来的 6–10 道加色光柱，缓慢摆动、明暗呼吸；
 * - 焦散：贴地的一层加色 Shader（两层滚动的网状光纹相乘），随时间流动；
 * - 水面：头顶一张发亮的波纹平面（镜头仰视时看到「天」）；
 * - 气泡：InstancedMesh，从海底喷口 / 海带根部不断冒出，左右摇摆上升，到水面附近重生；
 * - 悬浮微粒：Points，缓慢漂移；
 * - 海带：分段层级（每节相对上一节摆动，叠加成柔软的弯曲）+ 叶片；海葵：一圈触手随水流摆；
 * - 出口：上浮光柱（surfaceAt）= 一束亮青色光柱 + 环形气泡；通道出口 = 发光的礁石拱门。
 * 只负责显示；碰撞仍由房间墙体与家具负责。
 */
import * as THREE from 'three';
import { createToonMaterial } from '@/render';
import type { RoomConfig } from '@/config/interiors/types';

const BUBBLES = 160;
const MOTES = 260;

interface Bubble {
  x: number;
  z: number;
  y: number;
  speed: number;
  phase: number;
  size: number;
  /** 所属喷口 */
  vent: number;
}

interface Sway {
  obj: THREE.Object3D;
  axis: 'x' | 'z';
  amp: number;
  phase: number;
  freq: number;
}

export class UnderwaterFx {
  readonly group = new THREE.Group();
  /** 贴墙的礁岩：key = 墙（0 北 / 1 西 / 2 东 / 3 南），供剖切隐藏 */
  readonly wallRocks: THREE.Group[] = [];
  private mats: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private geos: THREE.BufferGeometry[] = [];
  /** mesh = 倾斜组（绕 z 斜射 + 摆动），其父组绕 y 朝向镜头 */
  private rays: Array<{ mesh: THREE.Object3D; mat: THREE.MeshBasicMaterial; base: number; phase: number }> = [];
  private caustic: THREE.ShaderMaterial | null = null;
  private surface: THREE.ShaderMaterial | null = null;
  private bubbles: Bubble[] = [];
  private bubbleMesh: THREE.InstancedMesh | null = null;
  private motes: THREE.Points | null = null;
  private moteBase: Float32Array | null = null;
  private sway: Sway[] = [];
  private columns: Array<{ mat: THREE.MeshBasicMaterial; ring: THREE.Mesh }> = [];
  private vents: Array<[number, number]> = [];
  private time = 0;
  private readonly dummy = new THREE.Object3D();
  private readonly w: number;
  private readonly d: number;
  private readonly h: number;

  constructor(private readonly room: RoomConfig) {
    this.group.name = 'underwater-fx';
    [this.w, this.d, this.h] = room.size;
    const dark = room.lighting === 'abyss';
    this.buildRocks(room.underwater?.rocks ?? 0.8, dark);
    this.buildRays(dark);
    this.buildCaustics(dark);
    this.buildSurface(dark);
    this.buildFlora();
    this.buildExits();
    this.buildBubbles();
    this.buildMotes(dark);
  }

  /** 雾：水下能见度（abyss 更浓） */
  fog(): THREE.FogExp2 {
    const dark = this.room.lighting === 'abyss';
    return new THREE.FogExp2(dark ? '#06223a' : '#0f5a72', dark ? 0.06 : 0.035);
  }

  update(dt: number, camera: THREE.Camera): void {
    this.time += dt;
    const t = this.time;
    for (const r of this.rays) {
      r.mat.opacity = r.base * (0.65 + 0.35 * Math.sin(t * 0.7 + r.phase));
      r.mesh.rotation.z = 0.18 + Math.sin(t * 0.25 + r.phase) * 0.05;
      // 光柱是一张面片：始终绕竖轴朝向镜头（体积感）
      const p = r.mesh.parent!.position;
      r.mesh.parent!.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    }
    if (this.caustic) this.caustic.uniforms.uTime!.value = t;
    if (this.surface) this.surface.uniforms.uTime!.value = t;
    for (const s of this.sway) s.obj.rotation[s.axis] = Math.sin(t * s.freq + s.phase) * s.amp;
    // 气泡：上升 + 左右摆；到水面附近重生到喷口
    const mesh = this.bubbleMesh;
    if (mesh) {
      for (let i = 0; i < this.bubbles.length; i++) {
        const b = this.bubbles[i]!;
        b.y += b.speed * dt;
        if (b.y > this.h + 1.5) this.respawnBubble(b, false);
        const wob = Math.sin(t * 3 + b.phase) * 0.12 * Math.min(1, b.y / 2);
        this.dummy.position.set(b.x + wob, b.y, b.z + Math.cos(t * 2.3 + b.phase) * 0.08);
        const s = b.size * (1 + b.y * 0.05);
        this.dummy.scale.set(s, s * (0.85 + Math.sin(t * 9 + b.phase) * 0.1), s);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.motes && this.moteBase) {
      const pos = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
      const a = pos.array as Float32Array;
      for (let i = 0; i < MOTES; i++) {
        const k = i * 3;
        a[k] = this.moteBase[k]! + Math.sin(t * 0.21 + i) * 0.6;
        a[k + 1] = this.moteBase[k + 1]! + Math.sin(t * 0.33 + i * 1.7) * 0.4;
        a[k + 2] = this.moteBase[k + 2]! + Math.cos(t * 0.17 + i * 0.9) * 0.6;
      }
      pos.needsUpdate = true;
    }
    for (const [i, c] of this.columns.entries()) {
      c.mat.opacity = 0.22 + Math.sin(t * 1.6 + i) * 0.06;
      c.ring.rotation.z = t * 0.6;
      c.ring.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.06);
    }
  }

  /** 剖切：镜头所在一侧墙前的礁岩跟着墙一起隐藏 */
  updateCutaway(cam: THREE.Vector3): void {
    const w = this.w / 2;
    const d = this.d / 2;
    const hide = [cam.z < -d + 0.5, cam.x < -w + 0.5, cam.x > w - 0.5, cam.z > d - 0.5];
    for (const [i, g] of this.wallRocks.entries()) g.visible = !hide[i];
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const t of this.textures) t.dispose();
    this.textures = [];
    this.geos = [];
    this.mats = [];
  }

  // ———————————————————— 构建 ————————————————————

  private toon(color: string, extra: Parameters<typeof createToonMaterial>[0] = {}): THREE.MeshToonMaterial {
    const m = createToonMaterial({ kind: 'scene', color, ...extra });
    this.mats.push(m);
    return m;
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }

  private rand(i: number): number {
    const s = Math.sin(i * 127.1 + this.w * 311.7 + this.d * 74.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /** 礁岩墙：沿墙每 ~1.6 m 一堆，2–3 层，越往上越小；墙脚散落碎石 */
  private buildRocks(density: number, dark: boolean): void {
    const rockCols = dark ? ['#2a3a48', '#34465a', '#22303c'] : ['#4a6a6a', '#5a7a74', '#3e5a5e'];
    const mats = rockCols.map((c) => this.toon(c));
    const moss = this.toon(dark ? '#2a5a5a' : '#4a8a5a');
    const rockGeo = this.geo(new THREE.DodecahedronGeometry(1, 0));
    const w = this.w / 2;
    const d = this.d / 2;
    const walls: Array<{ a: [number, number]; b: [number, number]; n: [number, number] }> = [
      { a: [-w, -d], b: [w, -d], n: [0, 1] },
      { a: [-w, -d], b: [-w, d], n: [1, 0] },
      { a: [w, -d], b: [w, d], n: [-1, 0] },
      { a: [-w, d], b: [w, d], n: [0, -1] },
    ];
    // 出口附近不堆（通道 / 上浮光柱要露出来）
    const exits = this.room.exits.map((e) => e.position);
    let seed = 0;
    for (const wall of walls) {
      const g = new THREE.Group();
      g.name = 'reef-wall';
      const len = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
      const n = Math.max(2, Math.round((len / 1.6) * density));
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const x = wall.a[0] + (wall.b[0] - wall.a[0]) * k;
        const z = wall.a[1] + (wall.b[1] - wall.a[1]) * k;
        if (exits.some(([ex, ez]) => Math.hypot(ex - x, ez - z) < 2.2)) continue;
        const layers = 2 + Math.round(this.rand(seed++) * 1.4);
        for (let L = 0; L < layers; L++) {
          const r = (1.15 - L * 0.28) * (0.8 + this.rand(seed++) * 0.5);
          const m = new THREE.Mesh(rockGeo, mats[(i + L) % mats.length]!);
          const inset = 0.25 + this.rand(seed++) * 0.5 - L * 0.15;
          m.position.set(x + wall.n[0] * inset + (this.rand(seed++) - 0.5) * 0.6, r * 0.55 + L * 0.95, z + wall.n[1] * inset + (this.rand(seed++) - 0.5) * 0.6);
          m.scale.set(r, r * (0.7 + this.rand(seed++) * 0.4), r);
          m.rotation.set(this.rand(seed++) * 3, this.rand(seed++) * 3, 0);
          m.castShadow = L === 0;
          m.receiveShadow = true;
          g.add(m);
          if (L === layers - 1 && this.rand(seed++) > 0.55) {
            const mm = new THREE.Mesh(rockGeo, moss);
            mm.position.copy(m.position).add(new THREE.Vector3(0, r * 0.55, 0));
            mm.scale.set(r * 0.6, r * 0.18, r * 0.6);
            g.add(mm);
          }
        }
        // 墙脚碎石
        if (this.rand(seed++) > 0.4) {
          const s = new THREE.Mesh(rockGeo, mats[2]!);
          const r = 0.18 + this.rand(seed++) * 0.2;
          s.position.set(x + wall.n[0] * (1.4 + this.rand(seed++)), r * 0.5, z + wall.n[1] * (1.4 + this.rand(seed++)));
          s.scale.setScalar(r);
          g.add(s);
        }
      }
      this.wallRocks.push(g);
      this.group.add(g);
    }
  }

  /** 竖向渐变（上亮下暗，两侧淡出）的光柱纹理 */
  private rayTexture(): THREE.DataTexture {
    const W = 16;
    const H = 64;
    const data = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / (W - 1);
        const v = y / (H - 1);
        const side = Math.pow(Math.sin(u * Math.PI), 1.6);
        const a = side * Math.pow(v, 1.3);
        const i = (y * W + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.round(a * 255);
      }
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    this.textures.push(t);
    return t;
  }

  private buildRays(dark: boolean): void {
    const tex = this.rayTexture();
    const n = dark ? 5 : Math.max(6, Math.round((this.w * this.d) / 70));
    const top = this.h + 4;
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: dark ? '#6ab8e8' : '#c8f4ff',
        map: tex,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      });
      this.mats.push(mat);
      const width = 1.2 + this.rand(i + 50) * 2.2;
      const mesh = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(width, top)), mat);
      mesh.position.y = top / 2;
      mesh.renderOrder = 5;
      const holder = new THREE.Group();
      holder.position.set((this.rand(i + 10) - 0.5) * this.w * 0.85, 0, (this.rand(i + 20) - 0.5) * this.d * 0.85);
      // 斜射：整束向一侧倾斜
      const tilt = new THREE.Group();
      tilt.rotation.z = 0.18;
      tilt.add(mesh);
      holder.add(tilt);
      this.group.add(holder);
      this.rays.push({ mesh: tilt, mat, base: (dark ? 0.14 : 0.22) + this.rand(i + 30) * 0.12, phase: i * 1.37 });
    }
  }

  private buildCaustics(dark: boolean): void {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(dark ? '#3a7ab8' : '#9af0ff') },
        uStrength: { value: dark ? 0.22 : 0.42 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vXZ;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vXZ = wp.xz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uStrength;
        varying vec2 vXZ;
        // 网状焦散：两层扭曲的 |sin| 网格相乘，取细亮线
        float layer(vec2 p, float t) {
          p += vec2(sin(p.y * 0.9 + t * 0.7), cos(p.x * 0.8 - t * 0.6)) * 0.6;
          vec2 s = abs(sin(p));
          float v = 1.0 - min(s.x, s.y);
          return pow(v, 6.0);
        }
        void main() {
          vec2 p = vXZ * 1.3;
          float c = layer(p, uTime) * 0.6 + layer(p * 1.7 + 3.1, -uTime * 1.2) * 0.5;
          gl_FragColor = vec4(uColor * c * uStrength, 1.0);
        }
      `,
    });
    this.caustic = mat;
    this.mats.push(mat);
    const plane = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(this.w, this.d).rotateX(-Math.PI / 2)), mat);
    plane.position.y = 0.025;
    plane.renderOrder = 2;
    plane.name = 'caustics';
    this.group.add(plane);
  }

  private buildSurface(dark: boolean): void {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color(dark ? '#06223a' : '#1a7a9a') }, uLight: { value: new THREE.Color(dark ? '#4a8ac8' : '#d8fbff') } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uDeep; uniform vec3 uLight; varying vec2 vUv;
        void main() {
          vec2 p = vUv * 18.0;
          float w = sin(p.x + uTime * 0.8 + sin(p.y * 0.7 + uTime)) * sin(p.y * 1.1 - uTime * 0.6);
          float glow = smoothstep(0.2, 1.0, w) * 0.7 + 0.25;
          float edge = smoothstep(0.0, 0.35, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
          gl_FragColor = vec4(mix(uDeep, uLight, glow), 0.75 * edge);
        }
      `,
    });
    this.surface = mat;
    this.mats.push(mat);
    const plane = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(this.w * 2.5, this.d * 2.5).rotateX(Math.PI / 2)), mat);
    plane.position.y = this.h + 6;
    plane.name = 'water-surface';
    this.group.add(plane);
  }

  /** 海带（分段层级摆动）与海葵（触手） */
  private buildFlora(): void {
    const kelpCols = ['#3f8a4a', '#4f9a3e', '#2f7a52'];
    const kelpMats = kelpCols.map((c) => this.toon(c, { side: THREE.DoubleSide }));
    const segGeo = this.geo(new THREE.CylinderGeometry(0.035, 0.05, 1, 5).translate(0, 0.5, 0));
    const leafGeo = this.geo(new THREE.PlaneGeometry(0.28, 0.75).translate(0.16, 0.3, 0));
    let k = 0;
    for (const f of this.room.furniture) {
      if (f.type === 'kelp') {
        const [fw, fh, fd] = f.size ?? [1.2, 3.2, 1.2];
        const stalks = 3 + Math.round(this.rand(k + 3) * 3);
        for (let s = 0; s < stalks; s++) {
          const root = new THREE.Group();
          root.position.set(f.position[0] + (this.rand(k * 7 + s) - 0.5) * fw, 0.05, f.position[1] + (this.rand(k * 11 + s) - 0.5) * fd);
          root.rotation.y = this.rand(k * 13 + s) * Math.PI * 2;
          const segs = 6;
          const segLen = (fh * (0.7 + this.rand(k * 17 + s) * 0.5)) / segs;
          let parent: THREE.Object3D = root;
          const mat = kelpMats[(k + s) % kelpMats.length]!;
          for (let i = 0; i < segs; i++) {
            const joint = new THREE.Group();
            joint.position.y = i === 0 ? 0 : segLen;
            const seg = new THREE.Mesh(segGeo, mat);
            seg.scale.set(1, segLen, 1);
            joint.add(seg);
            // 叶片：交替左右
            const leaf = new THREE.Mesh(leafGeo, mat);
            leaf.position.y = segLen * 0.4;
            leaf.rotation.set(0.2, i % 2 ? Math.PI : 0, (i % 2 ? -1 : 1) * 0.5);
            leaf.scale.setScalar(0.8 + i * 0.06);
            joint.add(leaf);
            parent.add(joint);
            this.sway.push({ obj: joint, axis: 'z', amp: 0.05 + i * 0.012, phase: s * 0.9 + k + i * 0.45, freq: 0.9 });
            this.sway.push({ obj: joint, axis: 'x', amp: 0.03 + i * 0.008, phase: s * 1.3 + k * 0.7 + i * 0.3, freq: 0.63 });
            parent = joint;
          }
          this.group.add(root);
        }
        this.vents.push([f.position[0], f.position[1]]);
        k++;
      } else if (f.type === 'anemone') {
        const col = f.color ?? '#e86aa8';
        const tip = f.accent ?? '#ffd8ec';
        const body = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.22, 0.3, 0.3, 10)), this.toon(col));
        body.position.set(f.position[0], 0.15, f.position[1]);
        this.group.add(body);
        const tMat = this.toon(col);
        const tipMat = this.toon(tip, { emissive: tip, emissiveIntensity: 0.35 });
        const tentGeo = this.geo(new THREE.CylinderGeometry(0.015, 0.04, 0.45, 5).translate(0, 0.225, 0));
        const tipGeo = this.geo(new THREE.SphereGeometry(0.035, 6, 5));
        const n = 14;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const pv = new THREE.Group();
          pv.position.set(f.position[0] + Math.cos(a) * 0.17, 0.3, f.position[1] + Math.sin(a) * 0.17);
          pv.rotation.y = -a;
          const bend = new THREE.Group();
          bend.rotation.z = -0.5;
          const t = new THREE.Mesh(tentGeo, tMat);
          const tp = new THREE.Mesh(tipGeo, tipMat);
          tp.position.y = 0.45;
          bend.add(t, tp);
          pv.add(bend);
          this.group.add(pv);
          this.sway.push({ obj: bend, axis: 'x', amp: 0.25, phase: i * 0.5 + k, freq: 1.6 });
        }
        k++;
      } else if (f.type === 'clam' || f.type === 'ruin' || f.type === 'coral') {
        // 气泡喷口：一部分珊瑚 / 残柱底部也冒泡
        if (this.rand(k + 77) > 0.5) this.vents.push([f.position[0] + 0.4, f.position[1] + 0.3]);
        k++;
      }
    }
    // 没有任何喷口时随机放几个
    for (let i = this.vents.length; i < 6; i++) this.vents.push([(this.rand(i + 200) - 0.5) * this.w * 0.8, (this.rand(i + 300) - 0.5) * this.d * 0.8]);
  }

  /** 出口表现：上浮光柱 / 通道拱门 */
  private buildExits(): void {
    for (const e of this.room.exits) {
      const [x, z] = e.position;
      if (e.surfaceAt) {
        const mat = new THREE.MeshBasicMaterial({ color: '#bff8ff', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
        this.mats.push(mat);
        const col = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.9, 1.3, this.h + 6, 20, 1, true)), mat);
        col.position.set(x, (this.h + 6) / 2, z);
        col.renderOrder = 6;
        const ringMat = new THREE.MeshBasicMaterial({ color: '#e8ffff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
        this.mats.push(ringMat);
        const ring = new THREE.Mesh(this.geo(new THREE.RingGeometry(1.0, 1.25, 32).rotateX(-Math.PI / 2)), ringMat);
        ring.position.set(x, 0.05, z);
        this.group.add(col, ring);
        this.columns.push({ mat, ring });
        // 光柱里的气泡更密
        for (let i = 0; i < 3; i++) this.vents.push([x + (i - 1) * 0.4, z + ((i * 0.7) % 1) * 0.4]);
      } else {
        // 通道：两块立石 + 横石拱门，内侧发光
        const stone = this.toon('#5a6a6e');
        const glow = this.toon('#2a7a9a', { emissive: '#3ab8e0', emissiveIntensity: 0.6 });
        const onX = Math.abs(x) > Math.abs(z) * (this.w / this.d);
        const yaw = onX ? Math.PI / 2 : 0;
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        g.rotation.y = yaw;
        for (const s of [-1, 1]) {
          const p = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.6, 2.8, 0.7)), stone);
          p.position.set(s * 1.25, 1.4, 0);
          g.add(p);
        }
        const lintel = new THREE.Mesh(this.geo(new THREE.BoxGeometry(3.2, 0.5, 0.8)), stone);
        lintel.position.y = 3.0;
        const inner = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(1.9, 2.75)), glow);
        inner.position.set(0, 1.38, 0);
        g.add(lintel, inner);
        this.group.add(g);
      }
    }
  }

  private buildBubbles(): void {
    const mat = this.toon('#e8fbff', { transparent: true, opacity: 0.55, emissive: '#bff4ff', emissiveIntensity: 0.35 });
    const geo = this.geo(new THREE.SphereGeometry(1, 8, 6));
    const mesh = new THREE.InstancedMesh(geo, mat, BUBBLES);
    mesh.name = 'bubbles';
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    this.bubbleMesh = mesh;
    for (let i = 0; i < BUBBLES; i++) {
      const b: Bubble = { x: 0, z: 0, y: 0, speed: 0, phase: 0, size: 0, vent: 0 };
      this.respawnBubble(b, true, i);
      this.bubbles.push(b);
    }
    this.group.add(mesh);
  }

  private respawnBubble(b: Bubble, initial: boolean, seed = Math.floor(Math.random() * 1e6)): void {
    const v = this.vents[Math.floor(this.rand(seed + 1) * this.vents.length) % Math.max(1, this.vents.length)] ?? [0, 0];
    b.vent = seed;
    b.x = v[0] + (this.rand(seed + 2) - 0.5) * 0.5;
    b.z = v[1] + (this.rand(seed + 3) - 0.5) * 0.5;
    b.y = initial ? this.rand(seed + 4) * (this.h + 1) : 0.1;
    b.speed = 0.6 + this.rand(seed + 5) * 0.9;
    b.phase = this.rand(seed + 6) * 6.28;
    b.size = 0.03 + this.rand(seed + 7) * 0.07;
  }

  private buildMotes(dark: boolean): void {
    const pos = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) {
      pos[i * 3] = (this.rand(i + 1000) - 0.5) * this.w;
      pos[i * 3 + 1] = 0.3 + this.rand(i + 2000) * (this.h + 2);
      pos[i * 3 + 2] = (this.rand(i + 3000) - 0.5) * this.d;
    }
    this.moteBase = pos.slice();
    const geo = this.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: dark ? '#7ab8e8' : '#dff8ff', size: 0.06, transparent: true, opacity: 0.6, depthWrite: false, sizeAttenuation: true });
    this.mats.push(mat);
    this.motes = new THREE.Points(geo, mat);
    this.motes.frustumCulled = false;
    this.motes.name = 'motes';
    this.group.add(this.motes);
  }
}
