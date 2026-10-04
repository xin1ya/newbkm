/**
 * SCN-001 · 战斗事件 → 中文播报文本（纯函数，可单测）。
 * 返回 null 表示该事件不需要文字（只做表现，例如 turn / hits 计数由其他事件合并）。
 */
import type { BattleEvent, SideId } from '@/systems/battle';
import { STATUS_NAMES } from '@/systems/battle';
import type { StatId, TypeId } from '@/systems/data/types';

export const TYPE_NAMES_ZH: Record<TypeId, string> = {
  normal: '一般', fire: '火', water: '水', electric: '电', grass: '草', ice: '冰',
  fighting: '格斗', poison: '毒', ground: '地面', flying: '飞行', psychic: '超能力', bug: '虫',
  rock: '岩石', ghost: '幽灵', dragon: '龙', dark: '恶', steel: '钢', fairy: '妖精',
} as Record<TypeId, string>;

export const STAT_NAMES_ZH: Record<StatId, string> = {
  hp: 'HP', atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度', acc: '命中率', eva: '闪避率',
};

const WEATHER_START: Record<string, string> = { rain: '开始下雨了！', sun: '日照变强了！', sand: '刮起了沙暴！', hail: '开始下冰雹了！' };
const WEATHER_GOING: Record<string, string> = { rain: '雨一直在下。', sun: '日照很强烈。', sand: '沙暴肆虐。', hail: '冰雹在下。' };
const WEATHER_END: Record<string, string> = { rain: '雨停了。', sun: '日照恢复了正常。', sand: '沙暴平息了。', hail: '冰雹停了。' };
const CONDITION_NAMES: Record<string, string> = { reflect: '反射壁', lightScreen: '光墙', mist: '白雾', safeguard: '神秘守护', tailwind: '顺风' };

export interface MessageContext {
  /** 野生对战时对手名前缀「野生的」 */
  kind: 'wild' | 'trainer';
  foeTrainer?: string;
  playerName: string;
}

/** 按阵营给名字加前缀：玩家方直接叫名字，对方加「野生的 / 对手的」 */
export function who(side: SideId, name: string, ctx: MessageContext): string {
  if (side === 0) return name;
  return ctx.kind === 'wild' ? `野生的${name}` : `对手的${name}`;
}

function stageText(delta: number, blocked?: string): string {
  if (blocked === 'max') return '已经无法再提高了！';
  if (blocked === 'min') return '已经无法再降低了！';
  if (blocked === 'mist') return '受到白雾的保护！';
  if (blocked === 'ability') return '没有降低！';
  const a = Math.abs(delta);
  if (delta > 0) return a >= 3 ? '巨幅提高了！' : a === 2 ? '大幅提高了！' : '提高了！';
  return a >= 3 ? '巨幅降低了！' : a === 2 ? '大幅降低了！' : '降低了！';
}

const ABILITY_ZH: Record<string, string> = { insomnia: '不眠', simple: '单纯' };
const TERRAIN_ZH: Record<string, string> = { electric: '电气场地', grassy: '青草场地' };

/** 引擎 message 事件的代码 → 中文（「代码:参数1:参数2」；未登记的原样输出） */
export function messageCode(text: string): string | null {
  const [code, a = '', b = ''] = text.split(':');
  switch (code) {
    case 'splash': return '但是什么也没有发生！';
    case 'ohko': return '一击必杀！';
    case 'spite': return `${a}的「${b}」PP 减少了！`;
    case 'trapped': return `${a}无法逃走！`;
    case 'sub-make': return null; // 伤害事件已播报
    case 'sub-hit': return `替身代替${a}承受了攻击！`;
    case 'sub-break': return `${a}的替身消失了……`;
    case 'encore': return `${a}受到了再来一次！`;
    case 'encore-end': return `${a}的再来一次状态解除了。`;
    case 'pain-split': return '双方分担了体力！';
    case 'wish': return `${a}许下了愿望！`;
    case 'wish-come': return `${a}的愿望实现了！`;
    case 'ability-set': return `${a}的特性变成了「${ABILITY_ZH[b] ?? b}」！`;
    case 'skill-swap': return `${a}与对手交换了特性！`;
    case 'trick': return `${a}与对手交换了道具！`;
    case 'power-split': return `${a}与对手平分了力量！`;
    case 'laser-focus': return `${a}集中了精神！`;
    case 'block': return `${a}无法逃走了！`;
    case 'future-sight': return `${a}预知了未来的攻击！`;
    case 'future-sight-hit': return `${a}受到了预知未来的攻击！`;
    case 'trick-room': return a === 'on' ? '扭曲了时空！' : '扭曲的时空复原了！';
    case 'gravity': return a === 'on' ? '重力变强了！' : '重力复原了！';
    case 'terrain': return `脚下展开了${TERRAIN_ZH[a] ?? a}！`;
    case 'terrain-end': return `脚下的${TERRAIN_ZH[a] ?? a}消失了。`;
    default: return text;
  }
}

export function describeEvent(e: BattleEvent, ctx: MessageContext): string | null {
  switch (e.type) {
    case 'start':
      return null;
    case 'switch-in':
      if (e.side === 0) return `上吧！${e.name}！`;
      return ctx.kind === 'wild' ? `野生的${e.name}出现了！` : `${ctx.foeTrainer ?? '对手'}派出了${e.name}！`;
    case 'switch-out':
      return e.side === 0 ? `回来吧，${e.name}！` : `${ctx.foeTrainer ?? '对手'}收回了${e.name}。`;
    case 'move':
      return `${who(e.side, e.name, ctx)}使用了${e.moveName}！`;
    case 'charge':
      return `${who(e.side, e.name, ctx)}正在蓄力！`;
    case 'damage': {
      const parts: string[] = [];
      if (e.source === 'move') {
        if (e.crit) parts.push('击中了要害！');
        if (e.effectiveness !== undefined && e.effectiveness > 1) parts.push('效果绝佳！');
        else if (e.effectiveness !== undefined && e.effectiveness > 0 && e.effectiveness < 1) parts.push('效果不好……');
        return parts.length ? parts.join('') : null;
      }
      const n = who(e.side, e.name, ctx);
      const m: Record<string, string> = {
        confusion: `${n}在混乱中攻击了自己！`, recoil: `${n}受到了反作用力的伤害！`, struggle: `${n}受到了反作用力的伤害！`,
        brn: `${n}受到了灼伤的伤害！`, psn: `${n}受到了毒的伤害！`, tox: `${n}受到了毒的伤害！`,
        weather: `${n}受到了天气的伤害！`, bind: `${n}受到了束缚的伤害！`, 'life-orb': `${n}的生命被夺走了一些！`,
        'belly-drum': `${n}削减了体力！`, substitute: `${n}削减了体力做出了替身！`, memento: `${n}倒下了……`,
      };
      return m[e.source] ?? null;
    }
    case 'heal':
      return `${who(e.side, e.name, ctx)}的体力回复了！`;
    case 'miss':
      return `${who(e.side, e.name, ctx)}的攻击没有命中！`;
    case 'immune':
      return `对${who(e.side, e.name, ctx)}好像没有效果……`;
    case 'fail':
      return '但是失败了！';
    case 'protected':
      return `${who(e.side, e.name, ctx)}守住了攻击！`;
    case 'hits':
      return `击中了${e.count}次！`;
    case 'status': {
      const n = who(e.side, e.name, ctx);
      const m: Record<string, string> = { brn: '被灼伤了！', par: '麻痹了，很难行动！', psn: '中毒了！', tox: '中了剧毒！', slp: '睡着了！', frz: '被冻住了！' };
      return n + (m[e.status] ?? `陷入了${STATUS_NAMES[e.status]}状态！`);
    }
    case 'status-already':
      return `${who(e.side, e.name, ctx)}已经处于${STATUS_NAMES[e.status]}状态了！`;
    case 'cure': {
      const n = who(e.side, e.name, ctx);
      if (e.status === 'confusion') return `${n}的混乱解除了！`;
      if (e.status === 'attract') return `${n}的着迷解除了！`;
      return `${n}的${STATUS_NAMES[e.status]}治愈了！`;
    }
    case 'volatile': {
      const n = who(e.side, e.name, ctx);
      const m: Record<string, string> = {
        confusion: `${n}混乱了！`, attract: `${n}着迷了！`, flinch: `${n}畏缩了，无法行动！`, 'focus-energy': `${n}干劲十足！`,
        taunt: `${n}中了挑衅！`, torment: `${n}受到了无理取闹！`, bound: `${n}被束缚住了！`, protect: `${n}摆出了防守的架势！`,
        stockpile: `${n}蓄积了力量！`, 'type-change': `${n}的属性改变了！`, recharge: `${n}需要休息一回合！`,
      };
      return m[e.volatile] ?? null;
    }
    case 'cant-move': {
      const n = who(e.side, e.name, ctx);
      const m: Record<string, string> = {
        par: `${n}身体麻痹，无法行动！`, slp: `${n}正在呼呼大睡。`, frz: `${n}因冻结而无法行动！`, flinch: `${n}畏缩了，无法行动！`,
        attract: `${n}着迷了，无法行动！`, recharge: `${n}因反作用力而无法行动！`, taunt: `${n}因挑衅无法使出该招式！`, truant: `${n}在偷懒。`,
      };
      return m[e.reason] ?? null;
    }
    case 'wake':
      return `${who(e.side, e.name, ctx)}醒过来了！`;
    case 'thaw':
      return `${who(e.side, e.name, ctx)}的冰融化了！`;
    case 'confusion-self-hit':
      return `${who(e.side, e.name, ctx)}混乱了！`;
    case 'stage':
      return `${who(e.side, e.name, ctx)}的${STAT_NAMES_ZH[e.stat]}${stageText(e.delta, e.blocked)}`;
    case 'weather':
      return e.weather === 'none' ? null : (WEATHER_START[e.weather] ?? null);
    case 'weather-continue':
      return WEATHER_GOING[e.weather] ?? null;
    case 'weather-end':
      return WEATHER_END[e.weather] ?? null;
    case 'side-condition': {
      const side = e.side === 0 ? '我方' : '对方';
      const c = CONDITION_NAMES[e.condition] ?? e.condition;
      return e.started ? `${side}受到了${c}的保护！` : `${side}的${c}消失了！`;
    }
    case 'ability':
      return `[${who(e.side, e.name, ctx)}的${e.abilityName}]`;
    case 'item':
      return e.consumed ? `${who(e.side, e.name, ctx)}使用了${e.itemName}！` : `${who(e.side, e.name, ctx)}的${e.itemName}发挥了作用！`;
    case 'faint':
      return `${who(e.side, e.name, ctx)}倒下了！`;
    case 'exp':
      return `${e.name}获得了${e.amount}点经验值！`;
    case 'level-up':
      return `${e.name}升到了${e.level}级！`;
    case 'learn-move':
      return `${e.name}学会了${e.moveName}！`;
    case 'learn-move-pending':
      return `${e.name}想要学习${e.moveName}……`;
    case 'run':
      return e.success ? '顺利逃走了！' : '没能逃走！';
    case 'ball-throw':
      return `${ctx.playerName}扔出了精灵球！`;
    case 'capture':
      if (e.success) return `抓到了${e.name}！`;
      return ['哎呀！宝可梦从球里出来了！', '啊！差一点就抓到了！', '可恶！只差一点点！', '可恶！只差一点点！'][Math.min(3, e.shakes)] ?? null;
    case 'item-use':
      return `对${e.target}使用了${e.itemName}。`;
    case 'trainer-switch':
      return null;
    case 'message':
      return messageCode(e.text);
    case 'request-switch':
      return null;
    case 'end':
      return null;
    case 'turn':
      return null;
  }
}
