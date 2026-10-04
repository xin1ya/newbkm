/**
 * ENG-006 · 场景管理器（栈式）。
 * - push：新场景盖在上面（例如战斗叠加在大地图上，大地图 paused 但仍可被上层借用渲染）
 * - replace：替换栈顶；pop：返回下层
 * - 只有栈顶接收 update / fixedUpdate；render 由栈顶负责（它可以决定是否渲染下层）
 * - 切换是异步的（enter 可以加载资源），切换期间忽略新的切换请求
 */
export interface Scene {
  readonly name: string;
  enter(from: Scene | null, data?: unknown): Promise<void> | void;
  exit(to: Scene | null): Promise<void> | void;
  /** 被上层场景覆盖 / 重新回到栈顶 */
  pause?(): void;
  resume?(data?: unknown): void;
  fixedUpdate?(dt: number): void;
  update(dt: number): void;
  render(alpha: number, dt: number): void;
  resize?(w: number, h: number): void;
  dispose?(): void;
}

export class SceneManager {
  private stack: Scene[] = [];
  private busy = false;

  get top(): Scene | null {
    return this.stack[this.stack.length - 1] ?? null;
  }
  get depth(): number {
    return this.stack.length;
  }
  get transitioning(): boolean {
    return this.busy;
  }
  /** 栈中从底到顶的场景名，调试用 */
  get names(): string[] {
    return this.stack.map((s) => s.name);
  }
  find<T extends Scene>(name: string): T | null {
    return (this.stack.find((s) => s.name === name) as T) ?? null;
  }

  async push(scene: Scene, data?: unknown): Promise<void> {
    await this.guard(async () => {
      const prev = this.top;
      prev?.pause?.();
      this.stack.push(scene);
      await scene.enter(prev, data);
    });
  }

  async pop(data?: unknown): Promise<void> {
    await this.guard(async () => {
      const cur = this.stack.pop();
      if (!cur) return;
      const next = this.top;
      await cur.exit(next);
      cur.dispose?.();
      next?.resume?.(data);
    });
  }

  async replace(scene: Scene, data?: unknown): Promise<void> {
    await this.guard(async () => {
      const cur = this.stack.pop() ?? null;
      if (cur) {
        await cur.exit(scene);
        cur.dispose?.();
      }
      this.stack.push(scene);
      await scene.enter(cur, data);
    });
  }

  fixedUpdate(dt: number): void {
    if (!this.busy) this.top?.fixedUpdate?.(dt);
  }
  update(dt: number): void {
    if (!this.busy) this.top?.update(dt);
  }
  render(alpha: number, dt: number): void {
    this.top?.render(alpha, dt);
  }
  resize(w: number, h: number): void {
    for (const s of this.stack) s.resize?.(w, h);
  }

  private async guard(fn: () => Promise<void>): Promise<void> {
    if (this.busy) {
      console.warn('[scenes] 正在切换场景，忽略新的请求');
      return;
    }
    this.busy = true;
    try {
      await fn();
    } finally {
      this.busy = false;
    }
  }
}
