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
    appearance: { look: 'engineer' },
    dialogByQuest: [
      { questId: 'side-crystal-treasure', when: 'completed', dialog: ['有了雷晶，冰川那边的线路一次都没断过！', '雷鸣镇的路灯，今晚也照常亮着。'] },
      { questId: 'side-crystal-treasure', when: 'active', requires: ['crystal-core-taken'], setFlags: ['crystal-treasure-done'], dialog: ['这就是雷晶？！电光这么稳……太完美了！', '把它装进变电箱，冰川线路再也不会冻断了。', '这几块属性石是我攒的，就当谢礼吧！'] },
      { questId: 'side-crystal-treasure', when: 'active', dialog: ['晶石洞窟在镇子北边的高原上。', '晶石栅栏要用怪力把石头推到压力板上才会沉下去。', '雷晶就在最深处的晶核外层——小心，晶簇里常有电系宝可梦。'] },
      {
        questId: 'side-crystal-treasure',
        when: 'available',
        setFlags: ['crystal-treasure-start'],
        dialog: ['你是训练家吧？能帮个忙吗！', '通往冰川的输电线老是冻断，普通的电池扛不住那种冷。', '晶石洞窟深处的晶核外层有一种「雷晶」，能自己发电、不怕冻。', '我这把老骨头推不动洞里的石头……拜托你了！'],
      },
    ],
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
    dialogByQuest: [
      { questId: 'side-cloud-mail', when: 'active', unless: ['mail-dawn-miller'], setFlags: ['mail-dawn-miller'], dialog: ['信？给我的？……是云雀镇的女儿寄来的！', '「爸爸，风车别修到半夜。」哈哈，这丫头。', '谢谢你，年轻人。'] },
    ],
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
  // ———————————— M3-26 · 支线 NPC ————————————
  {
    id: 'storm-researcher',
    name: '观测员 霁',
    title: '雷云观测站',
    appearance: { look: 'researcher', palette: { jacket: '#5a7a9a', hair: '#2a2a30' }, style: { glasses: true } },
    schedule: [{ from: 0, to: 24, at: { island: 'thunder', position: [-322, -140], yaw: Math.PI / 2 } }],
    dialogByQuest: [
      { questId: 'side-thunder-observation', when: 'completed', dialog: ['三组数据对上了：雷云的放电节奏，和晶石洞窟的晶核完全同步。', '……还有冰川、天上的光。整个雷鸣群岛像是被同一颗心脏牵着。'] },
      {
        questId: 'side-thunder-observation',
        when: 'active',
        requires: ['storm-sample-1', 'storm-sample-2', 'storm-sample-3'],
        setFlags: ['thunder-observation-done'],
        dialog: ['三组都记下来了？我看看……', '果然！雷云不是乱打的，每次放电间隔都是一模一样的 7 秒。', '这几块雷之石是观测站的样本，送你了。谢谢！'],
      },
      { questId: 'side-thunder-observation', when: 'active', dialog: ['采样点在高原上闪着光的地方，一共三处。', '雷暴天也不用怕，采样仪是绝缘的。'] },
      {
        questId: 'side-thunder-observation',
        when: 'available',
        setFlags: ['thunder-observation-start'],
        dialog: ['啊，正好！我一个人跑不过来。', '这几个月雷暴高原的雷云很反常——总在同几个地方打雷。', '这是采样仪。帮我在高原上 3 个采样点各记录一次数据，好吗？'],
      },
    ],
    dialog: ['雷云观测站。屋顶的风速计又在疯转了。'],
  },
  {
    id: 'snow-sculptor',
    name: '冰雕师傅 凌叔',
    title: '雪原冰雕节',
    appearance: { look: 'elder', palette: { jacket: '#4a8ac8', hair: '#e8e8f0' } },
    schedule: [{ from: 0, to: 24, at: { island: 'thunder', position: [146, -196], yaw: 0 } }],
    dialogByQuest: [
      { questId: 'side-ice-sculpture', when: 'completed', dialog: ['你那座冰雕还摆在广场上，天天有人排队拍照！', '明年还来啊，卫冕冠军。'] },
      { questId: 'side-ice-sculpture', when: 'active', requires: ['ice-block-got'], dialog: [], story: 'ice-sculpture' },
      { questId: 'side-ice-sculpture', when: 'active', dialog: ['冰湖就在西北边，湖边冰面裂开的地方最透。', '撬一块回来，咱们就开雕！'] },
      {
        questId: 'side-ice-sculpture',
        when: 'available',
        setFlags: ['ice-sculpture-start'],
        dialog: ['冰雕节报名喽！外乡的训练家也欢迎！', '规矩很简单：自己去冰湖撬一块透明冰，用宝可梦的冰系招式雕。', '冰湖在镇子西北，冰川脚下。去吧！'],
      },
    ],
    dialog: ['雪原镇的冰雕节，一年就这么一回。'],
  },
  {
    id: 'lark-courier',
    name: '信鸽站 羽姐',
    title: '云雀镇信鸽站',
    appearance: { look: 'villager-f', palette: { jacket: '#e8c86a', hair: '#6a4a3a' } },
    schedule: [{ from: 0, to: 24, at: { island: 'thunder', position: [282, -640], yaw: Math.PI } }],
    dialogByQuest: [
      { questId: 'side-cloud-mail', when: 'completed', dialog: ['信鸽站的招牌，都快被你抢走啦！', '以后有急件，还找你。'] },
      {
        questId: 'side-cloud-mail',
        when: 'active',
        requires: ['mail-magnolia', 'mail-inn-owner', 'mail-dawn-miller'],
        setFlags: ['cloud-mail-done'],
        dialog: ['三封都送到了？一天跑三座岛，比信鸽还快！', '这是跑腿费，还有一颗「经验糖果L」和这块「飞之石」——云海那边捎来的，轻得像云。'],
      },
      { questId: 'side-cloud-mail', when: 'active', dialog: ['萌芽的木兰博士、温泉乡的汤老板、晨光镇的磨坊主。', '按 B 键就能飞，别迷路哦！'] },
      {
        questId: 'side-cloud-mail',
        when: 'available',
        setFlags: ['cloud-mail-start'],
        dialog: ['你有会飞的宝可梦？太好了！', '风季来了，信鸽一只只都被吹回窝里，信堆成了山。', '这三封最急——萌芽、碧潮、晨光镇各一封。拜托啦！'],
      },
    ],
    dialog: ['云雀镇信鸽站。风再大，信也要送到。'],
  },
];
