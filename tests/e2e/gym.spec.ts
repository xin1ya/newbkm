/**
 * M1-11 端到端：翠澜道馆（道馆 1 · 水系）
 * - 水位机关：高水位时水池挡路 → 木筏上石岛 → 阀门 A 放水（栈道露出、木筏够不着）→ 阀门 B 蓄水 → 木筏到馆主台
 * - 道馆训练家：视线发现 → 在馆主台舞台开战 → 胜利后回到石岛原位
 * - 馆主：对话挑战 → 按 GymDef 生成队伍 → 胜利仪式 → 徽章 flag + 招式学习器 + 水上骑乘能力
 */
import { expect, test, type Page } from '@playwright/test';
import { bootGame, setLead } from './helpers';

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
const scenes = (page: Page) => page.evaluate(() => window.__cuilan!.game.scenes.names.join('>'));
const trainer = (page: Page) => page.evaluate(() => window.__cuilanPlay!.trainer());

type GymView = {
  player: { position: { x: number; y: number; z: number }; teleport(x: number, z: number, yaw: number): void };
  follower: { warp(): void };
  waterLevel: 'high' | 'low' | null;
  puzzle: { standable(x: number, z: number): boolean; animating: boolean; surface: number } | null;
  turnValve(id: string): Promise<boolean>;
};

async function inTeleport(page: Page, x: number, z: number, yaw = Math.PI): Promise<void> {
  await page.evaluate(
    ({ x, z, yaw }) => {
      const s = window.__cuilanInterior!() as unknown as GymView;
      s.player.teleport(x, z, yaw);
      s.follower.warp();
    },
    { x, z, yaw },
  );
  await frames(page, 4);
}
const gym = <T,>(page: Page, fn: (s: GymView) => T) => page.evaluate(`(${fn.toString()})(window.__cuilanInterior())`) as Promise<T>;
const pos = (page: Page) => gym(page, (s) => ({ x: s.player.position.x, y: s.player.position.y, z: s.player.position.z }));

/** 按住方向键走一段（室内镜头固定：W = -Z） */
async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await frames(page, 3);
}

/** 连按 Enter 推进对战，直到回到道馆室内 */
async function mashUntilInterior(page: Page, maxSteps = 200): Promise<string[]> {
  const seen = new Set<string>();
  for (let i = 0; i < maxSteps; i++) {
    await page.waitForTimeout(900);
    const ui = await page.evaluate(() => [...document.querySelectorAll('.cl-dialog, .cl-menu')].map((e) => e.textContent ?? '').join(' | '));
    if (ui) seen.add(ui);
    if ((await scenes(page)) === 'overworld>interior' && !ui) break;
    await page.keyboard.press('Enter');
  }
  return [...seen];
}

test('翠澜道馆：水位机关 → 道馆训练家 → 馆主 → 徽章', async ({ page }) => {
  test.setTimeout(900_000);
  const errors = await bootGame(page);
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  await page.evaluate(() => {
    const c = window.__cuilan!;
    for (const f of ['lab-visited', 'starter-chosen']) {
      c.state.flags[f] = true;
      c.game.events.emit('flag:set', { flag: f, value: true });
    }
  });
  await expect.poll(() => page.evaluate(() => window.__cuilanQuests!.tracked())).toBe('main-gym-verdant');
  await setLead(page, { level: 60, exp: 0, moves: ['tackle'] });

  // 进入道馆
  await page.evaluate(() => void (window.__cuilan!.overworld as unknown as { enterInterior(i: string, d: string): Promise<void> }).enterInterior('gym-cuilan', 'gym-cuilan'));
  await expect.poll(() => scenes(page), { timeout: 30_000 }).toBe('overworld>interior');
  await frames(page, 10);
  expect(await gym(page, (s) => s.waterLevel)).toBe('high');
  await page.screenshot({ path: 'test-results/gym-lobby.png' });

  // 1. 高水位：从大厅直接往水池走会被挡住
  await inTeleport(page, 0, 14.2);
  await hold(page, 'KeyW', 1500);
  expect((await pos(page)).z).toBeGreaterThan(12.5);

  // 2. 木筏（高水位浮起）→ 石岛 A：被道馆训练家阿浪发现
  await inTeleport(page, -9, 12.5);
  // 按住 W 直到上了木筏（固定时长在慢机器上可能差几厘米，M1-22 改为轮询）
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await pos(page)).z, { timeout: 5_000, intervals: [50] }).toBeLessThan(12.2);
  await page.keyboard.up('KeyW');
  const onRaft = await pos(page);
  expect(onRaft.y).toBeGreaterThan(0.15); // 站在木筏上（高于地面）
  await inTeleport(page, -9, 9.4);
  await expect.poll(() => trainer(page).then((t) => t.lastSpotted), { timeout: 20_000 }).toBe('gym-cuilan-1');
  await expect.poll(() => trainer(page).then((t) => t.phase), { timeout: 20_000 }).toBe('intro');
  const preBattle = await pos(page);
  for (let i = 0; i < 20 && (await scenes(page)) !== 'overworld>interior>battle'; i++) {
    await frames(page, 4);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
  }
  await expect.poll(() => scenes(page), { timeout: 30_000 }).toBe('overworld>interior>battle');
  // 对战在馆主台的固定舞台进行
  const stage = await pos(page);
  expect(Math.hypot(stage.x - 0, stage.z + 5.6)).toBeLessThan(0.5);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/gym-trainer-battle.png' });
  await mashUntilInterior(page);
  expect(await page.evaluate(() => window.__cuilan!.state.flags['trainer-defeated:gym-cuilan-1'])).toBe(true);
  // 胜利后回到石岛上的原位
  const back = await pos(page);
  expect(Math.hypot(back.x - preBattle.x, back.z - preBattle.z)).toBeLessThan(0.6);

  // 3. 阀门 A：放水 → 栈道露出、木筏够不着
  await inTeleport(page, -10.2, 4.8);
  await frames(page, 6);
  await expect(page.locator('.cl-prompt.show')).toContainText('转动阀门');
  expect(await gym(page, (s) => s.turnValve('valve-a'))).toBe(true);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/gym-draining.png' });
  await expect.poll(() => gym(page, (s) => s.puzzle!.animating), { timeout: 10_000 }).toBe(false);
  expect(await gym(page, (s) => s.waterLevel)).toBe('low');
  expect(await gym(page, (s) => [s.puzzle!.standable(-9, 11), s.puzzle!.standable(0, 6)])).toEqual([false, true]);
  await page.screenshot({ path: 'test-results/gym-low.png' });
  // 沿石栈道走向石岛 B（真实碰撞：按住方向键）
  await inTeleport(page, -5.5, 6, Math.PI / 2);
  await page.evaluate(() => (window.__cuilan!.state.flags['trainer-defeated:gym-cuilan-2'] = true));
  await hold(page, 'KeyD', 3500);
  // 走过了原本是水的区域（x -5.5 → 至少 -3.5，高水位时这里会被挡住）
  expect((await pos(page)).x).toBeGreaterThan(-4.5);

  // 4. 阀门 B：蓄水 → 木筏 R2 浮起 → 馆主台
  await inTeleport(page, 10.3, -0.3);
  expect(await gym(page, (s) => s.turnValve('valve-b'))).toBe(true);
  await expect.poll(() => gym(page, (s) => s.puzzle!.animating), { timeout: 10_000 }).toBe(false);
  expect(await gym(page, (s) => s.waterLevel)).toBe('high');
  expect(await gym(page, (s) => [s.puzzle!.standable(0, 6), s.puzzle!.standable(9, -3.5)])).toEqual([false, true]);
  await inTeleport(page, 9, -1.5);
  await hold(page, 'KeyW', 5000);
  expect((await pos(page)).z).toBeLessThan(-3);

  // 5. 馆主沧澜：对话挑战 → 道馆战
  await inTeleport(page, 0, -14.2);
  await page.evaluate(() => void window.__cuilanNpcs!.talk('canglan'));
  await expect.poll(() => trainer(page).then((t) => t.active)).toBe('gym-cuilan-leader');
  await expect(page.locator('.cl-dialog')).toContainText('沧澜');
  for (let i = 0; i < 20 && (await scenes(page)) !== 'overworld>interior>battle'; i++) {
    await frames(page, 4);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
  }
  await expect.poll(() => scenes(page), { timeout: 30_000 }).toBe('overworld>interior>battle');
  // 队伍来自 GymDef：3 只（海星星、大钳蟹、暴鲤龙），0 徽章档 Lv 13–16
  const foe = await page.evaluate(() => {
    const top = window.__cuilan!.game.scenes.top as unknown as { battle: { sides: Array<{ party: Array<{ pokemon: { speciesId: number; level: number } }> }> } };
    return top.battle.sides[1]!.party.map((m) => [m.pokemon.speciesId, m.pokemon.level]);
  });
  expect(foe).toEqual([
    [120, 13],
    [98, 13],
    [130, 16],
  ]);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/gym-leader-battle.png' });
  const money0 = await page.evaluate(() => window.__cuilan!.state.money);
  const seen = await mashUntilInterior(page, 260);
  expect(seen.join('\n')).toContain('翠澜徽章');
  const after = await page.evaluate(() => {
    const c = window.__cuilan!;
    return { badge: c.state.flags['badge-verdant'] === true, tm: c.state.bag['tm-water-pulse'] ?? 0, money: c.state.money };
  });
  expect(after.badge).toBe(true);
  expect(after.tm).toBe(1);
  expect(after.money).toBe(money0 + 1680);
  await expect.poll(() => page.evaluate(() => window.__cuilanQuests!.notices())).toContain('completed:水之试炼');
  await page.screenshot({ path: 'test-results/gym-badge.png' });
  expect(errors).toEqual([]);
});
