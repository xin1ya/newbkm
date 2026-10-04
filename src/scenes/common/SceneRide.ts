/**
 * M1-12 · 场景骑乘控制（大地图）：
 * - 上水：水边互动（「骑上水面」）或骑乘键 C → 选坐骑 → 跳上水面 → 玩家切到 surf 模式、坐骑挂到脚下
 * - 下水：朝岸边推进 0.2 s 自动跳上岸；或在岸边按 C；进入室内 / 读档时强制下水
 * - 水下暗影：玩家周围深水处漂游的暗影（设计 §3.4：海里有可见宝可梦 + 暗影里的隐藏遇敌），
 *   骑乘穿过暗影时按距离掷骰，触发 method = 'surf' 的遇敌
 * - 事件 ride:change；调试挂钩在 main.ts（window.__cuilanRide）
 */
import * as THREE from 'three';
import type { Game } from '@/core/Game';
import type { GameState } from '@/systems/state/GameState';
import type { Dex } from '@/systems/data/Dex';
import type { Rng } from '@/systems/rng';
import type { PlayerController } from '@/actors/player';
import { RideMount, SADDLE_HEIGHT } from '@/actors/player/RideMount';
import { chooseMount, rideFor, shadowEncounterChance, SURF_ENTER_DEPTH, SURF_SINK, type MountChoice, type RideDef } from '@/systems/ride';
import { createWild, rollEncounter, type EncounterTable, type FieldWeather, type TimeOfDay } from '@/systems/encounters';
import { probeWaterAhead } from '@/systems/interaction';
import { RIDES } from '@/config/rides';
import { LAYER } from '@/render';
import { sfx } from '@/core/audio';

export interface RideGround {
  heightAt(x: number, z: number): number;
  waterAt(x: number, z: number): { level: number; depth: number; body: string } | null;
}

export interface SceneRideDeps {
  game: Game;
  state: GameState;
  dex: Dex;
  rng: Rng;
  player: PlayerController;
  /** 尾迹 / 暗影挂载点（世界坐标） */
  parent: THREE.Object3D;
  ground: RideGround;
  toast(text: string): void;
  /** 该点的水上遇敌表与区域 id */
  surfTableAt(x: number, z: number): { table: EncounterTable; zoneId: string } | null;
  time(): TimeOfDay;
  weather(): FieldWeather;
  /** 能否接受骑乘操作（非战斗 / 非对话 / 非菜单） */
  canAct(): boolean;
  /** 能否触发遇敌 */
  canEncounter(): boolean;
}

interface Shadow {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  r: number;
  phase: number;
}

const SHADOW_MAX = 6;
const SHADOW_NEAR = 10;
const SHADOW_FAR = 38;

export class SceneRide {
  ride: RideDef | null = null;
  mount: RideMount | null = null;
  mountChoice: MountChoice | null = null;
  busy = false;
  private shoreTimer = 0;
  private shadows: Shadow[] = [];
  private shadowGeo = new THREE.CircleGeometry(1, 28);
  private shadowTimer = 0;
  /** 最近一次暗影遇敌（调试） */
  lastShadowEncounter: number | null = null;

  constructor(private readonly d: SceneRideDeps) {}

  get surfing(): boolean {
    return this.d.player.mode === 'surf';
  }

  get shadowCount(): number {
    return this.shadows.length;
  }

  shadowPositions(): { x: number; z: number; r: number }[] {
    return this.shadows.map((s) => ({ x: s.x, z: s.z, r: s.r }));
  }

  /** 当前可用的水上骑乘能力（未解锁为 null） */
  waterRide(): RideDef | null {
    return rideFor(RIDES, 'water', this.d.state.flags);
  }

  /** 玩家面前可以上水的点 */
  entryPoint(): { x: number; z: number; level: number } | null {
    const p = this.d.player.position;
    const depthAt = (x: number, z: number) => {
      const w = this.d.ground.waterAt(x, z);
      return w ? w.level - this.d.ground.heightAt(x, z) : 0;
    };
    const hit = probeWaterAhead(p.x, p.z, this.d.player.facing, depthAt, 2.5, SURF_ENTER_DEPTH);
    if (!hit) return null;
    const w = this.d.ground.waterAt(hit.x, hit.z);
    return w ? { x: hit.x, z: hit.z, level: w.level } : null;
  }

  /** 上水（从互动或骑乘键调用） */
  async start(target?: { x: number; z: number; level: number }, instant = false): Promise<boolean> {
    if (this.surfing || this.busy) return false;
    const ride = this.waterRide();
    if (!ride) {
      this.d.toast('需要「水上骑乘」能力才能在水面移动。');
      return false;
    }
    const at = target ?? this.entryPoint();
    if (!at) {
      this.d.toast('前方的水不够深，无法骑乘。');
      return false;
    }
    this.busy = true;
    const { player, dex, state } = this.d;
    const choice = chooseMount(dex, state.party, ride);
    this.ride = ride;
    this.mountChoice = choice;
    const inst = state.party.find((p) => p.uid === choice.uid);
    const sp = dex.species(choice.speciesId);
    const mount = new RideMount({ speciesId: choice.speciesId, types: sp.types, nickname: choice.nickname, shiny: !!inst?.shiny }, this.d.parent);
    this.mount = mount;
    // 先跳到水面，再挂上坐骑（落水时溅起水花）；读档恢复时直接骑在水面上
    player.mode = 'surf';
    player.surfSpeed = ride.speed;
    player.surfSprint = ride.sprint;
    if (instant) player.teleport(at.x, at.z);
    else {
      sfx('surf-mount');
      await player.hop(at.x, at.level - SURF_SINK, at.z, 0.5, 1.0);
    }
    player.root.add(mount.root);
    player.model.root.position.y = SADDLE_HEIGHT;
    if (!instant) {
      sfx('splash');
      this.d.toast(choice.uid ? `骑上了${choice.nickname}！` : `租借的${choice.nickname}载着你出发了！`);
    }
    this.d.game.events.emit('ride:change', { mode: 'surf', ride: ride.id, speciesId: choice.speciesId });
    this.busy = false;
    return true;
  }

  /** 下水到指定陆地点 */
  async stop(to: { x: number; y: number; z: number } | null, instant = false): Promise<void> {
    if (!this.surfing || (this.busy && !instant)) return;
    this.busy = true;
    const { player } = this.d;
    player.shoreAhead = null;
    if (to && !instant) {
      sfx('surf-dismount');
      this.detachMount();
      player.mode = 'walk';
      await player.hop(to.x, to.y, to.z, 0.45, 0.8);
    } else {
      this.detachMount();
      player.mode = 'walk';
      if (to) player.teleport(to.x, to.z);
    }
    this.clearShadows();
    this.d.game.events.emit('ride:change', { mode: 'walk', ride: this.ride?.id ?? 'water', speciesId: this.mountChoice?.speciesId ?? 0 });
    this.ride = null;
    this.mountChoice = null;
    this.busy = false;
  }

  private detachMount(): void {
    this.mount?.dispose();
    this.mount = null;
    this.d.player.model.root.position.y = 0;
  }

  /** 骑乘键（C）：在水边上水 / 在岸边下水 */
  async toggle(): Promise<void> {
    if (this.busy) return;
    if (this.surfing) {
      const p = this.d.player;
      const land = this.findLandNearby();
      if (land) await this.stop(land);
      else this.d.toast('附近没有可以上岸的地方。');
      void p;
      return;
    }
    await this.start();
  }

  /** 水上骑乘时，面前 / 周围 2.5 m 内可登岸的点（优先面朝方向） */
  findLandNearby(): { x: number; y: number; z: number } | null {
    const p = this.d.player;
    const pos = p.position;
    const dirs = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, Math.PI];
    for (const a of dirs) {
      const yaw = p.facing + a;
      for (const dist of [1, 1.6, 2.2, 2.8]) {
        const x = pos.x + Math.sin(yaw) * dist;
        const z = pos.z + Math.cos(yaw) * dist;
        const f = p.standableOnFoot(x, z, pos.y);
        if (f.ok) return { x, y: f.y, z };
      }
    }
    return null;
  }

  fixedUpdate(dt: number, rideKey: boolean, pushing: boolean): void {
    if (!this.surfing) {
      if (rideKey && this.d.canAct()) void this.toggle();
      return;
    }
    if (this.busy || this.d.player.hopping) return;
    if (rideKey && this.d.canAct()) {
      void this.toggle();
      return;
    }
    // 朝岸边推进 → 自动登岸
    const shore = this.d.player.shoreAhead;
    if (shore && pushing && this.d.canAct()) {
      this.shoreTimer += dt;
      if (this.shoreTimer > 0.2) {
        this.shoreTimer = 0;
        void this.stop(shore);
        return;
      }
    } else this.shoreTimer = 0;
    this.updateShadows(dt);
  }

  /** 渲染帧：坐骑动画 / 尾迹 / 暗影摆动 */
  update(dt: number): void {
    const p = this.d.player;
    if (this.mount) {
      const w = this.d.ground.waterAt(p.position.x, p.position.z);
      this.mount.update(dt, Math.hypot(p.velocity.x, p.velocity.z), p.facing, p.position, w?.level ?? p.position.y + SURF_SINK);
    }
    for (const s of this.shadows) {
      s.phase += dt;
      const k = 1 + Math.sin(s.phase * 1.7) * 0.06;
      s.mesh.scale.set(s.r * k, s.r * (2 - k) * 0.7, 1);
      s.mesh.rotation.z = Math.atan2(s.vx, s.vz);
      s.mesh.position.set(s.x, s.mesh.position.y, s.z);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.34 + Math.sin(s.phase * 0.9) * 0.06;
    }
  }

  // ———————————————————— 水下暗影 ————————————————————

  private updateShadows(dt: number): void {
    const p = this.d.player.position;
    const here = this.d.surfTableAt(p.x, p.z);
    // 漂游
    for (const s of this.shadows) {
      const nx = s.x + s.vx * dt;
      const nz = s.z + s.vz * dt;
      const w = this.d.ground.waterAt(nx, nz);
      if (w && w.depth > 1.1) {
        s.x = nx;
        s.z = nz;
      } else {
        s.vx = -s.vx + (this.d.rng.next() - 0.5) * 0.3;
        s.vz = -s.vz + (this.d.rng.next() - 0.5) * 0.3;
      }
    }
    // 回收太远的
    this.shadows = this.shadows.filter((s) => {
      if (Math.hypot(s.x - p.x, s.z - p.z) < SHADOW_FAR + 6) return true;
      s.mesh.removeFromParent();
      (s.mesh.material as THREE.Material).dispose();
      return false;
    });
    // 补充
    this.shadowTimer -= dt;
    if (here && this.shadowTimer <= 0 && this.shadows.length < SHADOW_MAX) {
      this.shadowTimer = 0.6;
      this.spawnShadow(p.x, p.z);
    }
    // 穿过暗影
    if (!this.d.canEncounter() || !here) return;
    const moved = this.d.player.movedThisStep;
    if (moved <= 0) return;
    for (const s of this.shadows) {
      if (Math.hypot(s.x - p.x, s.z - p.z) > s.r + 0.6) continue;
      const open = (this.d.ground.waterAt(p.x, p.z)?.body ?? '') === 'sea';
      if (!this.d.rng.chance(shadowEncounterChance(moved, open))) continue;
      const enc = rollEncounter(here.table, { time: this.d.time(), weather: this.d.weather(), method: 'surf' }, this.d.rng, this.d.dex);
      if (!enc) return;
      const wild = createWild(this.d.dex, enc, this.d.rng, { island: this.d.state.position.island, zone: here.zoneId, level: enc.level });
      this.lastShadowEncounter = wild.speciesId;
      this.removeShadow(s);
      sfx('splash');
      const wp = { x: p.x + Math.sin(this.d.player.facing) * 3.5, y: p.y, z: p.z + Math.cos(this.d.player.facing) * 3.5 };
      this.d.game.events.post('encounter:start', { wild, position: { x: p.x, y: p.y, z: p.z }, wildPosition: wp, initiative: null, entityId: -1, zoneId: here.zoneId, alpha: !!wild.alpha, method: 'surf' });
      return;
    }
  }

  private spawnShadow(px: number, pz: number): void {
    const rng = this.d.rng;
    for (let tries = 0; tries < 6; tries++) {
      const a = rng.next() * Math.PI * 2;
      const dist = SHADOW_NEAR + rng.next() * (SHADOW_FAR - SHADOW_NEAR);
      const x = px + Math.cos(a) * dist;
      const z = pz + Math.sin(a) * dist;
      const w = this.d.ground.waterAt(x, z);
      if (!w || w.depth < 1.4 || !this.d.surfTableAt(x, z)) continue;
      this.addShadow(x, z, w.level, 1.1 + rng.next() * 0.9);
      return;
    }
  }

  /** 直接放一个暗影（调试 / e2e） */
  addShadow(x: number, z: number, level: number, r = 1.4): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0x0b2238, transparent: true, opacity: 0.36, depthWrite: false });
    const mesh = new THREE.Mesh(this.shadowGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, level + 0.02, z);
    mesh.layers.set(LAYER.FX);
    mesh.name = 'surf-shadow';
    mesh.renderOrder = 2;
    this.d.parent.add(mesh);
    const a = this.d.rng.next() * Math.PI * 2;
    const sp = 0.4 + this.d.rng.next() * 0.5;
    this.shadows.push({ mesh, x, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, r, phase: this.d.rng.next() * 6 });
  }

  private removeShadow(s: Shadow): void {
    s.mesh.removeFromParent();
    (s.mesh.material as THREE.Material).dispose();
    this.shadows = this.shadows.filter((x) => x !== s);
  }

  clearShadows(): void {
    for (const s of [...this.shadows]) this.removeShadow(s);
  }

  dispose(): void {
    this.clearShadows();
    this.detachMount();
    this.shadowGeo.dispose();
  }
}
