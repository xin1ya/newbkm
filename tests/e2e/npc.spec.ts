/**
 * M1-06 · NPC 端到端：大地图按键对话（说话人名牌、NPC 转向玩家）→ 名字标签 → 接任务置位 flag → 室内固定位 NPC。
 */
import { expect, test, type Page } from '@playwright/test';
import { bootGame } from './helpers';

test.describe.configure({ mode: 'serial' });

const dialogOpen = (page: Page) => page.locator('.cl-dialog').isVisible();

/** 逐页推进对话直到关闭 */
async function finishDialog(page: Page): Promise<string[]> {
  const pages: string[] = [];
  for (let i = 0; i < 30 && (await dialogOpen(page)); i++) {
    pages.push((await page.locator('.cl-dialog').textContent()) ?? '');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
  }
  expect(await dialogOpen(page)).toBe(false);
  return pages;
}

async function standInFront(page: Page, id: string, dist = 1.4): Promise<void> {
  await page.evaluate(
    ([id, dist]) => {
      const c = window.__cuilan!;
      const n = window.__cuilanNpcs!.list().find((x) => x.id === id)!;
      const x = n.x + Math.sin(n.yaw) * dist;
      const z = n.z + Math.cos(n.yaw) * dist;
      c.overworld.player.teleport(x, z, n.yaw + Math.PI);
      c.overworld.rig.resetBehind(c.overworld.player.facing);
      c.overworld.rig.snap();
    },
    [id, dist] as const,
  );
}

test('大地图：面朝 NPC 按 E 对话，NPC 转向玩家，名字标签可见', async ({ page }) => {
  const errors = await bootGame(page);
  const ids = await page.evaluate(() => window.__cuilanNpcs!.list().map((n) => n.id));
  expect(ids).toContain('sprout-dock-keeper');
  expect(ids.length).toBeGreaterThanOrEqual(8);

  await standInFront(page, 'sprout-dock-keeper');
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__cuilanNpcs!.focus())).toBe('sprout-dock-keeper');
  await expect.poll(() => page.evaluate(() => window.__cuilanNpcs!.tags()), { timeout: 10_000 }).toContain('sprout-dock-keeper');
  await expect(page.locator('.cl-nametag', { hasText: '码头' }).first()).toBeVisible();

  await page.evaluate(() => {
    const w = window as unknown as { __talks: string[] };
    w.__talks = [];
    window.__cuilan!.game.events.on('npc:talk', (e) => w.__talks.push(`${e.npc}:${e.phase}`));
  });
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('KeyE');
  await expect(page.locator('.cl-dialog')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.cl-dialog .speaker')).not.toBeEmpty();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/npc-talk.png', timeout: 120_000 });
  const pages = await finishDialog(page);
  expect(pages.length).toBeGreaterThan(0);
  const talks = await page.evaluate(() => (window as unknown as { __talks: string[] }).__talks);
  expect(talks.slice(0, 2)).toEqual(['sprout-dock-keeper:start', 'sprout-dock-keeper:end']);
  expect(errors).toEqual([]);
});

test('接任务：对话后置位 startFlag 并提示接受任务', async ({ page }) => {
  const errors = await bootGame(page);
  await page.evaluate(() => {
    window.__cuilan!.state.flags['starter-chosen'] = true;
  });
  await page.waitForTimeout(700); // 等待 NPC 按 flag 重新同步
  await standInFront(page, 'cuilan-rumor-girl');
  await page.waitForTimeout(500);
  const done = page.evaluate(() => window.__cuilanNpcs!.talk('cuilan-rumor-girl'));
  await expect(page.locator('.cl-dialog')).toBeVisible({ timeout: 10_000 });
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  await finishDialog(page);
  expect(await done).toBe(true);
  expect(await page.evaluate(() => window.__cuilan!.state.flags['zorua-quest-start'])).toBe(true);
  await expect(page.locator('.cl-toast')).toContainText('接受了任务', { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('室内：研究所里有木兰博士，靠近按 E 对话', async ({ page }) => {
  const errors = await bootGame(page);
  await page.evaluate(() => window.__cuilan!.overworld.enterInterior('sprout-lab', 'magnolia-lab'));
  await expect.poll(() => page.evaluate(() => window.__cuilan!.game.scenes.names.join('>')), { timeout: 20_000 }).toBe('overworld>interior');
  await page.waitForFunction(() => !window.__cuilan!.game.scenes.transitioning);
  const ids = await page.evaluate(() => window.__cuilanNpcs!.list().map((n) => n.id));
  expect(ids).toContain('magnolia');
  await page.evaluate(() => {
    const s = window.__cuilanInterior!()!;
    const n = window.__cuilanNpcs!.list().find((x) => x.id === 'magnolia')!;
    s.player.teleport(n.x + Math.sin(n.yaw) * 1.3, n.z + Math.cos(n.yaw) * 1.3, n.yaw + Math.PI);
  });
  await page.waitForTimeout(500);
  await expect.poll(() => page.evaluate(() => window.__cuilanNpcs!.tags()), { timeout: 10_000 }).toContain('magnolia');
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('KeyE');
  await expect(page.locator('.cl-dialog .speaker')).toContainText('木兰', { timeout: 10_000 });
  await page.screenshot({ path: 'test-results/npc-lab.png', timeout: 120_000 });
  await finishDialog(page);
  expect(await page.evaluate(() => window.__cuilan!.game.scenes.names.join('>'))).toBe('overworld>interior');
  expect(errors).toEqual([]);
});
