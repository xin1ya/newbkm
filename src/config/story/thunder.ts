/**
 * 第三章主线剧情（M3-24）+ 雷鸣群岛 → 琉璃群岛的主线衔接（M3-05）。
 * 主线 14「二度跨海」：冲浪进入雷鸣地图西缘或到达雷鸣镇时播放第三章标题卡（thunder-arrival-card）。
 * 主线 17「冰封秘密」：冰川遗迹圣坛 → 碎片共鸣融冰 → 冰封守护者 → 异变碎片·蓝（snow-ruins-shard）。
 * 主线 19「天空异象」收尾：四枚徽章 + 蓝碎片后在云雀镇看到北方天空的裂光（sky-anomaly-seen）。
 * 主线 20「三度跨海」：集齐雷鸣四枚徽章后，云雀镇码头的钓竿爷指路雷鸣—琉璃海域（glaze-route-open）；
 * 第一次冲浪进入琉璃地图（礁石迷宫南口）或到达幻影镇时播放第四章标题卡。
 * 徽章 flag 约定（M3-15 道馆 5–8 沿用）：badge-thunder / badge-dawn / badge-snow / badge-lark。
 */
import type { StoryPickup, StoryScript, StoryStep, StoryTrigger } from '@/systems/story';

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

// ———————————————————————— M3-26 · 雷鸣支线 ————————————————————————
/** 雷云观测站的 3 个采样点（雷暴高原，陆地、无碰撞，远程探针校验） */
export const STORM_SAMPLE_SPOTS: ReadonlyArray<[number, number]> = [
  [-480, -200],
  [-300, 60],
  [-470, 220],
];
/** 冰湖畔的透明冰块 */
export const CLEAR_ICE_SPOT: [number, number] = [-160, -420];

const crystalCore: StoryStep[] = [
  {
    kind: 'if',
    flags: ['crystal-core-taken'],
    then: [{ kind: 'say', lines: ['晶核上留着一道整齐的缺口，电光绕着缺口转圈。'] }],
    else: [
      {
        kind: 'if',
        flags: ['crystal-treasure-start'],
        then: [
          { kind: 'say', lines: ['阿伏说的「雷晶」，应该就是晶核外层那几块透亮的晶片。', '小心地撬下一块——'] },
          { kind: 'fx', name: 'flash', ms: 300 },
          { kind: 'say', lines: ['啪！电光一闪，晶簇里窜出一只宝可梦！'] },
          {
            kind: 'battle',
            species: 26,
            level: 36,
            moves: ['thunderbolt', 'thunder-wave', 'quick-attack', 'iron-tail'],
            noCapture: true,
            onWin: [
              { kind: 'say', lines: ['雷丘甩了甩尾巴，一溜烟窜回晶簇深处去了。', '取下了一块闪着电光的「雷晶」。回雷鸣镇交给电工阿伏吧。'] },
              { kind: 'flag', set: 'crystal-core-taken' },
            ],
            onLose: [{ kind: 'say', lines: ['电得浑身发麻……先退回去整顿一下吧。'] }],
          },
        ],
      },
    ],
  },
];

const lighthouseLamp: StoryStep[] = [
  {
    kind: 'if',
    flags: ['lh-lamp-lit'],
    then: [{ kind: 'say', lines: ['透镜把灯光投向远海。海面上，一艘夜航的渔船正慢慢靠港。'] }],
    else: [
      {
        kind: 'if',
        flags: ['lighthouse-ghost-start'],
        then: [
          { kind: 'say', lines: ['把阿钟给的新灯芯装进灯座，正要点火——', '透镜里的绿光忽然涨满了整个灯室！'] },
          { kind: 'fx', name: 'shake', ms: 500 },
          { kind: 'say', lines: ['「……不许……点灯……」', '住在光里的宝可梦现身了！'] },
          {
            kind: 'battle',
            species: 93,
            level: 38,
            moves: ['shadow-ball', 'hypnosis', 'night-shade', 'confuse-ray'],
            noCapture: true,
            boss: true,
            onWin: [
              { kind: 'say', lines: ['鬼斯通缩成一团小小的绿光，躲到了灯座后面。', '……它只是怕被强光赶走罢了。', '点燃灯芯。透镜一圈圈亮了起来——'] },
              { kind: 'fx', name: 'lighthouse', ms: 1800 },
              { kind: 'fx', name: 'fog-clear', ms: 1200 },
              { kind: 'say', lines: ['灯光扫过海面，笼罩海港的雾慢慢散开了。', '灯座后面的绿光眨了眨，好像也挺喜欢这盏灯。回一楼告诉阿钟吧。'] },
              { kind: 'flag', set: 'lh-lamp-lit' },
            ],
            onLose: [{ kind: 'say', lines: ['绿光一下扑灭了灯芯……眼前一黑。'] }],
          },
        ],
      },
    ],
  },
];

const stormSample = (n: number): StoryStep[] => [
  { kind: 'say', lines: ['把观测员给的采样仪插进土里。', '天线噼啪作响，指针一下子打到了头——', `第 ${n} 组雷云数据记录完成！`] },
  { kind: 'fx', name: 'flash', ms: 250 },
  { kind: 'flag', set: `storm-sample-${n}` },
];

const clearIce: StoryStep[] = [
  { kind: 'say', lines: ['湖边的冰面裂开了一块，切口清澈得像玻璃。', '用力把它撬了起来——这就是冰雕用的「透明冰」！', '扛回雪原镇交给冰雕师傅吧。'] },
  { kind: 'flag', set: 'ice-block-got' },
];

const iceSculpture: StoryStep[] = [
  { kind: 'say', speaker: '冰雕师傅 凌叔', lines: ['好冰！透得能看见对面的雪山。', '比赛规矩：用宝可梦的冰系招式雕，人只管出主意。你想雕什么？'] },
  {
    kind: 'choice',
    prompt: '雕什么？',
    options: [
      { label: '展翅的云雀', steps: [{ kind: 'say', lines: ['冰屑像雪一样飞起来……一只张开翅膀的云雀立在了冰台上。', '观众里有人惊呼：「它好像下一秒就要飞走了！」'] }] },
      { label: '雷鸣镇的避雷塔', steps: [{ kind: 'say', lines: ['一层层冰棱叠上去，避雷塔的尖顶在阳光下闪闪发光。', '电工阿伏在台下使劲鼓掌。'] }] },
      { label: '自己的搭档', steps: [{ kind: 'say', lines: ['冰台上出现了搭档的模样，连神气的表情都一模一样。', '搭档绕着冰雕转了好几圈，得意极了。'] }] },
    ],
  },
  { kind: 'say', speaker: '冰雕师傅 凌叔', lines: ['评审团一致通过——今年的冰雕节冠军，就是你！', '这是冠军的奖品，收好。'] },
  { kind: 'flag', set: 'ice-sculpture-done' },
];

const frozenSeed: StoryStep[] = [
  {
    kind: 'if',
    flags: ['frozen-seed-found'],
    then: [{ kind: 'say', lines: ['冰缝里只剩一个种子形状的小坑。'] }],
    else: [
      {
        kind: 'if',
        flags: ['snow-ruins-shard'],
        then: [
          { kind: 'say', lines: ['圣坛的冰化开以后，地上的冰缝里露出了一颗种子。', '种子外面裹着一层薄冰，里面却是绿的——像还活着。', '拿到了「远古种子」。温泉乡培育屋的暖婆婆，也许有办法让它发芽。'] },
          { kind: 'flag', set: 'frozen-seed-found' },
        ],
        else: [{ kind: 'say', lines: ['冰缝被冻得死死的，里面好像有一点绿色。'] }],
      },
    ],
  },
];

export const THUNDER_PICKUPS: StoryPickup[] = [
  ...STORM_SAMPLE_SPOTS.map(
    ([x, z], i): StoryPickup => ({
      id: `storm-sample-${i + 1}`,
      island: 'thunder',
      position: [x, z],
      model: 'sparkle',
      label: '记录雷云数据',
      script: `storm-sample-${i + 1}`,
      showIf: ['thunder-observation-start'],
      hideIf: [`storm-sample-${i + 1}`],
    }),
  ),
  { id: 'clear-ice', island: 'thunder', position: CLEAR_ICE_SPOT, model: 'sparkle', label: '撬下透明冰', script: 'clear-ice', showIf: ['ice-sculpture-start'], hideIf: ['ice-block-got'] },
];

export const THUNDER_STORY: StoryScript[] = [
  { id: 'crystal-core', steps: crystalCore },
  { id: 'lighthouse-lamp', steps: lighthouseLamp },
  { id: 'storm-sample-1', steps: stormSample(1) },
  { id: 'storm-sample-2', steps: stormSample(2) },
  { id: 'storm-sample-3', steps: stormSample(3) },
  { id: 'clear-ice', steps: clearIce },
  { id: 'ice-sculpture', steps: iceSculpture },
  { id: 'frozen-seed', steps: frozenSeed },
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
