/**
 * ENG-007 · 输入系统：键盘 + 鼠标 + 手柄统一为“动作”查询。
 * - isDown / pressed（本帧按下）/ released
 * - moveAxis：WASD 或左摇杆（带死区、归一化）
 * - lookDelta：鼠标拖拽/指针锁定移动 或右摇杆
 * - 支持 UI 独占（对话框打开时 gameplay 动作不响应）
 * - 每帧末调用 endFrame() 清理边沿状态
 */
import { DEFAULT_BINDINGS, PAD, mergeBindings, type Action, type BindingTable } from './bindings';

export interface Vec2 {
  x: number;
  y: number;
}

const DEADZONE = 0.18;

function applyDeadzone(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y);
  if (len < DEADZONE) return { x: 0, y: 0 };
  const k = Math.min(1, (len - DEADZONE) / (1 - DEADZONE)) / len;
  return { x: x * k, y: y * k };
}

export class Input {
  bindings: BindingTable = structuredClone(DEFAULT_BINDINGS);
  private keys = new Set<string>();
  private keysPressed = new Set<string>();
  private keysReleased = new Set<string>();
  private mouse = new Set<number>();
  private mousePressed = new Set<number>();
  private padButtons: boolean[] = [];
  private padPrev: boolean[] = [];
  private padAxes: number[] = [0, 0, 0, 0];
  private look: Vec2 = { x: 0, y: 0 };
  private wheel = 0;
  private dragging = false;
  private listeners: Array<() => void> = [];
  /** 最近使用的设备（UI 提示显示键盘或手柄图标） */
  device: 'keyboard' | 'gamepad' = 'keyboard';
  /** 大于 0 时 gameplay 动作被 UI 占用（计数，支持嵌套） */
  private uiLocks = 0;
  /** 需要锁定鼠标时为 true（第一人称 / 第三人称开启锁定）：点击画面时自动重新请求指针锁定 */
  wantPointerLock = false;
  private relockAfterUi = false;
  /** 鼠标灵敏度（设置） */
  mouseSensitivity = 1;
  invertY = false;
  onDeviceChange?: (d: 'keyboard' | 'gamepad') => void;

  constructor(private readonly target: HTMLElement) {}

  attach(): void {
    const on = <K extends keyof WindowEventMap>(t: K, fn: (e: WindowEventMap[K]) => void, el: Window | HTMLElement = window) => {
      el.addEventListener(t, fn as EventListener, { passive: false });
      this.listeners.push(() => el.removeEventListener(t, fn as EventListener));
    };
    on('keydown', (e) => {
      if (isTypingTarget(e.target)) return;
      if (['Tab', 'F3', 'F5', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backquote'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.keys.add(e.code);
        this.keysPressed.add(e.code);
      }
      this.setDevice('keyboard');
    });
    on('keyup', (e) => {
      this.keys.delete(e.code);
      this.keysReleased.add(e.code);
    });
    on('blur', () => {
      this.keys.clear();
      this.mouse.clear();
      this.dragging = false;
    });
    on(
      'mousedown',
      (e) => {
        this.mouse.add(e.button);
        this.mousePressed.add(e.button);
        if (e.button === 0 || e.button === 2) this.dragging = true;
        this.setDevice('keyboard');
        // 第一人称：Esc 解锁后点击画面重新锁定
        if (this.wantPointerLock && this.uiLocks === 0 && !this.pointerLocked) this.requestPointerLock();
      },
      this.target,
    );
    on('mouseup', (e) => {
      this.mouse.delete(e.button);
      if (e.button === 0 || e.button === 2) this.dragging = false;
    });
    on('mousemove', (e) => {
      if (this.pointerLocked || this.dragging) {
        this.look.x += e.movementX * this.mouseSensitivity;
        this.look.y += e.movementY * this.mouseSensitivity * (this.invertY ? -1 : 1);
      }
    });
    on('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
    }, this.target);
    on('contextmenu', (e) => e.preventDefault(), this.target);
  }

  detach(): void {
    for (const off of this.listeners) off();
    this.listeners = [];
  }

  setBindings(custom: Parameters<typeof mergeBindings>[0]): void {
    this.bindings = mergeBindings(custom);
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.target;
  }
  requestPointerLock(): void {
    if (!this.pointerLocked) void this.target.requestPointerLock?.();
  }
  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock();
  }

  /** UI 占用：返回释放函数 */
  lockGameplay(): () => void {
    // 打开对话 / 菜单：释放鼠标以便点击选项；全部关闭后自动重新锁定
    if (this.uiLocks === 0 && this.pointerLocked) {
      this.relockAfterUi = true;
      this.exitPointerLock();
    }
    this.uiLocks++;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.uiLocks = Math.max(0, this.uiLocks - 1);
      if (this.uiLocks === 0 && this.relockAfterUi) {
        this.relockAfterUi = false;
        if (this.wantPointerLock) this.requestPointerLock();
      }
    };
  }
  get gameplayLocked(): boolean {
    return this.uiLocks > 0;
  }

  /** 每帧开始时轮询手柄 */
  poll(): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p) => p && p.connected && p.mapping === 'standard') ?? [...pads].find((p) => p?.connected);
    this.padPrev = this.padButtons;
    if (!pad) {
      this.padButtons = [];
      this.padAxes = [0, 0, 0, 0];
      return;
    }
    this.padButtons = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    this.padAxes = [pad.axes[0] ?? 0, pad.axes[1] ?? 0, pad.axes[2] ?? 0, pad.axes[3] ?? 0];
    if (this.padButtons.some((b, i) => b && !this.padPrev[i]) || this.padAxes.some((a) => Math.abs(a) > 0.5)) this.setDevice('gamepad');
  }

  private setDevice(d: 'keyboard' | 'gamepad'): void {
    if (this.device !== d) {
      this.device = d;
      this.onDeviceChange?.(d);
    }
  }

  /** ui=true 表示这是 UI 动作，不受 gameplay 锁影响 */
  isDown(a: Action, ui = false): boolean {
    if (!ui && this.gameplayLocked) return false;
    const b = this.bindings[a];
    return b.keys.some((k) => this.keys.has(k)) || !!b.mouse?.some((m) => this.mouse.has(m)) || !!b.pad?.some((p) => this.padButtons[p]);
  }

  pressed(a: Action, ui = false): boolean {
    if (!ui && this.gameplayLocked) return false;
    const b = this.bindings[a];
    return (
      b.keys.some((k) => this.keysPressed.has(k)) ||
      !!b.mouse?.some((m) => this.mousePressed.has(m)) ||
      !!b.pad?.some((p) => this.padButtons[p] && !this.padPrev[p]) ||
      (ui && this.stickEdge(a))
    );
  }

  /** 原始按键边沿（UI 专用快捷键，如地图 +/-），不受 gameplay 锁影响 */
  pressedCode(code: string): boolean {
    return this.keysPressed.has(code);
  }

  released(a: Action): boolean {
    return this.bindings[a].keys.some((k) => this.keysReleased.has(k));
  }

  private stickPrev: Vec2 = { x: 0, y: 0 };
  private stickEdge(a: Action): boolean {
    const [x, y] = [this.padAxes[0]!, this.padAxes[1]!];
    const [px, py] = [this.stickPrev.x, this.stickPrev.y];
    if (a === 'uiUp') return y < -0.6 && py >= -0.6;
    if (a === 'uiDown') return y > 0.6 && py <= 0.6;
    if (a === 'uiLeft') return x < -0.6 && px >= -0.6;
    if (a === 'uiRight') return x > 0.6 && px <= 0.6;
    return false;
  }

  /** 移动输入：x 右正、y 前正，长度 ≤ 1 */
  moveAxis(): Vec2 {
    if (this.gameplayLocked) return { x: 0, y: 0 };
    let x = (this.isDown('moveRight') ? 1 : 0) - (this.isDown('moveLeft') ? 1 : 0);
    let y = (this.isDown('moveForward') ? 1 : 0) - (this.isDown('moveBack') ? 1 : 0);
    if (x || y) {
      const l = Math.hypot(x, y);
      return { x: x / l, y: y / l };
    }
    const s = applyDeadzone(this.padAxes[0]!, -this.padAxes[1]!);
    x = s.x;
    y = s.y;
    return { x, y };
  }

  /** 视角输入（像素级鼠标位移 + 摇杆换算），读取后清零 */
  consumeLook(dt: number): Vec2 {
    const r = applyDeadzone(this.padAxes[2]!, this.padAxes[3]!);
    const padSpeed = 900 * dt;
    const out = { x: this.look.x + r.x * padSpeed, y: this.look.y + r.y * padSpeed * (this.invertY ? -1 : 1) };
    this.look = { x: 0, y: 0 };
    if (this.gameplayLocked) return { x: 0, y: 0 };
    return out;
  }

  consumeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  /** 每帧结束调用 */
  endFrame(): void {
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.mousePressed.clear();
    this.stickPrev = { x: this.padAxes[0]!, y: this.padAxes[1]! };
    this.padPrev = this.padButtons;
  }

  /** 测试/自动驾驶：模拟按键 */
  simulateKey(code: string, down: boolean): void {
    if (down) {
      if (!this.keys.has(code)) this.keysPressed.add(code);
      this.keys.add(code);
    } else {
      this.keys.delete(code);
      this.keysReleased.add(code);
    }
  }
}

function isTypingTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

export { PAD };
