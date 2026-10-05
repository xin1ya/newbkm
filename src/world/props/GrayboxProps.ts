/**
 * WLD-005 · 灰盒摆放物：读取 props.json，程序化生成建筑并按 128 m 分块合并网格（每块 ≤ 2 个 draw call），
 * 同时注册碰撞体（建筑为有向矩形、码头/栈桥为可站立顶面、灯柱为圆柱、可破坏岩石按阻挡 id 分组）。
 * 窗户与灯使用统一的发光材质，亮度随昼夜变化（夜里被 bloom 捕捉）。
 */
import * as THREE from 'three';
import type { PropInstance, PropsFile } from '@/config/islands/types';
import { createToonMaterial, LAYER } from '@/render';
import type { Heightfield } from '../terrain/Heightfield';
import type { CollisionWorld } from '../collision/CollisionWorld';
import * as B from './builders';
import * as T from './townBuilders';
import * as TB from './tideBuilders';
import * as TH from './thunderBuilders';
import * as GL from './glazeBuilders';
import { PHASE_FADE, phaseKey, phaseOpacity } from './phase';
import type { Collider } from '../collision/CollisionWorld';

/** M3-11 随时间出现 / 消失的一组摆放物 */
interface PropPhase {
  key: string;
  hours: [number, number];
  mirage: boolean;
  meshes: THREE.Mesh[];
  solid: THREE.MeshToonMaterial;
  glow: THREE.MeshBasicMaterial;
  colliders: Collider[];
  opacity: number;
  solidOn: boolean;
}

export class GrayboxProps {
  readonly group = new THREE.Group();
  /** 可清除的阻挡物（藤蔓 / 碎岩 / 巨石）：ref → 网格（独立于分块合并，清除时隐藏） */
  private readonly blockerMeshes = new Map<string, THREE.Mesh[]>();
  /** 正在摆放的阻挡物 ref（place 时放进独立桶） */
  private blockerRef: string | null = null;
  readonly solidMaterial = createToonMaterial({ kind: 'scene', vertexColors: true, cacheKey: 'props', rim: false, specular: false });
  readonly glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.9, 0.9, 0.9), fog: true });
  /** 灯的位置（夜间点光源池使用） */
  readonly lampPositions: THREE.Vector3[] = [];
  /** M3-06 闪电优先落点（避雷塔塔顶） */
  readonly strikeTargets: THREE.Vector3[] = [];
  /** 有门的建筑：ref → 门口世界坐标与朝向 */
  readonly doors = new Map<string, { position: THREE.Vector3; yaw: number }>();
  private buckets = new Map<string, B.PropParts>();
  /** 正在摆放的分时摆放物（放进独立桶，碰撞体另存） */
  private phaseCur: PropPhase | null = null;
  private readonly phases = new Map<string, PropPhase>();
  private phaseInit = false;
  private phaseTime = 0;

  constructor(
    private readonly hf: Heightfield,
    private readonly collision: CollisionWorld,
    file: PropsFile,
  ) {
    this.group.name = 'graybox-props';
    this.solidMaterial.name = 'props';
    this.solidMaterial.userData.outline = false;
    for (const p of file.props) {
      try {
        this.blockerRef = (p.type === 'breakable-rock' || p.type === 'vine-wall' || p.type === 'boulder') && p.ref ? p.ref : null;
        this.phaseCur = this.phaseFor(p);
        const lamps = this.lampPositions.length;
        const strikes = this.strikeTargets.length;
        this.addProp(p);
        // 分时摆放物不提供夜灯 / 落雷点（消失后不该还亮着）
        if (this.phaseCur) {
          this.lampPositions.length = lamps;
          this.strikeTargets.length = strikes;
        }
        this.blockerRef = null;
        this.phaseCur = null;
      } catch (e) {
        console.warn('[props] 生成失败', p, e);
      }
    }
    for (const [key, parts] of this.buckets) {
      const solid = B.mergeParts(parts.solid);
      if (solid) {
        const m = new THREE.Mesh(solid, this.solidMaterial);
        m.name = `props-${key}`;
        m.castShadow = true;
        m.receiveShadow = true;
        m.layers.set(LAYER.DEFAULT);
        this.group.add(m);
        this.trackBlocker(key, m);
        this.trackPhase(key, m, false);
      }
      const glow = B.mergeParts(parts.glow);
      if (glow) {
        const m = new THREE.Mesh(glow, this.glowMaterial);
        m.name = `props-glow-${key}`;
        this.group.add(m);
        this.trackBlocker(key, m);
        this.trackPhase(key, m, true);
      }
    }
    this.buckets.clear();
  }

  private phaseFor(p: PropInstance): PropPhase | null {
    const key = phaseKey(p);
    if (!key || !p.hours) return null;
    let ph = this.phases.get(key);
    if (!ph) {
      const solid = createToonMaterial({ kind: 'scene', vertexColors: true, cacheKey: 'props', rim: false, specular: false, transparent: true });
      solid.userData.outline = false;
      const glow = this.glowMaterial.clone();
      glow.transparent = true;
      ph = { key, hours: [p.hours[0], p.hours[1]], mirage: p.mirage === true, meshes: [], solid, glow, colliders: [], opacity: 1, solidOn: false };
      this.phases.set(key, ph);
    }
    return ph;
  }

  private trackPhase(key: string, m: THREE.Mesh, glow: boolean): void {
    const ph = this.phases.get(key);
    if (!ph) return;
    m.material = glow ? ph.glow : ph.solid;
    // 幻象不投影（热浪里的影子会穿帮）
    if (ph.mirage) m.castShadow = false;
    ph.meshes.push(m);
  }

  /** 碰撞体登记：分时摆放物另存（出现时才加入碰撞世界；幻象永远没有碰撞） */
  private colAdd(group: string, c: Collider): void {
    if (this.phaseCur) {
      if (!this.phaseCur.mirage) this.phaseCur.colliders.push(c);
      return;
    }
    this.collision.add(group, c);
  }

  /**
   * M3-11 · 每帧按游戏时间更新分时摆放物：时间窗内淡入（实体出现时同时加入碰撞），窗外淡出并移除碰撞。
   * 第一次调用直接跳到目标状态（读档 / 进岛时不播放淡入）。
   */
  setHour(hour: number, dt: number): void {
    if (!this.phases.size) return;
    this.phaseTime += dt;
    const first = !this.phaseInit;
    this.phaseInit = true;
    for (const ph of this.phases.values()) {
      const want = phaseOpacity(hour, ph.hours, ph.mirage, this.phaseTime);
      if (first) ph.opacity = want;
      // 幻象已经显现：直接跟随热浪闪烁
      else if (ph.mirage && want > 0 && ph.opacity > 0.3) ph.opacity = want;
      else ph.opacity += Math.sign(want - ph.opacity) * Math.min(Math.abs(want - ph.opacity), PHASE_FADE * dt);
      const vis = ph.opacity > 0.01;
      for (const m of ph.meshes) m.visible = vis;
      ph.solid.opacity = ph.opacity;
      ph.glow.opacity = ph.opacity;
      ph.solid.depthWrite = ph.opacity > 0.97;
      ph.solid.transparent = ph.opacity < 0.999;
      ph.glow.transparent = ph.opacity < 0.999;
      // 实体：一开始出现就有碰撞，开始消失就撤掉（避免玩家被困在正在淡出的墙里）
      const on = !ph.mirage && want > 0;
      if (on !== ph.solidOn) {
        ph.solidOn = on;
        if (on) for (const c of ph.colliders) this.collision.add(ph.key, c);
        else this.collision.removeGroup(ph.key);
      }
    }
  }

  /** 调试 / 测试：各分时组当前状态 */
  phaseState(): Array<{ key: string; opacity: number; solid: boolean; colliders: number }> {
    return [...this.phases.values()].map((ph) => ({ key: ph.key, opacity: ph.opacity, solid: ph.solidOn, colliders: ph.colliders.length }));
  }

  private trackBlocker(key: string, m: THREE.Mesh): void {
    if (!key.startsWith('blocker:')) return;
    const ref = key.slice(8);
    const list = this.blockerMeshes.get(ref) ?? [];
    list.push(m);
    this.blockerMeshes.set(ref, list);
  }

  /** 清除阻挡物（割开藤蔓 / 撞碎岩石 / 推开巨石后）：隐藏网格并移除碰撞 */
  clearBlocker(ref: string): void {
    for (const m of this.blockerMeshes.get(ref) ?? []) m.visible = false;
    this.collision.removeGroup(`blocker:${ref}`);
  }

  /** 阻挡物网格（清除动画用；没有则为空） */
  blockerObjects(ref: string): THREE.Mesh[] {
    return this.blockerMeshes.get(ref) ?? [];
  }

  private bucket(x: number, z: number): B.PropParts {
    const cs = this.hf.config.chunkSize;
    const key = this.blockerRef ? `blocker:${this.blockerRef}` : this.phaseCur ? this.phaseCur.key : `${Math.floor((x + this.hf.half) / cs)},${Math.floor((z + this.hf.half) / cs)}`;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = { solid: [], glow: [] }));
    return b;
  }

  private place(parts: B.PropParts, x: number, y: number, z: number, yaw: number): void {
    const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
    const b = this.bucket(x, z);
    for (const g of parts.solid) b.solid.push(g.applyMatrix4(m));
    for (const g of parts.glow) b.glow.push(g.applyMatrix4(m));
  }

  /** 建筑底面取占地四角与中心的最低地形高度（避免悬空；多出的部分由地基埋入） */
  private footprintY(x: number, z: number, w: number, d: number, yaw: number): number {
    let y = Infinity;
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    for (const [lx, lz] of [[0, 0], [-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]] as const) {
      y = Math.min(y, this.hf.heightAt(x + lx * c + lz * s, z - lx * s + lz * c));
    }
    return y - 0.1;
  }

  private addBox(x: number, z: number, w: number, d: number, yaw: number, y0: number, y1: number, tag: string, walkableTop = false, group = 'props'): void {
    this.colAdd(group, { kind: 'box', x, z, hx: w / 2, hz: d / 2, yaw, y0, y1, tag, walkableTop });
  }

  private addProp(p: PropInstance): void {
    const [x, z] = p.position;
    const [w, h, d] = p.size;
    const yaw = p.yaw;
    const wall = p.color ?? '#f2e6d0';
    const roof = p.roof ?? '#d9674e';
    const collide = p.collide !== false;
    switch (p.type) {
      case 'house':
      case 'lab':
      case 'pokecenter':
      case 'mart':
      case 'warehouse':
      case 'market-hall':
      case 'terminal':
      case 'greenhouse': {
        const y = p.y ?? this.footprintY(x, z, w, d, yaw);
        const seed = p.seed ?? Math.round(x * 13 + z * 7);
        const parts =
          p.type === 'house'
            ? p.variant === 'adobe'
              ? TB.adobeHouse(w, h, d, wall, p.accent ?? '#3f7a8a', seed)
              : p.variant === 'obsidian'
                ? TB.obsidianHouse(w, h, d, roof, seed)
                : p.variant === 'onsen'
                  ? TB.onsenHouse(w, h, d, wall, roof, seed, p.accent)
                  : p.variant === 'slate'
                    ? TH.slateHouse(w, h, d, wall, roof, seed, p.accent)
                    : p.variant === 'chalet'
                      ? TH.chaletHouse(w, h, d, roof, seed, p.accent)
                      : p.variant === 'lark'
                        ? TH.larkHouse(w, h, d, wall, roof, seed, p.accent)
                        : p.variant === 'mirage'
                          ? GL.mirageHouse(w, h, d, wall, roof, seed, p.accent)
                          : p.variant === 'crypt'
                            ? GL.cryptHouse(w, h, d, wall, roof, seed, p.accent)
                            : p.variant === 'ossuary'
                              ? GL.ossuary(w, h, d, wall, roof)
                              : p.variant === 'glass'
                                ? GL.glassHouse(w, h, d, wall, roof, seed, p.accent)
                                : p.variant === 'glassworks'
                                  ? GL.glassworks(w, h, d, wall, roof)
                                  : p.variant === 'ever' || p.variant === 'ever-hotel'
                                    ? GL.everHouse(w, h, d, p.accent ?? roof, seed, p.variant === 'ever-hotel')
                        : T.house(w, h, d, wall, roof, p.variant, seed, p.accent)
            : p.type === 'lab'
              ? T.lab(w, h, d, wall, roof)
              : p.type === 'pokecenter'
                ? T.pokecenter(w, h, d, wall, roof)
                : p.type === 'mart'
                  ? T.mart(w, h, d, wall, roof)
                  : p.type === 'market-hall'
                    ? T.marketHall(w, h, d, wall, roof, seed)
                    : p.type === 'terminal'
                      ? T.terminal(w, h, d, wall, roof)
                      : p.type === 'greenhouse'
                        ? T.greenhouse(w, h, d, seed)
                        : T.warehouse(w, h, d, wall, roof, seed);
        this.place(parts, x, y, z, yaw);
        const s = Math.sin(yaw);
        const c = Math.cos(yaw);
        const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
        if (collide) {
          this.addBox(x, z, w, d, yaw, y, y + h, `building:${p.ref ?? p.type}`);
          if (p.type === 'lab') {
            const [ax, az] = at(0, d / 2 + 1.5);
            this.addBox(ax, az, 6, 3, yaw, y, y + 4, 'building:lab-atrium');
            const [wx, wz] = at(w / 2 + 2.25, -d * 0.1);
            this.addBox(wx, wz, 4.5, d * 0.7, yaw, y, y + 4, 'building:lab-wing');
          }
          if (p.type === 'pokecenter') for (const sx of [-1, 1]) {
            const [px, pz] = at(sx * 3.3, d / 2 + 2.9);
            this.colAdd('props', { kind: 'circle', x: px, z: pz, r: 0.2, y0: y, y1: y + 4, tag: 'pillar' });
          }
          if (p.type === 'warehouse') {
            const [lx, lz] = at(0, d / 2 + 1.1);
            this.addBox(lx, lz, w * 0.42 + 2, 2.2, yaw, y, y + 1.0, 'loading-dock', true);
          }
        }
        if (p.ref) {
          const back = d / 2 + (p.type === 'lab' ? 3.6 : 0.6);
          const [dx, dz] = at(0, back);
          this.doors.set(p.ref, { position: new THREE.Vector3(dx, this.hf.heightAt(dx, dz), dz), yaw });
        }
        break;
      }
      case 'gym': {
        const y = p.y ?? this.hf.heightAt(x, z);
        const gymParts: Record<string, () => B.PropParts> = {
          grass: () => TB.gymGrass(w, h),
          rock: () => TB.gymRock(w, h),
          fire: () => TB.gymFire(w, h),
          electric: () => TH.gymElectric(w, h),
          dawn: () => TH.gymDawn(w, h),
          ice: () => TH.gymIce(w, h),
          flying: () => TH.gymFlying(w, h),
          mirage: () => GL.gymMirage(w, h),
          ghost: () => GL.gymGhost(w, h),
          water: () => GL.gymWater(w, h),
        };
        this.place((gymParts[p.variant ?? ''] ?? (() => T.gym(w, h, wall, roof)))(), x, y, z, yaw);
        this.colAdd('props', { kind: 'circle', x, z, r: w / 2, y0: y, y1: y + h, tag: `building:${p.ref}` });
        // 平台可站立
        this.colAdd('props', { kind: 'box', x, z, hx: w / 2 + 1.5, hz: w / 2 + 1.5, yaw: 0, y0: y - 3, y1: y + 0.6, walkableTop: true, tag: 'gym-platform' });
        // 大门前台阶：顶面 +0.3（平台 0.6 超过一步可跨高度 0.55，需要中间一级）
        {
          const sd = w / 2 + 2.4;
          this.colAdd('props', { kind: 'box', x: x + Math.sin(yaw) * sd, z: z + Math.cos(yaw) * sd, hx: 3.5, hz: 0.8, yaw, y0: y - 3, y1: y + 0.3, walkableTop: true, tag: 'gym-steps' });
        }
        if (p.ref) this.doors.set(p.ref, { position: new THREE.Vector3(x + Math.sin(yaw) * (w / 2 + 1), y + 0.6, z + Math.cos(yaw) * (w / 2 + 1)), yaw });
        break;
      }
      case 'lighthouse': {
        const y = this.hf.heightAt(x, z) - 0.2;
        this.place(T.lighthouse(w, h, wall, roof, p.variant ?? 'keeper'), x, y, z, yaw);
        if (p.variant !== 'plain') {
          const bx = x - Math.sin(yaw) * (w * 0.8 + 2.4);
          const bz = z - Math.cos(yaw) * (w * 0.8 + 2.4);
          this.addBox(bx, bz, 5, 4.2, yaw, y, y + 4.4, 'lighthouse-keeper');
        }
        this.colAdd('props', { kind: 'circle', x, z, r: w * 0.75, y0: y, y1: y + h, tag: 'lighthouse' });
        this.lampPositions.push(new THREE.Vector3(x, y + h - 3, z));
        // M3-23 古灯塔可进入：塔门（局部 +Z）外侧登记为门口
        if (p.variant === 'old' && p.ref) {
          const dx = x + Math.sin(yaw) * (w * 0.75 + 1.2);
          const dz = z + Math.cos(yaw) * (w * 0.75 + 1.2);
          this.doors.set(p.ref, { position: new THREE.Vector3(dx, this.hf.heightAt(dx, dz), dz), yaw });
        }
        break;
      }
      case 'dock': {
        const deckY = p.y ?? 1.3;
        const s = Math.sin(yaw);
        const c = Math.cos(yaw);
        this.place(B.dock(w, d, deckY, (lz) => this.hf.heightAt(x + lz * s, z + lz * c)), x, 0, z, yaw);
        this.addBox(x, z, w, d, yaw, deckY - 4, deckY, 'dock', true);
        // 两侧不可越过的边沿（防止走进深水里；系缆桩高度）
        for (const sx of [-1, 1]) this.addBox(x + c * sx * (w / 2 + 0.15), z - s * sx * (w / 2 + 0.15), 0.3, d, yaw, deckY - 4, deckY + 1.2, 'dock-edge');
        break;
      }
      case 'boat': {
        const y = p.y ?? 0;
        this.place(B.boat(w, h, d, wall, roof), x, y, z, yaw);
        if (collide) this.addBox(x, z, w, d, yaw, y - 2, y + h, 'boat');
        break;
      }
      case 'boardwalk': {
        const pts = p.points ?? [];
        const deckY = p.y ?? 1;
        for (let i = 0; i + 1 < pts.length; i++) {
          const [ax, az] = pts[i]!;
          const [bx, bz] = pts[i + 1]!;
          const len = Math.hypot(bx - ax, bz - az);
          const sy = Math.atan2(bx - ax, bz - az);
          const mx = (ax + bx) / 2;
          const mz = (az + bz) / 2;
          // 栈桥 = 沿方向的长码头（桩到湖底）
          const s = Math.sin(sy);
          const c = Math.cos(sy);
          const parts = B.dock(w, len + 1, deckY, (lz) => this.hf.heightAt(mx + lz * s, mz + lz * c));
          // 栏杆
          for (const sx of [-1, 1]) {
            parts.solid.push(B.box(0.1, 0.1, len + 1, '#f4efe6', sx * (w / 2 - 0.05), deckY + 0.95, 0));
            for (let t = -len / 2; t <= len / 2; t += 2.5) parts.solid.push(B.box(0.12, 1, 0.12, '#f4efe6', sx * (w / 2 - 0.05), deckY, t));
          }
          this.place(parts, mx, 0, mz, sy);
          this.addBox(mx, mz, w, len + 1.5, sy, deckY - 6, deckY, 'boardwalk', true);
          for (const sx of [-1, 1]) this.addBox(mx + c * sx * (w / 2), mz - s * sx * (w / 2), 0.2, len + 1, sy, deckY - 6, deckY + 1.1, 'boardwalk-rail');
        }
        break;
      }
      case 'fence': {
        const pts = p.points ?? [];
        for (let i = 0; i + 1 < pts.length; i++) {
          const [ax, az] = pts[i]!;
          const [bx, bz] = pts[i + 1]!;
          const len = Math.hypot(bx - ax, bz - az);
          const n = Math.max(1, Math.round(len / 2.2));
          for (let k = 0; k < n; k++) {
            const t0 = k / n;
            const t1 = (k + 1) / n;
            const x0 = ax + (bx - ax) * t0;
            const z0 = az + (bz - az) * t0;
            const x1 = ax + (bx - ax) * t1;
            const z1 = az + (bz - az) * t1;
            const y0 = this.hf.heightAt(x0, z0);
            const y1 = this.hf.heightAt(x1, z1);
            const post = B.cyl(0.07, 0.08, 1.15, 5, '#f4efe6');
            this.place({ solid: [post], glow: [] }, x0, y0 - 0.05, z0, 0);
            const segLen = Math.hypot(x1 - x0, z1 - z0, y1 - y0);
            const sy = Math.atan2(x1 - x0, z1 - z0);
            const pitch = Math.atan2(y1 - y0, Math.hypot(x1 - x0, z1 - z0));
            for (const ry of [0.45, 0.9]) {
              const rail = B.paint(new THREE.BoxGeometry(0.06, 0.09, segLen), '#f4efe6', new THREE.Matrix4().makeRotationX(-pitch));
              rail.applyMatrix4(new THREE.Matrix4().makeRotationY(sy).setPosition((x0 + x1) / 2, (y0 + y1) / 2 + ry, (z0 + z1) / 2));
              this.bucket(x0, z0).solid.push(rail);
            }
            this.addBox((x0 + x1) / 2, (z0 + z1) / 2, 0.2, segLen, sy, Math.min(y0, y1) - 1, Math.max(y0, y1) + 1.1, 'fence');
          }
        }
        break;
      }
      case 'lamp': {
        const y = this.hf.heightAt(x, z) - 0.05;
        this.place(B.lamp(h), x, y, z, yaw);
        this.colAdd('props', { kind: 'circle', x, z, r: 0.15, y0: y, y1: y + h, tag: 'lamp' });
        this.lampPositions.push(new THREE.Vector3(x + 0.55, y + h - 0.4, z));
        break;
      }
      case 'sign': {
        const y = this.hf.heightAt(x, z) - 0.05;
        this.place(B.sign(), x, y, z, yaw);
        this.addBox(x, z, 1.7, 0.2, yaw, y, y + 1.6, 'sign');
        break;
      }
      case 'crate': {
        const y = this.hf.heightAt(x, z) - 0.05;
        this.place(B.crate(w), x, y, z, yaw);
        this.addBox(x, z, w, w, yaw, y, y + w, 'crate');
        break;
      }
      case 'breakable-rock': {
        const y = this.hf.heightAt(x, z) - 0.2;
        this.place(B.breakableRock(w / 2), x, y, z, 0);
        this.colAdd(`blocker:${p.ref}`, { kind: 'circle', x, z, r: w / 2, y0: y, y1: y + h, tag: `blocker:${p.ref}` });
        break;
      }
      case 'cave-mouth': {
        // 贴着崖脚：取洞口前方 2 m 的地面高度，洞腔向崖内延伸
        const y = this.hf.heightAt(x + Math.sin(yaw) * 2, z + Math.cos(yaw) * 2) - 0.1;
        this.place(B.caveMouth(w, h), x, y, z, yaw);
        break;
      }
      case 'well': {
        const y = this.hf.heightAt(x, z) - 0.05;
        this.place(T.well(), x, y, z, yaw);
        this.colAdd('props', { kind: 'circle', x, z, r: 1.2, y0: y, y1: y + 3.5, tag: 'well' });
        break;
      }
      case 'market-stall': {
        const y = this.hf.heightAt(x, z) - 0.05;
        this.place(T.marketStall(w, h, d, roof, p.seed ?? Math.round(x * 3 + z), p.variant ?? 'fruit'), x, y, z, yaw);
        this.addBox(x, z, w, d, yaw, y, y + h, 'stall');
        break;
      }
      case 'glb':
        console.warn('[props] glb 摆放物将在美术资源到位后由 PropLoader 处理：', p.model);
        break;
      default:
        if (!this.addTownProp(p)) console.warn('[props] 未知摆放物类型', p.type);
        break;
    }
  }

  /** M1-02/03/04 城镇小品与水上结构；返回是否处理 */
  private addTownProp(p: PropInstance): boolean {
    const [x, z] = p.position;
    const [w, h, d] = p.size;
    const yaw = p.yaw;
    const wall = p.color ?? '#f2e6d0';
    const roof = p.roof ?? '#d9674e';
    const seed = p.seed ?? Math.round(x * 17 + z * 5);
    const collide = p.collide !== false;
    const ground = p.y ?? this.hf.heightAt(x, z) - 0.05;
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
    const bed = (deckY: number) => (lx: number, lz: number) => {
      const [wx, wz] = at(lx, lz);
      return this.hf.heightAt(wx, wz) - deckY;
    };
    const circle = (r: number, top: number, tag: string, cx = x, cz = z) => {
      if (collide) this.colAdd('props', { kind: 'circle', x: cx, z: cz, r, y0: ground, y1: ground + top, tag });
    };
    const rails = (deckY: number, rs: string, gaps: Array<[string, number, number]>) => {
      for (const seg of T.railSegments(w, d, rs, gaps)) {
        const [ax, az] = at(seg.ax, seg.az);
        const [bx, bz] = at(seg.bx, seg.bz);
        const len = Math.hypot(bx - ax, bz - az);
        this.addBox((ax + bx) / 2, (az + bz) / 2, 0.2, len + 0.1, Math.atan2(bx - ax, bz - az), deckY - 6, deckY + 1.1, 'deck-rail');
      }
    };
    switch (p.type) {
      case 'deck': {
        const deckY = p.y ?? 1.3;
        this.place(T.deck(w, d, bed(deckY), p.rails ?? 'nsew', p.gaps ?? []), x, deckY, z, yaw);
        this.addBox(x, z, w, d, yaw, deckY - 6, deckY, 'deck', true);
        rails(deckY, p.rails ?? 'nsew', p.gaps ?? []);
        return true;
      }
      case 'stilt-house': {
        const deckY = p.y ?? 6.1;
        this.place(T.stiltHouse(w, h, d, wall, roof, bed(deckY), seed, p.accent), x, deckY, z, yaw);
        this.addBox(x, z, w, d, yaw, deckY - 6, deckY, 'deck', true);
        rails(deckY, 'swe', [['s', 0, 1.6]]);
        const hd = d * 0.58;
        const [hx, hz] = at(0, -d / 2 + hd / 2 + 0.2);
        this.addBox(hx, hz, w - 0.8, hd, yaw, deckY, deckY + h, 'building:stilt-house');
        for (const sx of [-1, 1]) {
          const [lx, lz] = at(sx * (w / 2 - 1.1), -d / 2 + hd + 0.6);
          this.lampPositions.push(new THREE.Vector3(lx, deckY + h * 0.55 - 0.9, lz));
        }
        return true;
      }
      case 'shed': {
        this.place(T.shed(w, h, d, roof, p.variant, seed), x, ground, z, yaw);
        const nx = Math.max(1, Math.round(w / 3.5));
        for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) {
          const [px, pz] = at(-w / 2 + (i * w) / nx, (sz * d) / 2);
          circle(0.2, h, 'shed-post', px, pz);
        }
        if (p.variant !== 'pavilion') for (const sz of [-1, 1]) {
          const [cx, cz] = at(0, sz * (d / 2 - 1.0));
          this.addBox(cx, cz, w - 1.2, 1.2, yaw, ground, ground + 1.2, 'counter');
        }
        return true;
      }
      case 'windmill':
        this.place(T.windmill(w, h, wall, roof), x, ground, z, yaw);
        circle(w / 2, h, 'windmill');
        return true;
      case 'crane': {
        this.place(T.crane(w, h, d, wall), x, ground, z, yaw);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          const [px, pz] = at((sx * w) / 2, (sz * d) / 2);
          circle(0.7, h, 'crane-leg', px, pz);
        }
        return true;
      }
      case 'seawall':
        this.place(T.seawall(w, h, d), x, p.y ?? this.hf.heightAt(x, z), z, yaw);
        return true;
      case 'tree': {
        const v = p.variant ?? 'round';
        this.place(T.tree(h, v, seed), x, ground, z, yaw);
        circle(v === 'shrub' ? h * 0.45 : 0.35, h, 'tree');
        return true;
      }
      case 'bench':
        this.place(T.bench(w), x, ground, z, yaw);
        if (collide) this.addBox(x, z, w, 0.6, yaw, ground, ground + 0.9, 'bench');
        return true;
      case 'flowerbed': {
        const round = p.variant === 'round';
        this.place(T.flowerbed(w, d, seed, round), x, ground, z, yaw);
        if (round) circle(w / 2, 0.7, 'flowerbed');
        else if (collide) this.addBox(x, z, w, d, yaw, ground, ground + 0.7, 'flowerbed');
        return true;
      }
      case 'hedge':
        this.place(T.hedge(w, h, d, seed), x, ground, z, yaw);
        if (collide) this.addBox(x, z, w, d, yaw, ground, ground + h, 'hedge');
        return true;
      case 'mailbox':
        this.place(T.mailbox(p.color), x, ground, z, yaw);
        circle(0.25, 1.5, 'mailbox');
        return true;
      case 'barrel':
        this.place(T.barrel(p.color), x, ground, z, yaw);
        circle(0.4, 1.0, 'barrel');
        return true;
      case 'bollard':
        this.place(T.bollard(), x, ground, z, yaw);
        circle(0.25, 0.65, 'bollard');
        return true;
      case 'buoy':
        this.place(T.buoy(p.color), x, p.y ?? 0, z, yaw);
        return true;
      case 'rowboat':
        this.place(T.rowboat(w, d, p.color), x, p.y ?? 0, z, yaw);
        return true;
      case 'net-rack':
        this.place(T.netRack(w, h), x, ground, z, yaw);
        for (const sx of [-1, 1]) {
          const [px, pz] = at((sx * w) / 2, 0);
          circle(0.15, h, 'net-rack', px, pz);
        }
        return true;
      case 'fountain':
        this.place(T.fountain(w, p.color, p.variant), x, ground, z, yaw);
        circle(w / 2 + 0.1, 1.2, 'fountain');
        return true;
      case 'statue':
        this.place(T.statue(h, p.variant, p.color), x, ground, z, yaw);
        if (collide) this.addBox(x, z, 1.8, 1.8, yaw, ground, ground + h, 'statue');
        return true;
      case 'container':
        this.place(T.container(w, h, d, wall), x, ground, z, yaw);
        if (collide) this.addBox(x, z, w, d, yaw, ground, ground + h, 'container', true);
        return true;
      case 'lantern':
        this.place(T.lantern(h, p.color), x, ground, z, yaw);
        circle(0.14, h, 'lantern');
        {
          const [lx, lz] = at(0.7, 0);
          this.lampPositions.push(new THREE.Vector3(lx, ground + h - 0.8, lz));
        }
        return true;
      case 'reeds':
        this.place(T.reeds(w, seed), x, p.y ?? this.hf.heightAt(x, z), z, yaw);
        return true;
      case 'lilypads':
        this.place(T.lilypads(w, seed), x, p.y ?? 5, z, yaw);
        return true;
      case 'bunting': {
        const pts = (p.points ?? []).map(([px, pz]) => [px, (p.y ?? this.hf.heightAt(px, pz)) + h, pz] as const);
        const parts = T.bunting(pts, seed);
        const b = this.bucket(x || pts[0]![0], z || pts[0]![2]);
        b.solid.push(...parts.solid);
        return true;
      }
      case 'noticeboard':
        this.place(T.noticeboard(), x, ground, z, yaw);
        if (collide) this.addBox(x, z, 2.0, 0.3, yaw, ground, ground + 2.2, 'noticeboard');
        return true;
      case 'laundry':
        this.place(T.laundry(w, seed), x, ground, z, yaw);
        for (const sx of [-1, 1]) {
          const [px, pz] = at((sx * w) / 2, 0);
          circle(0.1, 2.1, 'laundry', px, pz);
        }
        return true;
      case 'garden':
        this.place(T.garden(w, d, p.variant, seed), x, ground, z, yaw);
        if (collide) this.addBox(x, z, w, d, yaw, ground, ground + 0.6, 'garden');
        return true;
      case 'rocks':
        this.place(T.rocks(w, seed, p.color), x, ground, z, yaw);
        circle(w * 0.4, w * 0.5, 'rocks');
        return true;
      default:
        return this.addTideProp(p, ground, circle, at);
    }
  }

  /** M2 碧潮群岛构件；返回是否处理 */
  private addTideProp(p: PropInstance, ground: number, circle: (r: number, top: number, tag: string, cx?: number, cz?: number) => void, at: (lx: number, lz: number) => [number, number]): boolean {
    const [x, z] = p.position;
    const [w, h, d] = p.size;
    const yaw = p.yaw;
    const seed = p.seed ?? Math.round(x * 17 + z * 5);
    const collide = p.collide !== false;
    switch (p.type) {
      case 'giant-tree': {
        this.place(TB.giantTree(h, seed), x, ground, z, yaw);
        const trunkR = h * 0.13;
        circle(trunkR * 1.5, h * 0.6, 'giant-tree');
        // 根拱：外圈 6 个矮圆柱挡住穿模
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + yaw;
          circle(trunkR * 0.45, 2.5, 'giant-root', x + Math.sin(a) * trunkR * 2.2, z + Math.cos(a) * trunkR * 2.2);
        }
        return true;
      }
      case 'treehouse': {
        const deckY = p.y ?? 4.5;
        this.place(TB.treehouse(w, h, d, deckY, p.roof ?? '#b8a05a', seed), x, ground, z, yaw);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          const [px, pz] = at(sx * (w / 2 - 0.4), sz * (d / 2 - 0.4));
          circle(0.45, deckY + h, 'treehouse-post', px, pz);
        }
        if (p.ref) {
          const [dx, dz] = at(0, d / 2 + 1.2);
          this.doors.set(p.ref, { position: new THREE.Vector3(dx, this.hf.heightAt(dx, dz), dz), yaw });
        }
        return true;
      }
      case 'rope-bridge': {
        const pts = (p.points ?? []).map(([px, pz], i) => [px - x, (p.y ?? this.hf.heightAt(px, pz)) + (i === 0 || i === (p.points?.length ?? 1) - 1 ? 0 : h) - ground, pz - z] as const);
        this.place(TB.ropeBridge(pts), x, ground, z, 0);
        return true;
      }
      case 'vine-wall': {
        this.place(TB.vineWall(w, h, seed), x, ground, z, yaw);
        if (p.ref) this.colAdd(`blocker:${p.ref}`, { kind: 'box', x, z, hx: w / 2, hz: 0.8, yaw, y0: ground, y1: ground + h, tag: `blocker:${p.ref}` });
        return true;
      }
      case 'boulder':
        this.place(TB.boulder(w / 2, seed), x, ground, z, yaw);
        if (p.ref) this.colAdd(`blocker:${p.ref}`, { kind: 'circle', x, z, r: w / 2, y0: ground, y1: ground + h, tag: `blocker:${p.ref}` });
        return true;
      case 'headframe':
        this.place(TB.headframe(w, h), x, ground, z, yaw);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          const [px, pz] = at((sx * w) / 2, (sz * w) / 2);
          circle(0.35, h, 'headframe-leg', px, pz);
        }
        return true;
      case 'rail': {
        const pts = p.points ?? [];
        for (let s = 0; s + 1 < pts.length; s++) {
          const [ax, az] = pts[s]!;
          const [bx, bz] = pts[s + 1]!;
          const len = Math.hypot(bx - ax, bz - az);
          const steps = Math.max(1, Math.ceil(len / 6));
          for (let i = 0; i < steps; i++) {
            const t = (i + 0.5) / steps;
            const cx = ax + (bx - ax) * t;
            const cz = az + (bz - az) * t;
            this.place(TB.railTrack(len / steps + 0.05), cx, this.hf.heightAt(cx, cz) - 0.02, cz, Math.atan2(bx - ax, bz - az));
          }
        }
        return true;
      }
      case 'mine-cart':
        this.place(TB.mineCart(seed, p.variant === 'anomaly'), x, ground, z, yaw);
        if (collide) this.addBox(x, z, 1.4, 2.0, yaw, ground, ground + 1.4, 'mine-cart');
        return true;
      case 'ore-pile':
        this.place(TB.orePile(w, seed), x, ground, z, yaw);
        circle(w * 0.4, w * 0.4, 'ore-pile');
        return true;
      case 'lava-vent':
        this.place(TB.lavaVent(w, seed), x, ground, z, yaw);
        circle(w * 0.5, 1.2, 'lava-vent');
        return true;
      case 'basalt':
        this.place(TB.basaltColumns(w, h, seed), x, ground, z, yaw);
        circle(w * 0.5, h, 'basalt');
        return true;
      case 'spring-rim':
        this.place(TB.springRim(w, d, seed), x, p.y ?? ground, z, yaw);
        return true;
      case 'pailou':
        this.place(TB.pailou(w, h, p.color), x, ground, z, yaw);
        for (const s of [-1, 1]) {
          const [px, pz] = at((s * w) / 2, 0);
          circle(0.6, h, 'pailou', px, pz);
        }
        return true;
      case 'stone-lantern':
        this.place(TB.stoneLantern(h), x, ground, z, yaw);
        circle(0.45, h, 'stone-lantern');
        this.lampPositions.push(new THREE.Vector3(x, ground + h * 0.55, z));
        return true;
      case 'bamboo-fence':
        this.place(TB.bambooFence(w, h), x, ground, z, yaw);
        if (collide) this.addBox(x, z, w, 0.3, yaw, ground, ground + h, 'bamboo-fence');
        return true;
      case 'ruin-pillar':
        this.place(TB.ruinPillar(h, seed, p.variant === 'anomaly'), x, ground, z, yaw);
        circle(0.75, h, 'ruin-pillar');
        return true;
      case 'ruin-arch':
        this.place(TB.ruinArch(w, h), x, ground, z, yaw);
        for (const s of [-1, 1]) {
          const [px, pz] = at((s * w) / 2, 0);
          if (collide) this.addBox(px, pz, 1.4, 1.4, yaw, ground, ground + h, 'ruin-arch');
        }
        return true;
      case 'stele':
        this.place(TB.stele(h), x, ground, z, yaw);
        if (collide) this.addBox(x, z, 1.6, 0.8, yaw, ground, ground + h, 'stele');
        return true;
      case 'coral':
        this.place(TB.coral(w, seed), x, p.y ?? this.hf.heightAt(x, z), z, yaw);
        return true;
      case 'shipwreck':
        this.place(TB.shipwreck(w, d), x, p.y ?? this.hf.heightAt(x, z), z, yaw);
        if (collide) this.addBox(x, z, w, d, yaw, -3, 2.2, 'shipwreck', true);
        return true;
      // ——— M3 雷鸣群岛 ———
      case 'lightning-tower':
        this.place(TH.lightningTower(w, h), x, ground, z, yaw);
        if (collide) this.addBox(x, z, w + 1.2, w + 1.2, yaw, ground, ground + h, 'lightning-tower');
        this.lampPositions.push(new THREE.Vector3(x, ground + h, z));
        this.strikeTargets.push(new THREE.Vector3(x, ground + h, z));
        return true;
      case 'sundial':
        this.place(TH.sundial(w), x, ground, z, yaw);
        circle(w / 2 + 0.2, 0.6, 'sundial');
        return true;
      case 'igloo':
        this.place(TH.igloo(w, seed), x, ground - 0.1, z, yaw);
        circle(w / 2, w / 2, 'igloo');
        if (p.ref) {
          const [dx, dz] = at(0, w / 2 + 1.6);
          this.doors.set(p.ref, { position: new THREE.Vector3(dx, this.hf.heightAt(dx, dz), dz), yaw });
        }
        return true;
      case 'sled':
        this.place(TH.sled(d, p.color), x, ground, z, yaw);
        if (collide) this.addBox(x, z, 1.1, d, yaw, ground, ground + 0.6, 'sled');
        return true;
      case 'snowman':
        this.place(TH.snowman(h, p.color), x, ground, z, yaw);
        circle(h * 0.22, h, 'snowman');
        return true;
      case 'glide-deck': {
        const top = p.y ?? ground;
        this.place(TH.glideDeck(w, d, p.color), x, top, z, yaw);
        this.addBox(x, z, w, d, yaw, top - 4, top + 0.3, 'glide-deck', true);
        return true;
      }
      case 'wind-turbine':
        this.place(TH.windTurbine(h, p.color), x, ground, z, yaw);
        circle(1.3, h, 'wind-turbine');
        this.lampPositions.push(new THREE.Vector3(x, ground + h, z));
        return true;
      // ——— M3-04 琉璃群岛 ———
      case 'karst-pinnacle':
        this.place(GL.karstPinnacle(w, h, seed, p.color), x, ground - 0.3, z, yaw);
        circle(w * 0.42, h, 'karst-pinnacle');
        return true;
      case 'dead-tree':
        this.place(GL.deadTree(h, seed, p.variant), x, ground, z, yaw);
        circle(0.35, h, 'dead-tree');
        return true;
      case 'tombstone':
        this.place(GL.tombstone(w, h, p.variant, seed), x, ground, z, yaw);
        if (collide) this.addBox(x, z, w * 1.25, 0.7, yaw, ground, ground + h, 'tombstone');
        return true;
      case 'glass-crystal':
        this.place(GL.glassCrystal(w, h, seed, p.color), x, ground - 0.1, z, yaw);
        circle(w * 0.35, h, 'glass-crystal');
        return true;
      case 'wisp':
        this.place(GL.wisp(h, p.color, seed), x, ground, z, yaw);
        return true;
      // ——— M3-11 幻影镇 ———
      case 'minaret': {
        const bw = Math.max(2.4, h * 0.11);
        this.place(GL.minaret(h, p.color, p.accent), x, ground - 0.1, z, yaw);
        if (collide) this.addBox(x, z, bw, bw, yaw, ground, ground + h, 'minaret');
        return true;
      }
      case 'mirage-gate': {
        this.place(GL.mirageGate(w, h, p.color, p.accent), x, ground - 0.05, z, yaw);
        for (const s of [-1, 1]) {
          const [px, pz] = at(s * (w / 2 + 1.1), 0);
          if (collide) this.addBox(px, pz, 2.2, 2.2, yaw, ground, ground + h, 'mirage-gate');
        }
        return true;
      }
      case 'prophecy-obelisk':
        this.place(GL.prophecyObelisk(h, seed), x, ground - 0.05, z, yaw);
        if (collide) this.addBox(x, z, 2.0, 2.0, yaw, ground, ground + h, 'prophecy-obelisk');
        this.lampPositions.push(new THREE.Vector3(x, ground + h + 1.6, z));
        return true;
      // ——— M3-12 幽冥镇 ———
      case 'bell-tower':
        this.place(GL.bellTower(w, h, p.color, p.roof), x, ground - 0.05, z, yaw);
        if (collide) this.addBox(x, z, w + 0.6, w + 0.6, yaw, ground, ground + h, 'bell-tower');
        this.lampPositions.push(new THREE.Vector3(x, ground + h * 0.7, z));
        return true;
      // ——— M3-14 彩幽市 ———
      case 'league-gate': {
        // 精灵联盟大门：台基可站立（顶 +1.2，前沿石阶）；四个墩柱 + 中门门扇（M3-21 由联盟入口开启）
        this.place(GL.leagueGate(w, h), x, ground, z, yaw);
        this.addBox(x, z, w + 6, 10, yaw, ground - 2, ground + 1.2, 'league-plinth', true);
        for (let k = 0; k < 4; k++) {
          const [sx, sz] = at(0, 5.5 + k);
          this.addBox(sx, sz, w * 0.6 - k * 0.4, 1, yaw, ground - 2, ground + 1.2 - k * 0.3, 'league-steps', true);
        }
        for (const lx of [-w / 2 + 1.6, -w * 0.165, w * 0.165, w / 2 - 1.6]) {
          const [px, pz] = at(lx, 0.6);
          this.addBox(px, pz, 3.4, 7.4, yaw, ground, ground + h, 'league-pier');
        }
        this.addBox(x, z, w, 0.6, yaw, ground, ground + h, 'league-door');
        this.lampPositions.push(new THREE.Vector3(x, ground + h * 0.75, z + 4));
        // M3-21 中门入口（台基顶面上、门扇正前方）
        if (p.ref) {
          const [dx, dz] = at(0, 1.1);
          this.doors.set(p.ref, { position: new THREE.Vector3(dx, ground + 1.2, dz), yaw });
        }
        return true;
      }
      // ——— M3-13 琉璃镇 ———
      case 'temple-gate': {
        // 海中石台：y = 海面（石台顶 +0.7 可站立）；门洞被封印光幕挡住（M3-18 潜水开放）
        const gy = p.y ?? 0;
        this.place(GL.templeGate(w, h, seed), x, gy, z, yaw);
        this.addBox(x, z, w + 3.4, 8.4, yaw, gy - 4, gy + 0.7, 'temple-platform', true);
        for (const sx of [-1, 1]) {
          const [cx, cz] = at(sx * (w / 2 - 0.4), 0);
          this.addBox(cx, cz, 1.8, 1.8, yaw, gy, gy + h, 'temple-pillar');
        }
        this.addBox(x, z, w - 2.4, 0.4, yaw, gy, gy + h, 'temple-seal');
        this.lampPositions.push(new THREE.Vector3(x, gy + h + w / 2 - 0.6, z));
        return true;
      }
      case 'ghost-lamp': {
        this.place(GL.ghostLamp(h, p.color), x, ground, z, yaw);
        circle(0.2, h, 'ghost-lamp');
        const [lx, lz] = at(0.75, 0);
        this.lampPositions.push(new THREE.Vector3(lx, ground + h - 0.7, lz));
        return true;
      }
      case 'moon-tower':
        this.place(GL.moonTower(w, h), x, ground - 0.1, z, yaw);
        circle(w * 0.6, h, 'moon-tower');
        this.lampPositions.push(new THREE.Vector3(x, ground + h * 0.85, z));
        return true;
      default:
        return false;
    }
  }

  /** 0 = 白天，1 = 深夜 */
  setNight(k: number): void {
    const v = THREE.MathUtils.lerp(0.9, 2.4, k);
    this.glowMaterial.color.setRGB(v, v * 0.95, v * 0.82);
    for (const ph of this.phases.values()) ph.glow.color.copy(this.glowMaterial.color);
  }

  dispose(): void {
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.solidMaterial.dispose();
    this.glowMaterial.dispose();
    this.collision.removeGroup('props');
    for (const ph of this.phases.values()) {
      this.collision.removeGroup(ph.key);
      ph.solid.dispose();
      ph.glow.dispose();
    }
  }
}
