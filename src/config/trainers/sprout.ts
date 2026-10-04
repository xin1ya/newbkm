/**
 * M1-10 · 萌芽群岛训练家（道馆训练家见 M1-11）。
 * 等级跟随区域：萌芽草原 3–5、翠澜湖畔 7–9、幻影之森 8–9、港湾崖道 11–12、港湾市 10–11。
 * 视线：站在路边面朝道路；fov 为全角。sight.range = 0 的只接受对话挑战。
 */
import type { TrainerDef } from '@/systems/trainers';
import type { NpcDef } from '@/systems/npcs';

const PI = Math.PI;

export interface TrainerPlacement {
  def: TrainerDef;
  npc: Omit<NpcDef, 'id' | 'name' | 'title' | 'trainer' | 'dialog'>;
}

export const SPROUT_TRAINERS: TrainerPlacement[] = [
  {
    def: {
      id: 'youngster-jian',
      name: '阿健',
      title: '短裤小子',
      ai: 'basic',
      prizeBase: 16,
      sight: { range: 11, fov: 70 },
      party: [
        { species: 19, level: 4 },
        { species: 16, level: 4 },
      ],
      intro: ['喂！眼神对上了就要对战，这是训练家的规矩！'],
      defeat: ['呜哇，我的小拉达……'],
      after: ['短裤是最好的装备！又凉快又好跑！', '下次我一定会赢的。'],
      entrance: 'point',
    },
    npc: {
      appearance: { look: 'youngster' },
      schedule: [{ from: 0, to: 24, at: { island: 'sprout', position: [-54, 214], yaw: PI / 2 } }],
      showIf: ['starter-chosen'],
    },
  },
  {
    def: {
      id: 'bugcatcher-sen',
      name: '小森',
      title: '捕虫少年',
      ai: 'random',
      prizeBase: 16,
      sight: { range: 9, fov: 60 },
      party: [
        { species: 10, level: 3 },
        { species: 10, level: 4 },
        { species: 11, level: 5 },
      ],
      intro: ['我的虫子大军准备好了！看招！'],
      defeat: ['虫虫们还要再长大一点……'],
      after: ['绿毛虫会变成铁甲蛹，然后是巴大蝶！', '蜕变的那一刻超级感人的。'],
      entrance: 'wave',
    },
    npc: {
      appearance: { look: 'bug-catcher' },
      schedule: [{ from: 6, to: 20, at: { island: 'sprout', position: [-4, 146], yaw: -PI / 2 } }],
      activity: { kind: 'turn', yaws: [-PI / 2, PI, -PI / 2, 0], every: 2.6 },
      showIf: ['starter-chosen'],
    },
  },
  {
    def: {
      id: 'lass-huayin',
      name: '花音',
      title: '迷你裙',
      ai: 'basic',
      prizeBase: 20,
      sight: { range: 10, fov: 70 },
      party: [
        { species: 43, level: 7 },
        { species: 25, level: 8 },
      ],
      intro: ['你好呀～来和我的可爱宝可梦比一场吧！'],
      defeat: ['哎呀，输掉了……不过好开心！'],
      after: ['湖边的花开得真好。', '走路草晚上会到处走来走去哦。'],
      entrance: 'wave',
    },
    npc: {
      appearance: { look: 'lass' },
      schedule: [{ from: 0, to: 24, at: { island: 'sprout', position: [128, 129], yaw: PI } }],
      showIf: ['starter-chosen'],
    },
  },
  {
    def: {
      id: 'fisher-sun',
      name: '老孙',
      title: '钓鱼人',
      ai: 'basic',
      prizeBase: 24,
      sight: { range: 8, fov: 80 },
      party: [
        { species: 129, level: 8 },
        { species: 60, level: 9 },
        { species: 98, level: 9 },
      ],
      intro: ['嘘——鱼都被你吓跑了！', '赔我一场对战吧！'],
      defeat: ['今天真不是钓鱼的好日子。'],
      after: ['鲤鱼王别看它现在这样，将来可是会变成大家伙的。', '耐心，钓鱼和训练宝可梦都要耐心。'],
      entrance: 'flex',
    },
    npc: {
      appearance: { look: 'fisher' },
      schedule: [{ from: 5, to: 21, at: { island: 'sprout', position: [44, 70], yaw: PI * 0.75 } }],
      activity: { kind: 'turn', yaws: [PI * 0.75, -PI / 2, PI * 0.75, PI / 4], every: 3.2 },
      showIf: ['starter-chosen'],
    },
  },
  {
    def: {
      id: 'camper-ye',
      name: '小叶',
      title: '露营少女',
      ai: 'basic',
      prizeBase: 20,
      sight: { range: 10, fov: 64 },
      party: [
        { species: 172, level: 8 },
        { species: 60, level: 9 },
      ],
      intro: ['森林里的雾越来越浓了……', '先热热身吧，和我对战！'],
      defeat: ['你的宝可梦好可靠啊。'],
      after: ['听说雾里有会变身的宝可梦，把人骗得团团转。', '你要进森林的话，小心别迷路。'],
      entrance: 'wave',
    },
    npc: {
      appearance: { look: 'camper' },
      schedule: [{ from: 0, to: 24, at: { island: 'sprout', position: [-192, -52], yaw: PI / 2 } }],
      showIf: ['starter-chosen'],
    },
  },
  {
    def: {
      id: 'hiker-dashi',
      name: '大石',
      title: '登山男',
      ai: 'smart',
      prizeBase: 32,
      sight: { range: 12, fov: 60 },
      party: [
        { species: 17, level: 11 },
        { species: 20, level: 12 },
      ],
      intro: ['哈哈哈！年轻人，这条崖道可不好走！', '先过我这一关！'],
      defeat: ['好！有骨气！'],
      after: ['崖下面有个洞穴，被石头堵住了。', '要是有能撞碎岩石的骑乘宝可梦就好了。'],
      entrance: 'flex',
    },
    npc: {
      appearance: { look: 'hiker' },
      schedule: [{ from: 0, to: 24, at: { island: 'sprout', position: [339, -196], yaw: PI } }],
      showIf: ['starter-chosen'],
    },
  },
  {
    def: {
      id: 'sailor-hai',
      name: '阿海',
      title: '水手',
      ai: 'smart',
      prizeBase: 32,
      sight: { range: 0, fov: 0 },
      party: [
        { species: 72, level: 10 },
        { species: 278, level: 11 },
        { species: 98, level: 11 },
      ],
      intro: ['渡船停航了，闲得发慌！', '陪我这个老水手打一场吧！'],
      defeat: ['嘿，比海浪还猛！'],
      after: ['渡船停航是因为海上起了怪雾。', '馆主沧澜好像也在调查这件事。'],
      entrance: 'bow',
    },
    npc: {
      appearance: { look: 'sailor' },
      schedule: [{ from: 7, to: 22, at: { island: 'sprout', position: [436, 30], yaw: -PI / 2 } }],
      activity: { kind: 'wander', radius: 2 },
      showIf: ['starter-chosen'],
    },
  },
];

/**
 * M1-11 · 翠澜道馆训练家（室内固定站位，NPC 定义在 config/npcs/sprout.ts，这里只有对战数据）。
 * 馆主的队伍由 GymDef（config/encounters/gyms.ts）按徽章数动态生成，party 留空。
 */
export const SPROUT_GYM_TRAINERS: TrainerDef[] = [
  {
    id: 'gym-cuilan-1',
    name: '阿浪',
    title: '泳裤小伙',
    ai: 'smart',
    prizeBase: 20,
    sight: { range: 6, fov: 80 },
    party: [
      { species: 60, level: 11, moves: ['water-gun', 'hypnosis', 'pound'] },
      { species: 72, level: 12, moves: ['water-gun', 'acid', 'supersonic', 'wrap'] },
    ],
    intro: ['站住！想见馆主，先让我试试你的水性！', '木筏晃得厉害吧？我可是在这上面长大的！'],
    defeat: ['呛、呛到水了……'],
    after: ['池子里的水位是连动的：放掉水，石栈道就露出来了。', '不过木筏也会跟着沉下去，别把自己困在岛上哦。'],
    entrance: 'flex',
  },
  {
    id: 'gym-cuilan-2',
    name: '小汐',
    title: '比基尼大姐',
    ai: 'smart',
    prizeBase: 24,
    sight: { range: 6, fov: 80 },
    party: [
      { species: 278, level: 12, moves: ['water-gun', 'wing-attack', 'supersonic', 'growl'] },
      { species: 98, level: 12, moves: ['bubble-beam', 'metal-claw', 'harden', 'leer'] },
    ],
    intro: ['能走到这里，说明你看懂了水位的秘密。', '可是馆主面前，还有我这道浪！'],
    defeat: ['被你漂亮地冲过去了！'],
    after: ['再把水位升回去，木筏就会浮到馆主台前。', '沧澜大人的暴鲤龙非常凶猛，小心它的威吓。'],
    entrance: 'wave',
  },
  {
    id: 'gym-cuilan-leader',
    name: '沧澜',
    title: '翠澜道馆馆主',
    ai: 'smart',
    prizeBase: 0,
    sight: { range: 0, fov: 0 },
    party: [],
    gym: 'gym-cuilan',
    intro: ['我是沧澜，翠澜道馆的馆主。', '湖水能包容一切，也能吞没一切。', '你已经驯服了池中的水——现在，让我看看你和伙伴之间的羁绊有多深！'],
    defeat: ['……好一股汹涌的力量。', '湖水也为你让路了。'],
    after: ['你已经证明了自己。', '带着翠澜徽章，去更远的海上看看吧。'],
    entrance: 'bow',
  },
];
