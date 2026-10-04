/**
 * SCN-001 补充：学招与进化的端到端流程（此前只有单测覆盖）。
 * 木木枭：Lv.15 学会飞叶快刀；Lv.17 进化为投羽枭（成长速度 medium-slow）。
 */
import { expect, test } from '@playwright/test';
import { expForLevel } from '../../src/systems/pokemon/growth';
import { bootGame, mashUntilOverworld, setLead, startEncounter } from './helpers';

test.describe.configure({ mode: 'serial' });

test('升级 → 招式已满 → 忘记旧招式并学会飞叶快刀', async ({ page }) => {
  const errors = await bootGame(page);
  await setLead(page, { level: 14, exp: expForLevel('medium-slow', 15) - 1, moves: ['leafage', 'tackle', 'growl', 'peck'] });
  await startEncounter(page, 16, 5, 1);
  await expect.poll(() => page.evaluate(() => window.__cuilan!.game.scenes.names.join('>')), { timeout: 30_000 }).toBe('overworld>battle');
  const end = (await mashUntilOverworld(page)) as Awaited<ReturnType<typeof mashUntilOverworld>> & { seen: string[] };
  const lead = await page.evaluate(() => { const p = window.__cuilan!.state.party[0]!; return { level: p.level, moves: p.moves.map((m) => m.id), speciesId: p.speciesId }; });
  expect(end.scenes).toBe('overworld');
  expect(lead.level).toBe(15);
  expect(lead.moves).toContain('razor-leaf');
  expect(lead.moves).not.toContain('leafage'); // 默认忘记第 1 个招式
  expect(lead.moves).toHaveLength(4);
  expect(end.seen.join('\n')).toContain('飞叶快刀');
  expect(errors).toEqual([]);
});

test('升到 Lv.17 → 战后进化为投羽枭', async ({ page }) => {
  const errors = await bootGame(page);
  await setLead(page, { level: 16, exp: expForLevel('medium-slow', 17) - 1, moves: ['tackle', 'leafage'] });
  await startEncounter(page, 16, 5, 1);
  await expect.poll(() => page.evaluate(() => window.__cuilan!.game.scenes.names.join('>')), { timeout: 30_000 }).toBe('overworld>battle');
  const end = (await mashUntilOverworld(page)) as Awaited<ReturnType<typeof mashUntilOverworld>> & { seen: string[] };
  const lead = await page.evaluate(() => { const c = window.__cuilan!; const p = c.state.party[0]!; return { level: p.level, speciesId: p.speciesId, hp: p.hp, caught: [...(c.state as unknown as { dex?: { caught?: number[] } }).dex?.caught ?? []] }; });
  expect(end.scenes).toBe('overworld');
  expect(lead.level).toBe(17);
  expect(lead.speciesId).toBe(723);
  expect(lead.hp).toBeGreaterThan(0);
  expect(end.seen.join('\n')).toContain('进化成了投羽枭');
  expect(errors).toEqual([]);
});
