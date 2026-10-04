/**
 * M1-13 / M1-14 · 剧情全流程：
 * 1. 新游戏（不带 quick）：二楼卧室 → 开场梦境 → 没有宝可梦离开萌芽镇被拉回 → 研究所找木兰博士选火球鼠；
 * 2. 港湾渡船事件（管理员 → 灯塔守 → 控制箱点亮灯塔 → 管理员开通航线）→ 首次跨海结尾卡；
 * 3. 支线：索罗亚（揭穿伪装 → 不可捕捉的信任之战 → 入队）、蒲婆婆药草 ×3、港湾失物、钓鱼大赛报告。
 * 只通过 window.__cuilan* 读状态 / 触发对话与互动，按键推进对话。
 */
import { expect, test, type Page } from '@playwright/test';
import { bootGame, setLead } from './helpers';

const frames = (page: Page, n: number) =>
  page.evaluate((n) => new Promise<void>((r) => {
    let k = 0;
    const f = () => (++k >= n ? r() : requestAnimationFrame(f));
    requestAnimationFrame(f);
  }), n);
const scenes = (page: Page) => page.evaluate(() => window.__cuilan!.game.scenes.names.join('>'));
const flag = (page: Page, f: string) => page.evaluate((f) => window.__cuilan!.state.flags[f] === true, f);
const setFlags = (page: Page, fs: string[]) =>
  page.evaluate((fs) => {
    const c = window.__cuilan!;
    for (const f of fs) {
      c.state.flags[f] = true;
      c.game.events.emit('flag:set', { flag: f, value: true });
    }
  }, fs);

type OW = {
  player: { position: { x: number; z: number }; teleport(x: number, z: number, yaw: number): void };
  follower: { warp(): void };
  npcs: { sync(p: unknown): void };
  chunks: { loadAround(x: number, z: number): void };
  enterInterior(id: string, door: string | null): Promise<void>;
  leaveInterior(id: string): Promise<void>;
  zoneAt(x: number, z: number): { name: string } | null;
};
const ow = <T,>(page: Page, fn: (o: OW) => T) => page.evaluate(`(${fn.toString()})(window.__cuilan.overworld)`) as Promise<T>;

async function tp(page: Page, x: number, z: number, yaw = 0): Promise<void> {
  await page.evaluate(
    ({ x, z, yaw }) => {
      const o = window.__cuilan!.overworld as unknown as OW;
      o.chunks.loadAround(x, z);
      o.player.teleport(x, z, yaw);
      o.follower.warp();
      o.npcs.sync(o.player.position);
    },
    { x, z, yaw },
  );
  await frames(page, 6);
}

const uiText = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('.cl-dialog, .cl-menu, .cl-starter-picker, .cl-story-narrate, .cl-story-card')].map((e) => e.textContent ?? '').join(' | '));

/**
 * 连按 Enter 直到剧情 / 对话 / 战斗结束、回到可操作状态。
 * onUi：每步回调（可在特定界面按别的键，返回 true 表示已处理、本步不按 Enter）。
 */
async function mash(page: Page, maxSteps = 160, onUi?: (ui: string) => Promise<boolean>): Promise<string[]> {
  const seen: string[] = [];
  let idle = 0;
  for (let i = 0; i < maxSteps; i++) {
    await page.waitForTimeout(450);
    const ui = await uiText(page);
    if (ui && seen[seen.length - 1] !== ui) seen.push(ui);
    const running = await page.evaluate(() => window.__cuilanStory!.running());
    const sc = await scenes(page);
    if (!ui && !running && !sc.endsWith('battle')) {
      if (++idle >= 3) break;
      continue;
    }
    idle = 0;
    if (onUi && (await onUi(ui))) continue;
    await frames(page, 4);
    await page.keyboard.press('Enter');
  }
  return seen;
}

const talk = (page: Page, id: string) => page.evaluate((id) => void window.__cuilanNpcs!.talk(id), id);
const use = (page: Page) => page.evaluate(() => void window.__cuilanInteract!.use());

test('新游戏：开场梦境 → 离镇被拉回 → 木兰博士的御三家（火球鼠）', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = await bootGame(page, 'lite&new&seed=7');
  // 梦境旁白层会拦截指针事件：强制点击只为让画布获得焦点
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 }, force: true });
  // 在自家二楼、梦境暗幕中
  expect(await scenes(page)).toBe('overworld>interior');
  await expect.poll(() => page.evaluate(() => window.__cuilanStory!.running())).toBe('dream-prelude');
  expect(await page.evaluate(() => window.__cuilanStory!.dreaming())).toBe(true);
  expect(await page.evaluate(() => window.__cuilan!.state.party.length)).toBe(0);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'test-results/story-dream.png' });
  const seen = await mash(page);
  expect(seen.join(' ')).toContain('翠澜的海');
  expect(await flag(page, 'dream-prelude-done')).toBe(true);
  expect(await page.evaluate(() => window.__cuilanStory!.card())).toBe('第一章 · 异变初闻');
  expect(await page.evaluate(() => window.__cuilanQuests!.tracked())).toBe('main-get-starter');

  // 下楼出门 → 往草原走 → 被拉回镇里
  await ow(page, (o) => o.leaveInterior('sprout-player-house'));
  await expect.poll(() => scenes(page)).toBe('overworld');
  await page.waitForTimeout(1200);
  await tp(page, -60, 262, Math.PI);
  await expect.poll(() => page.evaluate(() => window.__cuilanStory!.lastTrigger()), { timeout: 20_000 }).toBe('no-starter-turnback');
  await mash(page, 40);
  const back = await ow(page, (o) => ({ x: o.player.position.x, z: o.player.position.z, zone: o.zoneAt(o.player.position.x, o.player.position.z)?.name ?? null }));
  expect(back.zone).toBe('萌芽镇');

  // 研究所门口 → 进入 → 木兰博士 → 选火球鼠
  await tp(page, -20, 349, Math.PI);
  await expect.poll(() => flag(page, 'lab-visited'), { timeout: 20_000 }).toBe(true);
  await ow(page, (o) => o.enterInterior('sprout-lab', null));
  await expect.poll(() => scenes(page), { timeout: 30_000 }).toBe('overworld>interior');
  await frames(page, 10);
  await talk(page, 'magnolia');
  let picked = false;
  await mash(page, 80, async (ui) => {
    if (!picked && ui.includes('火球鼠') && ui.includes('水跃鱼') && (await page.locator('.cl-starter-picker').count())) {
      picked = true;
      await page.screenshot({ path: 'test-results/story-starter-picker.png' });
      await page.keyboard.press('ArrowRight');
      await frames(page, 4);
      await page.keyboard.press('Enter');
      return true;
    }
    return false;
  });
  expect(picked).toBe(true);
  const st = await page.evaluate(() => {
    const s = window.__cuilan!.state;
    return { species: s.party.map((p) => p.speciesId), level: s.party[0]?.level, chosen: s.flags['starter-chosen'], f155: s.flags['starter-155'], balls: s.bag['poke-ball'] ?? 0 };
  });
  expect(st).toMatchObject({ species: [155], level: 5, chosen: true, f155: true });
  await expect.poll(() => page.evaluate(() => window.__cuilan!.state.bag['poke-ball'] ?? 0)).toBe(5);
  await expect.poll(() => page.evaluate(() => window.__cuilanQuests!.tracked())).toBe('main-gym-verdant');
  expect(errors).toEqual([]);
});

test('港湾渡船事件：管理员 → 灯塔守 → 点亮灯塔 → 开通航线 → 首次跨海结尾卡', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = await bootGame(page);
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  await setFlags(page, ['lab-visited', 'starter-chosen', 'arrived-cuilan-town', 'badge-verdant', 'hm03-surf', 'arrived-harbor-city']);
  await page.evaluate(() => window.__cuilan!.game.clock.setHour(12));
  await expect.poll(() => page.evaluate(() => window.__cuilanQuests!.tracked())).toBe('main-harbor-ferry');

  await tp(page, 436, 26, Math.PI / 2);
  await talk(page, 'ferry-clerk');
  await mash(page, 30);
  expect(await flag(page, 'ferry-clerk-talked')).toBe(true);

  await tp(page, 418, -48, Math.PI);
  await talk(page, 'lighthouse-keeper');
  await mash(page, 30);
  expect(await flag(page, 'lighthouse-keeper-asked')).toBe(true);
  expect(await page.evaluate(() => window.__cuilanStory!.pickups())).toContain('lighthouse-lamp');

  await tp(page, 416.8, -63, Math.PI / 2);
  await expect.poll(() => page.evaluate(() => window.__cuilanInteract!.focus()?.id ?? null), { timeout: 10_000 }).toBe('story:lighthouse-lamp');
  await use(page);
  await mash(page, 40);
  expect(await flag(page, 'lighthouse-relit')).toBe(true);
  expect(await page.evaluate(() => window.__cuilanStory!.beam())).toBe(true);
  await page.screenshot({ path: 'test-results/story-lighthouse.png' });

  await tp(page, 436, 26, Math.PI / 2);
  await talk(page, 'ferry-clerk');
  await mash(page, 30);
  expect(await flag(page, 'ferry-route-opened')).toBe(true);
  await expect.poll(() => page.evaluate(() => (window.__cuilan!.state.bag['ferry-pass'] ?? 0) > 0)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__cuilanQuests!.tracked())).toBe('main-cross-sea-1');

  // 首次跨海：进入水路 1 → 东端 → 结尾卡 → 回到港湾码头
  await setFlags(page, ['sea-route-1-entered']);
  await tp(page, 505, 0, Math.PI / 2);
  await expect.poll(() => page.evaluate(() => window.__cuilanStory!.lastTrigger()), { timeout: 20_000 }).toBe('cross-sea-end');
  let shot = false;
  await mash(page, 60, async (ui) => {
    if (!shot && ui.includes('第一章 · 完')) {
      shot = true;
      await page.screenshot({ path: 'test-results/story-endcard.png' });
    }
    return false;
  });
  expect(shot).toBe(true);
  expect(await flag(page, 'cross-sea-1-done')).toBe(true);
  const p = await ow(page, (o) => ({ x: o.player.position.x, z: o.player.position.z }));
  expect(Math.hypot(p.x - 431, p.z - 26)).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test('支线：索罗亚 / 蒲婆婆药草 / 港湾失物 / 钓鱼大赛', async ({ page }) => {
  test.setTimeout(900_000);
  const errors = await bootGame(page);
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  await setFlags(page, ['lab-visited', 'starter-chosen']);
  await page.evaluate(() => window.__cuilan!.game.clock.setHour(9));
  await setLead(page, { level: 60, exp: 0, moves: ['tackle'] });

  // —— 索罗亚 ——
  await setFlags(page, ['zorua-quest-start', 'zorua-forest-entered']);
  await expect.poll(() => page.evaluate(() => window.__cuilanStory!.pickups().filter((p) => p.startsWith('zorua-footprints')).length)).toBe(7);
  await tp(page, -320, -327, Math.PI);
  await expect.poll(() => flag(page, 'zorua-found'), { timeout: 20_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__cuilanNpcs!.list().some((n: { id: string }) => n.id === 'zorua-disguise'))).toBe(true);
  await talk(page, 'zorua-disguise');
  let battleSeen = false;
  let noBallMenu = true;
  await mash(page, 200, async (ui) => {
    if ((await scenes(page)).endsWith('battle')) {
      battleSeen = true;
      if (ui.includes('捕捉') || ui.includes('精灵球')) noBallMenu = false;
    }
    return false;
  });
  expect(battleSeen).toBe(true);
  expect(await flag(page, 'zorua-quest-done')).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__cuilan!.state.party.some((p) => p.speciesId === 570))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__cuilanNpcs!.list().some((n: { id: string }) => n.id === 'zorua-disguise'))).toBe(false);
  expect(noBallMenu).toBe(true);

  // —— 蒲婆婆的药草 ——
  await tp(page, -158, 388, Math.PI);
  await talk(page, 'elder-pu');
  await mash(page, 30);
  expect(await flag(page, 'herbs-quest-start')).toBe(true);
  const herbs: Array<[number, number]> = await page.evaluate(() => [[263, -38], [198, -203], [74, 96]]);
  for (const [i, [x, z]] of herbs.entries()) {
    await tp(page, x - 1.2, z, Math.PI / 2);
    await expect.poll(() => page.evaluate(() => window.__cuilanInteract!.focus()?.id ?? null), { timeout: 10_000 }).toBe(`story:herb-${i + 1}`);
    if (i === 0) await page.screenshot({ path: 'test-results/story-herb.png' });
    await use(page);
    await mash(page, 20);
  }
  expect(await page.evaluate(() => window.__cuilan!.state.vars['herbs-collected'])).toBe(3);
  await expect.poll(() => flag(page, 'herbs-collected')).toBe(true);
  await tp(page, -158, 388, Math.PI);
  await talk(page, 'elder-pu');
  await mash(page, 30);
  expect(await flag(page, 'herbs-delivered')).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__cuilan!.state.bag['antidote'] ?? 0)).toBeGreaterThanOrEqual(5);

  // —— 港湾失物：漂流的钓具箱 ——
  await setFlags(page, ['badge-verdant', 'hm03-surf', 'got-old-rod']);
  await tp(page, 438.5, 111.5, Math.PI / 2);
  await talk(page, 'harbor-fisherman');
  await mash(page, 30);
  expect(await flag(page, 'fisher-quest-start')).toBe(true);
  await tp(page, 487.5, 170, Math.PI / 2);
  await expect.poll(() => page.evaluate(() => window.__cuilanInteract!.focus()?.id ?? null), { timeout: 10_000 }).toBe('story:fisher-tackle-box');
  await page.screenshot({ path: 'test-results/story-tackle.png' });
  await use(page);
  await mash(page, 20);
  expect(await flag(page, 'fisher-tackle-found')).toBe(true);
  await tp(page, 438.5, 111.5, Math.PI / 2);
  await talk(page, 'harbor-fisherman');
  await mash(page, 30);
  expect(await flag(page, 'fisher-tackle-returned')).toBe(true);
  await expect.poll(() => page.evaluate(() => (window.__cuilan!.state.bag['good-rod'] ?? 0) > 0)).toBe(true);

  // —— 钓鱼大赛：报名 → 三种宝可梦（直接置位 catch 目标）→ 报告 ——
  await tp(page, 430, 100, Math.PI);
  await talk(page, 'contest-host');
  await mash(page, 30);
  expect(await flag(page, 'fishing-contest-start')).toBe(true);
  await setFlags(page, ['contest-magikarp', 'contest-tentacool', 'contest-staryu']);
  await talk(page, 'contest-host');
  await mash(page, 30);
  expect(await flag(page, 'fishing-contest-done')).toBe(true);
  await expect.poll(() => page.evaluate(() => (window.__cuilan!.state.bag['super-rod'] ?? 0) > 0)).toBe(true);
  expect(errors).toEqual([]);
});
