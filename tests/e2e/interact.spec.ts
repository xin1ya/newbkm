/**
 * M1-07 · 互动提示端到端：NPC / 门 / 家具 / 床铺休息 / 封锁点 / 水边钓鱼 的提示气泡与按键执行。
 */
import { expect, test, type Page } from '@playwright/test';
import { bootGame } from './helpers';

test.describe.configure({ mode: 'serial' });

const prompt = (page: Page) => page.evaluate(() => window.__cuilanInteract!.prompt());
const focusId = (page: Page) => page.evaluate(() => window.__cuilanInteract!.focus()?.id ?? null);
const scenes = (page: Page) => page.evaluate(() => window.__cuilan!.game.scenes.names.join('>'));

async function finishDialog(page: Page): Promise<string> {
  let text = '';
  for (let i = 0; i < 30 && (await page.locator('.cl-dialog').isVisible()); i++) {
    text += (await page.locator('.cl-dialog').textContent()) ?? '';
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
  }
  return text;
}

async function focusCanvas(page: Page): Promise<void> {
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
}

/** 室内：从家具四个方向中找一个能站的位置，面朝家具 */
async function approachFurniture(page: Page, id: string): Promise<void> {
  const ok = await page.evaluate(async (id) => {
    const s = window.__cuilanInterior!() as unknown as {
      player: { teleport(x: number, z: number, yaw: number): void; position: { x: number; z: number } };
      built: { interactFootprints: Map<string, { x: number; z: number; hx: number; hz: number; yaw: number }> };
    };
    const fp = s.built.interactFootprints.get(id)!;
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const sides: [number, number][] = [
      [0, fp.hz + 0.75],
      [0, -(fp.hz + 0.75)],
      [fp.hx + 0.75, 0],
      [-(fp.hx + 0.75), 0],
    ];
    for (const [lx, lz] of sides) {
      const c = Math.cos(fp.yaw);
      const sn = Math.sin(fp.yaw);
      const x = fp.x + lx * c + lz * sn;
      const z = fp.z - lx * sn + lz * c;
      s.player.teleport(x, z, Math.atan2(fp.x - x, fp.z - z));
      await frame();
      await frame();
      const moved = Math.hypot(s.player.position.x - x, s.player.position.z - z);
      if (moved < 0.05 && window.__cuilanInteract!.focus()?.id === `furniture:${id}`) return true;
    }
    return false;
  }, id);
  expect(ok, `找不到能互动 ${id} 的站位`).toBe(true);
}

test('NPC 与门：提示气泡显示键帽与文字，按 E 执行', async ({ page }) => {
  const errors = await bootGame(page);
  // NPC
  await page.evaluate(() => {
    const c = window.__cuilan!;
    const n = window.__cuilanNpcs!.list().find((x) => x.id === 'sprout-dock-keeper')!;
    c.overworld.player.teleport(n.x + Math.sin(n.yaw) * 1.4, n.z + Math.cos(n.yaw) * 1.4, n.yaw + Math.PI);
    c.overworld.rig.resetBehind(c.overworld.player.facing);
    c.overworld.rig.snap();
  });
  await expect.poll(() => prompt(page), { timeout: 10_000 }).toEqual({ id: 'npc:sprout-dock-keeper', text: 'E对话' });
  await expect(page.locator('.cl-prompt.show .key')).toHaveText('E');
  await page.screenshot({ path: 'test-results/interact-npc.png', timeout: 120_000 });
  await focusCanvas(page);
  await page.keyboard.press('KeyE');
  await expect(page.locator('.cl-dialog')).toBeVisible({ timeout: 10_000 });
  // 对话中隐藏提示
  expect(await prompt(page)).toBeNull();
  await finishDialog(page);
  await expect.poll(() => prompt(page), { timeout: 10_000 }).not.toBeNull();
  // 对话刚结束的那次按键不会立刻再次触发对话
  await page.waitForTimeout(400);
  expect(await page.locator('.cl-dialog').isVisible()).toBe(false);

  // 门：站在研究所门外 1.5 m，面朝门，不移动
  await page.evaluate(() => {
    const ow = window.__cuilan!.overworld as unknown as { props: { doors: Map<string, { position: { x: number; z: number }; yaw: number }> }; player: { teleport(x: number, z: number, yaw: number): void } };
    const d = ow.props.doors.get('magnolia-lab')!;
    ow.player.teleport(d.position.x + Math.sin(d.yaw) * 1.5, d.position.z + Math.cos(d.yaw) * 1.5, d.yaw + Math.PI);
  });
  await expect.poll(() => prompt(page), { timeout: 10_000 }).toEqual({ id: 'door:magnolia-lab', text: 'E进入 木兰博士研究所' });
  await focusCanvas(page);
  await page.keyboard.press('KeyE');
  await expect.poll(() => scenes(page), { timeout: 20_000 }).toBe('overworld>interior');
  expect(errors).toEqual([]);
});

test('室内家具：查看书架；拿到御三家后在床上休息恢复全队', async ({ page }) => {
  const errors = await bootGame(page);
  await page.evaluate(() => window.__cuilan!.overworld.enterInterior('sprout-player-house', 'player-house'));
  await expect.poll(() => scenes(page), { timeout: 20_000 }).toBe('overworld>interior');
  await page.waitForFunction(() => !window.__cuilan!.game.scenes.transitioning);
  await approachFurniture(page, 'house-books');
  await expect.poll(() => prompt(page), { timeout: 5_000 }).toEqual({ id: 'furniture:house-books', text: 'E查看' });
  await focusCanvas(page);
  await page.keyboard.press('KeyE');
  await expect(page.locator('.cl-dialog')).toBeVisible({ timeout: 10_000 });
  expect(await finishDialog(page)).toContain('书架');

  // 2F 床铺
  await page.evaluate(async () => {
    const s = window.__cuilanInterior!()!;
    await s.useExit(s.room.exits.find((e) => e.id === 'stairs-up')!);
  });
  const fullHp = await page.evaluate(() => {
    const st = window.__cuilan!.state;
    st.flags['starter-chosen'] = true;
    const full = st.party.map((p) => p.hp);
    for (const p of st.party) p.hp = 1;
    return full;
  });
  expect(fullHp.length).toBeGreaterThan(0);
  await approachFurniture(page, 'bed');
  await expect.poll(() => prompt(page)).toEqual({ id: 'furniture:bed', text: 'E休息' });
  await page.evaluate(() => {
    const w = window as unknown as { __healed: number };
    w.__healed = 0;
    window.__cuilan!.game.events.on('party:healed', () => w.__healed++);
  });
  await focusCanvas(page);
  await page.keyboard.press('KeyE');
  await expect(page.locator('.cl-dialog')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Enter'); // 翻页（打字机先显示完）
  await page.waitForTimeout(300);
  for (let i = 0; i < 6 && !(await page.locator('.cl-menu').isVisible()); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
  }
  await expect(page.locator('.cl-menu')).toContainText('休息');
  await page.keyboard.press('Enter'); // 选第一项「休息」
  await expect.poll(() => page.evaluate(() => (window as unknown as { __healed: number }).__healed), { timeout: 10_000 }).toBe(1);
  await finishDialog(page);
  expect(await page.evaluate(() => window.__cuilan!.state.party.map((p) => p.hp))).toEqual(fullHp);
  expect(errors).toEqual([]);
});

test('封锁点显示说明；有钓竿时面朝水面提示「F 钓鱼」', async ({ page }) => {
  const errors = await bootGame(page);
  // 道馆桥头封锁（剧情）：站在封锁圈外 1 m 面朝它
  await page.evaluate(() => {
    const c = window.__cuilan!;
    const b = c.overworld.player; // 封锁中心 [31.5, -55] 半径 2.5（道馆桥头，config/islands/sprout.ts）
    b.teleport(31.5 - 3.5, -55, Math.PI / 2);
  });
  await expect.poll(() => focusId(page), { timeout: 10_000 }).toBe('blocker:gym-bridge-gate');
  await expect(page.locator('.cl-prompt.show.blocked')).toContainText('道馆正在准备中');
  await page.screenshot({ path: 'test-results/interact-blocker.png', timeout: 120_000 });

  // 水边：给一根钓竿，在港湾附近找一处岸边、面朝水
  const spot = await page.evaluate(() => {
    const c = window.__cuilan!;
    c.state.bag['old-rod'] = 1;
    const ow = c.overworld;
    const hf = ow.terrain.hf;
    const deep = (x: number, z: number) => {
      const w = hf.waterAt(x, z);
      return w ? w.level - ow.terrain.heightAt(x, z) : 0;
    };
    for (let r = 0; r < 60; r += 1)
      for (let a = 0; a < 32; a++) {
        const x = 445 + Math.cos((a / 32) * Math.PI * 2) * r;
        const z = 115 + Math.sin((a / 32) * Math.PI * 2) * r;
        if (deep(x, z) > 0.05 || hf.slopeAt(x, z) > 20) continue;
        for (let k = 0; k < 8; k++) {
          const yaw = (k / 8) * Math.PI * 2;
          if (deep(x + Math.sin(yaw) * 2.5, z + Math.cos(yaw) * 2.5) > 0.5) return { x, z, yaw };
        }
      }
    return null;
  });
  expect(spot).not.toBeNull();
  await page.evaluate((s) => {
    const ow = window.__cuilan!.overworld;
    ow.player.teleport(s!.x, s!.z, s!.yaw);
    ow.rig.resetBehind(s!.yaw);
    ow.rig.snap();
  }, spot);
  // 钓鱼码头告示牌就在旁边：气泡并列显示「E 查看 | F 钓鱼」，或只有「F 钓鱼」
  await expect.poll(async () => (await prompt(page))?.text ?? '', { timeout: 10_000 }).toMatch(/F钓鱼$/);
  await page.screenshot({ path: 'test-results/interact-fish.png', timeout: 120_000 });
  await focusCanvas(page);
  await page.keyboard.press('KeyF');
  // M1-15：F 打开钓鱼小游戏界面；Esc 收竿
  await expect(page.locator('.cl-fish')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator('.cl-fish')).toContainText('钓竿');
  for (let i = 0; i < 10 && (await page.evaluate(() => window.__cuilanFishing!.active())); i++) {
    await page.waitForTimeout(1200);
    await page.keyboard.press('Escape');
  }
  await expect.poll(() => page.evaluate(() => window.__cuilanFishing!.result().result), { timeout: 30_000 }).toBe('cancel');
  expect(errors).toEqual([]);
});
