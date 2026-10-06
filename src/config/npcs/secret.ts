/**
 * M4-03 · 寐龙镇 NPC（人物造型为程序化占位，M2-19 决议）。
 * 化石学者一组的作息与发掘场（towns/secret.ts）一致：白天坑沿作业、日落后回工棚一带。
 * 道馆馆主「暗」与道馆内 NPC 在 M4-06 加入。
 */
import type { NpcDef } from '@/systems/npcs';

const PI = Math.PI;

export const SECRET_NPCS: NpcDef[] = [
  {
    id: 'dragon-keeper',
    name: '守龙老人·岩生',
    title: '寐龙镇长老',
    appearance: { look: 'elder', palette: { jacket: '#6e5f4a' } },
    schedule: [
      { from: 6, to: 18, at: { island: 'secret', position: [5.6, 212], yaw: -PI / 2 }, activity: { kind: 'wander', radius: 2 } },
      { from: 18, to: 6, at: { interior: 'dragon-keeper-house', room: 'main', position: [3.6, 2.2], yaw: PI } },
    ],
    dialog: ['脚下这条街，是从一条龙的身上长出来的。', '三百年前山洪冲开谷底，这具东西就躺在那儿——老人说它是下凡迷路的龙，睡着了，别吵它。', '学者们挖了几十年，只说它是「古生物」。随他们说。夜里骨缝里起风的声音，像不像呼吸？', '北口那座石头厅子是龙渊道馆。馆主「暗」……比挖了一辈子的我们还懂这具骨头。'],
  },
  {
    id: 'dragon-scholar',
    name: '化石学者·拾骨',
    title: '龙骨发掘队',
    appearance: { look: 'researcher', palette: { jacket: '#b9a887', hair: '#3a3230' }, style: { hat: 'bandana' } },
    schedule: [
      { from: 7, to: 17, at: { island: 'secret', position: [20, 240], yaw: PI / 2 }, activity: { kind: 'wander', radius: 5 } },
      { from: 17, to: 7, at: { island: 'secret', position: [38, 236], yaw: -PI / 2 } },
    ],
    dialog: ['第 214 根肋骨，编号 R-214……别踩编号桩，谢谢！', '这不可能是任何已登记物种。单根肋骨比镇上最粗的梁还长。', '碳测定说它死了三千万年。可你把手贴在头骨上——温的。我发誓是温的。', '老人不许我们拆下颅顶。说实话，我也舍不得。'],
  },
  {
    id: 'dragon-assistant',
    name: '发掘队助手·量量',
    title: '龙骨发掘队',
    appearance: { look: 'aide', palette: { jacket: '#d8a030', cap: '#8a6a3a' }, style: { hat: 'cap' } },
    schedule: [{ from: 7, to: 19, at: { island: 'secret', position: [30, 258], yaw: 0 }, activity: { kind: 'wander', radius: 4 } }],
    dialog: ['我在给脊椎画测绘图！画完整条 spine 就能正式立项了！', '坑沿南边那个豁口是参观通道，可以从肋骨的缝里穿过去——里面能看到整片「屋顶」。'],
  },
  {
    id: 'dragon-kid',
    name: '阿骨',
    title: '寐龙镇的孩子',
    appearance: { look: 'child-m', palette: { cap: '#8fa8c8', jacket: '#c8784a' }, style: { hat: 'cap' } },
    schedule: [{ from: 8, to: 18, at: { island: 'secret', position: [14, 247], yaw: -PI / 2 }, activity: { kind: 'wander', radius: 6 } }],
    dialog: ['我们在龙骨头底下玩捉迷藏！牙齿后面超级隐蔽！', '爷爷说谁找到龙的心脏，龙就会醒过来送我一只宝宝。', '哼，化石怎么会有心脏。……不过，昨晚骨堆那边确实有光。'],
  },
  {
    id: 'dragon-trader',
    name: '山道商人·背锅',
    title: '旅商',
    appearance: { look: 'vendor', palette: { jacket: '#7a6f5a' } },
    schedule: [{ from: 9, to: 18, at: { island: 'secret', position: [-11, 244], yaw: PI / 2 } }],
    dialog: ['翻过北口就是峡谷，往上是冰原——补给买齐再走，谷底夜里会起雾。', '镇上没什么稀罕货，就一样：骨粉护符。老人们说戴着它睡，梦会干净。', '往北再往西，台地上立着个祭坛。别在夜里靠近，那是给「东西」留的位置。'],
  },
];
