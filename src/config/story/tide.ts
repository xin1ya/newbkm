/**
 * M2-16/17 · 碧潮群岛剧情脚本、触发区（大地图）与渡船脚本（M2-04）。
 * 奖励由 QuestDirector 在 completeFlag 置位后统一发放，脚本只负责演出与置位 flag。
 * 室内触发区写在 config/interiors/tide.ts 的 RoomConfig.triggers。
 */
import type { StoryScript, StoryStep, StoryTrigger } from '@/systems/story';

const PI = Math.PI;

/** 渡船到达点：碧潮镇码头的主街口 / 港湾市渡船码头 */
export const FERRY_ARRIVAL = {
  tide: { x: -570, z: 30, yaw: PI / 2 },
  sprout: { x: 444, z: 22, yaw: -PI / 2 },
} as const;

// ———————————————————————— M2-04 渡船 ————————————————————————
const ferryToTide: StoryStep[] = [
  {
    kind: 'choice',
    prompt: '要乘渡船前往碧潮群岛吗？',
    options: [
      {
        label: '出发（碧潮镇码头）',
        steps: [
          { kind: 'say', lines: ['「前往碧潮群岛的渡船即将开航，请握好扶手！」'] },
          { kind: 'fx', name: 'fade-out', ms: 600 },
          { kind: 'card', title: '萌芽—碧潮海域', subtitle: '渡船航行中……', ms: 1600 },
          { kind: 'travel', island: 'tide', x: FERRY_ARRIVAL.tide.x, z: FERRY_ARRIVAL.tide.z, yaw: FERRY_ARRIVAL.tide.yaw },
        ],
      },
      { label: '再等等', steps: [] },
    ],
  },
];

const ferryToSprout: StoryStep[] = [
  {
    kind: 'choice',
    prompt: '要乘渡船返回萌芽群岛（港湾市）吗？',
    options: [
      {
        label: '出发（港湾市）',
        steps: [
          { kind: 'say', lines: ['「开往港湾市的渡船即将开航！」'] },
          { kind: 'fx', name: 'fade-out', ms: 600 },
          { kind: 'card', title: '萌芽—碧潮海域', subtitle: '渡船航行中……', ms: 1600 },
          { kind: 'travel', island: 'sprout', x: FERRY_ARRIVAL.sprout.x, z: FERRY_ARRIVAL.sprout.z, yaw: FERRY_ARRIVAL.sprout.yaw },
        ],
      },
      { label: '再等等', steps: [] },
    ],
  },
];

// ———————————————————————— 第二章开场 ————————————————————————
const tideArrival: StoryStep[] = [
  { kind: 'card', title: '第二章 · 异变痕迹', subtitle: '碧潮群岛', ms: 2600 },
  { kind: 'narrate', lines: ['深绿的古森、赭石的峡谷、熔岩橙的火山……', '碧潮群岛的三座道馆，可以按任意顺序挑战。'] },
  { kind: 'flag', set: 'tide-arrival-card' },
];

// ———————————————————————— 主线 7 · 矿洞异变 ————————————————————————
const mineAnomaly: StoryStep[] = [
  { kind: 'say', lines: ['岩壁上的晶石泛着诡异的紫光……', '晶簇中间，嵌着一块赤红色的碎片，像心脏一样一下一下地跳动。'] },
  { kind: 'fx', name: 'shake', ms: 700 },
  { kind: 'say', lines: ['！！', '一只被紫光惊扰的宝可梦冲了出来！'] },
  {
    kind: 'battle',
    species: 75,
    level: 21,
    moves: ['rock-throw', 'defense-curl', 'rollout', 'bulldoze'],
    noCapture: true,
    onWin: [
      { kind: 'say', lines: ['隆隆石平静下来，慢慢滚回了黑暗里。', '小心地把赤红色的碎片撬了下来——摸上去烫手。', '晶石的紫光一点点暗了下去。回去告诉工头吧。'] },
      { kind: 'flag', set: 'mine-anomaly-found' },
    ],
    onLose: [{ kind: 'say', lines: ['……'] }],
  },
];

// ———————————————————————— 支线 · 矿洞救援 ————————————————————————
const mineRescue: StoryStep[] = [
  { kind: 'say', lines: ['塌方的乱石后面，传来微弱的呼救声。', '一条大岩蛇盘在通道口，烦躁地甩着尾巴！'] },
  {
    kind: 'battle',
    species: 95,
    level: 22,
    moves: ['rock-throw', 'bind', 'rock-tomb', 'screech'],
    noCapture: true,
    noRun: true,
    onWin: [
      { kind: 'say', lines: ['大岩蛇钻进岩壁的缝隙里，不见了。'] },
      { kind: 'say', speaker: '石根', lines: ['得、得救了！谢谢你！', '我这就回家报平安——你也去跟我婶说一声吧！'] },
      { kind: 'flag', set: 'mine-miner-rescued' },
    ],
    onLose: [{ kind: 'say', lines: ['……'] }],
  },
];

// ———————————————————————— 主线 9 · 地热异常 ————————————————————————
const volcanoCore: StoryStep[] = [
  { kind: 'say', lines: ['熔岩池中央的晶石发出橙色的光，热浪一阵阵涌来……', '晶石里嵌着一块橙色的碎片——热量就是从它那里冒出来的！'] },
  { kind: 'fx', name: 'shake', ms: 800 },
  { kind: 'say', lines: ['熔岩池里有什么东西爬了出来！'] },
  {
    kind: 'battle',
    species: 219,
    level: 26,
    moves: ['lava-plume', 'rock-throw', 'harden', 'amnesia'],
    noCapture: true,
    noRun: true,
    onWin: [
      { kind: 'say', lines: ['熔岩蜗牛缩回了熔岩里。', '趁机把橙色的碎片取了下来——周围的热浪明显退了。', '回观测站告诉老秦吧。'] },
      { kind: 'flag', set: 'volcano-heat-source-found' },
    ],
    onLose: [{ kind: 'say', lines: ['……'] }],
  },
];

// ———————————————————————— 主线 11 · 封印真相 ————————————————————————
const ruinsSealBreak: StoryStep[] = [
  { kind: 'say', lines: ['背包里的三枚徽章同时发出了光……', '紫色的结界像水面一样泛起涟漪。'] },
  { kind: 'fx', name: 'shake', ms: 900 },
  { kind: 'fx', name: 'flash', ms: 500 },
  { kind: 'say', lines: ['结界裂开了一道口子，遗迹的大门露了出来！'] },
  { kind: 'flag', set: 'ruins-seal-open' },
];

const ruinsEnter: StoryStep[] = [
  { kind: 'narrate', lines: ['空气里有一种很旧很旧的味道。', '墙上的纹路，和翠澜群岛的海浪一模一样。'] },
  { kind: 'flag', set: 'ruins-entered' },
];

const ruinsSanctum: StoryStep[] = [
  { kind: 'say', lines: ['圣所中央，一尊巨大的石像盘坐在台座上。', '石像身上的七个光点，正一明一灭地闪着……'] },
  { kind: 'flag', set: 'ruins-sanctum-reached' },
];

// ———————————————————————— 主线 12 · 原初守护者 ————————————————————————
const ruinsGuardian: StoryStep[] = [
  { kind: 'say', lines: ['石像的光点同时亮了起来——', '……它站起来了！'] },
  { kind: 'fx', name: 'shake', ms: 1000 },
  { kind: 'narrate', voice: '原初守护者', lines: ['……持证者。', '证明你配得上门后的真相。'] },
  {
    kind: 'battle',
    species: 377,
    level: 32,
    moves: ['ancient-power', 'stomp', 'rock-slide', 'curse'],
    noCapture: true,
    noRun: true,
    boss: true,
    onWin: [
      { kind: 'narrate', voice: '原初守护者', lines: ['……很好。', '拿去吧。撞碎岩石的力量，与封印的碎片。', '其余的碎片，散落在群岛各处。当它们重新聚首——'] },
      { kind: 'say', lines: ['守护者重新坐回了台座上，光点一个个熄灭。', '台座上，留下了一块紫色的碎片。'] },
      { kind: 'flag', set: 'ruins-guardian-defeated' },
    ],
    onLose: [{ kind: 'say', lines: ['……'] }],
  },
];

// ———————————————————————— 主线 13 · 温泉情报 ————————————————————————
const hotSpringHistory: StoryStep[] = [
  { kind: 'say', speaker: '汤婆婆', lines: ['你去过遗迹了？……身上还有那种紫色的味道。', '那就听老婆子讲个故事吧。'] },
  {
    kind: 'narrate',
    voice: '汤婆婆',
    lines: [
      '很久很久以前，翠澜还只是一片海。',
      '古代人和宝可梦一起，把五座岛从海底托了起来。',
      '他们立下约定：岛上的人守护宝可梦，宝可梦守护岛屿。',
      '为了让约定永远有效，他们把力量封进了七块碎片，交给守护者们看管。',
      '五十年前的异变，就是碎片的封印松动了一次……',
      '而现在，它又松了。',
    ],
  },
  { kind: 'say', speaker: '汤婆婆', lines: ['雷鸣群岛的冰川下，据说还有古代人的遗迹。', '等航线开通，就去那里看看吧。'] },
  { kind: 'flag', set: 'hot-spring-info-heard' },
  { kind: 'card', title: '第二章 · 异变痕迹', subtitle: '— 完 —', ms: 2600 },
];

// ———————————————————————— 主线 14 · 碧潮—雷鸣海域开放（M3-03） ————————————————————————
const thunderRouteOpen: StoryStep[] = [
  { kind: 'say', speaker: '船老大', lines: ['哦，是你！听汤婆婆说，你要去雷鸣群岛的冰川？', '渡轮还开不了——这阵子海上两股洋流一南一北地横着冲，还卷出好几个漩涡。'] },
  { kind: 'say', speaker: '船老大', lines: ['不过你的宝可梦会冲浪吧？', '从码头一直往东。看见海面上一道道白色流纹，那就是洋流，斜着切过去别硬顶。', '打转的漩涡千万绕开！被卷进去，会被甩到老远的地方。'] },
  { kind: 'say', lines: ['碧潮—雷鸣海域可以冲浪通过了！'] },
  { kind: 'flag', set: 'thunder-route-open' },
];

const scripts: StoryScript[] = [
  { id: 'ferry-to-tide', steps: ferryToTide },
  { id: 'ferry-to-sprout', steps: ferryToSprout },
  { id: 'tide-arrival', steps: tideArrival },
  { id: 'mine-anomaly', steps: mineAnomaly },
  { id: 'mine-rescue', steps: mineRescue },
  { id: 'volcano-core', steps: volcanoCore },
  { id: 'ruins-seal-break', steps: ruinsSealBreak },
  { id: 'ruins-enter', steps: ruinsEnter },
  { id: 'ruins-sanctum', steps: ruinsSanctum },
  { id: 'ruins-guardian', steps: ruinsGuardian },
  { id: 'hot-spring-history', steps: hotSpringHistory },
  { id: 'thunder-route-open', steps: thunderRouteOpen },
];

export const TIDE_STORY: StoryScript[] = scripts;

export const TIDE_TRIGGERS: StoryTrigger[] = [
  // 第一次踏上碧潮群岛（冲浪抵达海域西端 / 渡船直达镇上）
  { id: 'tide-arrival-sea', island: 'tide', position: [-980, 0], rect: [-1006, -240, -960, 240], radius: 0, script: 'tide-arrival', doneFlag: 'tide-arrival-card' },
  { id: 'tide-arrival-town', island: 'tide', position: [-560, 30], radius: 30, script: 'tide-arrival', doneFlag: 'tide-arrival-card' },
  // 三枚徽章 → 结界回应
  {
    id: 'ruins-seal-break',
    island: 'tide',
    position: [44, -398],
    radius: 12,
    script: 'ruins-seal-break',
    doneFlag: 'ruins-seal-open',
    showIf: ['badge-azure', 'badge-ore', 'badge-flame'],
  },
  // 听完汤婆婆的故事后走到温泉乡码头 → 船老大放行碧潮—雷鸣海域
  { id: 'thunder-route-open', island: 'tide', position: [562, 650], radius: 9, script: 'thunder-route-open', doneFlag: 'thunder-route-open', showIf: ['hot-spring-info-heard'] },
];
