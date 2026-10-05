/**
 * M3-07 ~ M3-10 · 雷鸣群岛城镇 NPC（雷鸣镇 / 晨光镇 / 雪原镇 / 云雀镇 + 特色民居室内）。
 * 道馆馆主与道馆训练家在 M3-15 加入；人物造型为程序化占位（M2-19 决议）。
 */
import type { NpcDef } from '@/systems/npcs';

const PI = Math.PI;

export const THUNDER_NPCS: NpcDef[] = [
  // ———————————————————————————— 雷鸣镇 ————————————————————————————
  {
    id: 'thunder-engineer',
    name: '电工阿伏',
    title: '发电工程师',
    appearance: { look: 'researcher', palette: { jacket: '#e8b73a', hair: '#3a3a40' }, style: { glasses: true } },
    dialog: ['欢迎来到雷鸣镇！这里一年有两百多天打雷。', '镇上每座房子都有避雷针，主避雷塔把雷电存进地下电池——所以我们的路灯从来不缺电。', '不过最近冰川那边的线路老是结冰，真让人头疼。'],
  },
  {
    id: 'thunder-guide',
    name: '道馆向导',
    title: '雷鸣道馆',
    appearance: { look: 'guide', palette: { cap: '#e8b73a', jacket: '#4b4a78' } },
    schedule: [{ from: 0, to: 24, at: { island: 'thunder', position: [-494, 372], yaw: 0 } }],
    dialog: ['这里是雷鸣道馆，用的是电属性宝可梦。', '道馆正在检修电路，馆主说要等线路调好才开放挑战。', '地面属性的招式对电系很有效——不过飞行系可要小心了！'],
  },
  {
    id: 'thunder-villager-1',
    name: '石板奶奶',
    title: '雷鸣镇居民',
    appearance: { look: 'elder', palette: { jacket: '#5f5b70' } },
    schedule: [{ from: 7, to: 19, at: { island: 'thunder', position: [-478, 433], yaw: 0 }, activity: { kind: 'wander', radius: 2 } }],
    dialog: ['我年轻的时候，这座塔还只是一根木杆子。', '打雷的夜里，整座塔会发出蓝光——像在跟天上的雷云说话。'],
  },
  {
    id: 'thunder-kid',
    name: '小闪',
    title: '雷鸣镇的孩子',
    appearance: { look: 'child-m', palette: { cap: '#e8b73a', jacket: '#4b8ac8' }, style: { hat: 'cap' } },
    schedule: [{ from: 8, to: 18, at: { island: 'thunder', position: [-520, 452], yaw: PI / 2 }, activity: { kind: 'wander', radius: 4 } }],
    dialog: ['我在等打雷！', '雷鸣平原上有好多皮卡丘，打雷的时候它们会一起竖起尾巴！'],
  },
  {
    id: 'thunder-sailor',
    name: '老舵',
    title: '雷鸣镇码头',
    appearance: { look: 'sailor', palette: { jacket: '#4b4a78' }, style: { beard: true } },
    schedule: [{ from: 0, to: 24, at: { island: 'thunder', position: [-604, 426], yaw: -PI / 2 } }],
    dialog: ['你是冲浪过来的？胆子不小！', '那两股洋流一南一北，漩涡还会到处乱跑——渡轮是不敢开了。', '往西回碧潮也是一样，记得斜着切过去。'],
  },
  // ———————————————————————————— 晨光镇 ————————————————————————————
  {
    id: 'dawn-miller',
    name: '磨坊主老麦',
    title: '晨光磨坊',
    appearance: { look: 'villager-m', palette: { jacket: '#c8a060' }, style: { apron: true, beard: true } },
    dialog: ['晨光镇的风车，一转就是一百年。', '这里是群岛上最早看见日出的地方——所以叫「晨光」。', '白天和夜里，镇子简直是两个样子。晚上来走走，你就知道了。'],
  },
  {
    id: 'dawn-miller-kid',
    name: '麦穗',
    title: '磨坊主的女儿',
    appearance: { look: 'lass', palette: { jacket: '#e8b73a', hair: '#c8703a' } },
    dialog: ['爸爸说，等我长大就把北边那架风车交给我！', '晨光丘陵上有好多瓢虫宝可梦，白天才会出来。'],
  },
  {
    id: 'dawn-guide',
    name: '道馆向导',
    title: '晨光道馆',
    appearance: { look: 'guide', palette: { cap: '#f0c24a', jacket: '#f0c24a' } },
    schedule: [{ from: 0, to: 24, at: { island: 'thunder', position: [422, 472], yaw: PI } }],
    dialog: ['晨光道馆的馆主正在准备新的机关——据说跟日夜有关。', '道馆暂时不开放，过几天再来吧！'],
  },
  {
    id: 'dawn-farmer',
    name: '阿禾',
    title: '晨光镇农夫',
    appearance: { look: 'camper', palette: { jacket: '#5aa05a', cap: '#c8a060' } },
    schedule: [
      { from: 5, to: 18, at: { island: 'thunder', position: [400, 386], yaw: 0 }, activity: { kind: 'wander', radius: 5 } },
      { from: 18, to: 22, at: { island: 'thunder', position: [455, 424], yaw: PI } },
    ],
    dialog: ['日出而作，日落而息。', '麦子今年长得特别好——风车转得勤，雨水也刚好。'],
  },
  {
    id: 'dawn-villager-1',
    name: '晨晨',
    title: '晨光镇居民',
    appearance: { look: 'villager-f', palette: { jacket: '#e07a8a' } },
    schedule: [{ from: 9, to: 20, at: { island: 'thunder', position: [410, 459], yaw: PI }, activity: { kind: 'wander', radius: 2 } }],
    dialog: ['刚摘的果子，要尝尝吗？……开玩笑的，这是要卖的！', '夜里镇上的路灯和窗户一齐亮起来，可漂亮了。'],
  },
  // ———————————————————————————— 雪原镇 ————————————————————————————
  {
    id: 'snow-igloo-elder',
    name: '冰须爷爷',
    title: '冰屋老人',
    appearance: { look: 'elder', palette: { jacket: '#8a3a2e', hair: '#e8e4dc' }, style: { beard: true, coat: 'long' } },
    dialog: ['进来暖和暖和吧，年轻人。', '冰川底下埋着古代人的遗迹……我年轻时见过它的入口，一整面会发光的冰墙。', '后来冰川动了，入口就被埋住了。'],
  },
  {
    id: 'snow-guide',
    name: '道馆向导',
    title: '雪原道馆',
    appearance: { look: 'guide', palette: { cap: '#9fd2ee', jacket: '#6a8aa0' } },
    schedule: [{ from: 0, to: 24, at: { island: 'thunder', position: [152, -126], yaw: PI } }],
    dialog: ['雪原道馆里的地面全是冰，一滑就停不下来！', '馆主正在重新浇冰面，道馆暂时关闭。'],
  },
  {
    id: 'snow-villager-1',
    name: '阿霜',
    title: '雪原镇居民',
    appearance: { look: 'hiker', palette: { jacket: '#c8402e', hair: '#3a2a1a' } },
    schedule: [{ from: 8, to: 18, at: { island: 'thunder', position: [120, -144], yaw: 0 }, activity: { kind: 'wander', radius: 4 } }],
    dialog: ['滑雪橇最好玩了！从冰川脚下一路滑到镇口！', '不过冰川上面风雪大，没有向导千万别上去。'],
  },
  {
    id: 'snow-kid',
    name: '雪球',
    title: '雪原镇的孩子',
    appearance: { look: 'child-m', palette: { jacket: '#4b8ac8' } },
    schedule: [{ from: 9, to: 17, at: { island: 'thunder', position: [70, -148], yaw: PI }, activity: { kind: 'wander', radius: 3 } }],
    dialog: ['这个雪人是我堆的！', '它的围巾是妈妈的……嘘，别告诉她。'],
  },
  // ———————————————————————————— 云雀镇 ————————————————————————————
  {
    id: 'lark-glider-master',
    name: '翔叔',
    title: '滑翔俱乐部会长',
    appearance: { look: 'hiker', palette: { jacket: '#3f6a9a', hair: '#5a4a3a' }, style: { beard: true } },
    dialog: ['欢迎来到云雀滑翔俱乐部！', '北崖午后的上升气流是全群岛最好的。', '不过想滑翔，得先有一只靠得住的飞行系伙伴——云翎道馆的馆主就是我们的老会员。'],
  },
  {
    id: 'lark-glider-student',
    name: '小羽',
    title: '滑翔学员',
    appearance: { look: 'lass', palette: { jacket: '#4b8ac8', hair: '#3a2a1a' }, style: { hair: 'pony' } },
    dialog: ['我第一次从北崖跳下去的时候，腿都软了！', '可是飞起来之后……整座雷鸣群岛都在脚下！'],
  },
  {
    id: 'lark-guide',
    name: '道馆向导',
    title: '云雀道馆',
    appearance: { look: 'guide', palette: { cap: '#4b8ac8', jacket: '#4b8ac8' } },
    schedule: [{ from: 0, to: 24, at: { island: 'thunder', position: [362, -684], yaw: 0 } }],
    dialog: ['云雀道馆里有好几座风力桥，风一停桥就不动了。', '馆主还在调整风力机，挑战要再等等。'],
  },
  {
    id: 'lark-villager-1',
    name: '风铃婶',
    title: '云雀镇居民',
    appearance: { look: 'villager-f', palette: { jacket: '#5aa05a' }, style: { apron: true } },
    schedule: [{ from: 8, to: 19, at: { island: 'thunder', position: [315, -644], yaw: PI }, activity: { kind: 'wander', radius: 3 } }],
    dialog: ['住在崖顶，什么都缺，就是不缺风。', '每家屋顶的小风车都能发电——风力机管全镇，小风车管自家。'],
  },
  {
    id: 'lark-fisher',
    name: '钓竿爷',
    title: '云雀镇码头',
    appearance: { look: 'sailor', palette: { jacket: '#3f6a9a' } },
    schedule: [{ from: 5, to: 20, at: { island: 'thunder', position: [-150, -700], yaw: PI } }],
    dialog: ['从镇上走崖路下来，可要花上好一阵子。', '再往北就是雷鸣—琉璃海域，海雾大得看不见手——听说里面还有礁石迷宫。'],
  },
];
