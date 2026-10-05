/**
 * M3-21 · 精灵联盟：四天王（花月 · 恶 → 芙蓉 · 鬼 → 波妮 · 冰 → 源治 · 龙）与冠军米可利（水）。
 * 等级：冠军之路 51–55 → 四天王 57–62 → 冠军 62–65。招式写死（四天王是精心配招的对手）。
 * 物种限于 120 种图鉴；「冰」「龙」以招式补足属性特色（M3-28 生态扩充后可替换）。
 * NPC 定义在 config/npcs/league.ts，站位在 config/interiors/league.ts。
 */
import type { TrainerDef } from '@/systems/trainers';

const elite = (id: string, name: string, title: string, prizeBase: number, party: TrainerDef['party'], intro: string[], defeat: string[], after: string[], items: { id: string; qty: number }[]): TrainerDef => ({
  id,
  name,
  title,
  ai: 'smart',
  prizeBase,
  sight: { range: 0, fov: 0 },
  party,
  intro,
  defeat,
  after,
  entrance: 'bow',
  items,
});

export const LEAGUE_TRAINERS: TrainerDef[] = [
  elite(
    'league-e1',
    '花月',
    '四天王',
    120,
    [
      { species: 862, level: 57, moves: ['night-slash', 'facade', 'close-combat', 'swords-dance'] },
      { species: 229, level: 57, moves: ['dark-pulse', 'flamethrower', 'nasty-plot', 'sucker-punch'] },
      { species: 342, level: 58, moves: ['crabhammer', 'crunch', 'swords-dance', 'aqua-jet'] },
      { species: 571, level: 59, moves: ['foul-play', 'dark-pulse', 'flamethrower', 'nasty-plot'] },
    ],
    ['哟，挑战者。我是四天王的花月。', '我喜欢你的眼神——像是还没被谁真正打趴下过。', '那就由我来当第一个吧。放马过来，别让我失望！'],
    ['……哈！输得痛快！'],
    ['你干得不错。可后面那三个人，可没我这么好说话。', '往前走吧——身后的门不会再开了。'],
    [{ id: 'hyper-potion', qty: 2 }],
  ),
  elite(
    'league-e2',
    '芙蓉',
    '四天王',
    120,
    [
      { species: 93, level: 58, moves: ['shadow-ball', 'sludge-bomb', 'hypnosis', 'destiny-bond'] },
      { species: 770, level: 58, moves: ['shadow-ball', 'earth-power', 'shore-up', 'giga-drain'] },
      { species: 864, level: 59, moves: ['hex', 'will-o-wisp', 'power-gem', 'giga-drain'] },
      { species: 724, level: 59, moves: ['spirit-shackle', 'leaf-blade', 'brave-bird', 'shadow-sneak'] },
      { species: 94, level: 60, moves: ['shadow-ball', 'sludge-wave', 'focus-blast', 'hypnosis'] },
    ],
    ['啊哈哈……我是四天王的芙蓉。', '我在幽冥镇的墓厅里长大，从小就能看见别人看不见的东西。', '你的身边……也跟着很多「东西」呢。让我看看，它们站在哪一边。'],
    ['……原来它们一直在保护你。'],
    ['你和宝可梦之间，有一根看不见的线。', '下一间很冷，记得别让那根线冻断了。'],
    [{ id: 'hyper-potion', qty: 2 }],
  ),
  elite(
    'league-e3',
    '波妮',
    '四天王',
    120,
    [
      { species: 73, level: 59, moves: ['ice-beam', 'sludge-wave', 'toxic-spikes', 'hydro-pump'] },
      { species: 80, level: 59, moves: ['ice-beam', 'psychic', 'slack-off', 'scald'] },
      { species: 222, level: 60, moves: ['icicle-spear', 'power-gem', 'recover', 'scald'] },
      { species: 195, level: 60, moves: ['earthquake', 'ice-punch', 'recover', 'yawn'] },
      { species: 91, level: 61, moves: ['icicle-spear', 'rock-blast', 'shell-smash', 'ice-shard'] },
    ],
    ['欢迎。我是四天王的波妮。', '我在雷鸣的冰川上修行了十年，学会的只有一件事：冰从不着急。', '你的热情，能撑到冰融化的那一刻吗？'],
    ['……冰，化了。'],
    ['你的热情是真的。', '最后一位四天王是源治——他的对战，像暴风雨一样。'],
    [{ id: 'hyper-potion', qty: 2 }],
  ),
  elite(
    'league-e4',
    '源治',
    '四天王',
    130,
    [
      { species: 18, level: 60, moves: ['hurricane', 'twister', 'u-turn', 'brave-bird'] },
      { species: 323, level: 60, moves: ['lava-plume', 'earth-power', 'dragon-pulse', 'yawn'] },
      { species: 208, level: 61, moves: ['dragon-tail', 'iron-tail', 'earthquake', 'rock-polish'] },
      { species: 464, level: 61, moves: ['stone-edge', 'earthquake', 'megahorn', 'dragon-tail'] },
      { species: 130, level: 62, moves: ['dragon-dance', 'waterfall', 'earthquake', 'dragon-tail'] },
    ],
    ['我是四天王之首，源治。', '年轻时我驾着暴鲤龙横渡过翠澜的每一片海。', '训练家需要的是什么？——是和宝可梦一起闯过风暴的觉悟！让我看看你的！'],
    ['……了不起。风暴被你闯过去了。'],
    ['去吧。冠军在最后那扇门后面等着你。', '他很强——但你现在也是。'],
    [{ id: 'hyper-potion', qty: 3 }],
  ),
  elite(
    'league-champion',
    '米可利',
    '冠军',
    200,
    [
      { species: 279, level: 62, moves: ['hurricane', 'scald', 'rain-dance', 'u-turn'] },
      { species: 186, level: 62, moves: ['surf', 'ice-beam', 'hypnosis', 'perish-song'] },
      { species: 199, level: 63, moves: ['psychic', 'scald', 'slack-off', 'calm-mind'] },
      { species: 99, level: 63, moves: ['crabhammer', 'x-scissor', 'swords-dance', 'rock-slide'] },
      { species: 121, level: 63, moves: ['hydro-pump', 'psychic', 'thunderbolt', 'recover'] },
      { species: 260, level: 65, moves: ['muddy-water', 'earthquake', 'ice-beam', 'protect'] },
    ],
    [
      '欢迎来到冠军之间。我是翠澜地区的冠军，米可利。',
      '萌芽的晨光、碧潮的古树、雷鸣的雪原、琉璃的海……你一路走来，翠澜的水都看着你。',
      '水能映出一个人的全部。那么——让我看看，你和你的宝可梦，能映出多美的景色！',
    ],
    ['……多么美的对战。', '你，就是新的冠军。'],
    ['恭喜你，新的冠军。', '后面就是名人堂。去吧，让翠澜记住你和伙伴们的名字。'],
    [{ id: 'hyper-potion', qty: 4 }],
  ),
];
