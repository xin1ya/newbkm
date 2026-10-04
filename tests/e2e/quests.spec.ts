/**
 * M1-16 · 任务日志 / 追踪 / 罗盘端到端：
 * 自动追踪主线 → 走到研究所完成目标 → 剧情 flag 完成任务并发奖励 → 下一个主线自动追踪（光柱 + 罗盘）
 * → 任务日志里切换追踪支线 → 进入幻影之森（enter-zone）→ 搜索范围光环。
 */
import { expect, test, type Page } from '@playwright/test';
import { bootGame } from './helpers';

test.describe.configure({ mode: 'serial' });

const q = <T,>(page: Page, fn: (api: NonNullable<Window['__cuilanQuests']>) => T) =>
  page.evaluate((src) => {
    const api = window.__cuilanQuests!;
    return new Function('api', `return (${src})(api)`)(api) as T;
  }, fn.toString());

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

async function teleport(page: Page, x: number, z: number, yaw = 0): Promise<void> {
  await page.evaluate(
    ({ x, z, yaw }) => {
      const o = window.__cuilan!.overworld as unknown as { player: { teleport(x: number, z: number, yaw: number): void }; rig: { resetBehind(y: number): void; snap(): void } };
      o.player.teleport(x, z, yaw);
      o.rig.resetBehind(yaw);
      o.rig.snap();
    },
    { x, z, yaw },
  );
  await frames(page, 6);
}

test('任务追踪：主线推进、奖励、罗盘与世界标记、日志切换追踪', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await bootGame(page);
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });

  // 1. 新游戏：自动追踪「木兰博士的托付」，罗盘与面板指向研究所
  await expect.poll(() => q(page, (a) => a.tracked())).toBe('main-get-starter');
  await expect.poll(() => q(page, (a) => a.tracker())).toContain('前往木兰博士研究所');
  await expect.poll(() => q(page, (a) => a.compass()?.text ?? '')).toMatch(/\d+ m/);
  await page.screenshot({ path: 'test-results/quest-hud-start.png' });

  // 罗盘角度与镜头朝向一致：转身面向目标后，图标回到中间
  await page.evaluate(() => {
    const o = window.__cuilan!.overworld as unknown as { player: { position: { x: number; z: number } }; rig: { yaw: number; snap(): void } };
    const t = window.__cuilanQuests!.target()!;
    const p = o.player.position;
    // 镜头在玩家身后：yaw = 朝向 + π；朝向 atan2(dx, dz)
    o.rig.yaw = Math.atan2(t.x - p.x, t.z - p.z) + Math.PI;
    o.rig.snap();
  });
  await expect.poll(async () => Math.abs((await q(page, (a) => a.compass()?.left ?? 999)) as number), { timeout: 20_000 }).toBeLessThan(30);

  // 2. 走到研究所门口：reach-point 完成第一个目标
  await teleport(page, -20, 350, Math.PI);
  await expect.poll(() => page.evaluate(() => window.__cuilan!.state.flags['lab-visited'] === true)).toBe(true);
  await expect.poll(() => q(page, (a) => a.tracker())).toContain('在研究所选择御三家');
  await expect.poll(() => q(page, (a) => a.notices())).toContain('objective:木兰博士的托付');

  // 3. 剧情置位 starter-chosen → 任务完成 + 奖励；下一主线自动追踪
  const balls = await page.evaluate(() => window.__cuilan!.state.bag['poke-ball'] ?? 0);
  await page.evaluate(() => {
    const c = window.__cuilan!;
    c.state.flags['starter-chosen'] = true;
    c.game.events.emit('flag:set', { flag: 'starter-chosen', value: true });
  });
  await expect.poll(() => q(page, (a) => a.notices())).toContain('completed:木兰博士的托付');
  await expect.poll(() => page.evaluate(() => window.__cuilan!.state.bag['poke-ball'])).toBe(balls + 5);
  await expect.poll(() => q(page, (a) => a.tracked())).toBe('main-gym-verdant');
  const notices = (await q(page, (a) => a.notices())) as string[];
  expect(notices).toContain('started:水之试炼');
  expect(notices).toContain('available:幻影之森的索罗亚');
  await expect(page.locator('.cl-qnotice').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/quest-notices.png' });
  // 翠澜镇很远：光柱可见
  await expect.poll(() => q(page, (a) => a.beacon().beam), { timeout: 20_000 }).toBe(true);

  // 4. 接取支线并在任务日志里改为追踪
  await page.evaluate(() => {
    const c = window.__cuilan!;
    c.state.flags['zorua-quest-start'] = true;
    c.game.events.emit('flag:set', { flag: 'zorua-quest-start', value: true });
  });
  await expect.poll(() => q(page, (a) => a.notices())).toContain('started:幻影之森的索罗亚');
  await press(page, 'KeyJ');
  await expect.poll(() => page.evaluate(() => window.__cuilanMenu!.state())).toEqual({ tab: 'quests', inPage: true });
  await expect(page.locator('.cl-quests .q.sel')).toContainText('水之试炼');
  await expect(page.locator('.cl-quests .q.completed[data-quest="main-get-starter"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/quest-log-main.png' });
  await press(page, 'ArrowRight'); // 支线
  await expect(page.locator('.cl-quests .q.sel')).toContainText('幻影之森的索罗亚');
  await expect(page.locator('.cl-quests .q.locked').first()).toContainText('???');
  await press(page, 'Enter'); // 操作菜单
  await expect(page.locator('.cl-menu')).toContainText('追踪这个任务');
  await expect(page.locator('.cl-menu')).toContainText('在地图上查看');
  await press(page, 'Enter'); // 追踪
  await expect.poll(() => q(page, (a) => a.tracked())).toBe('side-zorua-forest');
  await expect.poll(() => page.evaluate(() => window.__cuilan!.state.settings.trackedQuest)).toBe('side-zorua-forest');
  await expect(page.locator('.cl-quests .qd .trkinfo')).toContainText('追踪中');
  await page.screenshot({ path: 'test-results/quest-log-side.png' });
  await press(page, 'Escape');
  await expect.poll(() => page.evaluate(() => window.__cuilanMenu!.state())).toBeNull();

  // 5. 进入幻影之森（enter-zone，读取区域中心传送）→ 下一个目标是搜索范围
  const forest = (await q(page, (a) => a.target())) as { x: number; z: number; zoneId: string | null };
  expect(forest.zoneId).toBe('phantom-forest');
  await teleport(page, forest.x, forest.z);
  await expect.poll(() => page.evaluate(() => window.__cuilan!.state.flags['zorua-forest-entered'] === true)).toBe(true);
  await expect.poll(() => q(page, (a) => a.tracker())).toContain('跟着脚印找到索罗亚');
  // 搜索范围（半径 45 m）边缘附近：地面光环出现
  await teleport(page, -320 + 60, -330, -Math.PI / 2);
  await expect.poll(() => q(page, (a) => a.beacon().ring), { timeout: 20_000 }).toBe(true);
  await page.screenshot({ path: 'test-results/quest-ring.png' });
  // 走进范围：罗盘显示「搜索范围内」
  await teleport(page, -320 + 20, -330, -Math.PI / 2);
  await expect.poll(() => q(page, (a) => a.compass()?.text ?? '')).toBe('搜索范围内');

  // 6. 设置关闭任务标记 → 浮空图标与光柱隐藏
  await page.evaluate(() => (window.__cuilan!.state.settings.showWorldMarkers = false));
  await teleport(page, -320 + 120, -330, -Math.PI / 2);
  await expect.poll(() => q(page, (a) => a.beacon().beam || a.beacon().ring || a.marker()), { timeout: 20_000 }).toBe(false);
  expect(errors).toEqual([]);
});

test('室内只显示追踪面板', async ({ page }) => {
  test.setTimeout(200_000);
  const errors = await bootGame(page);
  await page.evaluate(() => window.__cuilan!.overworld.enterInterior('sprout-player-house', 'player-house'));
  await page.waitForFunction(() => window.__cuilan!.game.scenes.names.includes('interior'), null, { timeout: 60_000 });
  await expect.poll(() => q(page, (a) => a.tracker())).toContain('出门后查看方向');
  expect(await q(page, (a) => a.compass())).toBeNull();
  await page.screenshot({ path: 'test-results/quest-interior.png' });
  expect(errors).toEqual([]);
});
