/**
 * M1-11 · 道馆 1 水位机关的场景表现与碰撞（世界层）。
 *
 * - 下沉水池：池底瓷砖、四周池壁、池沿压边；
 * - 水面：半透明 Toon 水面，水位切换时 2.2 s 缓动升降，同时两侧进水管 / 池底排水口出现水流；
 * - 石岛（always）：高出地面 0.3 m，带花坛与水草；
 * - 石栈道（low）：顶面与地面齐平，高水位时没在水面下；
 * - 木筏（high）：系在木桩上随水面浮沉，只有高水位时与地面齐平可以踩上去；
 * - 阀门：台座 + 红色转轮，转动时转轮旋转；
 * - 碰撞：水池中当前不可站立的区域 = 高墙碰撞体（组 water-puzzle），每次切换水位后重建。
 * - 地面高度：heightAt 给出石岛 / 木筏 / 栈道顶面，玩家与 NPC 站在正确的高度上。
 */
import * as THREE from 'three';
import { addHullOutlines, createToonMaterial } from '@/render';
import type { CollisionWorld } from '../collision/CollisionWorld';
import { blockerRects, isStandable, tileActive, type WaterLevel, type WaterPuzzleConfig, type WaterTile } from '@/systems/puzzles/waterLevel';

export const WATER_PUZZLE_GROUP = 'water-puzzle';
const POOL_BOTTOM = -1.7;
const ISLAND_TOP = 0.3;
const WALK_TOP = -0.02;
const RAFT_FLOAT = 0.12;
const RAFT_THICK = 0.22;
const LEVEL_SECONDS = 2.2;

const smooth = (t: number) => t * t * (3 - 2 * t);

export class WaterPuzzleView {
  readonly group = new THREE.Group();
  level: WaterLevel;
  /** 当前水面高度（动画中连续变化） */
  surface: number;
  private from = 0;
  private to = 0;
  private t = 1;
  private water!: THREE.Mesh;
  private rafts: Array<{ tile: WaterTile; mesh: THREE.Object3D }> = [];
  private pads: Array<{ mesh: THREE.Object3D; phase: number }> = [];
  private wheels = new Map<string, { wheel: THREE.Object3D; spin: number }>();
  private falls: THREE.Mesh[] = [];
  private drains: THREE.Mesh[] = [];
  private gauges: THREE.Mesh[] = [];
  private jet: THREE.Mesh | null = null;
  private time = 0;
  private mats = new Map<string, THREE.Material>();

  constructor(
    readonly cfg: WaterPuzzleConfig,
    private readonly collision: CollisionWorld,
  ) {
    this.group.name = 'water-puzzle';
    this.level = cfg.start;
    this.surface = cfg.levels[cfg.start];
    this.build();
    addHullOutlines(this.group);
    this.applyCollision();
    this.placeFloating();
  }

  /** 正在升降水位（此时不允许再次转动阀门） */
  get animating(): boolean {
    return this.t < 1;
  }

  /** 切换水位：先改碰撞（立即生效，避免玩家踩上即将消失的地面），再播放升降 */
  setLevel(level: WaterLevel, animate = true): void {
    if (level === this.level && !this.animating) return;
    this.level = level;
    this.from = this.surface;
    this.to = this.cfg.levels[level];
    this.t = animate ? 0 : 1;
    if (!animate) this.surface = this.to;
    this.applyCollision();
    this.placeFloating();
  }

  /** 转动阀门的转轮动画 */
  spinValve(id: string): void {
    const w = this.wheels.get(id);
    if (w) w.spin = Math.PI * 4;
  }

  /** 地面高度（石岛 / 木筏 / 栈道；池外 0） */
  heightAt(x: number, z: number): number {
    const [px0, pz0, px1, pz1] = this.cfg.pool;
    if (x < px0 || x > px1 || z < pz0 || z > pz1) return 0;
    for (const t of this.cfg.tiles) {
      if (!tileActive(t, this.level)) continue;
      const [x0, z0, x1, z1] = t.rect;
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      if (t.kind === 'island') return ISLAND_TOP;
      if (t.kind === 'raft') return this.cfg.levels.high + RAFT_FLOAT;
      return WALK_TOP;
    }
    return 0;
  }

  standable(x: number, z: number): boolean {
    return isStandable(this.cfg, this.level, x, z);
  }

  update(dt: number): void {
    this.time += dt;
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / LEVEL_SECONDS);
      this.surface = THREE.MathUtils.lerp(this.from, this.to, smooth(this.t));
      this.placeFloating();
    }
    const rising = this.t < 1 && this.to > this.from;
    const falling = this.t < 1 && this.to < this.from;
    // 进水管瀑布 / 排水漩涡
    for (const f of this.falls) {
      f.visible = rising;
      const top = f.userData.top as number;
      const h = Math.max(0.05, top - this.surface);
      f.scale.y = h;
      f.position.y = this.surface + h / 2;
      (f.material as THREE.MeshToonMaterial).opacity = 0.55 + 0.2 * Math.sin(this.time * 18);
    }
    for (const d of this.drains) {
      d.visible = falling;
      d.position.y = this.surface + 0.02;
      d.rotation.y += dt * 5;
    }
    // 水面轻微波动；睡莲漂浮
    this.water.position.y = this.surface + Math.sin(this.time * 1.3) * 0.01;
    for (const p of this.pads) {
      p.mesh.position.y = this.surface + 0.015;
      p.mesh.rotation.y = p.phase + Math.sin(this.time * 0.4 + p.phase) * 0.25;
    }
    // 阀门转轮
    for (const w of this.wheels.values()) {
      if (w.spin <= 0) continue;
      const d = Math.min(w.spin, dt * 7);
      w.spin -= d;
      w.wheel.rotation.z += d;
    }
    // 水位标尺上的指示块
    for (const g of this.gauges) g.position.y = this.surface + 0.05;
    // 中央喷泉水柱
    if (this.jet) {
      this.jet.scale.y = 1 + Math.sin(this.time * 3.1) * 0.08;
      this.jet.rotation.y += dt;
    }
  }

  dispose(): void {
    this.collision.removeGroup(WATER_PUZZLE_GROUP);
    this.collision.removeGroup('water-puzzle-valves');
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
    for (const m of this.mats.values()) m.dispose();
    this.mats.clear();
  }

  // ———————————————————— 内部 ————————————————————

  private applyCollision(): void {
    this.collision.removeGroup(WATER_PUZZLE_GROUP);
    for (const [x0, z0, x1, z1] of blockerRects(this.cfg, this.level)) {
      this.collision.add(WATER_PUZZLE_GROUP, {
        kind: 'box',
        x: (x0 + x1) / 2,
        z: (z0 + z1) / 2,
        hx: (x1 - x0) / 2,
        hz: (z1 - z0) / 2,
        yaw: 0,
        y0: POOL_BOTTOM - 1,
        y1: 3,
        tag: 'water',
      });
    }
  }

  private placeFloating(): void {
    for (const r of this.rafts) r.mesh.position.y = this.surface + RAFT_FLOAT - RAFT_THICK / 2;
  }

  private mat(color: string, opts: { transparent?: boolean; opacity?: number; emissive?: string } = {}): THREE.Material {
    const key = `${color}|${opts.opacity ?? 1}|${opts.emissive ?? ''}`;
    let m = this.mats.get(key);
    if (!m) {
      m = createToonMaterial({
        color,
        kind: 'scene',
        ...(opts.transparent ? { transparent: true, opacity: opts.opacity ?? 0.8 } : {}),
        ...(opts.emissive ? { emissive: opts.emissive, emissiveIntensity: 0.6 } : {}),
      });
      this.mats.set(key, m);
    }
    return m;
  }

  private box(w: number, h: number, d: number, color: string, x: number, y: number, z: number, parent: THREE.Object3D = this.group): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  private build(): void {
    const [px0, pz0, px1, pz1] = this.cfg.pool;
    const pw = px1 - px0;
    const pd = pz1 - pz0;
    const cx = (px0 + px1) / 2;
    const cz = (pz0 + pz1) / 2;

    // 池底：深色底 + 浅色瓷砖格
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd).rotateX(-Math.PI / 2), this.mat('#6b7f84'));
    bottom.position.set(cx, POOL_BOTTOM, cz);
    bottom.userData.noShadow = true;
    this.group.add(bottom);
    const tileGeo = new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2);
    const tiles: THREE.Matrix4[] = [];
    for (let x = px0 + 0.5; x < px1; x += 1)
      for (let z = pz0 + 0.5; z < pz1; z += 1) if ((Math.floor(x) + Math.floor(z)) % 2 === 0) tiles.push(new THREE.Matrix4().makeTranslation(x, POOL_BOTTOM + 0.004, z));
    const tim = new THREE.InstancedMesh(tileGeo, this.mat('#7d9398'), tiles.length);
    tiles.forEach((m, i) => tim.setMatrixAt(i, m));
    tim.userData.noShadow = true;
    this.group.add(tim);
    // 排水格栅（池底中央两处）
    for (const [x, z] of [[-4, 1], [4, 9]] as const) {
      const g = this.box(1.6, 0.04, 1.6, '#16404f', x, POOL_BOTTOM + 0.02, z);
      for (let k = -2; k <= 2; k++) this.box(0.06, 0.05, 1.5, '#9fb8c0', x + k * 0.3, POOL_BOTTOM + 0.05, z, this.group);
      void g;
      const swirl = new THREE.Mesh(new THREE.RingGeometry(0.4, 1.1, 24, 1, 0, Math.PI * 1.5).rotateX(-Math.PI / 2), this.mat('#e8f8ff', { transparent: true, opacity: 0.55 }));
      swirl.position.set(x, 0, z);
      swirl.visible = false;
      this.group.add(swirl);
      this.drains.push(swirl);
    }

    // 池壁（四周，地面到池底）+ 池沿压边
    // 池壁顶面压到地板下 1 cm（与地板共面会闪烁）
    const wallH = -POOL_BOTTOM - 0.01;
    const wallCol = '#8fc4d2';
    this.box(pw, wallH, 0.2, wallCol, cx, POOL_BOTTOM + wallH / 2, pz0 - 0.1);
    this.box(pw, wallH, 0.2, wallCol, cx, POOL_BOTTOM + wallH / 2, pz1 + 0.1);
    this.box(0.2, wallH, pd, wallCol, px0 - 0.1, POOL_BOTTOM + wallH / 2, cz);
    this.box(0.2, wallH, pd, wallCol, px1 + 0.1, POOL_BOTTOM + wallH / 2, cz);
    this.box(pw + 0.6, 0.08, 0.5, '#2f7fa8', cx, 0.04, pz0 - 0.25);
    this.box(pw + 0.6, 0.08, 0.5, '#2f7fa8', cx, 0.04, pz1 + 0.25);
    // 池壁水位刻度线（两档水位）
    for (const lv of [this.cfg.levels.high, this.cfg.levels.low]) {
      this.box(pw, 0.04, 0.02, '#ffffff', cx, lv, pz1 - 0.005);
      this.box(pw, 0.04, 0.02, '#ffffff', cx, lv, pz0 + 0.005);
    }

    // 石块：石岛 / 栈道（木筏单独处理）
    for (const t of this.cfg.tiles) {
      const [x0, z0, x1, z1] = t.rect;
      const w = x1 - x0;
      const d = z1 - z0;
      const x = (x0 + x1) / 2;
      const z = (z0 + z1) / 2;
      if (t.kind === 'island') {
        // 石体顶面比压顶石板低 2 cm：两者顶面共面会闪烁（z-fighting）
        const h = ISLAND_TOP - 0.02 - POOL_BOTTOM;
        this.box(w, h, d, '#9aa7ad', x, POOL_BOTTOM + h / 2, z);
        this.box(w + 0.16, 0.1, d + 0.16, '#c7d3d7', x, ISLAND_TOP - 0.05, z);
        // 顶面石板缝
        for (let k = x0 + 1; k < x1 - 0.1; k += 1) this.box(0.03, 0.01, d - 0.1, '#9aa7ad', k, ISLAND_TOP + 0.005, z);
        // 水线处的青苔带
        this.box(w + 0.04, 0.18, d + 0.04, '#5f8f6a', x, this.cfg.levels.high - 0.04, z);
        if (t.id !== 'isle-statue') this.planters(t);
        else this.statue(x, z);
      } else if (t.kind === 'walkway') {
        const h = WALK_TOP - POOL_BOTTOM;
        this.box(w, 0.2, d, '#b8b0a0', x, WALK_TOP - 0.1, z);
        // 石墩（每 2 m 一对）
        const along = w >= d;
        const len = along ? w : d;
        for (let k = 0.6; k < len; k += 2) {
          const px = along ? x0 + k : x;
          const pz = along ? z : z0 + k;
          this.box(0.5, h - 0.2, 0.5, '#8a8274', px, POOL_BOTTOM + (h - 0.2) / 2, pz);
        }
        // 顶面边线（低水位露出时看得清路线）
        this.box(along ? w : 0.08, 0.02, along ? 0.08 : d, '#e8dcc0', along ? x : x0 + 0.1, WALK_TOP + 0.01, along ? z0 + 0.1 : z);
        this.box(along ? w : 0.08, 0.02, along ? 0.08 : d, '#e8dcc0', along ? x : x1 - 0.1, WALK_TOP + 0.01, along ? z1 - 0.1 : z);
      } else {
        this.raft(t);
      }
    }

    // 阀门
    for (const v of this.cfg.valves) this.valve(v.id, v.position[0], v.position[1]);

    // 进水管（两侧墙，水位上升时出水）
    for (const [x, dir] of [[px0 + 0.35, 1], [px1 - 0.35, -1]] as const) {
      for (const z of [cz - 4, cz + 4]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.7, 14).rotateZ(Math.PI / 2), this.mat('#6f8d99'));
        pipe.position.set(x, 1.4, z);
        this.group.add(pipe);
        const lip = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 6, 16).rotateY(Math.PI / 2), this.mat('#2f7fa8'));
        lip.position.set(x + dir * 0.35, 1.4, z);
        this.group.add(lip);
        const fall = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1, 0.42), this.mat('#bfeaff', { transparent: true, opacity: 0.65 }));
        fall.position.set(x + dir * 0.45, 0.7, z);
        fall.userData.top = 1.3;
        fall.visible = false;
        this.group.add(fall);
        this.falls.push(fall);
      }
    }

    // 水位标尺（池角两根刻度柱，指示块随水面）
    for (const [x, z] of [[px0 + 0.5, pz1 - 0.5], [px1 - 0.5, pz1 - 0.5]] as const) {
      const h = 1.2 - POOL_BOTTOM;
      this.box(0.16, h, 0.16, '#ffffff', x, POOL_BOTTOM + h / 2, z);
      for (let y = Math.ceil(POOL_BOTTOM * 4) / 4; y < 1.2; y += 0.25) this.box(0.24, 0.02, 0.24, '#2f7fa8', x, y, z);
      const ind = this.box(0.32, 0.1, 0.32, '#e8484a', x, this.surface, z);
      this.gauges.push(ind);
    }

    // 睡莲
    let k = 11;
    const rnd = () => ((k = (k * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const x = px0 + 0.8 + rnd() * (pw - 1.6);
      const z = pz0 + 0.8 + rnd() * (pd - 1.6);
      if (this.cfg.tiles.some((t) => x > t.rect[0] - 0.6 && x < t.rect[2] + 0.6 && z > t.rect[1] - 0.6 && z < t.rect[3] + 0.6)) continue;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.34 + rnd() * 0.2, 12, 0.4, Math.PI * 2 - 0.4).rotateX(-Math.PI / 2), this.mat('#4f9a4a'));
      pad.position.set(x, this.surface, z);
      if (rnd() > 0.6) {
        const flower = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.14, 6), this.mat('#f4a6c8'));
        flower.position.set(0.08, 0.07, 0.05);
        pad.add(flower);
      }
      this.group.add(pad);
      this.pads.push({ mesh: pad, phase: rnd() * 6 });
    }

    // 水面（最后加入，透明排序在后）
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd, 1, 1).rotateX(-Math.PI / 2), this.mat('#3aa6d8', { transparent: true, opacity: 0.72 }));
    this.water.position.set(cx, this.surface, cz);
    this.water.userData.noShadow = true;
    this.water.userData.outline = false;
    this.water.renderOrder = 2;
    this.group.add(this.water);
  }

  private planters(t: WaterTile): void {
    const [x0, z0, x1, z1] = t.rect;
    // 两个角落的花坛 + 水草
    for (const [x, z] of [[x1 - 0.6, z0 + 0.6], [x0 + 0.6, z1 - 0.6]] as const) {
      this.box(0.9, 0.35, 0.9, '#7a8a90', x, ISLAND_TOP + 0.175, z);
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), this.mat('#4f9a5a'));
      bush.position.set(x, ISLAND_TOP + 0.6, z);
      this.group.add(bush);
    }
    for (let i = 0; i < 6; i++) {
      const x = i % 2 ? x0 - 0.12 : x1 + 0.12;
      const z = z0 + ((i >> 1) + 0.5) * ((z1 - z0) / 3);
      const reed = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.9, 4), this.mat('#6fae5a'));
      reed.position.set(x, this.cfg.levels.high + 0.3, z);
      this.group.add(reed);
    }
  }

  private statue(x: number, z: number): void {
    // 暴鲤龙抽象雕像 + 喷泉
    this.box(2.2, 0.6, 2.2, '#c7d3d7', x, ISLAND_TOP + 0.3, z);
    const body = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.26, 8, 18, Math.PI * 1.3), this.mat('#2f6fb8'));
    body.position.set(x, ISLAND_TOP + 1.5, z);
    body.rotation.set(0, Math.PI / 5, Math.PI / 2.4);
    this.group.add(body);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 6), this.mat('#2f6fb8'));
    head.position.set(x + 0.2, ISLAND_TOP + 2.35, z);
    head.rotation.z = -0.6;
    this.group.add(head);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 3), this.mat('#f2e6b0'));
    fin.position.set(x - 0.1, ISLAND_TOP + 2.6, z);
    this.group.add(fin);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 1.2, 8), this.mat('#d8f4ff', { transparent: true, opacity: 0.7 }));
    jet.position.set(x + 0.55, ISLAND_TOP + 2.8, z);
    jet.userData.outline = false;
    this.group.add(jet);
    this.jet = jet;
  }

  private raft(t: WaterTile): void {
    const [x0, z0, x1, z1] = t.rect;
    const w = x1 - x0;
    const d = z1 - z0;
    const raft = new THREE.Group();
    raft.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const along = d >= w;
    const n = Math.round((along ? w : d) / 0.4);
    for (let i = 0; i < n; i++) {
      const off = -((along ? w : d) / 2) + (i + 0.5) * ((along ? w : d) / n);
      const col = i % 2 ? '#a8784a' : '#b98a58';
      this.box(along ? (w / n) * 0.94 : w, RAFT_THICK, along ? d : (d / n) * 0.94, col, along ? off : 0, 0, along ? 0 : off, raft);
    }
    // 横档 + 浮桶
    for (const s of [-0.35, 0.35]) {
      const len = along ? d : w;
      this.box(along ? w + 0.1 : 0.14, 0.08, along ? 0.14 : d + 0.1, '#7a5530', 0, RAFT_THICK / 2 + 0.04, 0, raft).position[along ? 'z' : 'x'] = s * len;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, (along ? w : d) * 0.9, 10).rotateZ(along ? Math.PI / 2 : 0).rotateX(along ? 0 : Math.PI / 2), this.mat('#2f7fa8'));
      drum.position.set(along ? 0 : s * len, -0.22, along ? s * len : 0);
      raft.add(drum);
    }
    this.group.add(raft);
    this.rafts.push({ tile: t, mesh: raft });
    // 系缆木桩（四角，从池底伸出）
    for (const [x, z] of [[x0 - 0.2, z0 + 0.3], [x1 + 0.2, z0 + 0.3], [x0 - 0.2, z1 - 0.3], [x1 + 0.2, z1 - 0.3]] as const) {
      const h = 0.5 - POOL_BOTTOM;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, h, 8), this.mat('#6b4a2a'));
      post.position.set(x, POOL_BOTTOM + h / 2, z);
      this.group.add(post);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 8), this.mat('#2f7fa8'));
      cap.position.set(x, 0.5, z);
      this.group.add(cap);
    }
  }

  private valve(id: string, x: number, z: number): void {
    const g = new THREE.Group();
    g.position.set(x, ISLAND_TOP, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.3, 12), this.mat('#6f8d99'));
    base.position.y = 0.15;
    g.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.75, 8), this.mat('#8fa5ad'));
    shaft.position.y = 0.6;
    g.add(shaft);
    // 转轮（竖直放置，面朝 +Z，便于俯视镜头看清旋转）
    const wheel = new THREE.Group();
    wheel.position.set(0, 1.0, 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 20), this.mat('#e8484a'));
    wheel.add(rim);
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.05), this.mat('#e8484a'));
      spoke.rotation.z = (i * Math.PI) / 3;
      wheel.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 10).rotateX(Math.PI / 2), this.mat('#f2e6b0'));
    wheel.add(hub);
    wheel.rotation.x = -0.5;
    g.add(wheel);
    // 指示灯：蓝 = 高水位 / 黄 = 低水位（静态双色）
    const lampA = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), this.mat('#6ad0f0', { emissive: '#6ad0f0' }));
    lampA.position.set(-0.22, 0.34, 0.3);
    const lampB = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), this.mat('#f2c84a', { emissive: '#f2c84a' }));
    lampB.position.set(0.22, 0.34, 0.3);
    g.add(lampA, lampB);
    g.name = `valve:${id}`;
    this.group.add(g);
    this.wheels.set(id, { wheel, spin: 0 });
    this.collision.add('water-puzzle-valves', { kind: 'circle', x, z, r: 0.42, y0: ISLAND_TOP, y1: ISLAND_TOP + 1.4, tag: `valve:${id}` });
  }
}
