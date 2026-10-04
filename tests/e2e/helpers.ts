/**
 * e2e 共用工具：启动游戏（?lite 软件渲染友好）、收集页面错误、读取游戏状态。
 * 游戏通过 window.__cuilan 暴露调试挂钩（见 src/main.ts），只读取状态或发事件，不修改内部实现。
 */
import type { Page } from '@playwright/test';

export async function bootGame(page: Page, query = 'lite&new&quick&seed=42'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => window.__cuilan?.ready === true, null, { timeout: 150_000 });
  await page.waitForTimeout(1500);
  return errors;
}

export interface GameSnapshot {
  scenes: string;
  turn: number | null;
  outcome: { winner: 0 | 1 | null; reason: string } | null;
  ui: string;
  party: number;
  hp: number[];
}

export function snapshot(page: Page): Promise<GameSnapshot> {
  return page.evaluate(() => {
    const c = window.__cuilan!;
    const top = c.game.scenes.top as unknown as { battle?: { turn: number; outcome: GameSnapshot['outcome'] } };
    return {
      scenes: c.game.scenes.names.join('>'),
      turn: top.battle?.turn ?? null,
      outcome: top.battle?.outcome ?? null,
      ui: [...document.querySelectorAll('.cl-dialog, .cl-menu')].map((e) => e.textContent ?? '').join(' | '),
      party: c.state.party.length,
      hp: c.state.party.map((p) => p.hp),
    };
  });
}

/** 在玩家前方触发一场草丛遭遇（野生个体由首只伙伴复制并改为指定物种/等级，保证确定性） */
export async function startEncounter(page: Page, speciesId: number, level: number, hp: number): Promise<void> {
  await page.evaluate(
    ({ speciesId, level, hp }) => {
      const c = window.__cuilan!;
      const w = structuredClone(c.state.party[0]!);
      Object.assign(w, { uid: 'e2e-wild', speciesId, level, hp, moves: [{ id: 'tackle', pp: 35, maxPp: 35 }] });
      const p = c.overworld.player.position;
      c.game.events.post('encounter:start', {
        wild: w,
        position: { x: p.x, y: p.y, z: p.z },
        wildPosition: { x: p.x + 1, y: p.y, z: p.z - 9 },
        initiative: null,
        entityId: -1,
        zoneId: 'e2e',
        alpha: false,
        method: 'grass',
      });
    },
    { speciesId, level, hp },
  );
}

/** 一直按 Enter 推进战斗直到回到大地图（指令默认「战斗」、招式默认第 1 个、学招默认「忘记一个招式」→ 第 1 个招式） */
export async function mashUntilOverworld(page: Page, maxSteps = 120, onStep?: (s: GameSnapshot) => Promise<void>): Promise<GameSnapshot> {
  const texts = new Set<string>();
  for (let i = 0; i < maxSteps; i++) {
    await page.waitForTimeout(1000);
    const s = await snapshot(page);
    if (s.ui) texts.add(s.ui);
    if (s.scenes === 'overworld') break;
    if (onStep) await onStep(s);
    await page.keyboard.press('Enter');
  }
  const end = await snapshot(page);
  (end as GameSnapshot & { seen: string[] }).seen = [...texts];
  return end;
}

/** 修改首只伙伴（等级、经验、招式）——只在 e2e 用于构造学招 / 进化前置条件 */
export async function setLead(page: Page, patch: { level: number; exp: number; moves: string[] }): Promise<void> {
  await page.evaluate((patch) => {
    const c = window.__cuilan!;
    const p = c.state.party[0]!;
    const dex = (c.overworld as unknown as { d: { dex: { move(id: string): { pp: number } } } }).d.dex;
    Object.assign(p, { level: patch.level, exp: patch.exp, moves: patch.moves.map((id) => ({ id, pp: dex.move(id).pp, maxPp: dex.move(id).pp })) });
    p.hp = 999; // 由战斗初始化按上限截断
  }, patch);
}
