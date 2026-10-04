/**
 * M1-05 · 室内场景端到端：走进门 → 室内 → 上楼 → 存档读档恢复室内 → 走出门回到门口。
 */
import { expect, test, type Page } from '@playwright/test';
import { bootGame } from './helpers';

test.describe.configure({ mode: 'serial' });

const scenes = (page: Page) => page.evaluate(() => window.__cuilan!.game.scenes.names.join('>'));
const idle = (page: Page) => page.waitForFunction(() => !window.__cuilan!.game.scenes.transitioning, null, { timeout: 30_000 });

test('走进研究所的门自动进入室内，走出正门回到门外', async ({ page }) => {
  const errors = await bootGame(page);
  // 站到研究所门外 3 m 处，面朝门口
  const door = await page.evaluate(() => {
    const ow = window.__cuilan!.overworld as unknown as { props: { doors: Map<string, { position: { x: number; z: number }; yaw: number }> }; player: { teleport(x: number, z: number, yaw: number): void } };
    const d = ow.props.doors.get('magnolia-lab')!;
    ow.player.teleport(d.position.x + Math.sin(d.yaw) * 3, d.position.z + Math.cos(d.yaw) * 3, d.yaw + Math.PI);
    const c = window.__cuilan!.overworld;
    c.rig.resetBehind(c.player.facing);
    c.rig.snap();
    return { x: d.position.x, z: d.position.z, yaw: d.yaw };
  });
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  await page.keyboard.down('KeyW');
  await expect.poll(() => scenes(page), { timeout: 20_000 }).toBe('overworld>interior');
  await page.keyboard.up('KeyW');
  await idle(page);
  expect(await page.evaluate(() => window.__cuilanInterior!()?.config.id)).toBe('sprout-lab');
  expect(await page.evaluate(() => window.__cuilan!.state.position.interior)).toBe('sprout-lab#main');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/interior-lab.png', timeout: 120_000 });

  // 往镜头方向（+Z）走回正门
  await page.evaluate(() => {
    const c = window.__cuilan!;
    c.game.events.on('interior:leave', () => {
      (window as unknown as { __leaveYaw: number }).__leaveYaw = c.overworld.player.facing;
      // 离开瞬间的室内标记（仍按住 S 时角色会朝镜头走回门里，慢机器上会再次进门）
      (window as unknown as { __leaveInterior: string | null }).__leaveInterior = c.state.position.interior;
    });
  });
  await page.keyboard.down('KeyS');
  await expect.poll(() => scenes(page), { timeout: 20_000 }).toBe('overworld');
  await page.keyboard.up('KeyS');
  await idle(page);
  const after = await page.evaluate(() => {
    const c = window.__cuilan!;
    return { x: c.overworld.player.position.x, z: c.overworld.player.position.z, yaw: (window as unknown as { __leaveYaw: number }).__leaveYaw, interior: (window as unknown as { __leaveInterior: string | null }).__leaveInterior };
  });
  expect(Math.hypot(after.x - door.x, after.z - door.z)).toBeLessThan(3);
  expect(Math.abs(Math.atan2(Math.sin(after.yaw - door.yaw), Math.cos(after.yaw - door.yaw)))).toBeLessThan(0.1);
  expect(after.interior).toBeNull();
  expect(errors).toEqual([]);
});

test('自己家：上楼 → 室内存档 → 读档后仍在 2F', async ({ page }) => {
  const errors = await bootGame(page);
  await page.evaluate(() => window.__cuilan!.overworld.enterInterior('sprout-player-house', 'player-house'));
  await expect.poll(() => scenes(page), { timeout: 20_000 }).toBe('overworld>interior');
  await idle(page);
  await page.evaluate(async () => {
    const s = window.__cuilanInterior!()!;
    await s.useExit(s.room.exits.find((e) => e.id === 'stairs-up')!);
  });
  expect(await page.evaluate(() => window.__cuilanInterior!()!.roomId)).toBe('2f');
  await page.locator('#app canvas').click({ position: { x: 20, y: 20 } });
  // 机器繁忙时首个 F5 可能落在转场 / 忙碌帧里被忽略：重试直到出现存档提示（M1-22）
  await expect(async () => {
    await page.keyboard.press('F5');
    await expect(page.locator('.cl-toast.show')).toContainText('已存档', { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });

  // 读档（不带 new 参数）
  await page.goto('/?lite&seed=42');
  await page.waitForFunction(() => window.__cuilan?.ready === true, null, { timeout: 150_000 });
  await expect.poll(() => scenes(page), { timeout: 30_000 }).toBe('overworld>interior');
  expect(await page.evaluate(() => [window.__cuilanInterior!()!.config.id, window.__cuilanInterior!()!.roomId])).toEqual(['sprout-player-house', '2f']);
  expect(errors).toEqual([]);
});
