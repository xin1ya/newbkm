import { defineConfig, devices } from '@playwright/test';

/**
 * smoke：加载游戏并截图（ENG-003）
 * perf：固定路线跑图，输出帧时间与 draw call（REN-006）
 * 两者都依赖 `pnpm build` 的产物，由 webServer 通过 vite preview 提供。
 */
export default defineConfig({
  testDir: 'tests',
  timeout: 180_000,
  // 每个用例都是一个软件渲染的 WebGL 实例：12 路并发时 CPU 饱和，按键 / 计时类断言偶发失败（M1-22 QA）
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 6,
  expect: { timeout: 60_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 960, height: 540 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    // retries 1：失败重试一次，重试通过会被报告为 flaky（不隐藏），用于区分负载抖动与真实回归
    { name: 'smoke', testDir: 'tests/e2e', retries: 1, use: { ...devices['Desktop Chrome'], viewport: { width: 960, height: 540 } } },
    { name: 'perf', testDir: 'tests/perf', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
