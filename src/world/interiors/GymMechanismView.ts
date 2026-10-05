/**
 * M3-15 · 道馆 5–8 馆内机关的场景表现与碰撞（世界层）。逻辑见 systems/puzzles/gymMechanism.ts。
 *
 * - 隔墙：metal（雷霆：钢板 + 黄黑警示条 + 顶部导线）、stone（晨辉：砂岩 + 金色压顶）、ice（霜凝：半透明冰块 + 积雪顶）；
 * - 闸门：
 *   - electric：两根绝缘柱 + 三道发光电弧条，关闭时闪烁，打开时电弧熄灭、柱灯转绿；
 *   - sunlight / shadow：半透明金色光幕（带光束）/ 紫色影幕（带星点），打开时淡出；
 *   - wind：关闭 = 深谷，打开 = 风托起的半透明浮板桥，桥面气流条纹沿桥向流动；
 * - 深谷：深蓝谷底 + 石质边沿 + 缓慢漂移的云雾；冰面：亮蓝冰板 + 反光纹；
 * - 开关：lever（拉杆台，档位灯）、sundial（日晷：晷针 + 日 / 月指示）、fan（风扇台：转动的叶片，可按档位转向）；
 * - 晨辉道馆的昼夜：暖金 / 冷蓝两盏顶灯随状态渐变。
 * - M3-16：crystal（幻月：紫水晶墙 + 发光棱）、grave（幽魄：苔藓墓墙 + 墓碑压顶）；spirit 灵火墙（一排飘动的鬼火，打开时散去）；
 *   orb 念力水晶球（三色档位，悬浮自转）、lamp 灯台（点亮时带真实点光源；3 档烛台按档位变色）；
 *   传送镜：镜框 + 发光镜面 + 地面法阵，金框镜顶部的宝石随水晶球变色；传送时镜面闪光（flashMirror）。
 * - 碰撞：当前所有阻挡矩形（组 gym-mech）在每次拨动后重建；开关台座单独一组。
 */
import * as THREE from 'three';
import { createToonMaterial } from '@/render';
import type { CollisionWorld } from '../collision/CollisionWorld';
import { blockingRects, cycleSwitch, gateOpen, gatesClosingOn, initialState, switchVar, type GymMechanismConfig, type MechGate, type MechMirror, type MechState, type MechSwitch, type MechWall, type Rect } from '@/systems/puzzles/gymMechanism';

export const GYM_MECH_GROUP = 'gym-mech';
const SWITCH_GROUP = 'gym-mech-switch';

interface GateView {
  def: MechGate;
  group: THREE.Group;
  /** 打开程度 0..1（动画） */
  open: number;
  parts: { bars?: THREE.Mesh[]; lamps?: THREE.Mesh[]; panel?: THREE.Mesh; extras?: THREE.Object3D[]; bridge?: THREE.Group; streaks?: THREE.Mesh[] };
}

interface SwitchView {
  def: MechSwitch;
  group: THREE.Group;
  lever?: THREE.Object3D;
  lamp?: THREE.Mesh;
  sun?: THREE.Object3D;
  moon?: THREE.Object3D;
  rotor?: THREE.Object3D;
  head?: THREE.Object3D;
  orb?: THREE.Mesh;
  flame?: THREE.Mesh;
  light?: THREE.PointLight;
  spin: number;
}

interface MirrorView {
  def: MechMirror;
  glass: THREE.Mesh;
  pad: THREE.Mesh;
  gem?: THREE.Mesh | undefined;
  flash: number;
}

/** 水晶球 / 烛台各档位的颜色（与镜顶宝石一致） */
const ORB_COLORS = ['#c86ad8', '#6a9ad8', '#e8c870'];
const CANDLE_COLORS = ['#9a7aff', '#7ad8ff', '#ffd27a'];

const rectCenter = (r: Rect): [number, number, number, number] => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2, r[2] - r[0], r[3] - r[1]];

export class GymMechanismView {
  readonly group = new THREE.Group();
  state: MechState;
  private gates: GateView[] = [];
  private switches: SwitchView[] = [];
  private clouds: Array<{ mesh: THREE.Mesh; rect: Rect; phase: number }> = [];
  private mats = new Map<string, THREE.Material>();
  private time = 0;
  private dayLight: THREE.PointLight | null = null;
  private nightLight: THREE.PointLight | null = null;
  private sunMix = 0;
  private mirrors: MirrorView[] = [];

  constructor(
    readonly cfg: GymMechanismConfig,
    private readonly collision: CollisionWorld,
    night = false,
  ) {
    this.group.name = 'gym-mechanism';
    this.state = initialState(cfg, night);
    this.build();
    this.applyCollision();
    for (const g of this.gates) g.open = gateOpen(g.def, this.state) ? 1 : 0;
    if (cfg.fromClock) this.sunMix = this.state[cfg.fromClock] ?? 0;
    this.update(0);
  }

  /** 拨动开关：返回 null 表示被拒绝（会把玩家关进闸门），否则返回新档位名 */
  toggle(id: string, px: number, pz: number): { name: string; opened: string[]; closed: string[] } | null {
    const s = this.cfg.switches.find((q) => q.id === id);
    if (!s) return null;
    const next = cycleSwitch(this.cfg, this.state, id);
    if (gatesClosingOn(this.cfg, this.state, next, px, pz).length) return null;
    const opened = this.cfg.gates.filter((g) => !gateOpen(g, this.state) && gateOpen(g, next)).map((g) => g.id);
    const closed = this.cfg.gates.filter((g) => gateOpen(g, this.state) && !gateOpen(g, next)).map((g) => g.id);
    this.state = next;
    // 碰撞立即生效（打开的门马上能走；关上的门马上挡住）
    this.applyCollision();
    const sv = this.switches.find((q) => q.def.id === id);
    if (sv) sv.spin = 1;
    const v = this.state[switchVar(s)] ?? 0;
    return { name: s.stateNames?.[v] ?? `第 ${v + 1} 档`, opened, closed };
  }

  /** 传送时让镜面闪一下 */
  flashMirror(id: string): void {
    const m = this.mirrors.find((q) => q.def.id === id);
    if (m) m.flash = 1;
  }

  value(id: string): number {
    const s = this.cfg.switches.find((q) => q.id === id);
    return s ? (this.state[switchVar(s)] ?? 0) : 0;
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    for (const g of this.gates) {
      const target = gateOpen(g.def, this.state) ? 1 : 0;
      g.open += Math.sign(target - g.open) * Math.min(Math.abs(target - g.open), dt * 2.2);
      const o = g.open;
      const p = g.parts;
      switch (g.def.style) {
        case 'electric': {
          for (const [i, b] of (p.bars ?? []).entries()) {
            b.visible = o < 0.5;
            const m = b.material as THREE.MeshToonMaterial;
            m.emissiveIntensity = 1.2 + Math.sin(t * 31 + i * 2.1) * 0.5 + (Math.sin(t * 7.3 + i) > 0.92 ? 1.2 : 0);
            b.scale.y = 1 + Math.sin(t * 40 + i * 3) * 0.25;
          }
          for (const l of p.lamps ?? []) (l.material as THREE.MeshToonMaterial).emissive.set(o > 0.5 ? '#3ad86a' : '#ffd23a');
          break;
        }
        case 'sunlight':
        case 'shadow': {
          if (p.panel) {
            const m = p.panel.material as THREE.MeshToonMaterial;
            m.opacity = (1 - o) * (0.55 + Math.sin(t * 2.2) * 0.06);
            p.panel.visible = o < 0.98;
          }
          for (const [i, e] of (p.extras ?? []).entries()) {
            e.visible = o < 0.98;
            e.scale.setScalar(Math.max(0.01, 1 - o));
            if (g.def.style === 'sunlight') e.position.y = 1.4 + Math.sin(t * 1.7 + i) * 0.4;
            else e.rotation.y = t * 0.6 + i;
          }
          break;
        }
        case 'spirit': {
          for (const [i, e] of (p.extras ?? []).entries()) {
            e.visible = o < 0.98;
            const k = Math.max(0.01, 1 - o);
            e.scale.set(k * (1 + Math.sin(t * 9 + i * 1.7) * 0.15), k * (1.2 + Math.sin(t * 6 + i) * 0.25), k);
            e.position.y = 0.9 + ((i * 0.43) % 1) * 1.2 + Math.sin(t * 2.1 + i * 0.9) * 0.18 + o * 1.5;
          }
          if (p.panel) {
            (p.panel.material as THREE.MeshToonMaterial).opacity = (1 - o) * (0.22 + Math.sin(t * 3.1) * 0.05);
            p.panel.visible = o < 0.98;
          }
          break;
        }
        case 'wind': {
          if (p.bridge) {
            p.bridge.visible = o > 0.02;
            p.bridge.scale.set(1, Math.max(0.01, o), 1);
            p.bridge.position.y = (1 - o) * -0.4;
          }
          const [, , w, d] = rectCenter(g.def.rect);
          const alongX = w > d;
          const len = alongX ? w : d;
          for (const [i, s] of (p.streaks ?? []).entries()) {
            const k = (((t * 2.4 + i * 0.37) % 1) + 1) % 1;
            if (alongX) s.position.x = -len / 2 + k * len;
            else s.position.z = -len / 2 + k * len;
            (s.material as THREE.MeshToonMaterial).opacity = 0.5 * o * Math.sin(k * Math.PI);
          }
          break;
        }
      }
    }
    for (const s of this.switches) {
      const v = this.value(s.def.id);
      if (s.lever) s.lever.rotation.x += ((v ? 0.65 : -0.65) - s.lever.rotation.x) * Math.min(1, dt * 10);
      if (s.lamp) (s.lamp.material as THREE.MeshToonMaterial).emissive.set(v ? '#ffd23a' : '#d84a3a');
      if (s.sun && s.moon) {
        const k = THREE.MathUtils.clamp(this.sunMix, 0, 1);
        s.sun.scale.setScalar(Math.max(0.01, 1 - k));
        s.moon.scale.setScalar(Math.max(0.01, k));
        s.sun.rotation.y = t * 0.5;
        s.moon.position.y = 1.55 + Math.sin(t * 1.3) * 0.05;
      }
      if (s.rotor) {
        const aim = s.def.stateNames && s.def.stateNames.length === 2 && s.def.stateNames[0]!.startsWith('吹向');
        const spinning = aim || v > 0;
        s.rotor.rotation.z += dt * (spinning ? 14 : 0.4);
        if (s.head && aim) {
          const target = v ? -Math.PI / 2 : Math.PI / 2;
          s.head.rotation.y += (target - s.head.rotation.y) * Math.min(1, dt * 4);
        }
      }
      if (s.orb) {
        s.orb.rotation.y = t * 0.8;
        s.orb.position.y = 1.35 + Math.sin(t * 1.6) * 0.06;
        const m = s.orb.material as THREE.MeshToonMaterial;
        m.emissive.set(ORB_COLORS[v % ORB_COLORS.length]!);
        m.color.set(ORB_COLORS[v % ORB_COLORS.length]!);
      }
      if (s.flame) {
        const states = s.def.states ?? 2;
        const lit = states > 2 || v > 0;
        const col = states > 2 ? CANDLE_COLORS[v % CANDLE_COLORS.length]! : '#ffb85a';
        s.flame.visible = lit;
        s.flame.scale.set(1, 1 + Math.sin(t * 13 + s.def.position[0]) * 0.15, 1);
        (s.flame.material as THREE.MeshToonMaterial).emissive.set(col);
        if (s.light) {
          s.light.color.set(col);
          const target = lit ? (states > 2 ? 14 : 22) : 0;
          s.light.intensity += (target * (0.92 + Math.sin(t * 11 + s.def.position[1]) * 0.08) - s.light.intensity) * Math.min(1, dt * 6);
        }
      }
      if (s.spin > 0) {
        s.spin = Math.max(0, s.spin - dt * 2);
        s.group.position.y = Math.sin(s.spin * Math.PI) * 0.05;
      }
    }
    for (const c of this.clouds) {
      const [x0, z0, x1, z1] = c.rect;
      const k = ((t * 0.05 + c.phase) % 1 + 1) % 1;
      c.mesh.position.x = x0 + (x1 - x0) * k;
      c.mesh.position.z = THREE.MathUtils.lerp(z0, z1, 0.5 + Math.sin(t * 0.3 + c.phase * 6) * 0.35);
      (c.mesh.material as THREE.MeshToonMaterial).opacity = 0.35 * Math.sin(k * Math.PI);
    }
    for (const m of this.mirrors) {
      const gm = m.glass.material as THREE.MeshToonMaterial;
      m.flash = Math.max(0, m.flash - dt * 1.6);
      gm.emissiveIntensity = 0.55 + Math.sin(t * 2 + m.def.at[0]) * 0.12 + m.flash * 2.5;
      (m.pad.material as THREE.MeshToonMaterial).opacity = 0.45 + Math.sin(t * 3 + m.def.at[1]) * 0.15 + m.flash * 0.4;
      m.pad.rotation.z = t * 0.4;
      if (m.gem && m.def.variable) {
        const c = ORB_COLORS[(this.state[m.def.variable] ?? 0) % ORB_COLORS.length]!;
        (m.gem.material as THREE.MeshToonMaterial).emissive.set(c);
        m.gem.rotation.y = t * 1.5;
      }
    }
    if (this.cfg.fromClock && this.dayLight && this.nightLight) {
      const target = this.state[this.cfg.fromClock] ?? 0;
      this.sunMix += (target - this.sunMix) * Math.min(1, dt * 1.5);
      this.dayLight.intensity = 26 * (1 - this.sunMix);
      this.nightLight.intensity = 22 * this.sunMix;
    }
  }

  dispose(): void {
    this.collision.removeGroup(GYM_MECH_GROUP);
    this.collision.removeGroup(SWITCH_GROUP);
    this.group.removeFromParent();
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    for (const m of this.mats.values()) m.dispose();
    this.mats.clear();
  }

  // ———————————————————— 内部 ————————————————————

  private applyCollision(): void {
    this.collision.removeGroup(GYM_MECH_GROUP);
    for (const r of blockingRects(this.cfg, this.state)) {
      const [x, z, w, d] = rectCenter(r);
      this.collision.add(GYM_MECH_GROUP, { kind: 'box', x, z, hx: w / 2, hz: d / 2, yaw: 0, y0: -1, y1: 3.2, tag: 'gym-mech' });
    }
  }

  private mat(key: string, o: Parameters<typeof createToonMaterial>[0]): THREE.MeshToonMaterial {
    let m = this.mats.get(key) as THREE.MeshToonMaterial | undefined;
    if (!m) {
      m = createToonMaterial({ kind: 'scene', ...o });
      this.mats.set(key, m);
    }
    return m;
  }

  /** 每个闸门需要独立动画的材质（不共享） */
  private ownMat(o: Parameters<typeof createToonMaterial>[0]): THREE.MeshToonMaterial {
    const m = createToonMaterial({ kind: 'scene', ...o });
    this.mats.set(`own-${this.mats.size}`, m);
    return m;
  }

  private box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.group): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private build(): void {
    for (const r of this.cfg.ice ?? []) this.buildIce(r);
    for (const r of this.cfg.pits ?? []) this.buildPit(r);
    for (const w of this.cfg.walls) this.buildWall(w);
    for (const g of this.cfg.gates) this.gates.push(this.buildGate(g));
    for (const s of this.cfg.switches) this.switches.push(this.buildSwitch(s));
    for (const m of this.cfg.mirrors ?? []) this.mirrors.push(this.buildMirror(m));
    if (this.cfg.fromClock) {
      const [x, z] = [(this.cfg.bounds[0] + this.cfg.bounds[2]) / 2, (this.cfg.bounds[1] + this.cfg.bounds[3]) / 2];
      this.dayLight = new THREE.PointLight('#ffd38a', 26, 40, 1.2);
      this.dayLight.position.set(x, 6.5, z + 4);
      this.nightLight = new THREE.PointLight('#7a9cff', 0, 40, 1.2);
      this.nightLight.position.set(x, 6.5, z + 4);
      this.group.add(this.dayLight, this.nightLight);
    }
  }

  private buildWall(w: MechWall): void {
    const [x, z, wd, dd] = rectCenter(w.rect);
    const h = w.height ?? (w.style === 'ice' ? 1.4 : 2.4);
    if (w.style === 'metal') {
      this.box(wd, h, dd, this.mat('metal', { color: '#5a6272' }), x, h / 2, z);
      // 黄黑警示条
      const n = Math.max(1, Math.round(Math.max(wd, dd) / 0.8));
      const alongX = wd >= dd;
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n - 0.5;
        const m = this.mat(i % 2 ? 'hz-y' : 'hz-k', { color: i % 2 ? '#f2c230' : '#2a2a30' });
        this.box(alongX ? wd / n : dd + 0.04, 0.22, alongX ? dd + 0.04 : dd / n, m, alongX ? x + k * wd : x, h - 0.35, alongX ? z : z + k * dd);
      }
      // 顶部导线 + 绝缘子
      this.box(alongX ? wd : 0.08, 0.08, alongX ? 0.08 : dd, this.mat('wire', { color: '#c8a050', emissive: '#6a4a10', emissiveIntensity: 0.4 }), x, h + 0.22, z);
      const posts = Math.max(2, Math.round(Math.max(wd, dd) / 3));
      for (let i = 0; i <= posts; i++) {
        const k = i / posts - 0.5;
        const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.25, 6), this.mat('ins', { color: '#e8e2d0' }));
        ins.position.set(alongX ? x + k * wd : x, h + 0.1, alongX ? z : z + k * dd);
        this.group.add(ins);
      }
    } else if (w.style === 'stone') {
      this.box(wd, h, dd, this.mat('sand', { color: '#e2cfa2' }), x, h / 2, z);
      this.box(wd + 0.2, 0.18, dd + 0.2, this.mat('gold', { color: '#d8a83a', emissive: '#5a3a00', emissiveIntensity: 0.3 }), x, h + 0.09, z);
      this.box(wd + 0.12, 0.3, dd + 0.12, this.mat('sand-dark', { color: '#c4ae7e' }), x, 0.15, z);
    } else if (w.style === 'ice') {
      const m = this.mat('iceblock', { color: '#a8dcf0', transparent: true, opacity: 0.88, emissive: '#3a7aa8', emissiveIntensity: 0.18 });
      const blk = this.box(wd - 0.06, h, dd - 0.06, m, x, h / 2, z);
      blk.castShadow = false;
      this.box(wd - 0.02, 0.16, dd - 0.02, this.mat('snowcap', { color: '#f6fbff' }), x, h + 0.06, z);
      // 冰块内的裂纹高光
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.6, 0.04), this.mat('icecrack', { color: '#ffffff', emissive: '#bfe8ff', emissiveIntensity: 0.6 }));
      crack.position.set(x + wd * 0.18, h * 0.5, z + dd / 2 - 0.02);
      crack.rotation.z = 0.5;
      this.group.add(crack);
    } else if (w.style === 'crystal') {
      const blk = this.box(wd, h, dd, this.mat('crystal', { color: '#5a3a8a', transparent: true, opacity: 0.9, emissive: '#3a1a6a', emissiveIntensity: 0.35, specular: true }), x, h / 2, z);
      blk.castShadow = false;
      // 顶部棱晶簇 + 发光底棱
      const alongX = wd >= dd;
      const len = alongX ? wd : dd;
      const n = Math.max(1, Math.round(len / 1.4));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n - 0.5;
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.32 + ((i * 0.37) % 1) * 0.22), this.mat(i % 2 ? 'crys-a' : 'crys-b', { color: i % 2 ? '#c86ad8' : '#8a7ae8', emissive: i % 2 ? '#a03ac0' : '#5a4ac8', emissiveIntensity: 0.7 }));
        c.position.set(alongX ? x + k * wd : x, h + 0.18, alongX ? z : z + k * dd);
        c.scale.y = 1.6;
        c.rotation.y = i * 0.9;
        this.group.add(c);
      }
      this.box(wd + 0.06, 0.08, dd + 0.06, this.mat('crys-glow', { color: '#f0e0ff', emissive: '#c86ad8', emissiveIntensity: 1.1 }), x, 0.04, z);
    } else if (w.style === 'grave') {
      this.box(wd, h, dd, this.mat('grave', { color: '#4a4c58' }), x, h / 2, z);
      this.box(wd + 0.14, 0.16, dd + 0.14, this.mat('grave-cap', { color: '#6a6c78' }), x, h + 0.08, z);
      // 苔藓斑
      const alongX = wd >= dd;
      const len = alongX ? wd : dd;
      const n = Math.max(1, Math.round(len / 2.2));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.3) / n - 0.5;
        this.box(alongX ? 0.7 : dd + 0.03, 0.35, alongX ? dd + 0.03 : 0.7, this.mat('moss', { color: '#3a5a3a' }), alongX ? x + k * wd : x, 0.2 + ((i * 0.618) % 1) * (h - 0.5), alongX ? z : z + k * dd);
      }
      // 墙头小墓碑
      if (h > 1.6) {
        for (let i = 0; i < n; i++) {
          const k = (i + 0.5) / n - 0.5;
          const st = this.box(0.42, 0.5, 0.12, this.mat('tomb', { color: '#8a8c98' }), alongX ? x + k * wd : x, h + 0.41, alongX ? z : z + k * dd);
          if (!alongX) st.rotation.y = Math.PI / 2;
        }
      }
    } else {
      this.box(wd, h, dd, this.mat('cloudwall', { color: '#eef4ff' }), x, h / 2, z);
    }
  }

  private buildPit(r: Rect): void {
    const [x, z, w, d] = rectCenter(r);
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this.mat('pit', { color: '#13233e', emissive: '#0a1a3a', emissiveIntensity: 0.6 }));
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(x, 0.02, z);
    this.group.add(pit);
    // 谷沿：浅色石边（只描外框，视觉上像一道断崖）
    const rim = this.mat('rim', { color: '#c8d2e0' });
    this.box(w, 0.08, 0.12, rim, x, 0.04, r[1]);
    this.box(w, 0.08, 0.12, rim, x, 0.04, r[3]);
    this.box(0.12, 0.08, d, rim, r[0], 0.04, z);
    this.box(0.12, 0.08, d, rim, r[2], 0.04, z);
    // 漂移云雾
    const n = Math.max(1, Math.round((w * d) / 14));
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), this.ownMat({ color: '#e8f0ff', transparent: true, opacity: 0.3 }));
      c.scale.set(1.4, 0.18, 0.9);
      c.position.y = 0.06;
      this.group.add(c);
      this.clouds.push({ mesh: c, rect: r, phase: (i * 0.618) % 1 });
    }
  }

  private buildIce(r: Rect): void {
    const [x, z, w, d] = rectCenter(r);
    const ice = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this.mat('ice', { color: '#d4f0fa', emissive: '#5aa8d8', emissiveIntensity: 0.15, specular: true }));
    ice.rotation.x = -Math.PI / 2;
    ice.position.set(x, 0.015, z);
    ice.receiveShadow = true;
    this.group.add(ice);
    // 反光纹：几道斜向的亮条
    const shine = this.mat('ice-shine', { color: '#ffffff', transparent: true, opacity: 0.45 });
    for (let i = 0; i < Math.round(w * d / 10); i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 1.2 + ((i * 0.37) % 1) * 1.6), shine);
      s.rotation.x = -Math.PI / 2;
      s.rotation.z = 0.7;
      s.position.set(r[0] + ((i * 0.618 + 0.1) % 1) * w, 0.02, r[1] + ((i * 0.381 + 0.2) % 1) * d);
      this.group.add(s);
    }
    // 冰场边框
    const edge = this.mat('ice-edge', { color: '#8cc4e0' });
    this.box(w + 0.2, 0.06, 0.2, edge, x, 0.03, r[1]);
    this.box(w + 0.2, 0.06, 0.2, edge, x, 0.03, r[3]);
    this.box(0.2, 0.06, d, edge, r[0], 0.03, z);
    this.box(0.2, 0.06, d, edge, r[2], 0.03, z);
  }

  private buildGate(def: MechGate): GateView {
    const g = new THREE.Group();
    g.name = `mech-gate:${def.id}`;
    const [x, z, w, d] = rectCenter(def.rect);
    g.position.set(x, 0, z);
    this.group.add(g);
    const alongX = w >= d;
    const len = alongX ? w : d;
    const parts: GateView['parts'] = {};
    if (def.style === 'electric') {
      const post = this.mat('e-post', { color: '#3a3f4a' });
      parts.lamps = [];
      for (const s of [-1, 1]) {
        const px = alongX ? (s * len) / 2 : 0;
        const pz = alongX ? 0 : (s * len) / 2;
        this.box(0.32, 2.5, 0.32, post, px, 1.25, pz, g);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this.ownMat({ color: '#fff4c0', emissive: '#ffd23a', emissiveIntensity: 1.4 }));
        cap.position.set(px, 2.62, pz);
        g.add(cap);
        parts.lamps.push(cap);
        for (const y of [0.6, 1.3, 2.0]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 12), this.mat('e-ring', { color: '#e8e2d0' }));
          ring.rotation.x = Math.PI / 2;
          ring.position.set(px, y, pz);
          g.add(ring);
        }
      }
      parts.bars = [];
      for (const [i, y] of [0.6, 1.3, 2.0].entries()) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len - 0.3 : 0.07, 0.07, alongX ? 0.07 : len - 0.3), this.ownMat({ color: '#fff8c8', emissive: '#ffd23a', emissiveIntensity: 1.6 }));
        bar.position.y = y;
        bar.rotation[alongX ? 'x' : 'z'] = i * 0.4;
        g.add(bar);
        parts.bars.push(bar);
      }
    } else if (def.style === 'sunlight' || def.style === 'shadow') {
      const sun = def.style === 'sunlight';
      const h = 2.6;
      parts.panel = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? len : 0.12, h, alongX ? 0.12 : len),
        this.ownMat({ color: sun ? '#ffe08a' : '#3a2a6a', emissive: sun ? '#ffb020' : '#4a2a9a', emissiveIntensity: sun ? 0.9 : 0.5, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      );
      parts.panel.position.y = h / 2;
      parts.panel.renderOrder = 3;
      g.add(parts.panel);
      parts.extras = [];
      const n = Math.max(3, Math.round(len * 1.5));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n - 0.5;
        const e = sun
          ? new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.8, 0.06), this.ownMat({ color: '#fff6d0', emissive: '#ffd060', emissiveIntensity: 1.2, transparent: true, opacity: 0.8 }))
          : new THREE.Mesh(new THREE.OctahedronGeometry(0.09), this.ownMat({ color: '#d8ccff', emissive: '#8a6aff', emissiveIntensity: 1.2 }));
        e.position.set(alongX ? k * len : 0, sun ? 1.4 : 0.4 + ((i * 0.618) % 1) * 2, alongX ? 0 : k * len);
        g.add(e);
        parts.extras.push(e);
      }
      // 地面嵌条：日纹 / 月纹
      const strip = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.3, 0.03, alongX ? 0.3 : len), this.mat(sun ? 'sunstrip' : 'moonstrip', { color: sun ? '#d8a83a' : '#5a4a9a' }));
      strip.position.y = 0.015;
      g.add(strip);
    } else if (def.style === 'spirit') {
      parts.panel = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? len : 0.1, 2.4, alongX ? 0.1 : len),
        this.ownMat({ color: '#6a4ab8', emissive: '#4a2a9a', emissiveIntensity: 0.6, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
      );
      parts.panel.position.y = 1.2;
      parts.panel.renderOrder = 3;
      g.add(parts.panel);
      parts.extras = [];
      const n = Math.max(3, Math.round(len * 2));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n - 0.5;
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), this.ownMat({ color: '#d8ccff', emissive: '#8a6aff', emissiveIntensity: 1.5, transparent: true, opacity: 0.85 }));
        f.position.set(alongX ? k * len : 0, 1, alongX ? 0 : k * len);
        g.add(f);
        parts.extras.push(f);
      }
      // 地面封印纹
      const strip = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.3, 0.03, alongX ? 0.3 : len), this.mat('spiritstrip', { color: '#5a4a9a', emissive: '#3a2a7a', emissiveIntensity: 0.6 }));
      strip.position.y = 0.015;
      g.add(strip);
    } else {
      // wind：谷底 + 风桥
      const pit = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this.mat('pit', { color: '#13233e', emissive: '#0a1a3a', emissiveIntensity: 0.6 }));
      pit.rotation.x = -Math.PI / 2;
      pit.position.y = 0.02;
      g.add(pit);
      const bridge = new THREE.Group();
      const plank = this.mat('w-plank', { color: '#f2f6ff', transparent: true, opacity: 0.78, emissive: '#9ac8ff', emissiveIntensity: 0.35 });
      const slats = Math.max(2, Math.round(len / 0.7));
      for (let i = 0; i < slats; i++) {
        const k = (i + 0.5) / slats - 0.5;
        const s = new THREE.Mesh(new THREE.BoxGeometry(alongX ? (len / slats) * 0.86 : w - 0.15, 0.1, alongX ? d - 0.15 : (len / slats) * 0.86), plank);
        s.position.set(alongX ? k * len : 0, 0.06, alongX ? 0 : k * len);
        bridge.add(s);
      }
      // 两侧风绳栏
      const rope = this.mat('w-rope', { color: '#bfe0ff', emissive: '#6aa8ff', emissiveIntensity: 0.5 });
      for (const sd of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.05, 0.05, alongX ? 0.05 : len), rope);
        r.position.set(alongX ? 0 : (sd * w) / 2 - sd * 0.06, 0.8, alongX ? (sd * d) / 2 - sd * 0.06 : 0);
        bridge.add(r);
      }
      g.add(bridge);
      parts.bridge = bridge;
      parts.streaks = [];
      for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.9 : 0.04, 0.03, alongX ? 0.04 : 0.9), this.ownMat({ color: '#ffffff', transparent: true, opacity: 0.4 }));
        s.position.set(0, 0.22 + (i % 3) * 0.25, 0);
        if (alongX) s.position.z = ((i % 3) - 1) * d * 0.3;
        else s.position.x = ((i % 3) - 1) * w * 0.3;
        g.add(s);
        parts.streaks.push(s);
      }
    }
    return { def, group: g, open: 0, parts };
  }

  private buildSwitch(def: MechSwitch): SwitchView {
    const g = new THREE.Group();
    g.name = `mech-switch:${def.id}`;
    const [x, z] = def.position;
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.add(g);
    this.group.add(holder);
    const sv: SwitchView = { def, group: g, spin: 0 };
    if (def.style === 'lever') {
      this.box(0.9, 0.9, 0.7, this.mat('lv-base', { color: '#4a5060' }), 0, 0.45, 0, g);
      this.box(0.96, 0.1, 0.76, this.mat('hz-y', { color: '#f2c230' }), 0, 0.92, 0, g);
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.95, 0);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), this.mat('lv-arm', { color: '#c8ccd4' }));
      arm.position.y = 0.4;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), this.mat('lv-knob', { color: '#d84a3a' }));
      knob.position.y = 0.82;
      pivot.add(arm, knob);
      g.add(pivot);
      sv.lever = pivot;
      sv.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), this.ownMat({ color: '#ffffff', emissive: '#d84a3a', emissiveIntensity: 1.3 }));
      sv.lamp.position.set(0.32, 1.05, 0.2);
      g.add(sv.lamp);
      // 闪电标志
      const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.02), this.mat('bolt', { color: '#ffd23a', emissive: '#a07000', emissiveIntensity: 0.5 }));
      bolt.position.set(0, 0.5, 0.36);
      bolt.rotation.z = 0.4;
      g.add(bolt);
    } else if (def.style === 'sundial') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.7, 16), this.mat('sd-base', { color: '#e2cfa2' }));
      base.position.y = 0.35;
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.06, 24), this.mat('sd-face', { color: '#f4e8c8' }));
      face.position.y = 0.73;
      const gnomon = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 3), this.mat('gold', { color: '#d8a83a', emissive: '#5a3a00', emissiveIntensity: 0.3 }));
      gnomon.position.set(0, 0.98, 0);
      g.add(base, face, gnomon);
      for (let i = 0; i < 12; i++) {
        const tick = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.14), this.mat('sd-tick', { color: '#8a6a3a' }));
        const a = (i / 12) * Math.PI * 2;
        tick.position.set(Math.sin(a) * 0.52, 0.77, Math.cos(a) * 0.52);
        tick.rotation.y = a;
        g.add(tick);
      }
      const sun = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), this.mat('sd-sun', { color: '#ffd23a', emissive: '#ffb020', emissiveIntensity: 1.2 }));
      sun.add(core);
      for (let i = 0; i < 8; i++) {
        const ray = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), this.mat('sd-sun', { color: '#ffd23a', emissive: '#ffb020', emissiveIntensity: 1.2 }));
        const a = (i / 8) * Math.PI * 2;
        ray.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0);
        ray.rotation.z = a - Math.PI / 2;
        sun.add(ray);
      }
      sun.position.y = 1.55;
      const moon = new THREE.Group();
      const m1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), this.mat('sd-moon', { color: '#e8ecff', emissive: '#8aa0ff', emissiveIntensity: 0.9 }));
      const m2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), this.mat('sd-moon-cut', { color: '#2a2a5a' }));
      m2.position.set(0.08, 0.04, 0.05);
      moon.add(m1, m2);
      moon.position.y = 1.55;
      g.add(sun, moon);
      sv.sun = sun;
      sv.moon = moon;
    } else if (def.style === 'orb') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 0.9, 6), this.mat('orb-base', { color: '#3a2a5a' }));
      base.position.y = 0.45;
      const cup = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 8, 18), this.mat('gold', { color: '#d8a83a', emissive: '#5a3a00', emissiveIntensity: 0.3 }));
      cup.rotation.x = Math.PI / 2;
      cup.position.y = 0.95;
      g.add(base, cup);
      sv.orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 2), this.ownMat({ color: ORB_COLORS[0]!, emissive: ORB_COLORS[0]!, emissiveIntensity: 1.1, transparent: true, opacity: 0.88 }));
      sv.orb.position.y = 1.35;
      g.add(sv.orb);
      sv.light = new THREE.PointLight('#c86ad8', 0, 7, 1.6);
      sv.light.position.y = 1.6;
      g.add(sv.light);
    } else if (def.style === 'lamp') {
      const tall = (def.states ?? 2) > 2;
      const stone = this.mat('lamp-stone', { color: '#5a5a68' });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, tall ? 1.3 : 1.0, 8), stone);
      post.position.y = tall ? 0.65 : 0.5;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.2, 8), stone);
      foot.position.y = 0.1;
      g.add(post, foot);
      const topY = tall ? 1.3 : 1.0;
      if (tall) {
        // 三臂烛台
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), this.mat('iron', { color: '#2a2a30' }));
          arm.position.set(Math.cos(a) * 0.2, topY, Math.sin(a) * 0.2);
          arm.rotation.y = -a;
          const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), this.mat('candle', { color: '#efe6d0' }));
          candle.position.set(Math.cos(a) * 0.4, topY + 0.11, Math.sin(a) * 0.4);
          g.add(arm, candle);
        }
      } else {
        // 石灯笼
        this.box(0.5, 0.06, 0.5, stone, 0, topY, 0, g);
        for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const) this.box(0.06, 0.4, 0.06, stone, dx, topY + 0.23, dz, g);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.3, 4), stone);
        roof.position.y = topY + 0.58;
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
      }
      sv.flame = new THREE.Mesh(new THREE.SphereGeometry(tall ? 0.16 : 0.13, 10, 8), this.ownMat({ color: '#fff4d8', emissive: '#ffb85a', emissiveIntensity: 2.0 }));
      sv.flame.scale.y = 1.3;
      sv.flame.position.y = topY + (tall ? 0.34 : 0.24);
      g.add(sv.flame);
      sv.light = new THREE.PointLight('#ffb85a', 0, tall ? 9 : 13, 1.4);
      sv.light.position.y = topY + 0.5;
      g.add(sv.light);
    } else {
      // fan：台座 + 可转向的风扇头
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.5, 12), this.mat('fan-base', { color: '#dfe6f2' }));
      base.position.y = 0.25;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8), this.mat('fan-pole', { color: '#9aa4b8' }));
      pole.position.y = 0.9;
      g.add(base, pole);
      const head = new THREE.Group();
      head.position.y = 1.45;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 24), this.mat('fan-ring', { color: '#4a7ad8' }));
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), this.mat('fan-hub', { color: '#f2f6ff' }));
      const rotor = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.03), this.mat('fan-blade', { color: '#f2f6ff' }));
        blade.position.y = 0.26;
        const arm = new THREE.Group();
        arm.rotation.z = (i / 4) * Math.PI * 2;
        blade.rotation.y = 0.5;
        arm.add(blade);
        rotor.add(arm);
      }
      head.add(ring, hub, rotor);
      g.add(head);
      sv.rotor = rotor;
      sv.head = head;
    }
    this.collision.add(SWITCH_GROUP, { kind: 'circle', x, z, r: 0.5, y0: 0, y1: 1.6, tag: `mech-switch:${def.id}` });
    return sv;
  }

  private buildMirror(def: MechMirror): MirrorView {
    const g = new THREE.Group();
    g.name = `mech-mirror:${def.id}`;
    g.position.set(def.at[0], 0, def.at[1]);
    g.rotation.y = def.yaw ?? 0;
    this.group.add(g);
    const color = def.color ?? '#c86ad8';
    const gold = !!def.variable;
    const frame = this.mat(gold ? 'mir-gold' : `mir-frame-${color}`, gold ? { color: '#d8a83a', emissive: '#6a4a00', emissiveIntensity: 0.4 } : { color: '#2a2440' });
    // 镜框：立在法阵后方（-z 侧），玩家站上法阵即传送
    const back = -0.55;
    this.box(0.14, 2.3, 0.14, frame, -0.7, 1.15, back, g);
    this.box(0.14, 2.3, 0.14, frame, 0.7, 1.15, back, g);
    this.box(1.54, 0.14, 0.14, frame, 0, 2.3, back, g);
    this.box(1.7, 0.14, 0.3, frame, 0, 0.07, back, g);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 6, 16, Math.PI), frame);
    arch.position.set(0, 2.3, back);
    g.add(arch);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 2.1), this.ownMat({ color: '#e8f0ff', emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, side: THREE.DoubleSide, specular: true }));
    glass.position.set(0, 1.2, back);
    g.add(glass);
    // 地面法阵
    const pad = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.62, 24), this.ownMat({ color, emissive: color, emissiveIntensity: 1.0, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.03;
    g.add(pad);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.3, 6), this.mat(`mir-inner-${color}`, { color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.35 }));
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.025;
    g.add(inner);
    let gem: THREE.Mesh | undefined;
    if (gold) {
      gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), this.ownMat({ color: '#ffffff', emissive: ORB_COLORS[0]!, emissiveIntensity: 1.4 }));
      gem.position.set(0, 3.15, back);
      g.add(gem);
    }
    // 镜框挡人（法阵本身可踩）
    const c = Math.cos(def.yaw ?? 0);
    const sn = Math.sin(def.yaw ?? 0);
    this.collision.add(SWITCH_GROUP, { kind: 'box', x: def.at[0] + sn * back, z: def.at[1] + c * back, hx: 0.85, hz: 0.18, yaw: def.yaw ?? 0, y0: 0, y1: 2.6, tag: `mech-mirror:${def.id}` });
    return { def, glass, pad, gem, flash: 0 };
  }
}
