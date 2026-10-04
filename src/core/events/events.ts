/**
 * 全局事件表。新增事件在这里登记（多人协作时请在 PR 描述里说明）。
 * 只放可序列化的简单数据，或跨层共享的接口类型（不含 three 对象的强依赖）。
 */
import type { PokemonInstance } from '@/systems/pokemon';
import type { FieldWeather, TimeOfDay } from '@/systems/encounters';

export interface EncounterStartEvent {
  /** 遭遇到的野生宝可梦（已生成个体） */
  wild: PokemonInstance;
  /** 遭遇点（世界坐标） */
  position: { x: number; y: number; z: number };
  /** 野生个体的世界坐标 */
  wildPosition: { x: number; y: number; z: number };
  /** 'player'：背后接触，玩家先手；'wild'：被追击，野生先手；null：按速度 */
  initiative: 'player' | 'wild' | null;
  /** 对应世界里的实体 id（战斗结束后移除/恢复） */
  entityId: number;
  zoneId: string;
  alpha: boolean;
  method: 'visible' | 'grass' | 'surf' | 'fish';
  /** 巢穴头目的巢穴 id（战后结算冷却与奖励） */
  denId?: string | undefined;
}

export interface GameEvents {
  'zone:enter': { zoneId: string; name: string; previous: string | null };
  'encounter:start': EncounterStartEvent;
  /** capturedSpecies / trainerId：M1-16 任务 catch / defeat 触发 */
  'battle:end': { result: 'win' | 'lose' | 'run' | 'capture'; entityId: number; capturedSpecies?: number; trainerId?: string };
  /** M1-16 任务进度：开始 / 目标完成 / 完成（奖励已发放） */
  'quest:update': { questId: string; kind: 'available' | 'started' | 'objective' | 'completed' };
  /** M1-05 进出室内 */
  'interior:enter': { interior: string; door: string | null };
  'interior:leave': { interior: string };
  'flag:set': { flag: string; value: boolean };
  /** M1-13 剧情脚本开始 / 结束 */
  'story:start': { id: string };
  'story:end': { id: string };
  /** M1-14 计数变量变化（任务 counter 目标） */
  'var:change': { name: string; value: number };
  /** M1-06 与 NPC 对话（开始 / 结束） */
  /** M1-07 互动焦点变化（null = 无） */
  'interact:focus': { id: string | null; kind: string | null };
  /** M1-07 执行互动（钓鱼 / 骑乘等由后续系统监听） */
  'interact:use': { id: string; kind: string };
  /** 队伍被完全恢复（床铺、宝可梦中心） */
  'party:healed': { source: string };
  /** 队伍成员变化（电脑寄放 / 取出 / 放生） */
  'party:changed': { source: string };
  /** 宝可梦进化（战后进化演出结束时） */
  'pokemon:evolve': { uid: string; from: number; to: number };
  'npc:talk': { npc: string; phase: 'start' | 'end'; setFlags: string[] };
  /** M1-09 黑屏：付出的金额与复活点 */
  'player:blackout': { money: number; respawn: string | null };
  /** M1-10 训练家发现玩家 / 对话挑战 */
  'trainer:spotted': { trainer: string; how: 'spotted' | 'talk' };
  'blocker:hit': { id: string; hint: string };
  'blocker:cleared': { id: string; type: string };
  /** M2-01 岛间旅行开始（随后存档并重新加载） */
  'island:travel': { from: string; to: string };
  'time:period': { period: TimeOfDay; hour: number };
  'weather:change': { weather: FieldWeather; zoneId: string | null };
  'quality:change': { tier: string };
  'ui:toast': { text: string; ms?: number };
  'game:save': { slot: string; ok: boolean; error?: string };
  /** M1-18 暂停菜单开关、设置修改（设置值在 GameState.settings） */
  'menu:open': { tab: string };
  'menu:close': Record<string, never>;
  'settings:change': Record<string, never>;
  /** M1-12 骑乘状态变化 */
  'ride:change': { mode: 'walk' | 'surf' | 'bike' | 'fly'; ride: string; speciesId: number };
  /** M1-20 战斗开始（BGM 切换） */
  'battle:start': { kind: 'wild' | 'trainer' | 'gym' | 'boss'; trainerId?: string };
  /** M1-20 战斗胜利 / 捕获（凯旋曲） */
  'battle:victory': { kind: 'wild' | 'trainer' | 'gym' | 'boss' };
  /** M1-15 钓鱼 */
  'fishing:start': { rod: string; spot: string | null };
  'fishing:end': { result: string; speciesId: number | null };
  /** M1-19 商店交易 */
  'shop:trade': { shop: string; kind: 'buy' | 'sell'; item: string; qty: number; money: number };
  /** M1-19 宝可梦中心回复（演出阶段） */
  'center:heal': { phase: 'start' | 'machine' | 'done'; count: number };
  /** M1-11 道馆水位机关 */
  'puzzle:water': { valve: string; level: 'high' | 'low' };
  /** M1-11 授予徽章（仪式演出；flag 由任务系统发放） */
  'gym:badge': { gym: string; badgeFlag: string };
  'input:device': { device: 'keyboard' | 'gamepad' };
}
