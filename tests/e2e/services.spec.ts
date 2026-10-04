/**
 * M1-19 / M1-12 / M1-15 / M1-20 e2e：宝可梦中心回复、商店购买、水上骑乘、钓鱼、区域 / 室内 BGM 切换。
 * 软件渲染每帧约 600 ms，按键前等待若干帧。
 */
import { expect, test, type Page } from '@playwright/test';
import { bootGame } from './helpers';

test.describe.configure({ timeout: 300_000 });

const frames = (page: Page, n = 4) =>
  page.evaluate(
    (n) =>
      new Promise<void>((r) => {
        let k = 0;
        const f = () => (++k >= n ? r() : requestAnimationFrame(f));
        requestAnimationFrame(f);
      }),
    n,
  );

async function press(page: Page, key: string): Promise<void> {
  await frames(page);
  await page.keyboard.press(key);
}

test('宝可梦中心：护士回复全队，恢复机放球，室内播放中心 BGM', async ({ page }) => {
  const errors = await bootGame(page);
  await page.evaluate(() => window.__cuilan!.overworld.enterInterior('pokecenter', 'pokecenter-cuilan'));
  await page.waitForFunction(() => window.__cuilanInterior?.()?.config.id === 'pokecenter', null, { timeout: 60_000 });
  await frames(page, 6);
  expect(await page.evaluate(() => window.__cuilanAudio!.state().wanted)).toBe('pokecenter');
  await page.evaluate(() => {
    const p = window.__cuilan!.state.party[0]!;
    p.hp = 1;
    p.status = 'psn' as never;
  });
  await page.evaluate(() => {
    (window as unknown as { __talkDone: boolean }).__talkDone = false;
    void window.__cuilanNpcs!.talk('nurse').then(() => ((window as unknown as { __talkDone: boolean }).__talkDone = true));
  });
  let maxBalls = 0;
  for (let i = 0; i < 60; i++) {
    const [done, balls] = await page.evaluate(() => [(window as unknown as { __talkDone: boolean }).__talkDone, window.__cuilanServices!.healBalls()] as const);
    maxBalls = Math.max(maxBalls, balls);
    if (done) break;
    await press(page, 'Enter');
  }
  const hp = await page.evaluate(() => {
    const p = window.__cuilan!.state.party[0]!;
    return { hp: p.hp, status: p.status ?? null };
  });
  expect(hp.hp).toBeGreaterThan(1);
  expect(hp.status).toBeNull();
  expect(maxBalls).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('友好商店：买精灵球扣钱，背包增加', async ({ page }) => {
  const errors = await bootGame(page);
  await page.evaluate(() => window.__cuilan!.overworld.enterInterior('mart', 'mart-cuilan'));
  await page.waitForFunction(() => window.__cuilanInterior?.()?.config.id === 'mart', null, { timeout: 60_000 });
  await frames(page, 6);
  expect(await page.evaluate(() => window.__cuilanAudio!.state().wanted)).toBe('mart');
  const before = await page.evaluate(() => ({ money: window.__cuilan!.state.money, balls: window.__cuilan!.state.bag['poke-ball'] ?? 0 }));
  await page.evaluate(() => {
    (window as unknown as { __talkDone: boolean }).__talkDone = false;
    void window.__cuilanNpcs!.talk('clerk').then(() => ((window as unknown as { __talkDone: boolean }).__talkDone = true));
  });
  // 欢迎语 → 商店界面：购买 → 第一项（精灵球）→ 数量 1 → 确认
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => ({ shop: !!window.__cuilanServices!.shop(), money: window.__cuilan!.state.money }));
    if (s.money < before.money) break;
    await press(page, 'Enter');
  }
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => (window as unknown as { __talkDone: boolean }).__talkDone)) break;
    await press(page, (await page.evaluate(() => !!window.__cuilanServices!.shop())) ? 'Escape' : 'Enter');
  }
  const after = await page.evaluate(() => ({ money: window.__cuilan!.state.money, balls: window.__cuilan!.state.bag['poke-ball'] ?? 0 }));
  expect(after.money).toBeLessThan(before.money);
  expect(after.balls).toBeGreaterThan(before.balls);
  expect(errors).toEqual([]);
});

/** 把玩家放到翠澜湖岸边的浅水里（湖岸平缓，要走进齐膝的水里才够得着深水）、面朝湖心 */
async function toLakeShore(page: Page): Promise<void> {
  const ok = await page.evaluate(() => {
    const ow = window.__cuilan!.overworld;
    const hf = ow.terrain.hf;
    const [cx, cz] = [135, -55];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      // 从岸上往湖心走：找第一个「脚下水深 < 0.4 且前方有深水」的点
      for (let r = 170; r > 10; r -= 0.5) {
        const x = cx + dx * r;
        const z = cz + dz * r;
        const d = hf.waterAt(x, z)?.depth ?? 0;
        if (d >= 0.4) break;
        ow.player.teleport(x, z, Math.atan2(-dx, -dz));
        if (window.__cuilanRide!.entry()) return true;
      }
    }
    return false;
  });
  if (!ok) throw new Error('找不到可以上水的湖岸');
  await frames(page, 4);
}

test('水上骑乘：面朝湖面上水、切换水上 BGM、登岸', async ({ page }) => {
  const errors = await bootGame(page);
  await page.evaluate(() => (window.__cuilan!.state.flags['hm03-surf'] = true));
  await toLakeShore(page);
  expect(await page.evaluate(() => window.__cuilanRide!.entry())).not.toBeNull();
  expect(await page.evaluate(() => window.__cuilanRide!.start())).toBe(true);
  await frames(page, 4);
  expect(await page.evaluate(() => window.__cuilanRide!.surfing())).toBe(true);
  expect(await page.evaluate(() => window.__cuilanRide!.mount()?.speciesId)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__cuilanAudio!.state().wanted)).toBe('surf');
  await page.evaluate(() => window.__cuilanRide!.stop());
  await frames(page, 4);
  expect(await page.evaluate(() => window.__cuilanRide!.surfing())).toBe(false);
  expect(await page.evaluate(() => window.__cuilanAudio!.state().wanted)).not.toBe('surf');
  expect(errors).toEqual([]);
});

test('钓鱼：有钓竿时打开钓鱼界面，取消后收竿', async ({ page }) => {
  const errors = await bootGame(page);
  await page.evaluate(() => (window.__cuilan!.state.bag['old-rod'] = 1));
  await toLakeShore(page);
  expect(await page.evaluate(() => window.__cuilanFishing!.rod())).toBe('old-rod');
  await page.evaluate(() => void window.__cuilanFishing!.start());
  await page.waitForFunction(() => window.__cuilanFishing!.active(), null, { timeout: 30_000 });
  await frames(page, 4);
  expect(await page.locator('.cl-fish').count()).toBe(1);
  for (let i = 0; i < 10 && (await page.evaluate(() => window.__cuilanFishing!.active())); i++) await press(page, 'Escape');
  await page.waitForFunction(() => !window.__cuilanFishing!.active(), null, { timeout: 60_000 });
  expect((await page.evaluate(() => window.__cuilanFishing!.result())).result).toBe('cancel');
  expect(errors).toEqual([]);
});
