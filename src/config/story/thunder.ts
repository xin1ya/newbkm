/**
 * 第三章主线剧情（M3-24）+ 雷鸣群岛 → 琉璃群岛的主线衔接（M3-05）。
 * 主线 14「二度跨海」：冲浪进入雷鸣地图西缘或到达雷鸣镇时播放第三章标题卡（thunder-arrival-card）。
 * 主线 17「冰封秘密」：冰川遗迹圣坛 → 碎片共鸣融冰 → 冰封守护者 → 异变碎片·蓝（snow-ruins-shard）。
 * 主线 19「天空异象」收尾：四枚徽章 + 蓝碎片后在云雀镇看到北方天空的裂光（sky-anomaly-seen）。
 * 主线 20「三度跨海」：集齐雷鸣四枚徽章后，云雀镇码头的钓竿爷指路雷鸣—琉璃海域（glaze-route-open）；
 * 第一次冲浪进入琉璃地图（礁石迷宫南口）或到达幻影镇时播放第四章标题卡。
 * 徽章 flag 约定（M3-15 道馆 5–8 沿用）：badge-thunder / badge-dawn / badge-snow / badge-lark。
 */
import type { StoryScript, StoryStep, StoryTrigger } from '@/systems/story';

/** M3-16 · 琉璃群岛三枚徽章。 */
export const GLAZE_BADGES = ['badge-mirage', 'badge-ghost', 'badge-glaze'] as const;
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

// ———————————————————————— 主线 14 · 二度跨海 ————————————————————————
const thunderArrival: StoryStep[] = [
  { kind: 'card', title: '第三章 · 文明遗迹', subtitle: '雷鸣群岛', ms: 2600 },
  { kind: 'narrate', lines: ['雷云压着山脊、冰川埋着神殿、云层之上还有一座小镇……', '雷鸣群岛的四座道馆，可以按任意顺序挑战。', '汤婆婆说过：第四块碎片，封在雪原镇北面的冰川下。'] },
  { kind: 'flag', set: 'thunder-arrival-card' },
];

// ———————————————————————— 主线 17 · 冰封秘密 ————————————————————————
const glacierEnter: StoryStep[] = [
  { kind: 'narrate', lines: ['呼出的气瞬间结成了白雾。', '冰层深处传来低沉的嗡鸣——和中央高原遗迹里的声音一模一样。'] },
  { kind: 'flag', set: 'glacier-ruins-entered' },
];

const glacierSanctum: StoryStep[] = [
  { kind: 'say', lines: ['圣坛中央立着一根巨大的冰晶柱。', '冰里那团蓝光，随着脚步声一明一暗……像是在呼吸。'] },
  { kind: 'flag', set: 'glacier-sanctum-reached' },
];

const glacierAltar: StoryStep[] = [
  { kind: 'say', lines: ['走近圣坛时，背包里的碎片同时亮了起来。', '赤、橙、紫三道光投在冰晶柱上——冰面「咔」地裂开了一道缝。'] },
  { kind: 'fx', name: 'flash', ms: 500 },
  { kind: 'fx', name: 'shake', ms: 800 },
  { kind: 'say', lines: ['寒气从裂缝里喷涌而出！', '守护圣坛的宝可梦被唤醒了！'] },
  {
    kind: 'battle',
    species: 91,
    level: 42,
    moves: ['icicle-spear', 'aurora-beam', 'shell-smash', 'spikes'],
    noCapture: true,
    noRun: true,
    boss: true,
    onWin: [
      { kind: 'say', lines: ['刺甲贝合上壳，沉进了圣坛下的冰水里。', '冰晶柱一寸一寸地融化，蓝光落进了掌心。'] },
      { kind: 'fx', name: 'flash', ms: 400 },
      { kind: 'say', lines: ['得到了「异变碎片·蓝」！', '四块碎片靠在一起，表面浮现出一行看不懂的古文字，指向北方。'] },
      { kind: 'flag', set: 'snow-ruins-shard' },
    ],
    onLose: [{ kind: 'say', lines: ['刺骨的寒气把人逼退了……', '冰面又重新合上了。整顿好队伍再来吧。'] }],
  },
];

// ———————————————————————— 主线 19 · 天空异象（第三章收尾） ————————————————————————
const skyAnomaly: StoryStep[] = [
  { kind: 'narrate', lines: ['云雀镇上空，风突然停了。'] },
  { kind: 'fx', name: 'flash', ms: 600 },
  { kind: 'say', lines: ['北方的天空裂开一道细长的光——蓝、紫、橙、赤，和背包里的四块碎片一样的颜色。', '光只持续了几秒，就被琉璃群岛方向的浓雾吞没了。'] },
  { kind: 'say', speaker: '云翎', lines: ['你也看到了？这几个月，那道光出现得越来越频繁。', '雷云、冰川、天上的裂光……雷鸣群岛的异变，都指向北边。', '码头的钓竿爷年轻时去过琉璃群岛。去问问他吧。'] },
  { kind: 'card', title: '第三章 · 文明遗迹', subtitle: '— 完 —', ms: 2400 },
  { kind: 'flag', set: 'sky-anomaly-seen' },
];

export const THUNDER_STORY: StoryScript[] = [
  { id: 'thunder-arrival', steps: thunderArrival },
  { id: 'glacier-enter', steps: glacierEnter },
  { id: 'glacier-sanctum', steps: glacierSanctum },
  { id: 'glacier-altar', steps: glacierAltar },
  { id: 'sky-anomaly', steps: skyAnomaly },
  { id: 'glaze-route-open', steps: glazeRouteOpen },
  { id: 'glaze-arrival', steps: glazeArrival },
];

export const THUNDER_TRIGGERS: StoryTrigger[] = [
  // 第一次踏上雷鸣群岛（冲浪抵达西缘 / 直接到雷鸣镇）
  { id: 'thunder-arrival-sea', island: 'thunder', position: [-990, 400], rect: [-1006, 120, -960, 680], radius: 0, script: 'thunder-arrival', doneFlag: 'thunder-arrival-card' },
  { id: 'thunder-arrival-town', island: 'thunder', position: [-470, 412], radius: 30, script: 'thunder-arrival', doneFlag: 'thunder-arrival-card' },
  // 四枚徽章 + 蓝碎片 → 云雀镇天空裂光（第三章收尾）
  { id: 'sky-anomaly', island: 'thunder', position: [300, -650], radius: 40, script: 'sky-anomaly', doneFlag: 'sky-anomaly-seen', showIf: [...THUNDER_BADGES, 'snow-ruins-shard'] },
  { id: 'glaze-route-open', island: 'thunder', position: [-146, -690], radius: 9, script: 'glaze-route-open', doneFlag: 'glaze-route-open', showIf: [...THUNDER_BADGES] },
  // 第一次到达琉璃群岛（冲浪进入礁石迷宫南口 / 直接到幻影镇）
  { id: 'glaze-arrival-sea', island: 'glaze', position: [-380, 990], rect: [-640, 960, -120, 1006], radius: 0, script: 'glaze-arrival', doneFlag: 'glaze-arrival-card' },
  { id: 'glaze-arrival-town', island: 'glaze', position: [-380, 470], radius: 30, script: 'glaze-arrival', doneFlag: 'glaze-arrival-card' },
];
