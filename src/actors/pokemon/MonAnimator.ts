/**
 * M1-21 · 宝可梦动画状态机：包装 AnimationMixer。
 * - 基础循环状态（idle / walk / run / sleep / fly / swim）之间交叉淡入淡出；
 * - 一次性动作（attack_physical / attack_special / hit / faint …）播放完毕后回到基础状态，
 *   返回 Promise，并可在 meta.hitTime 标注的命中帧回调（战斗里用来同步伤害特效）；
 * - 待机久了随机插一段 idle_alt（有的话）。
 * 缺少的剪辑自动回退：run→walk、fly/swim→idle、idle_alt→无。
 */
import * as THREE from 'three';

export type MonClip =
  | 'idle'
  | 'idle_alt'
  | 'walk'
  | 'run'
  | 'attack_physical'
  | 'attack_special'
  | 'hit'
  | 'faint'
  | 'sleep'
  | 'fly'
  | 'swim';

export type MonLoop = 'idle' | 'walk' | 'run' | 'sleep' | 'fly' | 'swim';

const FALLBACK: Partial<Record<MonClip, MonClip[]>> = {
  run: ['walk', 'idle'],
  walk: ['idle'],
  fly: ['idle'],
  swim: ['idle'],
  sleep: ['idle'],
  attack_special: ['attack_physical'],
  attack_physical: ['attack_special'],
};

export interface OnceOptions {
  fade?: number;
  timeScale?: number;
  /** 命中帧回调（meta.hitTime；没有标注时取动画 45% 处） */
  onHit?: () => void;
  /** true = 播完停在最后一帧（倒下），不回基础状态 */
  hold?: boolean;
}

interface OncePlay {
  action: THREE.AnimationAction;
  hitAt: number;
  onHit: (() => void) | undefined;
  hold: boolean;
  resolve: () => void;
}

export class MonAnimator {
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private base: MonLoop = 'idle';
  private baseAction: THREE.AnimationAction | null = null;
  private once: OncePlay | null = null;
  private idleFor = 0;
  private nextAlt = 6 + Math.random() * 6;
  private held = false;

  constructor(
    root: THREE.Object3D,
    clips: THREE.AnimationClip[],
    private readonly hitTime: Record<string, number> = {},
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const c of clips) this.actions.set(c.name, this.mixer.clipAction(c));
  }

  has(name: MonClip): boolean {
    return this.actions.has(name);
  }

  clipNames(): string[] {
    return [...this.actions.keys()];
  }

  /** 解析回退后的剪辑名 */
  resolve(name: MonClip): MonClip | null {
    if (this.actions.has(name)) return name;
    for (const f of FALLBACK[name] ?? []) if (this.actions.has(f)) return f;
    return null;
  }

  duration(name: MonClip): number {
    const n = this.resolve(name);
    return n ? (this.actions.get(n)?.getClip().duration ?? 0) : 0;
  }

  get state(): MonLoop {
    return this.base;
  }

  get busy(): boolean {
    return this.once !== null;
  }

  /** 切换基础循环状态（一次性动作进行中时，结束后再切过去） */
  loop(name: MonLoop, opts: { fade?: number; timeScale?: number } = {}): void {
    const n = this.resolve(name);
    const timeScale = opts.timeScale ?? 1;
    if (this.held) return;
    if (name === this.base && this.baseAction) {
      this.baseAction.timeScale = timeScale;
      return;
    }
    this.base = name;
    this.idleFor = 0;
    if (!n) return;
    const a = this.actions.get(n)!;
    if (a === this.baseAction) {
      a.timeScale = timeScale;
      return;
    }
    a.reset();
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.timeScale = timeScale;
    a.enabled = true;
    const prev = this.baseAction;
    this.baseAction = a;
    if (this.once) return; // 一次性动作结束时淡入
    a.play();
    if (prev) a.crossFadeFrom(prev, opts.fade ?? 0.2, false);
    else a.fadeIn(opts.fade ?? 0.01);
  }

  /** 播放一次性动作；返回的 Promise 在动作结束（或被下一次一次性动作打断）时完成 */
  play(name: MonClip, opts: OnceOptions = {}): Promise<void> {
    const n = this.resolve(name);
    if (!n) {
      opts.onHit?.();
      return Promise.resolve();
    }
    this.finishOnce(true);
    this.held = false;
    const a = this.actions.get(n)!;
    const fade = opts.fade ?? 0.12;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = opts.timeScale ?? 1;
    a.enabled = true;
    a.play();
    if (this.baseAction && this.baseAction !== a) a.crossFadeFrom(this.baseAction, fade, false);
    else a.fadeIn(fade);
    const dur = a.getClip().duration;
    const hitAt = Math.min(dur, this.hitTime[n] ?? dur * 0.45);
    return new Promise<void>((resolve) => {
      this.once = { action: a, hitAt, onHit: opts.onHit, hold: !!opts.hold, resolve };
    });
  }

  /** 立即停在某个剪辑的最后一帧（读档时已倒下等） */
  holdEnd(name: MonClip): void {
    const n = this.resolve(name);
    if (!n) return;
    this.finishOnce(true);
    this.mixer.stopAllAction();
    const a = this.actions.get(n)!;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
    a.time = a.getClip().duration;
    this.baseAction = null;
    this.held = true;
    this.mixer.update(0);
  }

  /** 从倒下 / 定格中恢复到基础状态 */
  revive(): void {
    this.held = false;
    const b = this.base;
    this.base = 'idle';
    this.baseAction = null;
    this.mixer.stopAllAction();
    this.loop(b === 'idle' ? 'idle' : b, { fade: 0.01 });
    if (!this.baseAction) this.loop('idle', { fade: 0.01 });
  }

  private finishOnce(interrupted: boolean): void {
    const o = this.once;
    if (!o) return;
    this.once = null;
    if (interrupted && o.onHit && o.action.time < o.hitAt) o.onHit();
    if (o.hold) {
      this.held = true;
      this.baseAction?.stop();
    } else if (this.baseAction && this.baseAction !== o.action) {
      const b = this.baseAction;
      b.reset();
      b.enabled = true;
      b.play();
      b.crossFadeFrom(o.action, 0.18, false);
    } else {
      o.action.fadeOut(0.18);
    }
    o.resolve();
  }

  update(dt: number): void {
    const o = this.once;
    const before = o ? o.action.time : 0;
    this.mixer.update(dt);
    if (o && this.once === o) {
      const t = o.action.time;
      if (o.onHit && before < o.hitAt && (t >= o.hitAt || !o.action.isRunning())) {
        const f = o.onHit;
        o.onHit = undefined;
        f();
      }
      if (!o.action.isRunning() || t >= o.action.getClip().duration - 1e-4) this.finishOnce(false);
    }
    // 待机小动作
    if (!this.once && !this.held && this.base === 'idle' && this.actions.has('idle_alt')) {
      this.idleFor += dt;
      if (this.idleFor > this.nextAlt) {
        this.idleFor = 0;
        this.nextAlt = 8 + Math.random() * 8;
        void this.play('idle_alt', { fade: 0.25 });
      }
    }
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
