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

export const GLAZE_STORY: StoryScript[] = [
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
