/**
 * M3-21 · 精灵联盟 NPC：大厅（守卫 / 护士 / 店员 / 老观众）、四条补给回廊的服务员、四天王与冠军、名人堂管理员。
 * 站位在 config/interiors/league.ts；四天王 / 冠军造型为程序化占位（M3-29 人物模型）。
 */
import type { NpcDef } from '@/systems/npcs';

const Q = 'main-league';

const attendant = (n: number, next: string, tip: string[]): NpcDef => ({
  id: `league-attendant-${n}`,
  name: '联盟服务员',
  title: `第 ${n} 回廊`,
  appearance: { look: 'clerk', palette: { jacket: '#2a4a7a', cap: '#2a4a7a' } },
  service: { kind: 'shop', shop: 'league-supply' },
  dialog: [`前面是${next}。`, ...tip, '这里不能恢复体力，但可以补给道具。'],
});

export const LEAGUE_NPCS: NpcDef[] = [
  {
    id: 'league-guard',
    name: '联盟守卫',
    title: '精灵联盟',
    appearance: { look: 'guard', palette: { jacket: '#2a4a7a', cap: '#2a4a7a' } },
    dialogByQuest: [{ questId: Q, when: 'completed', dialog: ['冠军，欢迎回来！', '四天王随时接受再挑战。每一轮都要从第一间重新开始。'] }],
    dialog: ['这扇门后面就是四天王之间。', '一旦踏进去，在打倒冠军——或者全队倒下——之前，都回不到这间大厅。', '厅与厅之间的回廊可以买道具，但不能恢复。准备好了再进去。'],
  },
  {
    id: 'league-nurse',
    name: '乔伊',
    title: '联盟护士',
    appearance: { look: 'nurse' },
    service: { kind: 'heal' },
    dialog: ['欢迎来到精灵联盟。', '这是挑战前最后一次恢复的机会哦。'],
  },
  {
    id: 'league-clerk',
    name: '联盟商店',
    title: '店员',
    appearance: { look: 'clerk', palette: { jacket: '#3a7ac8' } },
    service: { kind: 'shop', shop: 'league-mart' },
    dialog: ['联盟商店，全翠澜最齐全的对战补给！'],
  },
  {
    id: 'league-fan',
    name: '老观众 阿松',
    title: '联盟常客',
    appearance: { look: 'elder', style: { cane: true, beard: true } },
    dialogByQuest: [{ questId: Q, when: 'completed', dialog: ['我看了四十年联盟，你那场冠军战——是最好看的一场！'] }],
    dialog: [
      '我每年都来看挑战者。',
      '花月用恶属性，格斗、虫、妖精招式对它有效。芙蓉用幽灵属性，恶和幽灵招式最好使。',
      '波妮的宝可梦大多是水 + 冰的招式，电和草属性能打出效果；源治的暴鲤龙会跳龙之舞，别让它舞起来。',
      '至于冠军米可利……他的队伍全是水属性的宝可梦，可每一只的副属性都不一样。',
    ],
  },
  attendant(1, '四天王 · 芙蓉的灵堂', ['芙蓉用的是幽灵属性。普通和格斗招式打不中它们，恶属性招式效果拔群。']),
  attendant(2, '四天王 · 波妮的冰厅', ['波妮的宝可梦以水和冰的招式为主。电、草属性招式效果很好，也要提防「破壳」。']),
  attendant(3, '四天王 · 源治的龙厅', ['源治的暴鲤龙会用龙之舞。先手的招式和能让对手退场的招式会帮上忙。']),
  attendant(4, '冠军之间', ['冠军米可利的队伍全是水属性，但副属性各不相同。', '这是最后的补给了。']),
  {
    id: 'league-huayue',
    name: '花月',
    title: '四天王',
    appearance: { look: 'e4-dark' },
    trainer: 'league-e1',
    dialog: ['往前走吧——身后的门不会再开了。'],
  },
  {
    id: 'league-furong',
    name: '芙蓉',
    title: '四天王',
    appearance: { look: 'e4-ghost' },
    trainer: 'league-e2',
    dialog: ['下一间很冷，记得别让那根线冻断了。'],
  },
  {
    id: 'league-boni',
    name: '波妮',
    title: '四天王',
    appearance: { look: 'e4-ice' },
    trainer: 'league-e3',
    dialog: ['最后一位四天王是源治——他的对战，像暴风雨一样。'],
  },
  {
    id: 'league-yuanzhi',
    name: '源治',
    title: '四天王',
    appearance: { look: 'e4-dragon' },
    trainer: 'league-e4',
    dialog: ['冠军在最后那扇门后面等着你。'],
  },
  {
    id: 'league-mikuli',
    name: '米可利',
    title: '冠军',
    appearance: { look: 'champion' },
    trainer: 'league-champion',
    dialog: ['后面就是名人堂。去吧，让翠澜记住你和伙伴们的名字。'],
  },
  {
    id: 'league-hof-keeper',
    name: '名人堂管理员',
    title: '精灵联盟',
    appearance: { look: 'aide', palette: { jacket: '#c8a040' } },
    dialog: ['这里是名人堂。', '每一位战胜冠军的训练家，和他们的伙伴，都会被记录在这台机器里。', '出口在你身后，大门外就是彩幽市。'],
  },
];
