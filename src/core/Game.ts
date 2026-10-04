/**
 * ENG-006 · 引擎外壳：渲染器、主循环、场景栈、输入、时钟、事件总线、平台。
 * 只依赖 core/ 与 platform/（§4.3）；具体玩法场景由 main.ts 组装后 push 进来。
 * 帧顺序：input.poll → scenes.fixedUpdate×N → clock/scenes.update → events.flush → afterUpdate 钩子 → render → input.endFrame
 */
import { GpuTimer, DynamicResolution } from './loop/GpuTimer';
import * as THREE from 'three';
import type { Platform } from '@/platform';
import { EventBus } from './events/EventBus';
import { GameLoop, FrameStats } from './loop/GameLoop';
import { SceneManager } from './scene/SceneManager';
import { Input } from './input';
import { GameClock } from './time/GameClock';

export interface GameOptions {
  container: HTMLElement;
  platform: Platform;
  /** 初始游戏内时间（分钟） */
  clockMinutes?: number;
  antialias?: boolean;
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly platform: Platform;
  readonly events = new EventBus();
  readonly scenes = new SceneManager();
  readonly input: Input;
  readonly clock: GameClock;
  /** 每帧 CPU 耗时（update + render 提交）；帧间隔见 loop.stats */
  readonly cpu = new FrameStats();
  readonly loop: GameLoop;
  readonly container: HTMLElement;
  /** 每帧 update 之后调用（UI 更新等），由上层注册 */
  readonly afterUpdate: Array<(dt: number) => void> = [];
  /** 时钟是否随现实时间推进（战斗 / 菜单期间可暂停） */
  clockRunning = true;
  private disposers: Array<() => void> = [];
  private frameStart = 0;
  /** 性能 P0：GPU 帧时间与动态分辨率（render 回调前后计时） */
  readonly gpu: GpuTimer;
  readonly dynRes: DynamicResolution;
  /** 基础像素比（画质档位决定）；动态分辨率在此基础上乘 scale */
  basePixelRatio = 1;

  constructor(o: GameOptions) {
    this.container = o.container;
    this.platform = o.platform;
    this.renderer = new THREE.WebGLRenderer({ antialias: o.antialias ?? false, powerPreference: 'high-performance', stencil: false });
    this.renderer.setSize(o.container.clientWidth || window.innerWidth, o.container.clientHeight || window.innerHeight);
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.style.outline = 'none';
    o.container.appendChild(this.renderer.domElement);
    this.gpu = new GpuTimer(this.renderer.getContext() as WebGL2RenderingContext);
    this.dynRes = new DynamicResolution((scale) => {
      this.renderer.setPixelRatio(this.basePixelRatio * scale);
      this.resize();
    });
    this.input = new Input(this.renderer.domElement);
    this.input.attach();
    this.input.onDeviceChange = (device) => this.events.emit('input:device', { device });
    this.clock = new GameClock(o.clockMinutes ?? 8 * 60);
    this.clock.onPeriodChange((period, hour) => this.events.emit('time:period', { period: period === 'night' ? 'night' : 'day', hour }));

    this.loop = new GameLoop({
      fixedUpdate: (dt) => this.scenes.fixedUpdate(dt),
      update: (dt) => {
        this.frameStart = performance.now();
        this.input.poll();
        if (this.clockRunning) this.clock.tick(dt);
        this.scenes.update(dt);
        this.events.flush();
        for (const fn of this.afterUpdate) fn(dt);
      },
      render: (alpha, dt) => {
        this.gpu.begin();
        this.scenes.render(alpha, dt);
        this.gpu.end();
        const interval = Math.max(this.loop.rafIntervalMs, this.loop.maxFps > 0 ? 1000 / this.loop.maxFps : 0);
        this.dynRes.update(dt, this.gpu.ms, interval);
        this.input.endFrame();
        this.cpu.push(performance.now() - this.frameStart);
      },
    });

    const onResize = () => this.resize();
    window.addEventListener('resize', onResize);
    this.disposers.push(() => window.removeEventListener('resize', onResize));
    this.disposers.push(
      this.platform.window.onVisibilityChange((visible) => {
        if (visible) this.loop.start();
        else this.loop.stop();
      }),
    );
  }

  get width(): number {
    return this.container.clientWidth || window.innerWidth;
  }
  get height(): number {
    return this.container.clientHeight || window.innerHeight;
  }

  resize(): void {
    const w = this.width;
    const h = this.height;
    this.renderer.setSize(w, h);
    this.scenes.resize(w, h);
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    for (const d of this.disposers) d();
    this.input.detach();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
