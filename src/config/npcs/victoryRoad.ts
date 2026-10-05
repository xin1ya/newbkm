/**
 * M3-20 · 冠军之路 NPC：南关所守卫 / 护士 / 新人、地下暗河的攀瀑老人、山顶洞口守卫，以及 7 位训练家。
 * 室内固定位写在 config/interiors/victoryRoad.ts。
 */
import type { NpcDef } from '@/systems/npcs';

const Q = 'main-victory-road';

const trainer = (id: string, trainerId: string, name: string, title: string, look: NpcDef['appearance']['look'], jacket: string, dialog: string[]): NpcDef => ({
  id,
  name,
  title,
  appearance: { look, palette: { jacket } },
  trainer: trainerId,
  dialog,
});

export const VICTORY_ROAD_NPCS: NpcDef[] = [
  {
    id: 'vr-gate-guard',
    name: '关所守卫',
    title: '翠澜联盟',
    appearance: { look: 'guard', palette: { jacket: '#2a4a7a', cap: '#2a4a7a' } },
    dialogByQuest: [
      { questId: Q, when: 'completed', dialog: ['你已经走完冠军之路了。联盟高原的乱流，会为你让路。'] },
      { questId: Q, when: 'active', dialog: ['11 枚徽章……确认无误。', '前面就是冠军之路。洞里没有宝可梦中心，补给就在我身后，出发前准备好。'] },
    ],
    dialog: ['这里是冠军之路的南关所。', '只有集齐翠澜四岛全部 11 枚徽章的训练家，才能通过这扇门。'],
  },
  {
    id: 'vr-gate-nurse',
    name: '乔伊',
    title: '联盟护士',
    appearance: { look: 'nurse' },
    service: { kind: 'heal' },
    dialog: ['这里是冠军之路前最后的补给站。', '洞里的野生宝可梦都很强，累了随时回来哦。'],
  },
  {
    id: 'vr-gate-rookie',
    name: '新人训练家 小樱',
    title: '训练家',
    appearance: { look: 'lass', palette: { jacket: '#d86a8a' } },
    dialog: ['我才 3 枚徽章，被守卫拦下来了……', '听说冠军之路里要用到怪力、闪光、攀瀑和攀岩。光有徽章还不够呢。'],
  },
  {
    id: 'vr-falls-master',
    name: '瀑翁',
    title: '攀瀑老人',
    appearance: { look: 'elder', palette: { jacket: '#3f7aa8', hair: '#e8e8e8' } },
    dialogByQuest: [
      { questId: Q, when: 'active', unless: ['hm07-waterfall'], dialog: [], story: 'vr-hm07' },
      { questId: Q, when: 'active', dialog: ['逆流而上的诀窍？别跟水较劲，借它的力。', '站到瀑布前，按一下就上去了。'] },
      { questId: Q, when: 'completed', dialog: ['联盟高原的风，比瀑布还猛。去吧，年轻人。'] },
    ],
    dialog: ['我在这条暗河边住了四十年，看着它从上面一层落下来。'],
  },
  {
    id: 'vr-summit-guard',
    name: '山顶守卫',
    title: '翠澜联盟',
    appearance: { look: 'guard', palette: { jacket: '#2a4a7a', cap: '#2a4a7a' } },
    dialog: ['恭喜你，冠军之路到此为止。', '出了这个洞口就是联盟高原。往北走就是彩幽市——宝可梦联盟就在城市尽头。', '高原上空的乱流已经为你平息了。以后骑宝可梦飞过来也没问题。'],
  },
  trainer('vr-trainer-ace-1', 'vr-ace-1', '刚毅', '王牌训练家', 'camper', '#2a4a7a', ['没有「怪力」「闪光」「攀瀑」「攀岩」，你连一半都走不到。']),
  trainer('vr-trainer-ace-2', 'vr-ace-2', '铃兰', '王牌训练家', 'lass', '#2a4a7a', ['往西北走就是巨石大厅。']),
  trainer('vr-trainer-blackbelt', 'vr-blackbelt', '大山', '空手道王', 'hiker', '#f2f2f2', ['推错了就出去再进来，石头会回到原位。']),
  trainer('vr-trainer-dragon', 'vr-dragon', '龙崎', '龙使', 'camper', '#3a6a5a', ['下游的老人一辈子都在研究怎么逆流而上。']),
  trainer('vr-trainer-psychic', 'vr-psychic', '静音', '超能力者', 'kimono-f', '#7a4a9a', ['桥那头的瀑布下面，有个老人在等你。']),
  trainer('vr-trainer-veteran-1', 'vr-veteran-1', '岩翁', '老练训练家', 'hiker', '#6a5040', ['东边那面裂缝岩壁，爬上去就是山顶洞口。']),
  trainer('vr-trainer-veteran-2', 'vr-veteran-2', '夜岚', '老练训练家', 'villager-f', '#2a2a3a', ['联盟的四天王，可比我难缠得多。']),
];
