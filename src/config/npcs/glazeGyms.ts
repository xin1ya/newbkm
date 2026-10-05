/**
 * M3-16 · 琉璃群岛三座道馆的向导、馆主与道馆训练家 NPC（室内固定位写在 config/interiors/glazeGyms.ts）。
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

export const GLAZE_GYM_NPCS: NpcDef[] = [
  // ———————————————————————— 幻影道馆 ————————————————————————
  guide(
    'gym-mirage',
    'main-gym-mirage',
    '幻影道馆',
    '#9a5ab8',
    [
      '嘿，未来的冠军！欢迎来到幻影道馆！',
      '幻月用的是超能力属性宝可梦。虫、幽灵、恶属性的招式效果拔群；恶属性完全不怕超能力招式。',
      '馆里没有一扇门——六间镜厅只能靠镜子来往。走错了镜子，就会被送回大厅。',
      '有一颗念力水晶球会转动镜子的去向。哪面镜子跟着它转，要靠你自己观察。',
    ],
    ['镜子里的路都被你看穿了！', '幻月馆主说，你的倒影很清楚。'],
  ),
  {
    id: 'huanyue',
    name: '幻月',
    title: '幻影道馆馆主',
    appearance: { look: 'leader-psychic' },
    trainer: 'gym-mirage-leader',
    dialogByQuest: [{ questId: 'main-gym-mirage', when: 'completed', dialog: ['镜子不会骗人，骗人的是看镜子的人。', '去幽魄的墓厅吧，那里比这里更暗。'] }],
    dialog: ['雾里的东西，未必是真的。'],
  },
  { id: 'gym-mirage-trainer-1', name: '镜子', title: '超能力者', appearance: { look: 'lass', palette: { jacket: '#9a5ab8' } }, trainer: 'gym-mirage-1', dialog: ['中厅里那颗水晶球会转动镜子的去向。'] },
  { id: 'gym-mirage-trainer-2', name: '阿映', title: '超能力者', appearance: { look: 'youngster', palette: { jacket: '#5a6ab8' } }, trainer: 'gym-mirage-2', dialog: ['终点镜只有在金光时才认路。'] },
  { id: 'gym-mirage-trainer-3', name: '紫菀', title: '占卜师', appearance: { look: 'elder', palette: { jacket: '#6a3a8a' } }, trainer: 'gym-mirage-3', dialog: ['宝石海星很快。'] },
  // ———————————————————————— 幽冥道馆 ————————————————————————
  guide(
    'gym-ghost',
    'main-gym-ghost',
    '幽冥道馆',
    '#5a4a8a',
    [
      '……欢迎来到幽冥道馆。小声点。',
      '幽魄用的是幽灵属性宝可梦。幽灵和恶属性的招式效果拔群；普通和格斗招式打不中它们。',
      '墓厅里很暗，灵火墙只在对应的灯光照到时才会退散。入口的烛台能轮流照亮西翼、东翼和中廊。',
      '两翼各有一盏长明灯，点亮了就会一直亮着。灯光要组合起来用。',
    ],
    ['……你把每一盏灯都点对了。', '幽魄馆主难得开口夸人。'],
  ),
  {
    id: 'youpo',
    name: '幽魄',
    title: '幽冥道馆馆主',
    appearance: { look: 'leader-ghost' },
    trainer: 'gym-ghost-leader',
    dialogByQuest: [{ questId: 'main-gym-ghost', when: 'completed', dialog: ['神殿的门要从海底打开。', '琉璃镇的琉璃馆主，也许知道潜水的办法。'] }],
    dialog: ['……灯火不灭。'],
  },
  { id: 'gym-ghost-trainer-1', name: '阿烛', title: '守墓人', appearance: { look: 'villager-m', palette: { jacket: '#3a3a4a' } }, trainer: 'gym-ghost-1', dialog: ['西翼的长明灯点亮后会一直亮着。'] },
  { id: 'gym-ghost-trainer-2', name: '小幽', title: '灵媒', appearance: { look: 'villager-f', palette: { jacket: '#4a3a6a' } }, trainer: 'gym-ghost-2', dialog: ['最后一道灵火怕东翼的长明灯。'] },
  { id: 'gym-ghost-trainer-3', name: '墨夜', title: '灵媒', appearance: { look: 'lass', palette: { jacket: '#2a2440' } }, trainer: 'gym-ghost-3', dialog: ['小心耿鬼的催眠术。'] },
  // ———————————————————————— 琉璃道馆 ————————————————————————
  guide(
    'gym-glaze',
    'main-gym-lily',
    '琉璃道馆',
    '#2a8a9a',
    [
      '嘿，未来的冠军！欢迎来到琉璃道馆！',
      '琉璃用的是水属性宝可梦。电和草属性的招式效果拔群。',
      '玻璃穹顶下是一整池水：石岛上的阀门会把全池的水位升高或放低。',
      '高水位时木筏浮起，低水位时栈道露出——这一池比翠澜道馆那池难得多，至少要转四次阀门。',
    ],
    ['水位都难不倒你！', '琉璃馆主说，你的心像玻璃一样透亮。'],
  ),
  {
    id: 'liuli',
    name: '琉璃',
    title: '琉璃道馆馆主',
    appearance: { look: 'leader-glaze' },
    trainer: 'gym-glaze-leader',
    dialogByQuest: [{ questId: 'main-gym-lily', when: 'completed', dialog: ['海底神殿的大门，就在镇子东边的海里。', '等你学会了潜水，就去看看吧。'] }],
    dialog: ['琉璃要经过火，再沉进冷水。'],
  },
  { id: 'gym-glaze-trainer-1', name: '阿澜', title: '泳者', appearance: { look: 'youngster', palette: { jacket: '#3a9ad8' } }, trainer: 'gym-glaze-1', dialog: ['每座石岛上都有阀门。'] },
  { id: 'gym-glaze-trainer-2', name: '小汐', title: '泳者', appearance: { look: 'lass', palette: { jacket: '#5fc0d0' } }, trainer: 'gym-glaze-2', dialog: ['坐木筏南下要先把水位放高。'] },
  { id: 'gym-glaze-trainer-3', name: '浪花', title: '潜水员', appearance: { look: 'camper', palette: { jacket: '#1a5a8a' } }, trainer: 'gym-glaze-3', dialog: ['蚊香蛙皇会招来雨天。'] },
];
