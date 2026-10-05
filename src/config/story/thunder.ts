/**
 * 雷鸣群岛 → 琉璃群岛的主线衔接（M3-05）。
 * 主线 20「三度跨海」：集齐雷鸣四枚徽章后，云雀镇码头的钓竿爷指路雷鸣—琉璃海域（glaze-route-open）；
 * 第一次冲浪进入琉璃地图（礁石迷宫南口）或到达幻影镇时播放第四章标题卡。
 * 徽章 flag 约定（M3-15 道馆 5–8 沿用）：badge-thunder / badge-dawn / badge-snow / badge-lark。
 */
import type { StoryScript, StoryStep, StoryTrigger } from '@/systems/story';

export const THUNDER_BADGES = ['badge-thunder', 'badge-dawn', 'badge-snow', 'badge-lark'] as const;

const glazeRouteOpen: StoryStep[] = [
  { kind: 'say', speaker: '钓竿爷', lines: ['四枚徽章都到手了？好家伙！', '你是想去北边的琉璃群岛吧——渡轮还是开不了，那片海终年起雾，水下全是尖礁。'] },
  {
    kind: 'say',
    speaker: '钓竿爷',
    lines: ['礁石连成好几道墙，每道墙只有一个缺口，缺口两边有红绿浮标。', '雾大的时候看不清，就贴着礁墙找浮标。千万别想着从礁石上爬过去，那些尖礁可不长落脚的地方。'],
  },
  { kind: 'say', lines: ['雷鸣—琉璃海域可以冲浪通过了！从云雀镇码头一直往北。'] },
  { kind: 'flag', set: 'glaze-route-open' },
];

const glazeArrival: StoryStep[] = [
  { kind: 'card', title: '第四章 · 异变真相', subtitle: '琉璃群岛', ms: 2600 },
  { kind: 'narrate', lines: ['玻璃色的海岸、终年不散的夜雾、海市蜃楼里的城……', '穿过冠军之路，就是精灵联盟。'] },
  { kind: 'flag', set: 'glaze-arrival-card' },
];

export const THUNDER_STORY: StoryScript[] = [
  { id: 'glaze-route-open', steps: glazeRouteOpen },
  { id: 'glaze-arrival', steps: glazeArrival },
];

export const THUNDER_TRIGGERS: StoryTrigger[] = [
  { id: 'glaze-route-open', island: 'thunder', position: [-146, -690], radius: 9, script: 'glaze-route-open', doneFlag: 'glaze-route-open', showIf: [...THUNDER_BADGES] },
  // 第一次到达琉璃群岛（冲浪进入礁石迷宫南口 / 直接到幻影镇）
  { id: 'glaze-arrival-sea', island: 'glaze', position: [-380, 990], rect: [-640, 960, -120, 1006], radius: 0, script: 'glaze-arrival', doneFlag: 'glaze-arrival-card' },
  { id: 'glaze-arrival-town', island: 'glaze', position: [-380, 470], radius: 30, script: 'glaze-arrival', doneFlag: 'glaze-arrival-card' },
];
