/**
 * M3-19 · 攀瀑（大地图）：
 * - 解锁：冠军之路·瀑翁（flag hm07-waterfall，config/islands/waterfalls.ts 的 WATERFALL_FLAG）
 * - 冲浪到瀑潭（base）附近按互动键「攀上瀑布」：坐骑冲到崖脚，沿水幕逆流而上，翻过瀑口落进台顶泉池
 * - 在台顶泉池（top）附近按互动键「顺瀑布而下」：反向演出，落入瀑潭
 * - 演出期间 player.scripted = true（不读输入、不受重力、不遇敌），保持冲浪形态，整个人 + 坐骑随路径俯仰
 * - 没有能力：冲浪接近瀑潭 14 m 内第一次提示一次（flag seen-fall:<id>），互动显示瀑布说明
 * - 进门 / 剧情传送 / 读档时强制结束（snapToEnd：放到演出终点）
 */
import type { PlayerController } from '@/actors/player';
import type { GameState } from '@/systems/state/GameState';
import type { WaterfallConfig } from '@/config/islands/types';
import type { Interactable, InteractSource } from './SceneInteractions';
import { WATERFALL_FLAG } from '@/config/islands/waterfalls';
import { fallEndNear, fallPath, sampleFall, FALL_REACH, type FallEnd, type FallPath } from '@/systems/ride/waterfall';
import { sfx } from '@/core/audio';

export interface SceneWaterfallDeps {
  state: GameState;
  player: PlayerController;
  falls: readonly WaterfallConfig[];
  toast(text: string): void;
  say(pages: string[]): Promise<void>;
  canAct(): boolean;
  /** 冲浪中？ */
  surfing(): boolean;
  /** 开始前清理（停自动战斗 / 自动寻路），返回不能攀瀑的原因 */
  beforeFall(): string | null;
  /** 演出结束（摄像机复位等） */
  onDone?(fall: WaterfallConfig, end: FallEnd): void;
}

export class SceneWaterfall {
  busy = false;
  private path: FallPath | null = null;
  private t = 0;
  private hintCheck = 0;
  private resolve: (() => void) | null = null;
  private splashed = false;

  constructor(private readonly d: SceneWaterfallDeps) {}

  get unlocked(): boolean {
    return !!this.d.state.flags[WATERFALL_FLAG];
  }

  /** 当前演出的瀑布 id + 进度（调试 / e2e） */
  get fallId(): string | null {
    return this.path?.fall.id ?? null;
  }
  get progress(): number {
    return this.path ? this.t / this.path.duration : 0;
  }

  source(): InteractSource {
    return (player, out: Interactable[]) => {
      if (this.busy || player.mode !== 'surf') return;
      const hit = fallEndNear(this.d.falls, player.position.x, player.position.z);
      if (!hit) return;
      const { fall, end } = hit;
      const [x, z] = fall[end];
      const can = this.unlocked;
      out.push({
        id: `waterfall:${fall.id}:${end}`,
        kind: 'use',
        x,
        z,
        y: (end === 'base' ? fall.baseLevel : fall.topLevel) + 1.8,
        label: can ? (end === 'base' ? `攀上瀑布（${fall.name}）` : `顺瀑布而下（${fall.name}）`) : `查看瀑布（${fall.name}）`,
        action: 'interact',
        range: FALL_REACH + 0.3,
        priority: 3,
        run: async () => {
          if (can) await this.start(fall, end);
          else await this.d.say([`${fall.name}——轰隆隆的水流从石台顶上倾泻而下。`, '水势太猛了，普通的冲浪根本逆流不上去……', '（需要「攀瀑」——冠军之路的瀑翁会传授）']);
        },
      });
    };
  }

  /** 开始演出；返回演出结束的 Promise（被 snapToEnd 打断也会 resolve） */
  async start(fall: WaterfallConfig, end: FallEnd): Promise<boolean> {
    if (this.busy) return false;
    if (!this.unlocked) {
      this.d.toast('需要「攀瀑」才能攀上瀑布。');
      return false;
    }
    if (!this.d.surfing()) {
      this.d.toast('要先冲浪到水面上。');
      return false;
    }
    const why = this.d.beforeFall();
    if (why) {
      this.d.toast(why);
      return false;
    }
    const p = this.d.player;
    this.busy = true;
    this.path = fallPath(fall, end, { x: p.position.x, z: p.position.z });
    this.t = 0;
    this.splashed = false;
    p.scripted = true;
    p.velocity.set(0, 0, 0);
    sfx('splash', 0.8);
    this.d.toast(end === 'base' ? `逆着${fall.name}的水流冲了上去！` : `顺着${fall.name}一冲而下！`);
    await new Promise<void>((r) => (this.resolve = r));
    return true;
  }

  fixedUpdate(dt: number): void {
    if (!this.path) {
      this.hintCheck -= dt;
      if (this.hintCheck <= 0) {
        this.hintCheck = 0.5;
        this.firstApproachHint();
      }
      return;
    }
    this.t += dt;
    const pose = sampleFall(this.path, this.t);
    const p = this.d.player;
    p.climbTo(pose.x, pose.y, pose.z, pose.yaw);
    p.pitch = pose.pitch;
    // 落水溅起
    if (!this.splashed && this.t > this.path.duration - 0.55) {
      this.splashed = true;
      sfx(this.path.from === 'base' ? 'splash' : 'land', 0.9);
    }
    if (this.t >= this.path.duration) this.finish();
  }

  private finish(): void {
    const path = this.path;
    if (!path) return;
    const p = this.d.player;
    const last = path.keys[path.keys.length - 1]!;
    p.climbTo(last.x, last.y, last.z, path.yaw);
    p.pitch = 0;
    p.scripted = false;
    p.velocity.set(0, 0, 0);
    const end: FallEnd = path.from === 'base' ? 'top' : 'base';
    const flag = `fall-done:${path.fall.id}`;
    if (end === 'top' && !this.d.state.flags[flag]) {
      this.d.state.flags[flag] = true;
      this.d.toast(`登上了${path.fall.name}的顶端！石台上似乎放着什么东西……`);
    }
    this.path = null;
    this.busy = false;
    this.d.onDone?.(path.fall, end);
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }

  /** 演出中存档：记到演出终点（水面，世界坐标 x/y/z） */
  safeEnd(): [number, number, number] | null {
    const k = this.path?.keys[this.path.keys.length - 1];
    return k ? [k.x, k.y, k.z] : null;
  }

  /** 场景强制结束（进门 / 传送 / 读档）：直接放到终点 */
  snapToEnd(): void {
    if (this.path) this.finish();
  }

  private firstApproachHint(): void {
    if (this.unlocked || !this.d.surfing()) return;
    const p = this.d.player.position;
    for (const f of this.d.falls) {
      const flag = `seen-fall:${f.id}`;
      if (this.d.state.flags[flag]) continue;
      if (Math.hypot(p.x - f.base[0], p.z - f.base[1]) > 14) continue;
      this.d.state.flags[flag] = true;
      this.d.toast(`${f.name}从高高的石台上倾泻而下……水势太猛，现在还上不去。（需要「攀瀑」）`);
      return;
    }
  }

  dispose(): void {
    this.snapToEnd();
  }
}
