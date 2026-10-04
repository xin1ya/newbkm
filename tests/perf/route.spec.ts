/**
 * REN-006 · 性能基线：固定路线跑图，输出帧时间与 draw call。
 *
 * 路线（约 1.1 km，奔跑速度 7.6 m/s）：萌芽镇广场 → 1 号路 → 草原 → 湖北岸道路 → 港湾市。
 * 期间照常进行分块流式加载、植被、野生宝可梦刷新（遇敌被屏蔽，避免打断）。
 *
 * 运行：
 *   pnpm build && pnpm test:perf                         # 默认 high 画质、软件渲染（只用于回归对比，绝对值无意义）
 *   PERF_GPU=1 pnpm test:perf -- --headed                 # 真实 GPU（基线数据以此为准）
 *   PERF_QUALITY=low|medium|high  PERF_SPEED=4            # 画质档位 / 路线加速倍数（CI 冒烟用）
 * 结果：test-results/perf/<画质>-<时间>.json，并在控制台打印摘要。
 */
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const QUALITY = process.env.PERF_QUALITY ?? 'high';
const SPEED = Number(process.env.PERF_SPEED ?? 1);
const RUN_SPEED = 7.6;
const ROUTE: Array<[number, number]> = [
  [-118, 372], [-80, 390], [-70, 300], [-40, 200], [-20, 120], [-20, 50],
  [0, 55], [70, 120], [190, 120], [270, 70], [330, 40], [420, 35],
];
/** 预算（设计 §2.1 / §8：高画质 60 fps，draw call < 800，同屏三角面 ≤ 1.5M） */
const BUDGET = { p95FrameMs: 16.7 * 1.25, maxDrawCalls: 800, maxTrianglesK: 1500 };

interface Sample {
  t: number;
  ms: number;
  calls: number;
  tris: number;
  chunks: number;
  pending: number;
  wild: number;
  x: number;
  z: number;
}

if (process.env.PERF_GPU) test.use({ launchOptions: { args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] } });

test(`固定路线跑图（${QUALITY}）`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // quick：跳过开场梦境（M1-13 起新游戏从自家二楼室内开始，否则整条路线都在室内里跑）
  await page.goto(`/?new&quick&seed=1&quality=${QUALITY}`);
  await page.waitForFunction(() => window.__cuilan?.ready === true, null, { timeout: 180_000 });
  await page.waitForTimeout(2000);

  const routeLen = ROUTE.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - ROUTE[i]![0], p[1] - ROUTE[i]![1]), 0);
  const durationS = routeLen / (RUN_SPEED * SPEED);
  test.setTimeout((durationS + 240) * 1000);

  const samples = await page.evaluate(
    ({ route, speed, durationS }) =>
      new Promise<Sample[]>((resolve) => {
        const c = window.__cuilan!;
        const ow = c.overworld as unknown as Record<string, unknown> & typeof c.overworld;
        // 屏蔽遇敌但保留野生刷新：冷却必须为 0（SpawnManager 在冷却期间不刷新），改为吞掉遇敌事件与草丛判定
        ow['onEncounter'] = () => undefined;
        ow['grassCheck'] = () => undefined;
        const renderer = c.game.renderer;
        renderer.info.autoReset = false; // 一帧内多个后处理 pass 的 draw call 累加
        // 预计算累计长度
        const cum = [0];
        for (let i = 1; i < route.length; i++) cum.push(cum[i - 1]! + Math.hypot(route[i]![0] - route[i - 1]![0], route[i]![1] - route[i - 1]![1]));
        const total = cum[cum.length - 1]!;
        const at = (d: number) => {
          let i = 1;
          while (i < cum.length - 1 && cum[i]! < d) i++;
          const k = Math.min(1, (d - cum[i - 1]!) / (cum[i]! - cum[i - 1]!));
          const [ax, az] = route[i - 1]!;
          const [bx, bz] = route[i]!;
          return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, yaw: Math.atan2(bx - ax, bz - az) };
        };
        const out: Sample[] = [];
        const t0 = performance.now();
        let last = t0;
        renderer.info.reset();
        const frame = (now: number) => {
          const t = (now - t0) / 1000;
          const ms = now - last;
          last = now;
          const st = (ow as unknown as { chunks: { stats: { loaded: number; pending: number } } }).chunks.stats;
          const p = c.overworld.player.position;
          if (out.length || t > 0.05)
            out.push({ t, ms, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, chunks: st.loaded, pending: st.pending, wild: (ow as unknown as { spawns: { wild: Map<number, unknown> } }).spawns.wild.size, x: p.x, z: p.z });
          renderer.info.reset();
          const d = Math.min(total, t * 7.6 * speed);
          const pos = at(d);
          c.overworld.player.teleport(pos.x, pos.z, pos.yaw);
          c.overworld.player.running = true;
          c.overworld.rig.yaw = pos.yaw + Math.PI;
          if (t < durationS + 1) requestAnimationFrame(frame);
          else {
            renderer.info.autoReset = true;
            (window as unknown as { __perfEnd: { x: number; z: number } }).__perfEnd = { x: c.overworld.player.position.x, z: c.overworld.player.position.z };
            resolve(out);
          }
        };
        requestAnimationFrame(frame);
      }),
    { route: ROUTE, speed: SPEED, durationS },
  );

  // —— 统计 ——
  const body = samples.slice(5); // 去掉首帧抖动
  const ms = body.map((s) => s.ms).sort((a, b) => a - b);
  const pct = (p: number) => ms[Math.min(ms.length - 1, Math.floor((p / 100) * ms.length))] ?? 0;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const summary = {
    quality: QUALITY,
    gpu: process.env.PERF_GPU ? 'hardware' : 'swiftshader',
    viewport: page.viewportSize(),
    routeMeters: Math.round(routeLen),
    speedMultiplier: SPEED,
    frames: body.length,
    avgFps: +(1000 / avg(body.map((s) => s.ms))).toFixed(1),
    frameMs: { p50: +pct(50).toFixed(2), p95: +pct(95).toFixed(2), p99: +pct(99).toFixed(2), max: +pct(100).toFixed(2) },
    hitchesOver50ms: body.filter((s) => s.ms > 50).length,
    drawCalls: { avg: Math.round(avg(body.map((s) => s.calls))), max: Math.max(...body.map((s) => s.calls)) },
    trianglesK: { avg: Math.round(avg(body.map((s) => s.tris)) / 1000), max: Math.round(Math.max(...body.map((s) => s.tris)) / 1000) },
    chunksLoadedMax: Math.max(...body.map((s) => s.chunks)),
    wildMax: Math.max(...body.map((s) => s.wild)),
    budget: BUDGET,
    withinBudget: { frame: pct(95) <= BUDGET.p95FrameMs, drawCalls: Math.max(...body.map((s) => s.calls)) <= BUDGET.maxDrawCalls, triangles: Math.max(...body.map((s) => s.tris)) / 1000 <= BUDGET.maxTrianglesK },
    date: new Date().toISOString(),
  };
  mkdirSync('test-results/perf', { recursive: true });
  const file = `test-results/perf/${QUALITY}-${summary.date.replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, JSON.stringify({ summary, samples }, null, 2));
  console.info(`\n[perf] ${JSON.stringify(summary, null, 2)}\n[perf] 详细数据：${file}`);

  // 硬性检查：跑完全程、无异常、终点在港湾市附近；预算只报告不失败（软件渲染下帧时间没有参考意义）
  expect(errors).toEqual([]);
  const end = await page.evaluate(() => (window as unknown as { __perfEnd: { x: number; z: number } }).__perfEnd);
  expect(Math.hypot(end.x - 420, end.z - 35)).toBeLessThan(5);
  expect(summary.chunksLoadedMax).toBeGreaterThan(9);
  // 防回归：确实在大地图上跑（不在室内/暗幕里）——大地图同屏三角面至少数十万、野生宝可梦会刷新
  expect(summary.trianglesK.max, '三角面过少：路线可能没有在大地图上执行').toBeGreaterThan(200);
  expect(summary.wildMax, '整条路线没有刷出野生宝可梦').toBeGreaterThan(0);
  // 三角面与 draw call 与 GPU 无关，软件渲染下同样有效：硬性检查
  expect(summary.withinBudget.triangles, `三角面峰值 ${summary.trianglesK.max}k 超出 ${BUDGET.maxTrianglesK}k`).toBe(true);
  expect(summary.withinBudget.drawCalls, `draw call 峰值 ${summary.drawCalls.max} 超出 ${BUDGET.maxDrawCalls}`).toBe(true);
  test.info().annotations.push({ type: 'perf', description: JSON.stringify(summary) });
});
