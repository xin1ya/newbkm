/**
 * M3-21 · 精灵联盟纯逻辑（无 three / DOM）：
 * - 挑战流程：大厅 → 四天王 ×4（每间之后一条补给回廊）→ 冠军 → 名人堂；
 * - 「一轮挑战」：从大厅走进第一间时确认，清掉上一轮的击败标记（四天王 / 冠军可以反复挑战）；
 *   挑战中厅与厅之间不回复（回廊只能买道具），身后的门全部锁上；全灭 → 黑屏回到复活点，下次重新开始；
 * - 名人堂：每次战胜冠军记录一次队伍（GameState.hallOfFame）。
 */
import type { GameState, HallOfFameEntry } from '../state/GameState';
import type { PokemonInstance } from '../pokemon/Pokemon';

/** 四天王（按挑战顺序）与冠军的训练家 id */
export const LEAGUE_ELITES = ['league-e1', 'league-e2', 'league-e3', 'league-e4'] as const;
export const LEAGUE_CHAMPION = 'league-champion';
export const LEAGUE_TRAINERS = [...LEAGUE_ELITES, LEAGUE_CHAMPION] as const;

/** 一轮挑战进行中（大厅的门已经锁上） */
export const LEAGUE_RUN_FLAG = 'league-run';
/** 本轮名人堂演出已执行 */
export const LEAGUE_HOF_RUN_FLAG = 'league-hof-run';
/** 首次成为冠军 */
export const LEAGUE_CHAMPION_FLAG = 'league-champion-title';

export const trainerDefeatedFlag = (id: string): string => `trainer-defeated:${id}`;

/** 开始一轮挑战时要清掉的 flag（上一轮的击败记录 + 名人堂演出标记） */
export function leagueRunResetFlags(): string[] {
  return [...LEAGUE_TRAINERS.map(trainerDefeatedFlag), LEAGUE_HOF_RUN_FLAG];
}

/** 当前挑战进度：0..4 = 已击败的四天王数，5 = 冠军也已击败 */
export function leagueProgress(flags: Readonly<Record<string, boolean>>): number {
  let n = 0;
  for (const id of LEAGUE_TRAINERS) {
    if (!flags[trainerDefeatedFlag(id)]) break;
    n++;
  }
  return n;
}

/** 记录一次名人堂（只记录未成为蛋的队伍成员，最多 6 只） */
export function recordHallOfFame(state: GameState, party: readonly PokemonInstance[] = state.party): HallOfFameEntry {
  const list = (state.hallOfFame ??= []);
  const entry: HallOfFameEntry = {
    n: list.length + 1,
    day: state.day ?? 0,
    playTime: Math.floor(state.playTime),
    team: party.slice(0, 6).map((p) => ({ speciesId: p.speciesId, nickname: p.nickname ?? null, level: p.level, shiny: !!p.shiny, ot: p.ot ?? state.player.name })),
  };
  list.push(entry);
  return entry;
}

/** 游戏时间（秒）→「12 小时 34 分」 */
export function formatPlayTime(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${Math.floor(m / 60)} 小时 ${String(m % 60).padStart(2, '0')} 分`;
}
