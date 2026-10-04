/**
 * M1-17 · 大地图端到端：M 键打开 / 关闭，迷雾控制标记显示，走到新区域后解锁标记，
 * 缩放 / 回到自己，任务「在地图上查看」居中目标，室内打开显示门口位置。
 */
import { expect, test, type Page } from '@playwright/test';
import { bootGame } from './helpers';

test.describe.configure({ mode: 'serial' });

const frames = (page: Page, n: number) =>
  page.evaluate(
    (n) =>
      new Promise<void>((r) => {
        let k = 0;
        const f = () => (++k >= n ? r() : requestAnimationFrame(f));
        requestAnimationFrame(f);
      }),
    n,
  );

const press = async (page: Page, key: string) => {
  await frames(page, 4);
  await page.keyboard.press(key);
  await frames(page, 3);
};

const shown = (page: Page) => page.evaluate(() => window.__cuilanMap!.shown());
const cam = (page: Page) => page.evaluate(() => window.__cuilanMap!.camera());

async function teleport(page: Page, x: number, z: number): Promise<void> {
  await page.evaluate(
    ({ x, z }) => {
      const o = window.__cuilan!.overworld as unknown as { player: { teleport(x: number, z: number, yaw: number): void }; rig: { snap(): void } };
      o.player.teleport(x, z, Math.PI);
      o.rig.snap();
    },
    { x, z },
  );
  await frames(page, 8);
}

test('大地图：M 键、迷雾与标记、缩放、任务目标', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await bootGame(page);
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  await frames(page, 10);

  // 1. M 打开：出生点附近的地点可见，远处（港湾市）仍在迷雾中
  await press(page, 'KeyM');
  await expect.poll(() => shown(page)).not.toBeNull();
  await expect(page.locator('.cl-map')).toBeVisible();
  const s1 = (await shown(page))!;
  expect(s1.markers).toEqual(expect.arrayContaining(['player-house', 'magnolia-lab']));
  expect(s1.markers).not.toContain('pokecenter-harbor');
  expect(s1.markers).not.toContain('meadow-hidden-cave'); // 未标记 showOnMap 的隐藏地点
  expect(s1.zones.length).toBeGreaterThan(0);
  await expect(page.locator('.cl-map .me')).toHaveCount(1);
  await expect(page.locator('.cl-map .head')).toContainText('探索度');
  await page.screenshot({ path: 'test-results/map-start.png' });

  // 2. 缩放 / 平移 / 回到自己
  const z0 = (await cam(page))!.zoom;
  await press(page, 'Equal');
  expect((await cam(page))!.zoom).toBeGreaterThan(z0);
  await press(page, 'KeyC');
  const c0 = (await cam(page))!; // 回到自己（地图边缘会被夹紧）的参考位置
  await page.keyboard.down('ArrowRight');
  await frames(page, 12);
  await page.keyboard.up('ArrowRight');
  expect((await cam(page))!.cu).toBeGreaterThan(c0.cu);
  await press(page, 'KeyC');
  expect(Math.abs((await cam(page))!.cu - c0.cu)).toBeLessThan(2);
  await press(page, 'Minus');
  await press(page, 'Minus');
  expect((await cam(page))!.zoom).toBeLessThan(z0);

  // 3. M 关闭；时钟恢复
  await press(page, 'KeyM');
  await expect.poll(() => shown(page)).toBeNull();
  await expect(page.locator('.cl-map')).toHaveCount(0);
  expect(await page.evaluate(() => window.__cuilan!.game.clock.paused)).toBe(false);

  // 4. 走到翠澜镇：宝可梦中心 / 商店解锁；港湾市仍然没有
  await teleport(page, -45, -30);
  await press(page, 'KeyM');
  await expect.poll(() => shown(page)).not.toBeNull();
  const s2 = (await shown(page))!;
  expect(s2.markers).toEqual(expect.arrayContaining(['pokecenter-cuilan', 'mart-cuilan']));
  expect(s2.markers).not.toContain('pokecenter-harbor');
  await press(page, 'Escape');
  await expect.poll(() => shown(page)).toBeNull();

  // 5. 任务「在地图上查看」：以追踪目标为中心，侧栏显示任务
  await page.evaluate(() => window.__cuilanMap!.open('main-get-starter'));
  await expect.poll(() => shown(page)).not.toBeNull();
  const v = (await page.evaluate(() => window.__cuilanMap!.view())) as { quest: { x: number; z: number; title: string } | null; focus: string };
  expect(v.focus).toBe('quest');
  expect(v.quest?.title).toBe('木兰博士的托付');
  await expect(page.locator('.cl-map .qcard')).toContainText('木兰博士的托付');
  await expect(page.locator('.cl-map .qt')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/map-quest.png' });
  await press(page, 'KeyM');
  await expect.poll(() => shown(page)).toBeNull();

  expect(errors).toEqual([]);
});

test('室内打开地图：显示所在建筑门口', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await bootGame(page);
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  await page.evaluate(() => window.__cuilan!.overworld.enterInterior('sprout-player-house', 'player-house'));
  await page.waitForFunction(() => window.__cuilan!.game.scenes.names.includes('interior'), null, { timeout: 60_000 });
  await frames(page, 20);
  await press(page, 'KeyM');
  await expect.poll(() => shown(page)).not.toBeNull();
  const v = (await page.evaluate(() => window.__cuilanMap!.view())) as { note: string | null; currentZone: string | null };
  expect(v.note).toContain('里');
  await expect(page.locator('.cl-map .note')).toBeVisible();
  await page.screenshot({ path: 'test-results/map-interior.png' });
  await press(page, 'KeyM');
  await expect.poll(() => shown(page)).toBeNull();
  expect(errors).toEqual([]);
});
