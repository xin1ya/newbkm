/**
 * M3-22 城镇快速旅行（B 键 / 大地图「飞行」）：骑飞行宝可梦飞往已登记的宝可梦中心，跨岛也可以。
 *
 * 演出：
 * 1. 起飞：骑上坐骑（SceneFly.takeoff 强制模式），盘旋爬升约 28 m、抬头，镜头跟随 → 渐黑；
 * 2. 同岛：在目的地宝可梦中心门外上空出现，沿门口朝外方向斜着滑翔降落 → 落地下坐骑；
 * 3. 跨岛：写入目的地 + pendingFlyArrival → 存档重载（沿用岛间旅行的重载流程），
 *    新场景加载完成后在门外上空播放同样的降落演出（arrive）。
 * 登记：靠近宝可梦中心（45 m）自动登记飞行点并提示；旧存档按到访区域补登记。
 */
import * as THREE from 'three';
import type { Game } from '@/core/Game';
import type { GameState, IslandId } from '@/systems/state/GameState';
import type { PlayerController } from '@/actors/player';
import type { UiRoot } from '@/ui/core/UiRoot';
import type { Transition } from '@/ui/core/Transition';
import { FlyPicker, type FlyPickerGroup } from '@/ui/map/FlyPicker';
import { allFlyPoints, backfillFromZones, fastTravelBlock, groupedFlyPoints, revealNear, type FlyIslandSource, type FlyPoint } from '@/systems/travel/fastTravel';
import { sfx } from '@/core/audio';
import type { SceneFly } from './SceneFly';

export interface FastTravelIsland extends FlyIslandSource {
  size: [number, number];
}

export interface SceneFastTravelDeps {
  game: Game;
  state: GameState;
  ui: UiRoot;
  transition: Transition;
  player: PlayerController;
  fly: SceneFly;
  islands: readonly FastTravelIsland[];
  currentIsland: IslandId;
  toast(text: string, ms?: number): void;
  /** 非战斗 / 对话 / 菜单 / 进门中 */
  canAct(): boolean;
  indoors(): boolean;
  surfing(): boolean;
  /** 门外地面位置 + 朝外方向（当前岛） */
  doorOf(poiId: string): { position: THREE.Vector3; yaw: number } | null;
  heightAt(x: number, z: number): number;
  /** 同岛瞬移后的刷新（地块、刷怪、跟随宝可梦、镜头、区域） */
  afterTeleport(x: number, z: number): void;
  /** 起飞前清理（自动寻路 / 自动战斗 / 下自行车） */
  beforeStart(): void;
  /** 跨岛：写入目的地并重载 */
  travelTo(to: IslandId, x: number, z: number, yaw: number): Promise<void>;
  mapFor(island: IslandId): Promise<HTMLCanvasElement | null>;
}

/** 爬升高度 / 降落起点高度（米） */
const RISE = 28;
const DESCENT_H = 26;
/** 降落起点：门外落点沿朝外方向再退多远（米） */
const DESCENT_BACK = 34;
/** 落点：门外再往外几米（避开门口触发区） */
const LAND_OUT = 5;

interface Tween {
  t: number;
  dur: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  pitch: [number, number];
  /** 盘旋：起飞时绕圈转向 */
  spin: number;
  yaw0: number;
  ease: (k: number) => number;
  resolve: () => void;
}

const easeInOut = (k: number) => k * k * (3 - 2 * k);
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);

export class SceneFastTravel {
  busy = false;
  private tween: Tween | null = null;
  private readonly points: FlyPoint[];
  private revealTimer = 0;
  private readonly tmp = new THREE.Vector3();

  constructor(private readonly d: SceneFastTravelDeps) {
    this.points = allFlyPoints(d.islands);
    backfillFromZones(d.state, d.islands);
  }

  /** 每个固定步：登记附近飞行点（0.5 s 检查一次）、推进起降动画 */
  fixedUpdate(dt: number, key: boolean): void {
    if (this.tween) this.stepTween(dt);
    if (this.busy) return;
    this.revealTimer -= dt;
    if (this.revealTimer <= 0 && !this.d.indoors()) {
      this.revealTimer = 0.5;
      const p = this.d.player.position;
      for (const fp of revealNear(this.d.state, this.points, this.d.currentIsland, p.x, p.z)) {
        sfx('confirm', 0.6);
        this.d.toast(`已登记飞行点：${fp.name}\n拿到徽章后按 B 可以随时飞回这里。`, 3500);
      }
    }
    if (key && this.d.canAct()) void this.open();
  }

  private hereRadius = 30;

  private nearestHere(): string | null {
    const p = this.d.player.position;
    let best: string | null = null;
    let bd = this.hereRadius;
    for (const fp of this.points) {
      if (fp.island !== this.d.currentIsland) continue;
      const dd = Math.hypot(fp.x - p.x, fp.z - p.z);
      if (dd < bd) {
        bd = dd;
        best = fp.id;
      }
    }
    return best;
  }

  /** 打开目的地选单；选中后执行飞行 */
  async open(): Promise<void> {
    if (this.busy) return;
    const { state, player, fly } = this.d;
    const why = fastTravelBlock(state, {
      hasFlyRide: !!fly.flyRide(),
      indoors: this.d.indoors(),
      mode: this.d.surfing() ? 'surf' : player.mode,
      busy: fly.busy || player.hopping,
    });
    if (why) {
      this.d.toast(why);
      return;
    }
    this.busy = true;
    try {
      const groups: FlyPickerGroup[] = groupedFlyPoints(state, this.d.islands).map((g) => ({ ...g, worldSize: this.d.islands.find((i) => i.id === g.island)!.size }));
      const picker = this.d.ui.push(new FlyPicker(this.d.ui, { groups, currentIsland: this.d.currentIsland, player: { x: player.position.x, z: player.position.z, facing: player.facing }, herePoint: this.nearestHere(), mapFor: (id) => this.d.mapFor(id) }));
      const dest = await picker.done;
      this.d.ui.remove(picker);
      if (!dest) return;
      await this.flyTo(dest);
    } finally {
      this.busy = false;
    }
  }

  /** 起飞 → 渐黑 → 同岛滑翔降落 / 跨岛重载 */
  async flyTo(dest: FlyPoint): Promise<void> {
    const { player, fly } = this.d;
    this.d.beforeStart();
    if (!fly.flying && !fly.takeoff(true, true)) {
      this.d.toast('现在没办法起飞。');
      return;
    }
    player.scripted = true;
    this.d.toast(`${fly.mountChoice?.nickname ?? '宝可梦'}载着你飞向${dest.name}！`, 2200);
    const p = player.position.clone();
    sfx('jump', 0.6);
    const fade = (async () => {
      await new Promise((r) => setTimeout(r, 1100));
      await this.d.transition.fadeOut(600);
    })();
    await this.animate(p, p.clone().add(new THREE.Vector3(Math.sin(player.facing) * 6, RISE, Math.cos(player.facing) * 6)), 1.8, [0.1, 0.55], Math.PI * 0.9, easeInOut);
    await fade;
    if (dest.island !== this.d.currentIsland) {
      this.d.state.pendingFlyArrival = dest.id;
      await this.d.travelTo(dest.island, dest.x, dest.z, 0);
      return;
    }
    await this.descend(dest.id);
  }

  /** 跨岛重载后：在飞行点上空降落（由场景加载完成后调用） */
  async arrive(): Promise<void> {
    const id = this.d.state.pendingFlyArrival;
    if (!id) return;
    this.d.state.pendingFlyArrival = null;
    const { fly, player } = this.d;
    if (!fly.flyRide()) return;
    this.busy = true;
    try {
      await this.d.transition.fadeOut(1);
      if (!fly.flying && !fly.takeoff(true, true)) {
        player.scripted = false;
        await this.d.transition.fadeIn(400);
        return;
      }
      player.scripted = true;
      await this.descend(id);
    } finally {
      this.busy = false;
    }
  }

  /** 门外落点（门口朝外 LAND_OUT 米）与降落方向 */
  landingFor(poiId: string): { x: number; z: number; yaw: number } | null {
    const door = this.d.doorOf(poiId);
    if (door) {
      const ox = Math.sin(door.yaw);
      const oz = Math.cos(door.yaw);
      return { x: door.position.x + ox * LAND_OUT, z: door.position.z + oz * LAND_OUT, yaw: door.yaw };
    }
    const fp = this.points.find((q) => q.id === poiId);
    return fp ? { x: fp.x, z: fp.z + LAND_OUT, yaw: 0 } : null;
  }

  private async descend(poiId: string): Promise<void> {
    const { player, fly } = this.d;
    const land = this.landingFor(poiId);
    if (!land) {
      player.scripted = false;
      await fly.land(true);
      await this.d.transition.fadeIn(400);
      return;
    }
    const ox = Math.sin(land.yaw);
    const oz = Math.cos(land.yaw);
    const gy = this.d.heightAt(land.x, land.z);
    // 从门口正前方远处的高空，朝着宝可梦中心滑翔下来
    const start = new THREE.Vector3(land.x + ox * DESCENT_BACK, gy + DESCENT_H, land.z + oz * DESCENT_BACK);
    const end = new THREE.Vector3(land.x, gy + 0.4, land.z);
    const faceIn = Math.atan2(-ox, -oz);
    player.placeAt(start, faceIn, true);
    this.d.afterTeleport(start.x, start.z);
    const fade = this.d.transition.fadeIn(600);
    await this.animate(start, end, 2.4, [-0.45, 0.05], 0, easeOut);
    await fade;
    player.scripted = false;
    await fly.land(true);
    sfx('land', 0.7);
    // 落地后背对宝可梦中心（朝外），镜头回正
    player.teleport(land.x, land.z, land.yaw);
    this.d.afterTeleport(land.x, land.z);
  }

  private animate(from: THREE.Vector3, to: THREE.Vector3, dur: number, pitch: [number, number], spin: number, ease: (k: number) => number): Promise<void> {
    return new Promise((resolve) => {
      this.tween = { t: 0, dur, from: from.clone(), to: to.clone(), pitch, spin, yaw0: this.d.player.facing, ease, resolve };
    });
  }

  private stepTween(dt: number): void {
    const tw = this.tween!;
    const p = this.d.player;
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    const e = tw.ease(k);
    let facing = p.facing;
    if (tw.spin) facing = tw.yaw0 + tw.spin * e;
    else {
      const dx = tw.to.x - tw.from.x;
      const dz = tw.to.z - tw.from.z;
      if (Math.hypot(dx, dz) > 0.1) facing = Math.atan2(dx, dz);
    }
    p.placeAt(this.tmp.lerpVectors(tw.from, tw.to, e), facing);
    p.flyPitch = tw.pitch[0] + (tw.pitch[1] - tw.pitch[0]) * k;
    if (k >= 1) {
      this.tween = null;
      tw.resolve();
    }
  }
}
