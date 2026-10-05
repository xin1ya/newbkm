/**
 * M3-11 ~ M3-14 · 琉璃群岛城镇 NPC。道馆馆主与道馆训练家在 M3-16 加入；人物造型为程序化占位（M2-19 决议）。
 * 幻影镇的摊主日程与 towns/glaze.ts 的 MIRAGE_HOURS 一致：白日市集 7–18 时、月夜集市 19–3 时。
 */
import type { NpcDef } from '@/systems/npcs';
import { MIRAGE_HOURS } from '@/config/islands/towns/glaze';

const PI = Math.PI;
const [B0, B1] = MIRAGE_HOURS.bazaar;
const [N0, N1] = MIRAGE_HOURS.nightMarket;

export const GLAZE_NPCS: NpcDef[] = [
  // ———————————————————————————— 幻影镇 ————————————————————————————
  {
    id: 'mirage-guide',
    name: '道馆向导',
    title: '幻影道馆',
    appearance: { look: 'guide', palette: { cap: '#7a4a9a', jacket: '#7a4a9a' } },
    schedule: [{ from: 0, to: 24, at: { island: 'glaze', position: [-388, 404], yaw: 0 } }],
    dialog: ['这里是幻影道馆，馆主幻月用的是超能力属性的宝可梦。', '馆里到处是传送镜——走错一步就会被送回门口。', '恶属性和虫属性的招式对超能系很有效，记住了！'],
  },
  {
    id: 'mirage-scholar',
    name: '蜃学者沙洛',
    title: '海市蜃楼研究者',
    appearance: { look: 'researcher', palette: { jacket: '#efe2c8', hair: '#5a4a3a' }, style: { glasses: true } },
    schedule: [
      { from: 6, to: 18, at: { island: 'glaze', position: [-252, 466], yaw: PI / 2 }, activity: { kind: 'wander', radius: 2 } },
      { from: 18, to: 6, at: { island: 'glaze', position: [-470, 498], yaw: -PI / 2 }, activity: { kind: 'wander', radius: 2 } },
    ],
    dialog: ['幻影镇的房子……不是每一栋都一直在。', '上午十点到下午四点，东边沙丘上会浮现一座宫殿和两座高塔。走过去的话，你会直接穿过去。', '而到了晚上八点，镇西口外会出现月影塔——那座塔是摸得着的！天一亮就消失得无影无踪。', '我研究了二十年，还是不知道哪边才是「真的」。'],
  },
  {
    id: 'mirage-bazaar-fruit',
    name: '椰枣大叔',
    title: '白日市集',
    appearance: { look: 'vendor', palette: { jacket: '#d86a4a' } },
    schedule: [{ from: B0, to: B1, at: { island: 'glaze', position: [-402, 428], yaw: PI / 2 } }],
    dialog: ['新鲜的椰枣、仙人掌果！', '天一黑我们就收摊——这片广场到了晚上可是空荡荡的，连摊子都看不见。'],
  },
  {
    id: 'mirage-bazaar-potter',
    name: '陶罐婆婆',
    title: '白日市集',
    appearance: { look: 'elder', palette: { jacket: '#3f8aa8' } },
    schedule: [{ from: B0, to: B1, at: { island: 'glaze', position: [-358, 428], yaw: -PI / 2 } }],
    dialog: ['这些陶罐是用蜃景沙丘的沙子烧的。', '对着罐口说话，过一会儿会听到回声……有时候回声说的话跟你说的不一样。'],
  },
  {
    id: 'mirage-night-vendor',
    name: '月灯姑娘',
    title: '月夜集市',
    appearance: { look: 'kimono-f', palette: { jacket: '#4b4a78', hair: '#2a2a3a' } },
    schedule: [{ from: N0, to: N1, at: { island: 'glaze', position: [-397, 500], yaw: PI / 2 } }],
    dialog: ['欢迎来到月夜集市～', '这个集市只在月亮出来的时候开张，天亮之前就会散。', '白天来找我？那你只会看到一条空荡荡的码头路哦。'],
  },
  {
    id: 'mirage-night-charm',
    name: '护符商人',
    title: '月夜集市',
    appearance: { look: 'villager-m', palette: { jacket: '#5b4a78' } },
    schedule: [{ from: N0, to: N1, at: { island: 'glaze', position: [-363, 512], yaw: -PI / 2 } }],
    dialog: ['看看这些护符吧，都是在月影塔下开过光的。', '月影塔？晚上八点以后去镇西口外看看就知道了。'],
  },
  {
    id: 'mirage-villager-1',
    name: '纱丽阿姨',
    title: '幻影镇居民',
    appearance: { look: 'villager-f', palette: { jacket: '#3f7a8a' }, style: { apron: true } },
    schedule: [{ from: 7, to: 20, at: { island: 'glaze', position: [-440, 452], yaw: 0 }, activity: { kind: 'wander', radius: 3 } }],
    dialog: ['我们镇上的房子都刷成白色，屋顶是青色的玻璃穹顶。', '太阳最毒的时候，整座镇子都在热浪里晃——分不清哪栋是真的。'],
  },
  {
    id: 'mirage-kid',
    name: '小蜃',
    title: '幻影镇的孩子',
    appearance: { look: 'child-f', palette: { jacket: '#7fd6d8' } },
    schedule: [{ from: 9, to: 18, at: { island: 'glaze', position: [-374, 474], yaw: PI }, activity: { kind: 'wander', radius: 4 } }],
    dialog: ['我昨天跑进蜃楼宫里面了！', '……可是里面什么都没有，只有沙子。妈妈说那是「海市蜃楼」。'],
  },
  {
    id: 'mirage-fisher',
    name: '老船夫',
    title: '幻影镇码头',
    appearance: { look: 'sailor', palette: { jacket: '#3f6a9a' } },
    schedule: [{ from: 5, to: 21, at: { island: 'glaze', position: [-380, 576], yaw: 0 } }],
    dialog: ['你是从雷鸣那边穿过礁石迷宫过来的？了不起！', '迷宫里认准红绿浮标，缺口就在两只浮标中间。', '回去的话，一路往南冲浪就行。'],
  },
  // ——— 先知之家 ———
  {
    id: 'mirage-seer',
    name: '先知娜芙',
    title: '幻影镇的先知',
    appearance: { look: 'kimono-f', palette: { jacket: '#7a4a9a', hair: '#e8e2ff' } },
    dialog: ['……我等你很久了，从雷鸣来的训练家。', '水晶球里映出三段预言：「白昼之宫」「月下之塔」「海底之门」。', '前两段就在这座镇子里。最后一段……要等琉璃之海告诉你。'],
  },
  {
    id: 'mirage-seer-apprentice',
    name: '学徒小望',
    title: '先知的学徒',
    appearance: { look: 'youngster', palette: { jacket: '#3f7a8a' } },
    dialog: ['师父说预言石柱上的符文会在夜里发光。', '我抄了好几个晚上，还是看不懂……'],
  },
];
