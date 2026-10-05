/**
 * M3-23 · 洞窟 / 塔 NPC：向导 / 工人 / 学者，以及 11 位训练家（站位写在 config/interiors/dungeons.ts）。
 */
import type { NpcDef } from '@/systems/npcs';

const trainer = (id: string, trainerId: string, name: string, title: string, look: NpcDef['appearance']['look'], jacket: string, dialog: string[]): NpcDef => ({
  id,
  name,
  title,
  appearance: { look, palette: { jacket } },
  trainer: trainerId,
  dialog,
});

export const DUNGEON_NPCS: NpcDef[] = [
  {
    id: 'cc-miner',
    name: '矿工 老铁',
    title: '晶石矿工',
    appearance: { look: 'miner', palette: { jacket: '#c8a040' } },
    dialog: [
      '晶石洞窟的石头一敲就冒火花，矿工都管它叫「雷晶」。',
      '洞壁边那些带裂纹的小岩石，用「碎岩」撞开，常能捡到硬矿石，运气好还有雷之石。',
      '回廊那头的晶石栅栏？两块发光石板都压上巨石，它自己就沉下去了。',
    ],
  },
  {
    id: 'lh-repairman',
    name: '修塔工 阿钟',
    title: '灯塔修复队',
    appearance: { look: 'miner', palette: { jacket: '#3a6aa8' } },
    dialog: [
      '古灯塔修了三年，到现在还没修好。',
      '一到晚上，楼上就有人走动的声音——可上面明明没人！',
      '二楼的窗户被我们钉死了，黑得什么都看不见，上去记得带会「闪光」的宝可梦。',
    ],
  },
  {
    id: 'gr-scholar',
    name: '考古学者 白桦',
    title: '雷鸣大学',
    appearance: { look: 'researcher', palette: { jacket: '#e8eef4' } },
    dialogByQuest: [
      {
        questId: 'main-snow-ruins',
        when: 'active',
        dialog: ['你也是来看圣坛的？最里面的圣坛被一整块寒冰封着，冰里有蓝光。', '石碑上写着「携异变之晶者至此，圣坛之冰自会消融」——你身上那几块碎片，说不定就是钥匙。', '石碑之间的冰裂缝要用「怪力」推石头填平，推错了就出去再进来。'],
      },
      { questId: 'main-snow-ruins', when: 'completed', dialog: ['蓝色的碎片……天降异光，碎为数晶。', '赤、橙、紫、蓝，加上石碑说的，应该一共七块。剩下的，恐怕在更北的琉璃群岛。'] },
    ],
    dialog: [
      '冰川遗迹是古代人为「冰之试炼」修建的神殿。',
      '前厅东边的侧室被冰封住了，听说里面放着当年的祭具。会「碎岩」的话可以撞开冰块。',
      '再往里是石碑之间，地上有道冰裂缝，要用「怪力」推石头填平才能过去。',
    ],
  },
  {
    id: 'sc-guide',
    name: '守洞人 墨婆',
    title: '幽冥镇',
    appearance: { look: 'elder', palette: { jacket: '#4a3a5a', hair: '#d8d8e0' } },
    dialog: [
      '这里是暗影洞窟。幽冥镇的人，世世代代守着洞口。',
      '里面的宝可梦又强又凶，没走完冠军之路那样的本事，最好别往深处去。',
      '迷廊里没有一丝光，要靠「闪光」；岩壁缺口被巨石和碎石堵着，要「怪力」和「碎岩」。',
    ],
  },
  trainer('cc-trainer-hiker', 'cc-hiker', '石垣', '登山男', 'hiker', '#8a6a40', ['晶石栅栏要用压力板打开。']),
  trainer('cc-trainer-researcher', 'cc-researcher', '晶川', '研究员', 'researcher', '#e8eef4', ['晶核的放电越来越乱了。']),
  trainer('lh-trainer-channeler-1', 'lh-channeler-1', '阿雾', '灵媒', 'kimono-f', '#6a5a8a', ['楼梯上的落石，要用「碎岩」撞开。']),
  trainer('lh-trainer-sailor', 'lh-sailor', '海生', '水手', 'sailor', '#2a4a7a', ['灯塔不亮，船就不敢夜航。']),
  trainer('lh-trainer-channeler-2', 'lh-channeler-2', '阿烛', '灵媒', 'kimono-f', '#4a6a5a', ['灯会再亮的，等对的人来。']),
  trainer('gr-trainer-hiker', 'gr-hiker', '雪岩', '登山男', 'hiker', '#4a7aa8', ['把巨石推进冰裂缝的缺口里。']),
  trainer('gr-trainer-researcher', 'gr-researcher', '冬青', '研究员', 'researcher', '#d8e8f4', ['圣坛的冰，要等异变之晶来融化。']),
  trainer('sc-trainer-ace', 'sc-ace', '玄夜', '王牌训练家', 'camper', '#2a2a3a', ['没有「闪光」就别进迷廊。']),
  trainer('sc-trainer-channeler', 'sc-channeler', '幽兰', '灵媒', 'kimono-f', '#3a2a4a', ['影子会跟着人走。']),
  trainer('sc-trainer-veteran', 'sc-veteran', '岩鸦', '老练训练家', 'hiker', '#3a3440', ['十年还不够啊。']),
  trainer('sc-trainer-hex', 'sc-hex', '夜铃', '灵媒', 'kimono-f', '#5a2a6a', ['祭坛在低吟。']),
];
