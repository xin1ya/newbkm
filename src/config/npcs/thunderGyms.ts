/**
 * M3-15 · 雷鸣群岛四座道馆的向导、馆主与道馆训练家 NPC（室内固定位写在 config/interiors/thunderGyms.ts）。
 * 馆主造型为程序化占位（M3-29 人物模型）。
 */
import type { NpcDef } from '@/systems/npcs';

const guide = (gym: string, quest: string, name: string, cap: string, active: string[], done: string[]): NpcDef => ({
  id: `${gym}-guide`,
  name: '道馆向导',
  title: name,
  appearance: { look: 'guide', palette: { cap, jacket: cap } },
  dialogByQuest: [
    { questId: quest, when: 'active', dialog: active },
    { questId: quest, when: 'completed', dialog: done },
  ],
  dialog: active,
});

export const THUNDER_GYM_NPCS: NpcDef[] = [
  // ———————————————————————— 雷鸣道馆 ————————————————————————
  guide(
    'gym-thunder',
    'main-gym-thunder',
    '雷鸣道馆',
    '#d8a820',
    [
      '嘿，未来的冠军！欢迎来到雷鸣道馆！',
      '雷霆用的是电属性宝可梦。地面属性的招式效果拔群，而且地面系完全不怕电！',
      '馆里的路被电栅栏挡着：入口这根拉杆决定东道、西道哪边断电；中间那条路要东西两根拉杆都接通。',
      '雷鸣群岛的四座道馆可以按任意顺序挑战——你拿到的徽章越多，馆主们的队伍就越认真。',
    ],
    ['电压爆表！雷霆的徽章到手了！', '下一站去哪？晨光镇、雪原镇、云雀镇都行。'],
  ),
  {
    id: 'leiting',
    name: '雷霆',
    title: '雷鸣道馆馆主',
    appearance: { look: 'miner', palette: { jacket: '#f2c230', pants: '#2a2e3a', hair: '#e8d040' }, style: { hair: 'spiky' } },
    trainer: 'gym-thunder-leader',
    dialogByQuest: [{ questId: 'main-gym-thunder', when: 'completed', dialog: ['雷云越来越厚了，最近北边冰川那里也不太平。', '晨光、雪原、云雀——去吧，把雷鸣群岛的徽章都拿齐。'] }],
    dialog: ['雷暴不会等人。'],
  },
  { id: 'gym-thunder-trainer-1', name: '阿伏', title: '电工', appearance: { look: 'miner', palette: { jacket: '#f2c230', cap: '#f2c230' } }, trainer: 'gym-thunder-1', dialog: ['入口那根拉杆管着东西两道的电栅。'] },
  { id: 'gym-thunder-trainer-2', name: '小铜', title: '电工', appearance: { look: 'youngster', palette: { jacket: '#c8a050' } }, trainer: 'gym-thunder-2', dialog: ['最后一道电栅接的是西道这根拉杆。'] },
  { id: 'gym-thunder-trainer-3', name: '雷阿姨', title: '工程师', appearance: { look: 'researcher', palette: { jacket: '#4a5068' }, style: { glasses: true } }, trainer: 'gym-thunder-3', dialog: ['雷丘的「避雷针」会吸走电招。'] },
  // ———————————————————————— 晨光道馆 ————————————————————————
  guide(
    'gym-dawn',
    'main-gym-dawn',
    '晨光道馆',
    '#d8a83a',
    [
      '嘿，未来的冠军！欢迎来到晨光道馆！',
      '晨辉用的是普通属性宝可梦。格斗属性的招式效果拔群；幽灵招式对它们无效，反过来也一样。',
      '回廊里有日光墙和影墙：白天日光墙挡路，夜里影墙挡路。馆里的日晷能拨动昼夜。',
      '进门时馆里的昼夜跟外面的时间一致——白天来和晚上来，走法不一样哦。',
    ],
    ['昼夜都难不倒你！', '晨辉馆主很少笑，刚才她笑了。'],
  ),
  {
    id: 'chenhui',
    name: '晨辉',
    title: '晨光道馆馆主',
    appearance: { look: 'villager-f', palette: { jacket: '#f2d080', pants: '#8a6a3a', hair: '#f2c860' }, style: { coat: 'long' } },
    trainer: 'gym-dawn-leader',
    dialogByQuest: [{ questId: 'main-gym-dawn', when: 'completed', dialog: ['「普之试炼」到此为止。', '去雪原镇的话，记得多穿一件——冰川下面，好像藏着什么。'] }],
    dialog: ['风车在转。'],
  },
  { id: 'gym-dawn-trainer-1', name: '阿昼', title: '晨跑少年', appearance: { look: 'camper', palette: { jacket: '#f2a030' } }, trainer: 'gym-dawn-1', dialog: ['日光墙白天挡路，夜里就散了。'] },
  { id: 'gym-dawn-trainer-2', name: '小夜', title: '观星少女', appearance: { look: 'lass', palette: { jacket: '#5a4a9a' } }, trainer: 'gym-dawn-2', dialog: ['迷路了就回去拨一拨日晷。'] },
  { id: 'gym-dawn-trainer-3', name: '老钟', title: '钟表匠', appearance: { look: 'elder', palette: { jacket: '#8a6a3a' } }, trainer: 'gym-dawn-3', dialog: ['堵拦熊有「毅力」特性。'] },
  // ———————————————————————— 雪原道馆 ————————————————————————
  guide(
    'gym-snow',
    'main-gym-snow',
    '雪原道馆',
    '#4a8ab8',
    [
      '嘿，未来的冠军！欢迎来到雪原道馆！',
      '霜凝用的是冰属性宝可梦。火、格斗、岩石、钢属性的招式效果拔群！',
      '前面是冰晶滑场：踏上冰面就会一直滑，撞上冰块才停。滑到对面的出口，就能见到馆主。',
      '滑错了也没关系，从入口重新来过就行。',
    ],
    ['你滑得比我还稳！', '有了「攀爬」，冰川北边的崖壁就能上去了。'],
  ),
  {
    id: 'shuangning',
    name: '霜凝',
    title: '雪原道馆馆主',
    appearance: { look: 'villager-f', palette: { jacket: '#bfe0f0', pants: '#4a6a8a', hair: '#e8f4fa' }, style: { coat: 'long' } },
    trainer: 'gym-snow-leader',
    dialogByQuest: [{ questId: 'main-gym-snow', when: 'completed', dialog: ['冰川深处有一处古代遗迹，冰层里封着奇怪的蓝色光芒。', '有了「攀爬」，你就能上去看看了。'] }],
    dialog: ['……冷静。'],
  },
  { id: 'gym-snow-trainer-1', name: '阿凛', title: '滑冰选手', appearance: { look: 'swimmer', palette: { jacket: '#6ab0d8' } }, trainer: 'gym-snow-1', dialog: ['撞上哪块冰，就停在哪里。'] },
  { id: 'gym-snow-trainer-2', name: '冰柱', title: '登山家', appearance: { look: 'hiker', palette: { jacket: '#4a6a8a' } }, trainer: 'gym-snow-2', dialog: ['刺甲贝会「破壳」，小心。'] },
  // ———————————————————————— 云雀道馆 ————————————————————————
  guide(
    'gym-lark',
    'main-gym-cloud',
    '云雀道馆',
    '#5a8ad8',
    [
      '嘿，未来的冠军！欢迎来到云雀道馆！',
      '云翎用的是飞行属性宝可梦。电、冰、岩石属性的招式效果拔群！',
      '馆里是三座悬在深谷上的浮台，风扇吹出的气流会托起风桥。入口的大风扇能转向西台或东台。',
      '风桥只在有风的时候才在——过桥前看清楚风向！',
    ],
    ['你驾驭了风！', '雷鸣群岛的徽章齐了的话，去云雀镇码头找钓竿爷吧。'],
  ),
  {
    id: 'yunling',
    name: '云翎',
    title: '云雀道馆馆主',
    appearance: { look: 'sailor', palette: { jacket: '#f2f6ff', pants: '#3a4a6a', hair: '#8ab0e8' } },
    trainer: 'gym-lark-leader',
    dialogByQuest: [{ questId: 'main-gym-cloud', when: 'completed', dialog: ['天上的异象，八成和北边的琉璃群岛有关。', '你若要去，就要穿过那片终年起雾的礁海。'] }],
    dialog: ['风在说话。'],
  },
  { id: 'gym-lark-trainer-1', name: '阿翔', title: '滑翔员', appearance: { look: 'camper', palette: { jacket: '#8ab0e8' } }, trainer: 'gym-lark-1', dialog: ['中台那座风扇，管的是西台过去的桥。'] },
  { id: 'gym-lark-trainer-2', name: '小羽', title: '鸟使', appearance: { look: 'lass', palette: { jacket: '#f2f6ff' } }, trainer: 'gym-lark-2', dialog: ['东台的风扇一开，通往中台的桥就托起来了。'] },
  { id: 'gym-lark-trainer-3', name: '鹰叔', title: '驯鹰人', appearance: { look: 'hiker', palette: { jacket: '#6a5a3a' } }, trainer: 'gym-lark-3', dialog: ['叉字蝠极快，准备好能扛住一击的伙伴。'] },
];
