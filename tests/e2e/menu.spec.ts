/**
 * M1-18 · 暂停菜单端到端：打开 / 关闭、时钟暂停、背包使用伤药、设置生效、图鉴、存档。
 */
import { expect, test, type Page } from '@playwright/test';
import { bootGame } from './helpers';

test.describe.configure({ mode: 'serial' });

const menuState = (page: Page) => page.evaluate(() => window.__cuilanMenu!.state());
/** 等待若干渲染帧（软件渲染下一帧可能超过 500ms；新压栈的 UI 组件第一帧不接收输入） */
const frames = (page: Page, n: number) =>
  page.evaluate((n) => new Promise<void>((r) => {
    let k = 0;
    const f = () => (++k >= n ? r() : requestAnimationFrame(f));
    requestAnimationFrame(f);
  }), n);
const press = async (page: Page, key: string, wait = 100) => {
  await frames(page, 4);
  await page.keyboard.press(key);
  await frames(page, 2);
  await page.waitForTimeout(wait);
};

async function finishDialog(page: Page): Promise<string> {
  let text = '';
  await page.locator('.cl-dialog').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
  for (let i = 0; i < 20 && (await page.locator('.cl-dialog').isVisible()); i++) {
    text += (await page.locator('.cl-dialog').textContent()) ?? '';
    await press(page, 'Enter', 350);
  }
  return text;
}

test('暂停菜单：导航、道具、设置、图鉴、存档', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await bootGame(page);
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });

  // Esc 打开，默认停在“队伍”；时钟暂停
  await press(page, 'Escape', 400);
  await expect.poll(() => menuState(page)).toEqual({ tab: 'party', inPage: false });
  await expect(page.locator('.cl-pause')).toBeVisible();
  const t0 = await page.evaluate(() => window.__cuilan!.game.clock.totalMinutes);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__cuilan!.game.clock.totalMinutes)).toBe(t0);
  await expect(page.locator('.cl-party .card')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/menu-party.png' });

  // 队伍详情切到“能力”
  await press(page, 'Enter');
  await expect.poll(() => menuState(page)).toEqual({ tab: 'party', inPage: true });
  await press(page, 'ArrowRight');
  await expect(page.locator('.cl-party .cl-stats')).toBeVisible();
  await press(page, 'KeyQ');
  await expect.poll(async () => (await menuState(page))?.inPage).toBe(false);

  // 背包：伤药对受伤的伙伴使用
  await page.evaluate(() => {
    const s = window.__cuilan!.state;
    s.bag.potion = 2;
    s.party[0]!.hp = 3;
  });
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await expect.poll(() => menuState(page)).toEqual({ tab: 'bag', inPage: true });
  await expect(page.locator('.cl-bag .it.sel')).toContainText('伤药');
  await page.screenshot({ path: 'test-results/menu-bag.png' });
  await press(page, 'Enter', 300); // 打开操作菜单
  await press(page, 'Enter', 300); // 使用
  await press(page, 'Enter', 300); // 选宝可梦 → 第一只
  const said = await finishDialog(page);
  expect(said).toContain('恢复了');
  await expect.poll(() => page.evaluate(() => window.__cuilan!.state.party[0]!.hp)).toBe(22);
  await expect.poll(() => page.evaluate(() => window.__cuilan!.state.bag.potion)).toBe(1);
  // 精灵球口袋
  await press(page, 'ArrowRight');
  await expect(page.locator('.cl-bag .it.sel')).toContainText('精灵球');
  await press(page, 'KeyQ');

  // 图鉴：木木枭已捕获
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await expect(page.locator('.cl-dex .row.sel')).toContainText('木木枭');
  await expect(page.locator('.cl-dex .entry .flavor')).toBeVisible();
  await page.screenshot({ path: 'test-results/menu-dex.png' });
  await press(page, 'KeyQ');

  // 存档（图鉴之后是任务）
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await press(page, 'Enter', 300); // 确认存档
  await press(page, 'Enter', 300);
  await finishDialog(page);
  await expect.poll(() => page.evaluate(() => window.__cuilan!.state.savedAt)).toBeTruthy();
  await press(page, 'KeyQ');

  // 设置：文字速度 普通 → 快，镜头灵敏度 +0.1
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await expect.poll(() => menuState(page)).toEqual({ tab: 'settings', inPage: true });
  await press(page, 'ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__cuilan!.state.settings.textSpeed)).toBe('fast');
  await page.screenshot({ path: 'test-results/menu-settings.png' });
  await press(page, 'ArrowDown'); // 名字标签
  await press(page, 'Enter');
  await expect.poll(() => page.evaluate(() => window.__cuilan!.state.settings.showNameTags)).toBe(false);
  await press(page, 'Enter');

  // Esc 直接关闭；时钟恢复
  await press(page, 'Escape', 400);
  await expect.poll(() => menuState(page)).toBeNull();
  await expect(page.locator('.cl-pause')).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__cuilan!.game.clock.totalMinutes)).toBeGreaterThan(t0);
  expect(errors).toEqual([]);
});

test('室内也能打开菜单，所在地显示房间名', async ({ page }) => {
  test.setTimeout(200_000);
  const errors = await bootGame(page);
  await page.evaluate(() => window.__cuilan!.overworld.enterInterior('sprout-player-house', 'player-house'));
  await page.waitForFunction(() => window.__cuilan!.game.scenes.names.includes('interior'), null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  await expect.poll(() => page.evaluate(() => window.__cuilanMenu!.open('save'))).toBe(true);
  await page.waitForTimeout(400);
  await expect(page.locator('.cl-save .card')).toContainText('萌芽');
  await page.screenshot({ path: 'test-results/menu-interior-save.png' });
  await press(page, 'Escape', 400);
  await expect.poll(() => menuState(page)).toBeNull();
  expect(errors).toEqual([]);
});
