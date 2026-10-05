/**
 * 飞行骑乘（大地图）：
 * - 解锁：拿到第一枚徽章（flag badge-verdant，对话里暂称「翠澜徽章」）
 * - 起飞：只能在地面（步行、站稳、不在水里 / 冲浪 / 游泳）按飞行键 G；骑自行车时会先下车
 * - 操作：WASD 水平移动（相对镜头），空格上升，Shift / Ctrl 下降，X 加速；可飞越海面与山地，有高度上限（见 systems/ride FLY_*）
 * - 降落：离地 FLY_LAND_ALTITUDE 米以内按 G，或按住下降贴到地面时自动降落；水面上不能降落
 * - 坐骑：队伍里有 fly 动画、体型够大的飞行系宝可梦优先；没有时租借大比鸟（18）
 *   坐骑与玩家模型挂在同一个俯仰节点下，随升降抬头 / 低头、转向侧倾；坐骑循环播放 fly 动画
 * - 飞行中不触发遇敌、训练家视线；进入室内 / 剧情传送 / 黑屏回城时强制落地
 */
import * as THREE from 'three';
import type { Game } from '@/core/Game';
import type { GameState } from '@/systems/state/GameState';
import type { Dex } from '@/systems/data/Dex';
import type { PlayerController } from '@/actors/player';
import type { PokemonInstance } from '@/systems/pokemon';
import { createMonModel, createMonModelFor, disposeMonModel, monManifest, setMonLoop, updateMonModel } from '@/actors/pokemon/monModel';
import { chooseFlyMount, FLY_LAND_ALTITUDE, FLY_MOUNT_HEIGHT, rideFor, type MountChoice, type RideDef } from '@/systems/ride';
import { RIDES } from '@/config/rides';
import { sfx } from '@/core/audio';

export interface SceneFlyDeps {
  game: Game;
  state: GameState;
  dex: Dex;
  player: PlayerController;
  toast(text: string): void;
  /** 能否接受骑乘操作（非战斗 / 非对话 / 非菜单） */
  canAct(): boolean;
  /** 起飞前的清理（下自行车等） */
  beforeTakeoff(): void;
  /** 当前是否在冲浪 */
  surfing(): boolean;
}

/** 鞍座：坐骑高度的比例 */
const SADDLE_K = 0.52;

export class SceneFly {
  ride: RideDef | null = null;
  mountChoice: MountChoice | null = null;
  private mount: THREE.Group | null = null;
  private pivot: THREE.Group | null = null;
  private lean = 0;
  private lastYaw = 0;
  private waterHint = 0;
  busy = false;

  constructor(private readonly d: SceneFlyDeps) {}

  get flying(): boolean {
    return this.d.player.mode === 'fly';
  }

  flyRide(): RideDef | null {
    return rideFor(RIDES, 'air', this.d.state.flags);
  }

  /** 可以起飞？返回不能起飞的原因 */
  takeoffBlock(): string | null {
    const p = this.d.player;
    if (!this.flyRide()) return '需要拿到「翠澜徽章」，才能骑着宝可梦飞行。';
    if (this.d.surfing() || p.mode === 'surf') return '在水上不能起飞，先上岸吧。';
    if (p.hopping || p.swimming || p.waterDepth > 0.3) return '这里没办法起飞。';
    if (p.mode === 'walk' && (!p.grounded || p.airborne)) return '要站在地面上才能起飞。';
    return null;
  }

  /** quiet = 自动战斗等系统调用：不弹提示 */
  takeoff(quiet = false): boolean {
    if (this.flying || this.busy) return false;
    const why = this.takeoffBlock();
    if (why) {
      if (!quiet) this.d.toast(why);
      return false;
    }
    const ride = this.flyRide()!;
    this.d.beforeTakeoff();
    const { player, dex, state } = this.d;
    const choice = chooseFlyMount(dex, state.party, ride, (id) => !!monManifest(id)?.clips?.includes('fly'));
    this.ride = ride;
    this.mountChoice = choice;
    const inst = state.party.find((q) => q.uid === choice.uid);
    const mount = inst
      ? createMonModel(dex, inst, { height: FLY_MOUNT_HEIGHT })
      : createMonModelFor(dex.species(choice.speciesId), { speciesId: choice.speciesId, shiny: false } as PokemonInstance, { height: FLY_MOUNT_HEIGHT });
    mount.name = `fly-mount:${choice.speciesId}`;
    setMonLoop(mount, 'fly', 1);
    // 俯仰节点：坐骑 + 玩家模型一起抬头 / 低头 / 侧倾
    const pivot = new THREE.Group();
    pivot.name = 'fly-pivot';
    pivot.rotation.order = 'YXZ';
    pivot.add(mount);
    pivot.add(player.model.root);
    player.model.root.position.set(0, FLY_MOUNT_HEIGHT * SADDLE_K, -0.08);
    player.root.add(pivot);
    this.mount = mount;
    this.pivot = pivot;
    this.lastYaw = player.facing;
    this.lean = 0;
    player.beginFly();
    sfx('jump', 0.7);
    sfx('surf-mount', 0.6);
    if (!quiet) this.d.toast(choice.uid ? `骑上${choice.nickname}飞上了天空！（空格上升 · Shift/Ctrl 下降 · X 加速 · 近地按 G 降落）` : `租借的${choice.nickname}载着你飞上了天空！`);
    this.d.game.events.emit('ride:change', { mode: 'fly', ride: ride.id, speciesId: choice.speciesId });
    return true;
  }

  /** 正下方可降落的地面（离地足够近、不是水面） */
  landingSpot(): { x: number; y: number; z: number } | null {
    const p = this.d.player;
    if (p.flyOverWater || p.flyAltitude > FLY_LAND_ALTITUDE) return null;
    const pos = p.position;
    const f = p.standableOnFoot(pos.x, pos.z, pos.y - p.flyAltitude);
    return f.ok ? { x: pos.x, y: f.y, z: pos.z } : null;
  }

  /** 降落；instant = 场景强制（直接放到正下方地面） */
  async land(instant = false): Promise<boolean> {
    if (!this.flying || (this.busy && !instant)) return false;
    const p = this.d.player;
    const spot = this.landingSpot();
    if (!instant && !spot) {
      this.d.toast(p.flyOverWater ? '下面是水面，没法降落。' : `再低一点才能降落（离地 ${FLY_LAND_ALTITUDE} 米以内）。`);
      return false;
    }
    this.busy = true;
    const speciesId = this.mountChoice?.speciesId ?? 0;
    this.detach();
    p.endFly();
    if (instant || !spot) p.teleport(p.position.x, p.position.z);
    else {
      sfx('land', 0.7);
      await p.hop(spot.x + Math.sin(p.facing) * 0.6, spot.y, spot.z + Math.cos(p.facing) * 0.6, 0.35, 0.4);
    }
    this.d.game.events.emit('ride:change', { mode: 'walk', ride: this.ride?.id ?? 'fly', speciesId });
    this.ride = null;
    this.mountChoice = null;
    this.busy = false;
    return true;
  }

  private detach(): void {
    const p = this.d.player;
    if (this.pivot) {
      p.root.add(p.model.root);
      p.model.root.position.set(0, 0, 0);
      p.model.root.rotation.set(0, 0, 0);
      this.pivot.removeFromParent();
    }
    if (this.mount) disposeMonModel(this.mount);
    this.mount = null;
    this.pivot = null;
  }

  fixedUpdate(dt: number, flyKey: boolean): void {
    if (this.busy) return;
    const p = this.d.player;
    if (!this.flying) {
      if (this.mount) this.detach();
      if (flyKey && this.d.canAct()) this.takeoff();
      return;
    }
    if (flyKey && this.d.canAct()) {
      void this.land();
      return;
    }
    // 按住下降贴近地面 → 自动降落
    if (p.flyDescending && p.flyAltitude < 1.05 && this.d.canAct()) {
      if (!p.flyOverWater && this.landingSpot()) {
        void this.land();
        return;
      }
      this.waterHint -= dt;
      if (p.flyOverWater && this.waterHint <= 0) {
        this.waterHint = 5;
        this.d.toast('下面是水面，飞到陆地上空再降落吧。');
      }
    }
  }

  /** 渲染帧：坐骑动画、俯仰与转向侧倾 */
  update(dt: number): void {
    if (!this.mount || !this.pivot) return;
    const p = this.d.player;
    const hs = Math.hypot(p.velocity.x, p.velocity.z);
    setMonLoop(this.mount, 'fly', 0.9 + Math.min(1, hs / p.flySprint) * 0.7);
    updateMonModel(this.mount, dt);
    let dy = p.facing - this.lastYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.lastYaw = p.facing;
    const want = THREE.MathUtils.clamp((-dy / Math.max(dt, 1e-3)) * 0.25, -0.5, 0.5) * Math.min(1, hs / 6);
    this.lean += (want - this.lean) * Math.min(1, dt * 4);
    this.pivot.rotation.x = -p.flyPitch;
    this.pivot.rotation.z = this.lean;
    // 悬停时上下轻微起伏（扇翅节奏）
    this.pivot.position.y = Math.sin(performance.now() * 0.004) * (0.12 - Math.min(1, hs / 10) * 0.07);
  }

  dispose(): void {
    if (this.flying) this.d.player.endFly();
    this.detach();
  }
}
