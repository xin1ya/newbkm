/**
 * 性能 P0 · GPU 帧时间计时（EXT_disjoint_timer_query_webgl2）。
 * 每帧 begin/end 包住整帧绘制（含阴影、后处理）；查询结果异步可用（通常晚 1–3 帧），用环形队列轮询。
 * 不支持该扩展的浏览器（如部分 Safari / 远程桌面）available = false，调用全部为空操作。
 */
interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export class GpuTimer {
  readonly available: boolean;
  /** 最近若干帧 GPU 时间的平滑值（毫秒）；未知时为 0 */
  ms = 0;
  /** 最近一次读到的单帧值 */
  lastMs = 0;
  private readonly ext: TimerExt | null;
  private readonly pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
    this.available = !!this.ext;
  }

  begin(): void {
    if (!this.ext || this.active || this.pending.length > 4) return;
    const q = this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  end(): void {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
    this.poll();
  }

  private poll(): void {
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext!.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length) {
      const q = this.pending[0]!;
      if (!(gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) as boolean)) break;
      this.pending.shift();
      if (!disjoint) {
        const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
        this.lastMs = ns / 1e6;
        this.ms = this.ms === 0 ? this.lastMs : this.ms * 0.9 + this.lastMs * 0.1;
      }
      gl.deleteQuery(q);
    }
  }
}

/**
 * 动态分辨率：GPU 帧时间持续超过目标帧间隔的 85% 时逐步降低渲染比例（最低 0.7），
 * 持续低于 55% 时逐步回升（最高 1.0）。只在 GPU 计时可用时工作；调整间隔 ≥ 1.5 s，避免来回抖动。
 */
export class DynamicResolution {
  scale = 1;
  enabled = true;
  readonly min = 0.7;
  private over = 0;
  private under = 0;
  private cooldown = 0;

  constructor(private readonly apply: (scale: number) => void) {}

  /** dt 秒；gpuMs 平滑后的 GPU 帧时间；intervalMs 目标帧间隔（限帧间隔与实际刷新间隔取大者） */
  update(dt: number, gpuMs: number, intervalMs: number): void {
    if (!this.enabled || gpuMs <= 0 || intervalMs <= 0) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const load = gpuMs / intervalMs;
    this.over = load > 0.85 ? this.over + dt : 0;
    this.under = load < 0.55 ? this.under + dt : 0;
    if (this.cooldown > 0) return;
    let next = this.scale;
    if (this.over > 1) next = Math.max(this.min, this.scale - 0.1);
    else if (this.under > 4) next = Math.min(1, this.scale + 0.05);
    if (next !== this.scale) {
      this.scale = Math.round(next * 100) / 100;
      this.over = this.under = 0;
      this.cooldown = 1.5;
      this.apply(this.scale);
    }
  }

  reset(): void {
    if (this.scale !== 1) {
      this.scale = 1;
      this.apply(1);
    }
  }
}
