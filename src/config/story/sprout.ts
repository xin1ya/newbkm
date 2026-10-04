/**
 * M1-13 主线 1–5 / M1-14 支线 4 条 · 萌芽群岛剧情脚本、剧情拾取物、抵达触发。
 * 任务 ID / 奖励不变（设计 §7.4）；奖励由 QuestDirector 在 completeFlag 置位后统一发放，脚本只负责演出与置位 flag。
 */
import type { StoryPickup, StoryScript, StoryStep, StoryTrigger } from '@/systems/story';
import { TM_DEFS, tmItemId } from '@/config/tms';

/** 野外招式学习器拾取点（config/tms 的 field 来源） */
const FIELD_TMS = TM_DEFS.flatMap((t) => (t.source.kind === 'field' ? [{ move: t.move, ...t.source }] : []));

const PI = Math.PI;

/** 御三家（07-22：木木枭 / 火球鼠 / 水跃鱼） */
export const STARTERS = [722, 155, 258] as const;
export const STARTER_LEVEL = 5;

export const STARTER_CARDS = [
  { species: 722, blurb: '沉稳的草之羽毛宝可梦。\n能悄无声息地飞近对手。\n招式：撞击 · 叶刃' },
  { species: 155, blurb: '胆小却勇敢的火鼠宝可梦。\n背上的火焰越紧张烧得越旺。\n招式：撞击 · 火花' },
  { species: 258, blurb: '特别黏人的小沼鱼宝可梦。\n头上的鳍能感知水流变化。\n招式：撞击 · 水枪' },
];

// ———————————————————————— 主线 1 · 梦境序章 ————————————————————————
const dreamPrelude: StoryStep[] = [
  { kind: 'fx', name: 'dream-in', ms: 1400 },
  {
    kind: 'narrate',
    voice: '？？？',
    lines: [
      '……听得见吗？',
      '翠澜的海，正在低声哭泣。',
      '五座岛屿被托起的那一天，我们立下了守护的约定。',
      '可如今，约定的光正在一点点熄灭……',
      '年轻的训练家啊——',
      '和你的伙伴一起，去看看这片群岛吧。',
      '当五座岛的光再次连成一线，你就会明白一切。',
    ],
  },
  { kind: 'narrate', lines: ['光芒像潮水一样退去……'] },
  { kind: 'fx', name: 'dream-out', ms: 1000 },
  { kind: 'flag', set: 'dream-prelude-done' },
  { kind: 'say', lines: ['……是梦吗？', '那个声音……好像在哪里听过。'] },
  { kind: 'say', speaker: '妈妈', lines: ['小澜——起床啦！', '木兰博士一早就打来电话，让你去研究所一趟！'] },
  { kind: 'card', title: '第一章 · 异变初闻', subtitle: '萌芽群岛', ms: 3200 },
];

// ———————————————————————— 主线 2 · 木兰博士的托付 ————————————————————————
const starterChoice: StoryStep[] = [
  { kind: 'starter', species: [...STARTERS], level: STARTER_LEVEL },
  {
    kind: 'say',
    speaker: '木兰博士',
    lines: [
      '好选择！你们一定会成为最好的搭档。',
      '这些精灵球和伤药也拿去吧，路上用得着。',
      '萌芽草原往南就是翠澜镇，镇上湖心道馆的馆主沧澜是位出色的训练家。',
      '去挑战她吧——顺便帮我留意群岛上的「异变」。',
    ],
  },
];

/** 没拿到宝可梦就想离开萌芽镇（经典的「草丛很危险」） */
const noStarterTurnback: StoryStep[] = [
  { kind: 'say', speaker: '妈妈的声音', lines: ['等一下！', '没有宝可梦就走进草丛可是很危险的！', '先去木兰博士的研究所吧。'] },
  { kind: 'pushBack' },
];

// ———————————————————————— 主线 4 · 港湾渡船事件 ————————————————————————
const lighthouseRelight: StoryStep[] = [
  { kind: 'say', lines: ['灯塔底部的控制箱上结满了白色的盐霜。', '连接灯室的透镜驱动器也被卡住了……'] },
  {
    kind: 'choice',
    options: [
      {
        label: '擦掉盐霜，重新合上电闸',
        steps: [
          { kind: 'say', lines: ['用力擦掉盐霜，把电闸推了上去——', '咔嗒！'] },
          { kind: 'fx', name: 'lighthouse', ms: 1400 },
          { kind: 'flag', set: 'lighthouse-relit' },
          { kind: 'say', lines: ['灯塔顶端亮起了明亮的光束！', '光芒划破海面上的雾气，远处的漩涡渐渐平息了。'] },
          { kind: 'say', speaker: '灯塔守 老周', lines: ['亮了！真的亮了！', '有这道光，渡船就能安全出港了。快去告诉渡船管理员吧！'] },
        ],
      },
      { label: '先不动它', steps: [{ kind: 'say', lines: ['还是先想想别的办法吧……'] }] },
    ],
  },
];

// ———————————————————————— 主线 5 · 首次跨海 ————————————————————————
const crossSeaEnd: StoryStep[] = [
  { kind: 'say', lines: ['海风变得温暖起来……', '远处的海平线上，浮现出一片翡翠色的岛影。', '那就是——碧潮群岛。'] },
  { kind: 'flag', set: 'cross-sea-1-done' },
  { kind: 'card', title: '第二章 · 碧潮群岛', subtitle: '异变痕迹', ms: 3600 },
  // M2-01：驶入萌芽—碧潮海域（碧潮地图西端），继续冲浪向东抵达碧潮镇
  { kind: 'travel', island: 'tide', x: -990, z: 0, yaw: PI / 2 },
];

// ———————————————————————— 支线 · 幻影之森的索罗亚 ————————————————————————
const zoruaBattle: StoryStep = {
  kind: 'battle',
  species: 570,
  level: 10,
  noCapture: true,
  noRun: true,
  onWin: [
    { kind: 'say', lines: ['索罗亚气喘吁吁地坐下，却开心地摇起了尾巴。', '它蹭了蹭你的手心——', '看来它认可你了！'] },
    { kind: 'fx', name: 'fog-clear', ms: 1200 },
    { kind: 'flag', set: 'zorua-quest-done' },
  ],
  onLose: [{ kind: 'say', lines: ['索罗亚咯咯笑着，一溜烟钻进了雾里……', '（它好像还在附近。再和它说话可以重新挑战。）'] }],
};

const zoruaReveal: StoryStep[] = [
  {
    kind: 'choice',
    prompt: '（这个孩子……怎么看都有点奇怪。）',
    options: [
      {
        label: '你就是索罗亚吧！',
        steps: [
          { kind: 'say', speaker: '？？？', lines: ['……！', '被、被发现了？'] },
          { kind: 'fx', name: 'poof', ms: 900 },
          { kind: 'say', lines: ['一阵黑雾散开——小女孩变成了一只黑色的小狐狸！'] },
        ],
      },
      {
        label: '你迷路了吗？',
        steps: [
          { kind: 'say', speaker: '？？？', lines: ['嘻嘻，猜错啦！'] },
          { kind: 'fx', name: 'poof', ms: 900 },
          { kind: 'say', lines: ['小女孩转了个圈，身后露出一条毛茸茸的黑尾巴——', '是索罗亚！'] },
        ],
      },
    ],
  },
  { kind: 'say', lines: ['索罗亚压低身子，眼睛亮晶晶的。', '它想试试你的实力！'] },
  zoruaBattle,
];

const zoruaRetry: StoryStep[] = [{ kind: 'say', lines: ['索罗亚从雾里探出头来，又想比一场了！'] }, zoruaBattle];

const zoruaFootprints: StoryStep[] = [{ kind: 'say', lines: ['湿软的泥土上有一串小小的脚印。', '脚印朝着雾的更深处延伸……'] }];

// ———————————————————————— 支线 · 港湾失物招领 ————————————————————————
const fisherTackle: StoryStep[] = [
  { kind: 'say', lines: ['浪花里漂着一只旧木箱……', '箱盖上刻着一个「陈」字——是老陈的钓具箱！'] },
  { kind: 'flag', set: 'fisher-tackle-found' },
  { kind: 'say', lines: ['把钓具箱绑在了身后。', '回港湾市还给老陈吧。'] },
];

// ———————————————————————— 支线 · 蒲婆婆的药草 ————————————————————————
export const HERB_SPOTS: Array<[number, number]> = [
  [263, -38],
  [198, -203],
  [74, 96],
];

const herbScript = (i: number): StoryStep[] => [
  { kind: 'say', lines: ['湖边的湿地里长着一株叶背泛蓝的药草。', '是翠澜药草！小心地把它采了下来。'] },
  { kind: 'var', name: 'herbs-collected', add: 1 },
  { kind: 'flag', set: `herb-${i + 1}-picked` },
];

// ———————————————————————— 汇总 ————————————————————————
const scripts: StoryScript[] = [
  { id: 'dream-prelude', steps: dreamPrelude },
  { id: 'starter-choice', steps: starterChoice },
  { id: 'no-starter-turnback', steps: noStarterTurnback },
  { id: 'lighthouse-relight', steps: lighthouseRelight },
  { id: 'cross-sea-end', steps: crossSeaEnd },
  { id: 'zorua-reveal', steps: zoruaReveal },
  { id: 'zorua-retry', steps: zoruaRetry },
  { id: 'zorua-footprints', steps: zoruaFootprints },
  { id: 'fisher-tackle', steps: fisherTackle },
  ...HERB_SPOTS.map((_, i) => ({ id: `herb-${i + 1}`, steps: herbScript(i) })),
  // 计划文档 §6：野外遗落的招式学习器（每个只能捡一次）
  ...FIELD_TMS.map((t) => ({
    id: t.pickup,
    steps: [
      { kind: 'say', lines: [t.hint + '……'] },
      { kind: 'item', id: tmItemId(t.move), qty: 1 },
      { kind: 'flag', set: `got-${t.pickup}` },
    ] satisfies StoryStep[],
  })),
];

export const SPROUT_STORY: StoryScript[] = scripts;

/** 索罗亚脚印：从森林入口一路延伸到雾中空地 */
const FOOTPRINT_TRAIL: Array<[number, number]> = [
  [-168, -150],
  [-190, -168],
  [-218, -200],
  [-246, -232],
  [-270, -262],
  [-292, -290],
  [-308, -314],
];

export const SPROUT_PICKUPS: StoryPickup[] = [
  ...FIELD_TMS.map(
    (t): StoryPickup => ({
      id: t.pickup,
      island: 'sprout',
      position: t.position,
      model: 'tm-disc',
      label: '捡起发光的东西',
      script: t.pickup,
      hideIf: [`got-${t.pickup}`],
    }),
  ),
  {
    id: 'lighthouse-lamp',
    island: 'sprout',
    position: [418.5, -63],
    model: 'lamp',
    yaw: -PI / 2,
    label: '检查灯塔控制箱',
    script: 'lighthouse-relight',
    showIf: ['lighthouse-keeper-asked'],
    hideIf: ['lighthouse-relit'],
    range: 2.2,
  },
  {
    id: 'fisher-tackle-box',
    island: 'sprout',
    position: [490, 170],
    model: 'tackle-box',
    label: '捞起漂流的木箱',
    script: 'fisher-tackle',
    showIf: ['fisher-quest-start'],
    hideIf: ['fisher-tackle-found'],
    range: 4,
    floating: true,
  },
  ...HERB_SPOTS.map(
    (p, i): StoryPickup => ({
      id: `herb-${i + 1}`,
      island: 'sprout',
      position: p,
      model: 'herb',
      label: '采集药草',
      script: `herb-${i + 1}`,
      showIf: ['herbs-quest-start'],
      hideIf: [`herb-${i + 1}-picked`, 'herbs-delivered'],
    }),
  ),
  ...FOOTPRINT_TRAIL.map((p, i): StoryPickup => {
    const next = FOOTPRINT_TRAIL[i + 1] ?? [-320, -330];
    return {
      id: `zorua-footprints-${i + 1}`,
      island: 'sprout',
      position: p,
      model: 'footprints',
      label: '查看脚印',
      script: 'zorua-footprints',
      showIf: ['zorua-quest-start'],
      hideIf: ['zorua-quest-done'],
      yaw: Math.atan2(next[0] - p[0], next[1] - p[1]),
      range: 1.8,
    };
  }),
];

export const SPROUT_TRIGGERS: StoryTrigger[] = [
  {
    id: 'cross-sea-end',
    island: 'sprout',
    position: [506, 0],
    rect: [498, -230, 512, 230],
    radius: 0,
    script: 'cross-sea-end',
    doneFlag: 'cross-sea-1-done',
    showIf: ['sea-route-1-entered', 'ferry-route-opened'],
  },
  {
    id: 'no-starter-turnback',
    island: 'sprout',
    position: [0, 0],
    radius: 0,
    outsideZone: 'sprout-town',
    repeat: true,
    script: 'no-starter-turnback',
    doneFlag: 'starter-chosen',
    showIf: ['dream-prelude-done'],
    hideIf: ['m0.prototype-starter'],
  },
];
