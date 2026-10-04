/**
 * ENG-006 · 主循环：固定步长逻辑（60 Hz）+ 可变帧渲染。
 * - 逻辑步长固定，保证物理/AI 与帧率无关；单帧最多补 5 步，避免卡顿后“死亡螺旋”
 * - 渲染传入插值系数 alpha
 * - 记录帧时间统计供性能基线（REN-006）与调试 HUD 使用
 */
export interface LoopCallbacks {
  fixedUpdate(dt: number): void;
  update(dt: number): void;
  render(alpha: number, dt: number): void;
}

export class FrameStats {
  private samples = new Float32Array(240);
  private i = 0;
  private n = 0;
  push(ms: number): void {
    this.samples[this.i] = ms;
    this.i = (this.i + 1) % this.samples.length;
    this.n = Math.min(this.n + 1, this.samples.length);
  }
  get avg(): number {
    let s = 0;
    for (let k = 0; k < this.n; k++) s += this.samples[k]!;
    return this.n ? s / this.n : 0;
  }
  get fps(): number {
    const a = this.avg;
    return a > 0 ? 1000 / a : 0;
  }
  percentile(p: number): number {
    if (!this.n) return 0;
    const arr = Array.from(this.samples.subarray(0, this.n)).sort((a, b) => a - b);
    return arr[Math.min(arr.length - 1, Math.floor(p * arr.length))]!;
  }
}

export class GameLoop {
  static readonly STEP = 1 / 60;
  static readonly MAX_STEPS = 5;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  readonly stats = new FrameStats();
  /** 调试：时间倍率（仅影响逻辑） */
  timeScale = 1;
  /** 帧率上限（设置 fpsLimit）：0 = 不限（跟随显示器刷新率） */
  maxFps = 0;
  /** 实际刷新间隔（rAF 回调间隔的平滑值，毫秒），供动态分辨率判断目标帧间隔 */
  rafIntervalMs = 16.7;
  private lastRaf = 0;

  constructor(private readonly cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(frame);
      if (this.lastRaf) this.rafIntervalMs = this.rafIntervalMs * 0.95 + Math.min(100, now - this.lastRaf) * 0.05;
      this.lastRaf = now;
      // 限帧：距上次渲染不足一个间隔就跳过这次刷新（留 1 ms 余量，避免 120 Hz 上限在 120 Hz 屏上被误跳）
      if (this.maxFps > 0 && now - this.last < 1000 / this.maxFps - 1) return;
      this.step(now);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** 单帧推进（也供测试/离线渲染手动驱动） */
  step(now: number): void {
    const frameMs = Math.min(250, now - this.last);
    this.last = now;
    this.stats.push(frameMs);
    const dt = (frameMs / 1000) * this.timeScale;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= GameLoop.STEP && steps < GameLoop.MAX_STEPS) {
      this.cb.fixedUpdate(GameLoop.STEP);
      this.acc -= GameLoop.STEP;
      steps++;
    }
    if (steps === GameLoop.MAX_STEPS) this.acc = 0;
    this.cb.update(dt);
    this.cb.render(this.acc / GameLoop.STEP, dt);
  }
}
