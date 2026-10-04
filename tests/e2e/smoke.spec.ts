/**
 * ENG-003 · 冒烟测试（基于 `pnpm build` 产物，由 playwright webServer 启动 vite preview）。
 * 覆盖 M0 验收的三件事：能加载并渲染灰盒岛、能存档、能遇敌并打完一场战斗。
 * 软件渲染（swiftshader）很慢，所以统一使用 ?lite 与 960×540 视口。
 */
import { expect, test } from '@playwright/test';
import { bootGame, snapshot, startEncounter } from './helpers';

test.describe.configure({ mode: 'serial' });

test('加载萌芽群岛并渲染出画面', async ({ page }) => {
  const errors = await bootGame(page);
  const s = await snapshot(page);
  expect(s.scenes).toBe('overworld');
  expect(s.party).toBe(1);
  await expect(page.locator('.cl-clock')).toBeVisible();
  await expect(page.locator('.cl-loading')).toHaveCount(0, { timeout: 10_000 }).catch(() => {});
  const png = await page.screenshot({ path: 'test-results/smoke-overworld.png', timeout: 120_000 });
  // 纯色/黑屏的 PNG 只有几 KB；正常画面（地形 + 天空 + 植被）远大于此
  expect(png.byteLength).toBeGreaterThan(40_000);
  expect(errors).toEqual([]);
});

test('F5 快速存档写入平台存储', async ({ page }) => {
  const errors = await bootGame(page);
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('F5');
  await expect(page.locator('.cl-toast.show')).toContainText('已存档', { timeout: 15_000 });
  const saved = await page.evaluate(async () => (await window.__cuilan!.game.platform.storage.read('slot1'))?.length ?? 0);
  expect(saved).toBeGreaterThan(500);
  expect(errors).toEqual([]);
});

test('遇敌 → 战斗 → 胜利 → 返回大地图', async ({ page }) => {
  const errors = await bootGame(page);
  await startEncounter(page, 16, 2, 8);
  await expect.poll(async () => (await snapshot(page)).scenes, { timeout: 30_000 }).toBe('overworld>battle');
  let movePicked = false;
  let shot = false;
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(1200);
    const s = await snapshot(page);
    if (s.scenes === 'overworld') break;
    if (!shot && s.ui.includes('PP')) {
      shot = true;
      await page.screenshot({ path: 'test-results/smoke-battle-moves.png', timeout: 120_000 });
    }
    // 招式菜单：选第 2 个招式（撞击），之后光标记忆会保持
    if (s.ui.includes('PP') && !movePicked) {
      movePicked = true;
      await page.keyboard.press('ArrowRight');
    }
    await page.keyboard.press('Enter');
  }
  const end = await snapshot(page);
  expect(end.scenes).toBe('overworld');
  expect(end.hp[0]).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('Toon 样张页可以打开', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/style-guide.html?lite&shot');
  await page.waitForFunction(() => (window as unknown as { __styleGuideReady?: boolean }).__styleGuideReady === true, null, { timeout: 120_000 });
  await page.waitForTimeout(2000);
  const png = await page.screenshot({ path: 'test-results/smoke-style-guide.png', timeout: 120_000 });
  expect(png.byteLength).toBeGreaterThan(30_000);
  expect(errors).toEqual([]);
});
