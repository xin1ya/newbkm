/**
 * M3-17 · 攀爬骑乘（大地图）：
 * - 解锁：雪原道馆奖励（flag hm08-rock-climb，config/rides 的 climb）
 * - 上崖：走到攀爬点崖脚（或崖顶边缘）、大致面朝岩壁，按互动键「攀上岩壁 / 攀下岩壁」
 * - 攀爬中：W / ↑ 向上、S / ↓ 向下，按住奔跑键加速；到顶 / 到底继续推就自动翻上崖顶 / 落地
 *   坐骑（队伍里第一只够大的岩石 / 地面系；没有就租借隆隆石）趴在崖面上随坡度俯仰，循环播放 walk
 * - 没有能力：靠近崖脚 10 m 内第一次提示一次（flag seen-climb:<id>），互动显示岩壁说明
 * - 攀爬中不遇敌、不被训练家看到；进门 / 剧情传送 / 读档时强制回到最近的端点（snapToEnd）
 */
import * as THREE from 'three';
import type { Game } from '@/core/Game';
import type { GameState } from '@/systems/state/GameState';
import type { Dex } from '@/systems/data/Dex';
import type { PlayerController } from '@/actors/player';
import type { PokemonInstance } from '@/systems/pokemon';
import type { ClimbWallConfig } from '@/config/islands/types';
import type { Interactable, InteractSource } from './SceneInteractions';
import { createMonModel, createMonModelFor, disposeMonModel, setMonLoop, updateMonModel } from '@/actors/pokemon/monModel';
import { chooseMount, rideFor, type MountChoice, type RideDef } from '@/systems/ride';
import { climbEndNear, climbPath, climbProgress, sampleClimb, CLIMB_REACH, type ClimbEnd, type ClimbPath } from '@/systems/ride/climb';
import { RIDES } from '@/config/rides';
import { sfx } from '@/core/audio';

export interface SceneClimbDeps {
  game: Game;
  state: GameState;
  dex: Dex;
  player: PlayerController;
  walls: readonly ClimbWallConfig[];
  heightAt(x: number, z: number): number;
  toast(text: string): void;
  say(pages: string[]): Promise<void>;
  /** 能否接受操作（非战斗 / 非对话 / 非菜单） */
  canAct(): boolean;
  /** 攀爬前的清理（下自行车）；返回不能攀爬的原因（飞行 / 冲浪中） */
  beforeClimb(): string | null;
}

/** 坐骑显示高度（米） */
const MOUNT_HEIGHT = 1.35;
const SADDLE_K = 0.55;
const STYLE_TEXT: Record<ClimbWallConfig['style'], string> = {
  vines: '粗壮的藤蔓从崖顶一直垂到崖脚',
  crack: '岩壁上有一道深深的裂缝，两侧满是可以抓握的凸起',
  ice: '冰壁上布满了冰裂纹和冰凸',
};

export class SceneClimb {
  ride: RideDef | null = null;
  mountChoice: MountChoice | null = null;
  busy = false;
  private path: ClimbPath | null = null;
  private s = 0;
  private mount: THREE.Group | null = null;
  private pivot: THREE.Group | null = null;
  private pitch = 0;
  private moving = 0;
  private hintCheck = 0;
  private paths = new Map<string, ClimbPath>();

  constructor(private readonly d: SceneClimbDeps) {}

  get climbing(): boolean {
    return this.d.player.mode === 'climb';
  }

  /** 当前攀爬的岩壁 id（调试 / e2e） */
  get wallId(): string | null {
    return this.path?.wall.id ?? null;
  }

  /** 攀爬进度 0..1（调试 / e2e） */
  get progress(): number {
    return this.path ? this.s / Math.max(1e-6, this.path.length) : 0;
  }

  climbRide(): RideDef | null {
    return rideFor(RIDES, 'rock', this.d.state.flags);
  }

  pathOf(w: ClimbWallConfig): ClimbPath {
    let p = this.paths.get(w.id);
    if (!p) {
      p = climbPath(w, this.d.heightAt);
      this.paths.set(w.id, p);
    }
    return p;
  }

  /** 互动来源：崖脚 / 崖顶的「攀上 / 攀下岩壁」或岩壁说明 */
  source(): InteractSource {
    return (player, out: Interactable[]) => {
      if (this.climbing || this.busy || player.mode === 'fly' || player.mode === 'surf') return;
      const hit = climbEndNear(this.d.walls, player.position.x, player.position.z);
      if (!hit) return;
      const { wall, end } = hit;
      const [x, z] = wall[end];
      const can = !!this.climbRide();
      out.push({
        id: `climb:${wall.id}:${end}`,
        kind: 'use',
        x,
        z,
        y: this.d.heightAt(x, z) + 1.6,
        label: can ? (end === 'base' ? `攀上岩壁（${wall.name}）` : `攀下岩壁（${wall.name}）`) : `查看岩壁（${wall.name}）`,
        action: 'interact',
        range: CLIMB_REACH + 0.2,
        priority: 2,
        run: async () => {
          if (can) await this.start(wall, end);
          else await this.d.say([`${STYLE_TEXT[wall.style]}。`, '如果有擅长攀岩的宝可梦，应该能顺着它爬上去……', '（需要「攀岩」骑乘——雪原道馆的奖励）']);
        },
      });
    };
  }

  /** 开始攀爬：从崖脚往上，或从崖顶往下 */
  async start(wall: ClimbWallConfig, end: ClimbEnd): Promise<boolean> {
    if (this.climbing || this.busy) return false;
    const ride = this.climbRide();
    if (!ride) {
      this.d.toast('需要「攀岩」骑乘才能攀爬岩壁。');
      return false;
    }
    const why = this.d.beforeClimb();
    if (why) {
      this.d.toast(why);
      return false;
    }
    this.busy = true;
    const { player, dex, state } = this.d;
    const path = this.pathOf(wall);
    const choice = chooseMount(dex, state.party, ride);
    this.ride = ride;
    this.mountChoice = choice;
    const inst = state.party.find((q) => q.uid === choice.uid);
    const mount = inst
      ? createMonModel(dex, inst, { height: MOUNT_HEIGHT })
      : createMonModelFor(dex.species(choice.speciesId), { speciesId: choice.speciesId, shiny: false } as PokemonInstance, { height: MOUNT_HEIGHT });
    mount.name = `climb-mount:${choice.speciesId}`;
    setMonLoop(mount, 'walk', 0);
    const pivot = new THREE.Group();
    pivot.name = 'climb-pivot';
    pivot.rotation.order = 'YXZ';
    pivot.add(mount);
    pivot.add(player.model.root);
    player.model.root.position.set(0, MOUNT_HEIGHT * SADDLE_K, -0.05);
    player.root.add(pivot);
    this.mount = mount;
    this.pivot = pivot;
    this.path = path;
    this.s = end === 'base' ? 0 : path.length;
    const p0 = sampleClimb(path, this.s);
    this.pitch = 0;
    sfx('jump', 0.6);
    player.mode = 'climb';
    await player.hop(p0.x, p0.y, p0.z, 0.35, 0.5);
    player.climbTo(p0.x, p0.y, p0.z, path.yaw);
    sfx('bump', 0.6);
    this.d.toast(
      `${choice.uid ? `骑上${choice.nickname}` : `租借的${choice.nickname}载着你`}${end === 'base' ? '攀上了岩壁' : '扒住了崖边'}！（W 向上 · S 向下 · 按住奔跑键加速）`,
    );
    this.d.game.events.emit('ride:change', { mode: 'climb', ride: ride.id, speciesId: choice.speciesId });
    this.busy = false;
    return true;
  }

  /** 固定步：沿崖面移动；到两端继续推则翻上崖顶 / 落到崖脚 */
  fixedUpdate(dt: number, input: { moveAxis(): { x: number; y: number }; isDown(a: string): boolean } | null): void {
    // 没有能力时：第一次靠近崖脚提示一次
    this.hintCheck -= dt;
    if (!this.climbing && this.hintCheck <= 0) {
      this.hintCheck = 0.5;
      this.firstApproachHint();
    }
    if (!this.climbing || this.busy || !this.path) return;
    const path = this.path;
    const axis = input && this.d.canAct() ? input.moveAxis().y : 0;
    const res = climbProgress(path, this.s, axis, !!input?.isDown('run'), dt);
    this.moving = axis;
    this.s = res.s;
    const p = sampleClimb(path, this.s);
    this.d.player.climbTo(p.x, p.y, p.z, path.yaw);
    if (res.atTop) void this.finish('top');
    else if (res.atBase) void this.finish('base');
  }

  /** 渲染帧：坐骑俯仰贴合崖面、爬行动画 */
  update(dt: number): void {
    if (!this.mount || !this.pivot || !this.path) return;
    const p = sampleClimb(this.path, this.s);
    const want = Math.min(1.25, Math.max(0, p.pitch));
    this.pitch += (want - this.pitch) * Math.min(1, dt * 6);
    this.pivot.rotation.x = -this.pitch;
    setMonLoop(this.mount, 'walk', Math.abs(this.moving) > 0.05 ? 0.9 : 0);
    updateMonModel(this.mount, dt);
    // 爬行时身体左右轻摆
    this.pivot.rotation.z = Math.abs(this.moving) > 0.05 ? Math.sin(performance.now() * 0.012) * 0.06 : 0;
  }

  /** 翻上崖顶 / 落到崖脚 */
  private async finish(end: ClimbEnd): Promise<void> {
    if (!this.path || this.busy) return;
    this.busy = true;
    const wall = this.path.wall;
    const [x, z] = wall[end];
    const y = this.d.heightAt(x, z);
    const speciesId = this.mountChoice?.speciesId ?? 0;
    this.detach();
    this.d.player.mode = 'walk';
    sfx(end === 'top' ? 'jump' : 'land', 0.7);
    await this.d.player.hop(x, y, z, 0.4, end === 'top' ? 0.9 : 0.4);
    this.d.player.teleport(x, z, end === 'top' ? this.path.yaw : this.path.yaw + Math.PI);
    this.d.game.events.emit('ride:change', { mode: 'walk', ride: this.ride?.id ?? 'climb', speciesId });
    this.path = null;
    this.ride = null;
    this.mountChoice = null;
    this.busy = false;
  }

  /** 攀爬中：最近端点的站立点（存档用）；不在攀爬时为 null */
  safeEnd(): readonly [number, number] | null {
    if (!this.climbing || !this.path) return null;
    return this.path.wall[this.s > this.path.length / 2 ? 'top' : 'base'];
  }

  /** 场景强制结束（进门 / 传送 / 读档）：放到最近的端点 */
  snapToEnd(): void {
    if (!this.climbing || !this.path) return;
    const wall = this.path.wall;
    const end: ClimbEnd = this.s > this.path.length / 2 ? 'top' : 'base';
    const speciesId = this.mountChoice?.speciesId ?? 0;
    this.detach();
    this.d.player.mode = 'walk';
    this.d.player.teleport(wall[end][0], wall[end][1]);
    this.d.game.events.emit('ride:change', { mode: 'walk', ride: this.ride?.id ?? 'climb', speciesId });
    this.path = null;
    this.ride = null;
    this.mountChoice = null;
    this.busy = false;
  }

  private firstApproachHint(): void {
    if (this.climbRide()) return;
    const p = this.d.player.position;
    for (const w of this.d.walls) {
      const flag = `seen-climb:${w.id}`;
      if (this.d.state.flags[flag]) continue;
      if (Math.hypot(p.x - w.base[0], p.z - w.base[1]) > 10) continue;
      this.d.state.flags[flag] = true;
      this.d.toast(`${STYLE_TEXT[w.style]}……似乎可以攀爬，但现在还上不去。（需要「攀岩」骑乘）`);
      return;
    }
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

  dispose(): void {
    this.snapToEnd();
    this.detach();
  }
}
