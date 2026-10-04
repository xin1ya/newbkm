/**
 * M1-15 · 场景钓鱼：把 systems/fishing 的状态机接到 3D 表现与界面上。
 * - 钓竿（挂在玩家身侧）、钓线（竿梢 → 浮漂的下垂曲线）、红白浮漂
 * - 抛竿：浮漂沿抛物线飞到面前 2.5–11 m；落点不在水里时沿抛竿方向回退到最远的够深水面
 * - 等待：浮漂随波起伏；轻啄小晃 + 小波纹；咬钩猛沉 + 水花 + 「！」
 * - 收线：浮漂随进度被拉回、随鱼的拉力左右挣动；钓线张力越大越红
 * - 钓点：世界中可见的冒泡水花（config/fishing），落在钓点内等待更短、稀有鱼更常见
 * - 钓上来 → 进入 method = 'fish' 的野生战斗
 */
import * as THREE from 'three';
import type { Game } from '@/core/Game';
import type { GameState } from '@/systems/state/GameState';
import type { Dex } from '@/systems/data/Dex';
import type { Rng } from '@/systems/rng';
import type { PlayerController } from '@/actors/player';
import { bestRod, findFishingTable, fishStrength, FishingSession, MIN_CAST, RESULT_TEXT, RODS, rollFish, TENSION_SWEET, type FishEvent, type FishingSpot, type RodId } from '@/systems/fishing';
import { createWild, type TimeOfDay } from '@/systems/encounters';
import { FISH_STRENGTH, FISHING_SPOTS, FISHING_TABLES } from '@/config/fishing';
import { FishingHud, type FishingView } from '@/ui/hud/FishingHud';
import type { UiRoot } from '@/ui/core';
import { createToonMaterial, LAYER } from '@/render';
import { jingle, sfx } from '@/core/audio';

export interface FishingGround {
  heightAt(x: number, z: number): number;
  waterAt(x: number, z: number): { level: number; depth: number; body: string } | null;
}

export interface SceneFishingDeps {
  game: Game;
  ui: UiRoot;
  state: GameState;
  dex: Dex;
  rng: Rng;
  player: PlayerController;
  parent: THREE.Object3D;
  ground: FishingGround;
  zoneAt(x: number, z: number): string | null;
  time(): TimeOfDay;
  toast(text: string): void;
}

const MIN_FISH_DEPTH = 0.35;

interface SpotFx {
  spot: FishingSpot;
  x: number;
  z: number;
  level: number;
  group: THREE.Group;
  bubbles: { m: THREE.Mesh; t: number; life: number }[];
  rings: { m: THREE.Mesh; t: number }[];
  timer: number;
}

export class SceneFishing {
  session: FishingSession | null = null;
  hud: FishingHud | null = null;
  lastResult: string | null = null;
  lastCatch: number | null = null;
  private rod: THREE.Group | null = null;
  private line: THREE.Line | null = null;
  private bobber: THREE.Group | null = null;
  private ripple: THREE.Mesh | null = null;
  private rippleT = 99;
  private landing = new THREE.Vector3();
  private flight: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  private dunk = 0;
  private nibbleFlash = 0;
  private spot: FishingSpot | null = null;
  private waterBody = 'sea';
  private t = 0;
  private spots: SpotFx[] = [];
  private bubbleGeo = new THREE.SphereGeometry(0.06, 6, 5);
  private bubbleMat = new THREE.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, opacity: 0.85 });
  private ringGeo = new THREE.RingGeometry(0.3, 0.38, 24);
  private resolveDone: (() => void) | null = null;

  constructor(private readonly d: SceneFishingDeps) {
    this.buildSpots();
  }

  get active(): boolean {
    return !!this.session;
  }

  get rodId(): RodId | null {
    return bestRod(this.d.state.bag);
  }

  /** 钓点（已吸附到水面） */
  spotList(): { id: string; x: number; z: number; r: number }[] {
    return this.spots.map((s) => ({ id: s.spot.id, x: s.x, z: s.z, r: s.spot.radius }));
  }

  // ———————————————————— 开始 / 结束 ————————————————————

  /** 开始钓鱼（面朝水面按 F）；结束时 resolve */
  start(): Promise<void> {
    if (this.session) return Promise.resolve();
    const rod = this.rodId;
    if (!rod) {
      this.d.toast('需要钓竿才能钓鱼。');
      return Promise.resolve();
    }
    const { player } = this.d;
    player.velocity.set(0, 0, 0);
    const session = new FishingSession(
      {
        rod,
        spot: null,
        roll: () => {
          const table = findFishingTable(FISHING_TABLES, this.waterBody, this.d.zoneAt(this.landing.x, this.landing.z));
          return table ? rollFish(table, rod, this.d.time(), this.d.rng, this.spot) : null;
        },
        strength: (enc) => fishStrength(enc.speciesId, enc.level, FISH_STRENGTH),
      },
      this.d.rng,
    );
    this.session = session;
    this.spot = null;
    this.lastResult = null;
    this.lastCatch = null;
    this.buildRod();
    this.d.game.events.emit('fishing:start', { rod, spot: null });
    this.hud = this.d.ui.push(new FishingHud(this.d.ui, (dt, inp) => this.step(dt, inp), { confirm: 'E', cancel: 'Q' }));
    return new Promise((r) => (this.resolveDone = r));
  }

  private finish(): void {
    const s = this.session;
    this.session = null;
    this.hud = null;
    this.flight = null;
    this.clearGear();
    const res = s?.result ?? 'cancel';
    this.d.game.events.emit('fishing:end', { result: res, speciesId: res === 'landed' ? (s?.fish?.speciesId ?? null) : null });
    if (res === 'landed' && s?.fish) this.startBattle(s);
    const r = this.resolveDone;
    this.resolveDone = null;
    r?.();
  }

  private startBattle(s: FishingSession): void {
    const fish = s.fish!;
    const zone = this.d.zoneAt(this.landing.x, this.landing.z) ?? 'fishing';
    const wild = createWild(this.d.dex, fish, this.d.rng, { island: this.d.state.position.island, zone, level: fish.level });
    this.lastCatch = wild.speciesId;
    const p = this.d.player.position;
    this.d.game.events.post('encounter:start', {
      wild,
      position: { x: p.x, y: p.y, z: p.z },
      wildPosition: { x: this.landing.x, y: this.landing.y, z: this.landing.z },
      initiative: 'player',
      entityId: -1,
      zoneId: zone,
      alpha: false,
      method: 'fish',
    });
  }

  // ———————————————————— 每帧（由 HUD 驱动） ————————————————————

  private step(dt: number, inp: { pressed: boolean; holding: boolean; cancel: boolean }): FishingView {
    const s = this.session!;
    const events = s.update(dt, inp);
    this.handle(events, s);
    if (s.phase === 'reel' && inp.holding && Math.floor(this.t * 14) !== Math.floor((this.t - dt) * 14)) sfx('fish-reel', 0.6 + s.tension * 0.4);
    const done = s.done;
    const view: FishingView = {
      phase: s.phase,
      rodName: RODS[this.rodId ?? 'old-rod'].name,
      power: s.power,
      charging: s.phase === 'aim' && s.power > 0,
      tension: s.tension,
      progress: s.progress,
      pull: s.pull,
      surging: s.surging,
      sweet: TENSION_SWEET,
      nibble: this.nibbleFlash > 0,
      result: done ? this.resultText(s) : null,
      closeAfter: s.result === 'landed' ? 0.9 : s.result === 'cancel' ? 0.05 : 1.4,
    };
    if (done && !this.lastResult) {
      this.lastResult = s.result;
      setTimeout(() => this.finish(), (view.closeAfter ?? 1) * 1000 + 30);
    }
    return view;
  }

  private resultText(s: FishingSession): string {
    if (s.result === 'landed' && s.fish) return `钓到了 ${this.d.dex.species(s.fish.speciesId).name.zh}！`;
    return RESULT_TEXT[s.result ?? 'cancel'];
  }

  private handle(events: FishEvent[], s: FishingSession): void {
    for (const e of events) {
      switch (e.type) {
        case 'cast':
          this.cast(e.distance);
          sfx('fish-cast');
          break;
        case 'splash':
          sfx('fish-plop');
          this.showRipple(1);
          break;
        case 'nibble':
          sfx('fish-nibble');
          this.nibbleFlash = 0.45;
          this.dunk = 0.08;
          this.showRipple(0.6);
          break;
        case 'bite':
          sfx('fish-bite');
          this.dunk = 0.3;
          this.showRipple(1.4);
          break;
        case 'hooked':
          sfx('confirm');
          break;
        case 'surge':
          this.showRipple(1);
          break;
        case 'end':
          if (e.result === 'landed') {
            sfx('splash');
            void jingle('jingle-fish');
          } else if (e.result === 'snapped') sfx('fish-snap');
          else if (e.result === 'escaped' || e.result === 'missed' || e.result === 'scared') sfx('fish-escape');
          else if (e.result === 'shore') sfx('bump');
          void s;
          break;
      }
    }
  }

  /** 计算落点：沿朝向 distance 米；不在水里时回退到最远的够深水面 */
  private cast(distance: number): void {
    const p = this.d.player.position;
    const yaw = this.d.player.facing;
    let best: THREE.Vector3 | null = null;
    for (let dist = distance; dist >= MIN_CAST - 1; dist -= 0.25) {
      const x = p.x + Math.sin(yaw) * dist;
      const z = p.z + Math.cos(yaw) * dist;
      const w = this.d.ground.waterAt(x, z);
      if (w && w.level - this.d.ground.heightAt(x, z) >= MIN_FISH_DEPTH) {
        best = new THREE.Vector3(x, w.level, z);
        this.waterBody = w.body;
        break;
      }
    }
    const tip = this.rodTip();
    const to = best ?? new THREE.Vector3(p.x + Math.sin(yaw) * distance, this.d.ground.heightAt(p.x + Math.sin(yaw) * distance, p.z + Math.cos(yaw) * distance), p.z + Math.cos(yaw) * distance);
    this.landing.copy(to);
    this.flight = { from: tip, to: to.clone(), t: 0 };
    this.spot = best ? (this.spots.find((s) => Math.hypot(s.x - to.x, s.z - to.z) <= s.spot.radius)?.spot ?? null) : null;
    // 钓点加成：替换会话里的钓点（影响等待时间与稀有权重）
    this.session?.setSpot(this.spot);
    this.inWater = !!best;
  }

  private inWater = false;

  // ———————————————————— 3D 表现 ————————————————————

  private buildRod(): void {
    const g = new THREE.Group();
    g.name = 'fishing-rod';
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.025, 2.2, 6), createToonMaterial({ color: '#7a5230' }));
    pole.position.y = 1.1;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8), createToonMaterial({ color: '#2d3550' }));
    grip.position.y = 0.2;
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), createToonMaterial({ color: '#c9ced9' }));
    reel.rotation.z = Math.PI / 2;
    reel.position.set(0.05, 0.42, 0);
    g.add(pole, grip, reel);
    g.position.set(0.3, 0.95, 0.15);
    g.rotation.x = 1.05;
    g.traverse((o) => o.layers.set(LAYER.CHARACTERS));
    this.d.player.root.add(g);
    this.rod = g;

    const bob = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), createToonMaterial({ color: '#e8484a' }));
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), createToonMaterial({ color: '#ffffff' }));
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 5), createToonMaterial({ color: '#27304a' }));
    stick.position.y = 0.13;
    bob.add(top, bottom, stick);
    bob.name = 'fishing-bobber';
    bob.visible = false;
    bob.traverse((o) => o.layers.set(LAYER.FX));
    this.d.parent.add(bob);
    this.bobber = bob;

    const lineGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 16 }, () => new THREE.Vector3()));
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf4f4f4, transparent: true, opacity: 0.9 }));
    line.frustumCulled = false;
    line.layers.set(LAYER.FX);
    line.visible = false;
    this.d.parent.add(line);
    this.line = line;

    const ripple = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    ripple.rotation.x = -Math.PI / 2;
    ripple.layers.set(LAYER.FX);
    this.d.parent.add(ripple);
    this.ripple = ripple;
  }

  private rodTip(out = new THREE.Vector3()): THREE.Vector3 {
    if (!this.rod) return out.copy(this.d.player.position);
    this.rod.updateWorldMatrix(true, false);
    return out.set(0, 2.2, 0).applyMatrix4(this.rod.matrixWorld);
  }

  private showRipple(scale: number): void {
    if (!this.ripple) return;
    this.rippleT = 0;
    this.ripple.userData.scale = scale;
  }

  private clearGear(): void {
    for (const o of [this.rod, this.bobber, this.line, this.ripple]) {
      if (!o) continue;
      o.removeFromParent();
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.geometry && m.geometry !== this.ringGeo) m.geometry.dispose();
      });
    }
    this.rod = this.bobber = null;
    this.line = null;
    this.ripple = null;
  }

  /** 渲染帧 */
  update(dt: number): void {
    this.t += dt;
    this.updateSpots(dt);
    const s = this.session;
    if (!s || !this.bobber || !this.line) return;
    if (this.nibbleFlash > 0) this.nibbleFlash -= dt;
    const tip = this.rodTip();
    const bob = this.bobber;
    // 竿随阶段摆动
    if (this.rod) {
      const want = s.phase === 'aim' ? 1.05 - s.power * 0.9 : s.phase === 'reel' ? 0.55 + Math.sin(this.t * 18) * 0.03 * s.pull + (s.surging ? 0.15 : 0) : 1.05;
      this.rod.rotation.x += (want - this.rod.rotation.x) * Math.min(1, dt * 10);
    }
    if (this.flight) {
      const f = this.flight;
      f.t += dt / 0.55;
      const k = Math.min(1, f.t);
      bob.visible = true;
      bob.position.lerpVectors(f.from, f.to, k);
      bob.position.y += Math.sin(k * Math.PI) * (1.2 + f.from.distanceTo(f.to) * 0.15);
      if (k >= 1) {
        this.flight = null;
        this.handle(s.setLanding(this.inWater), s);
      }
    } else if (s.phase === 'wait' || s.phase === 'bite') {
      bob.position.set(this.landing.x, this.landing.y + Math.sin(this.t * 2.4) * 0.025 - this.dunk, this.landing.z);
      this.dunk = Math.max(s.phase === 'bite' ? 0.18 : 0, this.dunk - dt * 0.6);
      if (s.phase === 'bite') bob.position.x += Math.sin(this.t * 40) * 0.03;
    } else if (s.phase === 'reel') {
      const p = this.d.player.position;
      const k = Math.min(0.85, s.progress * 0.85);
      const x = this.landing.x + (p.x - this.landing.x) * k + Math.sin(this.t * 7) * 0.25 * s.pull;
      const z = this.landing.z + (p.z - this.landing.z) * k + Math.cos(this.t * 5) * 0.25 * s.pull;
      const w = this.d.ground.waterAt(x, z);
      bob.position.set(x, (w?.level ?? this.landing.y) - 0.08 - (s.surging ? 0.1 : 0), z);
    }
    // 钓线：竿梢 → 浮漂的下垂曲线（张力越大越直、越红）
    const pts = this.line.geometry.attributes.position as THREE.BufferAttribute;
    const tension = s.phase === 'reel' ? Math.min(1, s.tension) : s.phase === 'aim' ? 1 : 0.15;
    const sag = (1 - tension) * Math.min(1.2, tip.distanceTo(bob.position) * 0.12);
    for (let i = 0; i < pts.count; i++) {
      const k = i / (pts.count - 1);
      const x = tip.x + (bob.position.x - tip.x) * k;
      const y = tip.y + (bob.position.y + 0.1 - tip.y) * k - Math.sin(k * Math.PI) * sag;
      const z = tip.z + (bob.position.z - tip.z) * k;
      pts.setXYZ(i, x, y, z);
    }
    pts.needsUpdate = true;
    this.line.visible = bob.visible && s.phase !== 'aim';
    (this.line.material as THREE.LineBasicMaterial).color.setRGB(0.96, 0.96 - tension * 0.55, 0.96 - tension * 0.6);
    // 波纹
    if (this.ripple) {
      this.rippleT += dt;
      const a = Math.min(1, this.rippleT / 0.9);
      const sc = (this.ripple.userData.scale as number | undefined) ?? 1;
      this.ripple.position.set(bob.position.x, this.landing.y + 0.02, bob.position.z);
      this.ripple.scale.setScalar((0.6 + a * 2.2) * sc);
      (this.ripple.material as THREE.MeshBasicMaterial).opacity = a >= 1 ? 0 : 0.7 * (1 - a);
    }
  }

  // ———————————————————— 钓点 ————————————————————

  private buildSpots(): void {
    for (const spot of FISHING_SPOTS) {
      // 吸附到附近足够深的水面
      let best: { x: number; z: number; level: number; d: number } | null = null;
      for (let r = 0; r <= 16; r += 1) {
        for (let a = 0; a < 16; a++) {
          const x = spot.position[0] + Math.cos((a / 16) * Math.PI * 2) * r;
          const z = spot.position[1] + Math.sin((a / 16) * Math.PI * 2) * r;
          const w = this.d.ground.waterAt(x, z);
          if (!w || w.level - this.d.ground.heightAt(x, z) < 0.8) continue;
          if (!best || r < best.d) best = { x, z, level: w.level, d: r };
        }
        if (best) break;
      }
      if (!best) continue;
      const group = new THREE.Group();
      group.name = `fishing-spot:${spot.id}`;
      group.position.set(best.x, best.level, best.z);
      this.d.parent.add(group);
      this.spots.push({ spot, x: best.x, z: best.z, level: best.level, group, bubbles: [], rings: [], timer: 0 });
    }
  }

  private updateSpots(dt: number): void {
    const p = this.d.player.position;
    for (const s of this.spots) {
      const near = Math.hypot(s.x - p.x, s.z - p.z) < 90;
      s.group.visible = near;
      if (!near) continue;
      s.timer -= dt;
      if (s.timer <= 0) {
        s.timer = 0.12 + Math.random() * 0.25;
        const m = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * s.spot.radius * 0.6;
        m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        m.scale.setScalar(0.6 + Math.random() * 0.9);
        m.layers.set(LAYER.FX);
        s.group.add(m);
        s.bubbles.push({ m, t: 0, life: 0.5 + Math.random() * 0.5 });
        if (Math.random() < 0.3) {
          const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(m.position.x, 0.02, m.position.z);
          ring.layers.set(LAYER.FX);
          s.group.add(ring);
          s.rings.push({ m: ring, t: 0 });
        }
      }
      for (const b of s.bubbles) {
        b.t += dt;
        b.m.position.y = Math.sin((b.t / b.life) * Math.PI) * 0.12;
      }
      s.bubbles = s.bubbles.filter((b) => {
        if (b.t < b.life) return true;
        b.m.removeFromParent();
        return false;
      });
      for (const r of s.rings) {
        r.t += dt;
        r.m.scale.setScalar(1 + r.t * 3);
        (r.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.5 * (1 - r.t / 1.1));
      }
      s.rings = s.rings.filter((r) => {
        if (r.t < 1.1) return true;
        r.m.removeFromParent();
        (r.m.material as THREE.Material).dispose();
        return false;
      });
    }
  }

  dispose(): void {
    this.clearGear();
    for (const s of this.spots) s.group.removeFromParent();
    this.spots = [];
  }
}
