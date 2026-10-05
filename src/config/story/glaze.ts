/**
 * M3-18 · 琉璃群岛：潜水骑乘 + 海底神殿。M3-25 · 主线 22「亡魂低吟」：暗影洞窟祭坛 → 被异变缠住的耿鬼 → 异变碎片·幽（ghost-event-solved）。
 * 支线「深叔的旧罗盘」（side-old-diver）：琉璃道馆胜利后，老潜水员深叔托你找回他年轻时掉在东海岸礁湾的潜水罗盘；
 *   罗盘漂在琉璃沙滩东侧的浅湾里（冲浪靠近），交还后获得潜水许可（flag hm08-dive）。
 * 支线「潮落之门」（side-sea-temple）：从神殿海沟（深水暗区）下潜 → 海底神殿前厅（潮汐螺机关）→ 圣所祭坛。
 */
import type { StoryPickup, StoryScript, StoryStep, StoryTrigger } from '@/systems/story';

const compassFound: StoryStep[] = [
  { kind: 'narrate', lines: ['水面上漂着一只缠满海草的小木匣。', '打开一看——是一只黄铜罗盘，表盘背面刻着一道浪纹。指针不指北，一直颤颤地指向东边的深海。'] },
  { kind: 'item', id: 'diver-compass', qty: 1 },
  { kind: 'flag', set: 'diver-compass-found' },
  { kind: 'say', lines: ['得到了「旧潜水罗盘」！拿回琉璃镇给深叔看看吧。'] },
];

const compassReturned: StoryStep[] = [
  { kind: 'say', speaker: '老潜水员深叔', lines: ['这、这是……我的罗盘！四十年了，居然还能再见到它。', '你看这指针——它从来不指北，只指那座门。当年就是靠它，我才在漆黑的海沟里找到了路。'] },
  { kind: 'say', speaker: '老潜水员深叔', lines: ['你和你的宝可梦已经够强了。我把潜水的本事教给你们。', '东边那片颜色最深的海，水面会打着旋——骑着会游泳的伙伴到漩涡中心，就能潜下去。', '记住：水下的暗流有时有、有时无。神殿里的海螺，能让暗流改道。'] },
  { kind: 'flag', set: 'diver-compass-returned' },
  { kind: 'say', lines: ['现在可以骑乘宝可梦「潜水」了！在深水区的漩涡处冲浪即可下潜。'] },
];

const hallEnter: StoryStep[] = [
  { kind: 'narrate', lines: ['穿过巨柱之间的门洞，水忽然变得清澈。', '前厅里立着三只巨大的海螺，三道水幕后各有一扇门。中间那扇门上的浪纹，和石堤尽头的门楼一模一样。'] },
  { kind: 'flag', set: 'sea-temple-entered' },
];

const sanctumEnter: StoryStep[] = [
  { kind: 'fx', name: 'flash' },
  { kind: 'narrate', lines: ['水幕在身后合拢。四周忽然安静下来——连气泡声都听不见了。', '圆形的圣所中央，一块水蓝色的晶石悬在祭坛上，缓缓地明灭，像在呼吸。'] },
  { kind: 'flag', set: 'sea-temple-hall-open' },
];

const altar: StoryStep[] = [
  {
    kind: 'if',
    flags: ['sea-temple-cleared'],
    then: [{ kind: 'narrate', lines: ['晶石安静地明灭着。', '掌心贴上去时，能感觉到一阵很慢、很深的潮汐。'] }],
    else: [
      { kind: 'narrate', lines: ['你把手放在晶石上。', '……一道光沿着地面的浪纹一圈圈扩散出去，壁画上的海民像是活了过来。'] },
      { kind: 'narrate', lines: ['「潮去潮来，海与岛同息。」', '「若有一日群岛失衡，持此水之心者，当至海底聆听。」'] },
      { kind: 'fx', name: 'flash' },
      { kind: 'item', id: 'mystic-water', qty: 1 },
      { kind: 'item', id: 'gold-bottle-cap', qty: 1 },
      { kind: 'flag', set: 'sea-temple-cleared' },
      { kind: 'say', lines: ['祭坛下的暗格里，有一滴凝住的「神秘水滴」和一枚「金色王冠」。'] },
    ],
  },
];

// ———————————————— M3-20 冠军之路 ————————————————
// ———————————————————————— M3-25 · 主线 22 亡魂低吟 ————————————————————————
const shadowEnter: StoryStep[] = [
  { kind: 'narrate', lines: ['洞口吹出的风是冷的，带着潮湿的土腥味。', '风里夹着低低的吟唱声……像很多人在很远的地方，同时念着一个名字。'] },
  { kind: 'flag', set: 'shadow-cave-entered' },
];

const shadowAltar: StoryStep[] = [
  { kind: 'say', lines: ['祭坛上的紫色晶石猛地亮了起来，低吟声一下子变成了尖啸！', '背包里的碎片跟着震动——晶石里，封着第五块碎片。'] },
  { kind: 'fx', name: 'shake', ms: 700 },
  { kind: 'say', lines: ['晶石的光里浮出一对红色的眼睛。', '一只被异变缠住的耿鬼，挡在了祭坛前面！'] },
  {
    kind: 'battle',
    species: 94,
    level: 48,
    moves: ['shadow-ball', 'sludge-bomb', 'hypnosis', 'dream-eater'],
    noCapture: true,
    noRun: true,
    boss: true,
    onWin: [
      { kind: 'say', lines: ['耿鬼身上的紫光一点点褪去。', '它看了看洞口的方向——幽冥镇的方向——咧嘴笑了笑，化成一缕烟散开了。'] },
      { kind: 'fx', name: 'flash', ms: 400 },
      { kind: 'say', lines: ['从晶石里取出了「异变碎片·幽」！', '五块碎片排成一行，古文字又多亮起了一段：「……七晶归一之处，在群岛之外。」', '低吟声停了。回幽冥镇灵堂告诉巫女澄吧。'] },
      { kind: 'flag', set: 'ghost-event-solved' },
    ],
    onLose: [{ kind: 'say', lines: ['眼前一黑……', '醒来时已经在洞口了。尖啸声还在深处回荡。'] }],
  },
];

const vrGateEnter: StoryStep[] = [
  { kind: 'narrate', lines: ['关所里很安静。对面那扇门后传来低沉的风声——那是冠军山腹地的呼吸。', '门边的守卫抬起头，目光落在你的徽章盒上。'] },
  { kind: 'flag', set: 'vr-entered' },
];

const vrHm07: StoryStep[] = [
  { kind: 'say', speaker: '攀瀑老人瀑翁', lines: ['哦？走到暗河这里来了啊。', '那道瀑布从上一层落下来，四十年没停过。我年轻时也想爬上去——可惜我的伙伴已经老了。'] },
  { kind: 'say', speaker: '攀瀑老人瀑翁', lines: ['你的宝可梦眼神很好。来，我把逆流而上的诀窍教给你们。', '别跟水较劲。顺着水势找落脚的地方，借它的力往上冲。'] },
  { kind: 'fx', name: 'flash' },
  { kind: 'flag', set: 'hm07-waterfall' },
  { kind: 'say', lines: ['学会了「攀瀑」！站在瀑布前按互动键，就能逆瀑而上。'] },
  { kind: 'say', speaker: '攀瀑老人瀑翁', lines: ['对了——萌芽的澜源大瀑布、碧潮的泉眼瀑布、雷鸣的冰舌瀑布，', '那几座石台顶上都有古人留下的石匣。冲浪到瀑潭里，就能攀上去看看。（地图上标着「≋」）'] },
];

const vrCleared: StoryStep[] = [
  { kind: 'fx', name: 'flash' },
  { kind: 'narrate', lines: ['洞口外涌进来一阵明亮的风。', '远处，联盟高原上翻卷的云层慢慢散开——彩幽市的尖塔在阳光下闪闪发亮。'] },
  { kind: 'flag', set: 'victory-road-cleared' },
  { kind: 'say', lines: ['冠军之路通关！联盟高原上空的乱流平息了，以后可以骑宝可梦飞往彩幽市。'] },
];

/** M3-21 名人堂：战胜冠军后走进名人堂自动执行（每轮挑战一次） */
const leagueHallOfFame: StoryStep[] = [
  { kind: 'say', speaker: '名人堂管理员', lines: ['欢迎来到名人堂。', '恭喜你——翠澜地区新的冠军！', '请让我把你和伙伴们的名字，记录进名人堂。'] },
  { kind: 'fx', name: 'flash' },
  { kind: 'hall-of-fame' },
  {
    kind: 'if',
    flags: ['league-champion-title'],
    then: [{ kind: 'say', speaker: '名人堂管理员', lines: ['又一次载入名人堂了！', '四天王随时欢迎你回来再挑战。'] }],
    else: [
      { kind: 'card', title: '翠澜地区 · 新冠军诞生', subtitle: '与伙伴们一同，登上了顶峰', ms: 3200 },
      {
        kind: 'narrate',
        lines: [
          '萌芽镇的晨光、碧潮的古树、雷鸣的雪原、琉璃的海。',
          '一路上遇见的每一位训练家，每一只宝可梦，都成了这段旅程的一部分。',
          '旅程还没有结束——翠澜的海上，还有许多没被发现的秘密。',
        ],
      },
      { kind: 'flag', set: 'league-champion-title' },
      { kind: 'say', speaker: '名人堂管理员', lines: ['从今天起，你就是翠澜的冠军了。', '大门外就是彩幽市。四天王随时接受再挑战——每一轮都从第一间重新开始。'] },
    ],
  },
  { kind: 'unflag', clear: ['league-run'] },
  { kind: 'flag', set: 'league-hof-run' },
];

// ———————————————————————— M3-27 · 琉璃支线 ————————————————————————
/** 降灵会：三处徘徊的亡魂（墓园 / 沼泽古墓 / 钟楼下） */
export const SPIRIT_SPOTS: ReadonlyArray<[number, number]> = [
  [-470, -108],
  [-515, -422],
  [-458, -142],
];
/** 幻影预言：白昼之宫 / 月下之塔 / 海底之门 */
export const PROPHECY_SPOTS: ReadonlyArray<[number, number]> = [
  [-246, 465],
  [-467, 514],
  [590, 192],
];
/** 秘密基地材料：琉璃砖（琉璃沙滩）/ 石板（海蚀石林）/ 细沙（蜃景沙洲） */
export const BASE_MATERIAL_SPOTS: ReadonlyArray<{ id: string; name: string; at: [number, number]; line: string }> = [
  { id: 'glass', name: '琉璃砖', at: [628, 286], line: '沙滩上半埋着几块被海浪磨圆的琉璃砖，透着淡淡的海蓝色。' },
  { id: 'stone', name: '石板', at: [-549, 165], line: '石林脚下散落着平整的石板，正好用来铺地。' },
  { id: 'sand', name: '细沙', at: [-60, 650], line: '沙洲上的沙细得像面粉，在阳光下微微发亮。' },
];
export const VEIN_SPRING_SPOT: [number, number] = [292, -222];

const SPIRITS: Array<{ species: number; level: number; moves: string[]; intro: string; outro: string }> = [
  { species: 92, level: 46, moves: ['lick', 'night-shade', 'confuse-ray', 'hypnosis'], intro: '一块没写名字的墓碑前，飘着一团小小的鬼火。它在找自己的名字。', outro: '鬼斯安静下来，绕着墓碑转了一圈。墓碑上浮现出一个模糊的名字——它满足地散开了。' },
  { species: 769, level: 48, moves: ['sand-tomb', 'hypnosis', 'shadow-ball', 'mega-drain'], intro: '沼泽古墓的泥沙自己堆了起来，堆成一座小小的沙堡……沙堡里传来哭声。', outro: '沙堡塌了下去，哭声变成了一声长长的叹息。古墓周围的雾淡了一些。' },
  { species: 93, level: 48, moves: ['shadow-ball', 'confuse-ray', 'sucker-punch', 'hypnosis'], intro: '钟楼下，一只鬼斯通一下一下地撞着钟绳，像是想敲响什么。', outro: '「当——」钟声响起。鬼斯通听完最后一声余音，朝墓园的方向飘走了。' },
];

const spiritScript = (i: number): StoryStep[] => {
  const sp = SPIRITS[i]!;
  return [
    { kind: 'say', lines: [sp.intro] },
    {
      kind: 'battle',
      species: sp.species,
      level: sp.level,
      moves: sp.moves,
      noCapture: true,
      onWin: [{ kind: 'say', lines: [sp.outro, `第 ${i + 1} 个亡魂平息了。`] }, { kind: 'flag', set: `spirit-${i + 1}-calmed` }],
      onLose: [{ kind: 'say', lines: ['寒意钻进骨头里……亡魂还在原地徘徊。'] }],
    },
  ];
};

const PROPHECIES = [
  ['蜃楼宫的幻影在正午最清楚。', '海市蜃楼里，宫殿的门开着，门后是一片冰原——雷鸣群岛的冰川？', '第一段预言：「白昼之宫，映出已去之地。」'],
  ['月影塔的残柱投下长长的影子。', '影子的尽头，指向北方的冠军山——山顶上方，天空有一道细细的裂缝。', '第二段预言：「月下之塔，指向将至之门。」'],
  ['神殿石碑旁，海浪拍岸的节奏忽然停了一拍。', '水面上映出七道光，排成一个圆——圆心是一座从来没见过的岛。', '第三段预言：「海底之门，通往群岛之外。」'],
];

const prophecyScript = (i: number): StoryStep[] => [
  { kind: 'say', lines: PROPHECIES[i]! },
  { kind: 'fx', name: 'flash', ms: 300 },
  { kind: 'say', lines: ['把预言记在了笔记上。'] },
  { kind: 'flag', set: `prophecy-${i + 1}` },
];

const baseMaterial = (m: (typeof BASE_MATERIAL_SPOTS)[number]): StoryStep[] => [
  { kind: 'say', lines: [m.line, `收集到了「${m.name}」！`] },
  { kind: 'flag', set: `base-mat-${m.id}` },
];

const baseBuild: StoryStep[] = [
  { kind: 'say', speaker: '秘密基地迷 阿穴', lines: ['琉璃砖、石板、细沙——全齐了！', '东边那面岩壁后面是空的，我早就听出来了。看好了！'] },
  { kind: 'fx', name: 'fade-out', ms: 500 },
  { kind: 'narrate', lines: ['咚、咚、咚……', '敲开岩壁，铺上石板，砌好琉璃砖窗，用细沙抹平地面——'] },
  { kind: 'fx', name: 'fade-in', ms: 500 },
  { kind: 'say', speaker: '秘密基地迷 阿穴', lines: ['完工！从今天起，这里就是你的秘密基地。', '里面有电脑和床，最里面的工作台可以换布置。想怎么摆都行！'] },
  { kind: 'flag', set: 'secret-base-built' },
];

const BASE_THEMES = ['base-theme-cozy', 'base-theme-crystal', 'base-theme-training'];
const theme = (flag: string, line: string): StoryStep[] => [
  { kind: 'unflag', clear: BASE_THEMES.filter((t) => t !== flag) },
  { kind: 'flag', set: flag },
  { kind: 'fx', name: 'room-refresh', ms: 500 },
  { kind: 'say', lines: [line] },
];
const baseDecor: StoryStep[] = [
  {
    kind: 'choice',
    prompt: '换成哪种布置？',
    options: [
      { label: '温馨小屋', steps: theme('base-theme-cozy', '铺上地毯，摆好沙发和书架——秘密基地一下子暖和起来了。') },
      { label: '水晶洞', steps: theme('base-theme-crystal', '四周立起发光的晶簇，整个基地泛着蓝紫色的光。') },
      { label: '训练场', steps: theme('base-theme-training', '挂上旗子、点起火把，搬来几个沙袋箱——随时可以开练！') },
      { label: '清空', steps: [{ kind: 'unflag', clear: BASE_THEMES }, { kind: 'fx', name: 'room-refresh', ms: 500 }, { kind: 'say', lines: ['把布置都收了起来。空荡荡的，也挺好。'] }] },
    ],
  },
];

const shadowRare: StoryStep[] = [
  { kind: 'say', lines: ['暗河边的珊瑚状石头……动了。', '传说中只在暗影洞窟最深处出没的宝可梦！'] },
  {
    kind: 'battle',
    species: 864,
    level: 56,
    moves: ['hex', 'power-gem', 'giga-drain', 'curse'],
    noRun: true,
    onWin: [{ kind: 'say', lines: ['太阳珊瑚的亡魂……不，是魔灵珊瑚。', '回洞口告诉墨婆吧——你见到了它。'] }, { kind: 'flag', set: 'shadow-rare-met' }],
    onLose: [{ kind: 'say', lines: ['眼前的珊瑚碎成一片幽光，消失在暗河里……', '它还会回来的。'] }],
  },
];

const veinSpring: StoryStep[] = [
  { kind: 'say', lines: ['泉眼里的水不是往外冒，而是在往下漏——漩涡中心闪着紫光。', '水底有什么东西堵住了水脉！'] },
  { kind: 'fx', name: 'shake', ms: 600 },
  {
    kind: 'battle',
    species: 130,
    level: 52,
    moves: ['waterfall', 'crunch', 'dragon-dance', 'ice-fang'],
    noCapture: true,
    boss: true,
    onWin: [
      { kind: 'say', lines: ['暴鲤龙身上的紫光散去，它甩甩尾巴，顺着水道游回了深海。', '漩涡停了。清水重新从泉眼里涌了出来——'] },
      { kind: 'fx', name: 'flash', ms: 300 },
      { kind: 'say', lines: ['水脉通了！回琉璃镇告诉吹玻璃匠岩师傅吧。'] },
      { kind: 'flag', set: 'vein-spring-fixed' },
    ],
    onLose: [{ kind: 'say', lines: ['被水流卷了出来……泉眼还在往下漏。'] }],
  },
];

export const GLAZE_STORY: StoryScript[] = [
  ...SPIRITS.map((_, i): StoryScript => ({ id: `spirit-${i + 1}`, steps: spiritScript(i) })),
  ...PROPHECIES.map((_, i): StoryScript => ({ id: `prophecy-${i + 1}`, steps: prophecyScript(i) })),
  ...BASE_MATERIAL_SPOTS.map((m): StoryScript => ({ id: `base-mat-${m.id}`, steps: baseMaterial(m) })),
  { id: 'secret-base-build', steps: baseBuild },
  { id: 'secret-base-decor', steps: baseDecor },
  { id: 'shadow-rare', steps: shadowRare },
  { id: 'vein-spring', steps: veinSpring },
  { id: 'shadow-enter', steps: shadowEnter },
  { id: 'shadow-altar', steps: shadowAltar },
  { id: 'league-hall-of-fame', steps: leagueHallOfFame },
  { id: 'league-hof-browse', steps: [{ kind: 'hall-of-fame', browse: true }] },
  { id: 'vr-gate-enter', steps: vrGateEnter },
  { id: 'vr-hm07', steps: vrHm07 },
  { id: 'vr-cleared', steps: vrCleared },
  { id: 'diver-compass-pickup', steps: compassFound },
  { id: 'diver-compass-return', steps: compassReturned },
  { id: 'sea-temple-hall-enter', steps: hallEnter },
  { id: 'sea-temple-sanctum-enter', steps: sanctumEnter },
  { id: 'sea-temple-altar', steps: altar },
];

/** 罗盘：漂在琉璃沙滩以东的浅湾（冲浪靠近） */
export const DIVER_COMPASS_POS: [number, number] = [705, 375];

export const GLAZE_PICKUPS: StoryPickup[] = [
  ...SPIRIT_SPOTS.map(([x, z], i): StoryPickup => ({ id: `spirit-${i + 1}`, island: 'glaze', position: [x, z], model: 'sparkle', label: '靠近鬼火', script: `spirit-${i + 1}`, showIf: ['seance-start'], hideIf: [`spirit-${i + 1}-calmed`] })),
  ...PROPHECY_SPOTS.map(([x, z], i): StoryPickup => ({ id: `prophecy-${i + 1}`, island: 'glaze', position: [x, z], model: 'sparkle', label: '感应预言', script: `prophecy-${i + 1}`, showIf: ['prophecy-start'], hideIf: [`prophecy-${i + 1}`] })),
  ...BASE_MATERIAL_SPOTS.map((m): StoryPickup => ({ id: `base-mat-${m.id}`, island: 'glaze', position: m.at, model: 'sparkle', label: `收集${m.name}`, script: `base-mat-${m.id}`, showIf: ['secret-base-start'], hideIf: [`base-mat-${m.id}`] })),
  { id: 'vein-spring', island: 'glaze', position: VEIN_SPRING_SPOT, model: 'sparkle', label: '调查泉眼', script: 'vein-spring', showIf: ['watervein-start'], hideIf: ['vein-spring-fixed'] },
  {
    id: 'diver-compass',
    island: 'glaze',
    position: DIVER_COMPASS_POS,
    model: 'sparkle',
    label: '捞起漂浮的木匣',
    script: 'diver-compass-pickup',
    showIf: ['diver-quest-start'],
    hideIf: ['diver-compass-found'],
    range: 4,
    floating: true,
  },
];

export const GLAZE_TRIGGERS: StoryTrigger[] = [];
