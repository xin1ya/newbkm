/**
 * M1-08 / M1-09 / M1-10 端到端：
 * - 跟随宝可梦：跟在身后、对话心情、设置开关、室内也跟随
 * - 遇敌：接触停顿 → 战斗开场提示（先手）→ 跟随宝可梦跑进战斗场 → 胜利后归还；黑屏回到复活点并付款
 * - 训练家：视线发现 →「!」→ 走到面前 → 开场白 → 对战 → 奖金 + 击败 flag → 不再发现；对话挑战
 */
import { expect, test, type Page } from '@playwright/test';
import { bootGame, mashUntilOverworld, setLead, snapshot } from './helpers';

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
const follower = (page: Page) => page.evaluate(() => window.__cuilanPlay!.follower());
const trainer = (page: Page) => page.evaluate(() => window.__cuilanPlay!.trainer());

async function teleport(page: Page, x: number, z: number, yaw = Math.PI): Promise<void> {
  await page.evaluate(
    ({ x, z, yaw }) => {
      const o = window.__cuilan!.overworld as unknown as { player: { teleport(x: number, z: number, yaw: number): void }; rig: { resetBehind(y: number): void; snap(): void }; follower: { warp(): void } };
      o.player.teleport(x, z, yaw);
      o.follower.warp();
      o.rig.resetBehind(yaw);
      o.rig.snap();
    },
    { x, z, yaw },
  );
  await frames(page, 6);
}

async function visibleEncounter(page: Page, o: { speciesId: number; level: number; hp: number; initiative: 'player' | 'wild' | null }): Promise<void> {
  await page.evaluate((o) => {
    const c = window.__cuilan!;
    const w = structuredClone(c.state.party[0]!);
    Object.assign(w, { uid: `e2e-wild-${Math.random()}`, speciesId: o.speciesId, level: o.level, hp: o.hp, moves: [{ id: 'tackle', pp: 35, maxPp: 35 }] });
    const p = c.overworld.player.position;
    c.game.events.post('encounter:start', {
      wild: w,
      position: { x: p.x, y: p.y, z: p.z },
      wildPosition: { x: p.x, y: p.y, z: p.z - 8.8 },
      initiative: o.initiative,
      entityId: -1,
      zoneId: 'e2e',
      alpha: false,
      method: 'visible',
    });
  }, o);
}

test('跟随宝可梦：跟随、对话、开关、室内', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await bootGame(page);
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  // 出现在身后
  await expect.poll(() => follower(page)).not.toBeNull();
  const lead = await page.evaluate(() => window.__cuilan!.state.party[0]!.uid);
  expect((await follower(page))!.uid).toBe(lead);

  // 走一段：跟随者保持在身后 1–4 m
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  await frames(page, 30);
  const gap = await page.evaluate(() => {
    const f = window.__cuilanPlay!.follower()!;
    const p = window.__cuilan!.overworld.player.position;
    return Math.hypot(f.x - p.x, f.z - p.z);
  });
  expect(gap).toBeGreaterThan(0.9);
  expect(gap).toBeLessThan(4.5);
  await page.screenshot({ path: 'test-results/follower-walk.png' });

  // 对话：显示心情表情与台词
  await page.evaluate(() => void (window.__cuilan!.overworld as unknown as { follower: { talk(): Promise<void> } }).follower.talk());
  await expect.poll(() => follower(page).then((f) => f?.mood ?? null)).not.toBeNull();
  await expect(page.locator('.cl-dialog')).toBeVisible();
  await page.screenshot({ path: 'test-results/follower-talk.png' });
  for (let i = 0; i < 4 && (await page.locator('.cl-dialog').count()); i++) {
    await frames(page, 4);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }

  // 设置关闭 → 消失；打开 → 回来
  await page.evaluate(() => (window.__cuilan!.state.settings.showFollower = false));
  await expect.poll(() => follower(page)).toBeNull();
  await page.evaluate(() => (window.__cuilan!.state.settings.showFollower = true));
  await expect.poll(() => follower(page)).not.toBeNull();

  // 室内也跟着
  await page.evaluate(() => window.__cuilan!.overworld.enterInterior('sprout-player-house', 'player-house'));
  await page.waitForFunction(() => window.__cuilan!.game.scenes.names.includes('interior'), null, { timeout: 60_000 });
  await frames(page, 20);
  await expect.poll(() => follower(page)).not.toBeNull();
  await page.screenshot({ path: 'test-results/follower-interior.png' });
  expect(errors).toEqual([]);
});

test('遇敌：接触停顿、先手提示、跟随者跑进战斗场、黑屏复活点', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = await bootGame(page);
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  await expect.poll(() => follower(page)).not.toBeNull();

  // 1. 从背后接近：先手提示；战斗中跟随者被借用
  await setLead(page, { level: 30, exp: 0, moves: ['tackle'] });
  await visibleEncounter(page, { speciesId: 16, level: 3, hp: 1, initiative: 'player' });
  await expect.poll(() => scenes(page), { timeout: 30_000 }).toBe('overworld>battle');
  await expect.poll(() => follower(page).then((f) => f?.borrowed ?? false)).toBe(true);
  const seen = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const s = await snapshot(page);
    if (s.ui) seen.add(s.ui);
    if ([...seen].some((t) => t.includes('抢先行动'))) break;
    await page.waitForTimeout(400);
  }
  expect([...seen].join('\n')).toContain('抢先行动');
  await page.screenshot({ path: 'test-results/encounter-opening.png' });
  const end = await mashUntilOverworld(page);
  expect(end.scenes).toBe('overworld');
  await expect.poll(() => follower(page).then((f) => f?.borrowed ?? true)).toBe(false);

  // 2. 在宝可梦中心回复 → 记录复活点
  await teleport(page, -40, 0);
  await page.evaluate(() => window.__cuilan!.overworld.enterInterior('pokecenter', 'pokecenter-cuilan'));
  await page.waitForFunction(() => window.__cuilan!.game.scenes.names.includes('interior'), null, { timeout: 60_000 });
  await frames(page, 10);
  await page.evaluate(() => window.__cuilan!.game.events.emit('party:healed', { source: 'e2e' }));
  const rp = (await page.evaluate(() => window.__cuilanPlay!.respawn())) as { label: string; xyz: number[] } | null;
  expect(rp?.label).toBe('宝可梦中心（翠澜镇）');
  await page.evaluate(() => (window.__cuilan!.game.scenes.top as unknown as { d: { leave(id: string): Promise<void> } }).d.leave('pokecenter'));
  await expect.poll(() => scenes(page), { timeout: 30_000 }).toBe('overworld');

  // 3. 远处输掉 → 付款、回到宝可梦中心门口、全队回复
  await teleport(page, -60, 200);
  await setLead(page, { level: 5, exp: 0, moves: ['growl'] });
  await page.evaluate(() => (window.__cuilan!.state.party[0]!.hp = 1));
  const money0 = await page.evaluate(() => window.__cuilan!.state.money);
  await visibleEncounter(page, { speciesId: 20, level: 40, hp: 200, initiative: 'wild' });
  await expect.poll(() => scenes(page), { timeout: 30_000 }).toBe('overworld>battle');
  const lost = await mashUntilOverworld(page, 160);
  expect(lost.scenes).toBe('overworld');
  await expect.poll(() => page.locator('.cl-dialog').textContent().catch(() => ''), { timeout: 20_000 }).toMatch(/弄丢了|赶回了/);
  const after = await page.evaluate(() => {
    const c = window.__cuilan!;
    const p = c.overworld.player.position;
    return { money: c.state.money, x: p.x, z: p.z, hp: c.state.party[0]!.hp };
  });
  expect(after.money).toBe(money0 - Math.min(money0, 8 * 5));
  expect(Math.hypot(after.x - rp!.xyz[0]!, after.z - rp!.xyz[2]!)).toBeLessThan(2);
  expect(after.hp).toBeGreaterThan(1);
  await page.screenshot({ path: 'test-results/blackout.png' });
  expect(errors).toEqual([]);
});

test('训练家：视线发现 → 走近 → 对战 → 奖金与击败 flag；对话挑战', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = await bootGame(page);
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  await page.evaluate(() => {
    const c = window.__cuilan!;
    c.state.flags['starter-chosen'] = true;
    (c.overworld.npcs as unknown as { sync(p: unknown, f: boolean): void }).sync(c.overworld.player.position, true);
  });
  await setLead(page, { level: 40, exp: 0, moves: ['tackle'] });

  // 站到短裤小子阿健视线内 7 m 处
  await teleport(page, -120, 260);
  await page.evaluate(() => (window.__cuilan!.overworld.npcs as unknown as { sync(p: unknown, f: boolean): void }).sync(window.__cuilan!.overworld.player.position, true));
  await expect.poll(() => page.evaluate(() => window.__cuilanPlay!.trainers().some((t) => t.trainer === 'youngster-jian'))).toBe(true);
  const t0 = (await page.evaluate(() => window.__cuilanPlay!.trainers().find((t) => t.trainer === 'youngster-jian')))!;
  const money0 = await page.evaluate(() => window.__cuilan!.state.money);
  await teleport(page, t0.x + Math.sin(t0.yaw) * 7, t0.z + Math.cos(t0.yaw) * 7, t0.yaw + Math.PI);
  await expect.poll(() => trainer(page).then((t) => t.lastSpotted), { timeout: 20_000 }).toBe('youngster-jian');
  // 走近后说开场白
  await expect.poll(() => trainer(page).then((t) => t.phase), { timeout: 20_000 }).toBe('intro');
  const t1 = (await page.evaluate(() => window.__cuilanPlay!.trainers().find((t) => t.trainer === 'youngster-jian')))!;
  const p1 = await page.evaluate(() => ({ x: window.__cuilan!.overworld.player.position.x, z: window.__cuilan!.overworld.player.position.z }));
  expect(Math.hypot(t1.x - p1.x, t1.z - p1.z)).toBeLessThan(3);
  await expect(page.locator('.cl-dialog')).toContainText('短裤小子');
  await page.screenshot({ path: 'test-results/trainer-intro.png' });

  // 推进开场白直到进入对战，然后打赢
  for (let i = 0; i < 20 && (await scenes(page)) !== 'overworld>battle'; i++) {
    await frames(page, 4);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
  }
  await expect.poll(() => scenes(page), { timeout: 30_000 }).toBe('overworld>battle');
  const end = await mashUntilOverworld(page, 200, async (s) => {
    if (s.scenes.endsWith('battle') && !(await page.evaluate(() => (window as unknown as { __shot?: boolean }).__shot))) {
      await page.evaluate(() => ((window as unknown as { __shot?: boolean }).__shot = true));
      await page.waitForTimeout(2500);
      await page.screenshot({ path: 'test-results/trainer-battle.png' });
    }
  });
  expect(end.scenes).toBe('overworld');
  expect((end as unknown as { seen: string[] }).seen.join('\n')).toContain('我的小拉达');
  const after = await page.evaluate(() => ({ money: window.__cuilan!.state.money, flag: window.__cuilan!.state.flags['trainer-defeated:youngster-jian'] === true }));
  expect(after.flag).toBe(true);
  expect(after.money).toBe(money0 + 16 * 4);
  await expect.poll(() => trainer(page).then((t) => t.active)).toBeNull();

  // 击败后不再发现
  await page.waitForTimeout(3000);
  await teleport(page, t0.x + Math.sin(t0.yaw) * 6, t0.z + Math.cos(t0.yaw) * 6, t0.yaw + Math.PI);
  await page.waitForTimeout(1500);
  expect((await trainer(page)).active).toBeNull();

  // 对话挑战：水手阿海（视线 0，只能对话）
  await teleport(page, 438, 32);
  await page.evaluate(() => (window.__cuilan!.overworld.npcs as unknown as { sync(p: unknown, f: boolean): void }).sync(window.__cuilan!.overworld.player.position, true));
  await frames(page, 10);
  await page.evaluate(() => void window.__cuilanNpcs!.talk('trainer-sailor-hai'));
  await expect.poll(() => trainer(page).then((t) => t.active)).toBe('sailor-hai');
  await expect(page.locator('.cl-dialog')).toContainText('水手');
  expect(errors).toEqual([]);
});
