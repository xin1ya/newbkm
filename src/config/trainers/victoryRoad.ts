/**
 * M3-20 · 冠军之路训练家（室内固定站位，NPC 定义在 config/npcs/victoryRoad.ts）。
 * 等级 51–55：介于第 4 章最后一馆（55 档）与联盟（M3-21）之间；招式按等级自动学会（不写死 moves）。
 */
import type { TrainerDef } from '@/systems/trainers';

const t = (id: string, name: string, title: string, party: TrainerDef['party'], intro: string[], defeat: string[], after: string[], entrance: TrainerDef['entrance'] = 'point'): TrainerDef => ({
  id,
  name,
  title,
  ai: 'smart',
  prizeBase: title === '王牌训练家' || title === '老练训练家' ? 60 : 48,
  sight: { range: 7, fov: 80 },
  party,
  intro,
  defeat,
  after,
  entrance,
});

export const VICTORY_ROAD_TRAINERS: TrainerDef[] = [
  t(
    'vr-ace-1',
    '刚毅',
    '王牌训练家',
    [
      { species: 464, level: 52 },
      { species: 59, level: 51 },
      { species: 130, level: 52 },
    ],
    ['走到这里的人，都是集齐了 11 枚徽章的怪物。', '那就让我看看，你是哪一种怪物！'],
    ['……原来是会咬人的那种。'],
    ['冠军之路分好几层：石柱大厅、巨石大厅、地下暗河，再往上是瀑上岩台。', '别以为徽章够了就万事大吉——没有「怪力」「闪光」「攀瀑」「攀岩」，你连一半都走不到。'],
  ),
  t(
    'vr-ace-2',
    '铃兰',
    '王牌训练家',
    [
      { species: 407, level: 51 },
      { species: 121, level: 52 },
      { species: 637, level: 52 },
    ],
    ['这些石柱之间回声很响——我的宝可梦最喜欢在这里对战。'],
    ['好吧，回声里全是你的名字了。'],
    ['往西北走就是巨石大厅。那里有一道裂谷，只有把石头推进谷口的地洞才能过去。'],
    'wave',
  ),
  t(
    'vr-blackbelt',
    '大山',
    '空手道王',
    [
      { species: 68, level: 52 },
      { species: 67, level: 51 },
      { species: 214, level: 52 },
    ],
    ['喝！我每天都在这里推石头练力气！'],
    ['我的拳头……还是太轻了。'],
    ['推石头要讲顺序。推错一步就卡死在墙角——那就出去再进来，石头会回到原位。'],
    'flex',
  ),
  t(
    'vr-dragon',
    '龙崎',
    '龙使',
    [
      { species: 130, level: 53 },
      { species: 342, level: 52 },
      { species: 95, level: 52 },
    ],
    ['黑暗里看不清我的宝可梦？那正好。'],
    ['连暗河的水声都盖不住你的脚步了。'],
    ['暗河的瀑布直通上一层。听说下游有个老人，一辈子都在研究怎么逆流而上。'],
  ),
  t(
    'vr-psychic',
    '静音',
    '超能力者',
    [
      { species: 199, level: 52 },
      { species: 344, level: 53 },
    ],
    ['我早就感觉到你会来。我还感觉到……你会输。'],
    ['……预知出错了。'],
    ['桥那头的瀑布下面，有个老人在等一个能爬上瀑布的人。'],
    'wave',
  ),
  t(
    'vr-veteran-1',
    '岩翁',
    '老练训练家',
    [
      { species: 76, level: 53 },
      { species: 260, level: 53 },
      { species: 724, level: 54 },
    ],
    ['能逆着瀑布爬上来……你的宝可梦很信任你。'],
    ['好，好！我在这条路上守了十年，就等这样的对手。'],
    ['岩台东边那面裂缝岩壁，爬上去就是山顶洞口。出了洞口，就是联盟高原和彩幽市。'],
    'bow',
  ),
  t(
    'vr-veteran-2',
    '夜岚',
    '老练训练家',
    [
      { species: 94, level: 54 },
      { species: 571, level: 54 },
      { species: 157, level: 55 },
    ],
    ['最后一道关了。联盟的四天王，可比我难缠得多。'],
    ['去吧。山顶的风会为你让路。'],
    ['联盟高原上空的乱流，只有走完冠军之路的人才能穿过去——这是联盟的规矩。'],
    'bow',
  ),
];
