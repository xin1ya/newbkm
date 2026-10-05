/**
 * 野生宝可梦的行为性格（设计 §5.2）。未登记的物种按 calm 处理。
 */
import type { Temperament } from '@/systems/encounters';

export interface SpeciesBehavior {
  temperament: Temperament;
  /** 夜间是否在固定位置睡觉 */
  sleepsAtNight?: boolean;
  /** 发现玩家的视野距离（米） */
  sight?: number;
  /** 游荡速度（米/秒） */
  speed?: number;
  /** 飞行 / 水栖（影响刷新位置） */
  habitat?: 'ground' | 'air' | 'water' | 'shore';
}

export const BEHAVIOR: Record<number, SpeciesBehavior> = {
  16: { temperament: 'timid', sleepsAtNight: true, sight: 14, speed: 3, habitat: 'ground' },
  17: { temperament: 'aggressive', sight: 18, speed: 4.5, habitat: 'air' },
  19: { temperament: 'aggressive', sight: 12, speed: 3.5 },
  // 生态新物种第 1 批
  161: { temperament: 'timid', sleepsAtNight: true, sight: 16, speed: 3 }, // 尾立：放哨，视野远、一见人就跑
  263: { temperament: 'curious', sight: 10, speed: 3.2 }, // 蛇纹熊：之字形乱逛，好奇凑近
  46: { temperament: 'calm', sight: 5, speed: 0.9 }, // 派拉斯
  163: { temperament: 'calm', sight: 14, speed: 2 }, // 咕咕：夜行，单脚站着不动
  92: { temperament: 'aggressive', sight: 12, speed: 2.2, habitat: 'air' }, // 鬼斯：漂浮，主动靠近吓人
  // 生态新物种第 2 批
  90: { temperament: 'calm', sight: 6, speed: 0.6, habitat: 'shore' }, // 大舌贝：在浪边蹦跳，几乎不挪窝
  222: { temperament: 'timid', sight: 10, speed: 1.2, habitat: 'shore' }, // 太阳珊瑚：胆小，见人就缩进浅水
  769: { temperament: 'aggressive', sight: 8, speed: 0.8 }, // 沙丘娃：夜里埋在沙中，靠近才猛然冒出
  74: { temperament: 'sleepy', sight: 6, speed: 1 }, // 小拳石：伪装成石头打盹，踩到才醒
  66: { temperament: 'aggressive', sight: 14, speed: 3.4 }, // 腕力：好斗，主动找人比力气
  // 生态新物种第 3 批
  396: { temperament: 'aggressive', sight: 16, speed: 4.5, habitat: 'air' }, // 姆克儿：成群盘旋，见人俯冲
  54: { temperament: 'calm', sight: 6, speed: 1.2, habitat: 'shore' }, // 可达鸭：抱头发呆，反应慢半拍
  194: { temperament: 'curious', sight: 8, speed: 1.4, habitat: 'shore' }, // 乌波：夜里上岸溜达，傻乎乎凑近
  283: { temperament: 'timid', sight: 10, speed: 3, habitat: 'water' }, // 溜溜糖球：在水面滑来滑去，受惊就溜
  341: { temperament: 'aggressive', sight: 10, speed: 2, habitat: 'shore' }, // 龙虾小兵：举钳挑衅
  118: { temperament: 'calm', sight: 8, speed: 1.8, habitat: 'water' }, // 角金鱼
  // 进化线闭合（计划第 7 步）：新物种的进化型
  162: { temperament: 'curious', sight: 14, speed: 4.2 }, // 大尾立：贴地窜行，好奇绕圈
  264: { temperament: 'aggressive', sight: 16, speed: 6 }, // 直冲熊：直线冲刺扑人
  47: { temperament: 'calm', sight: 5, speed: 0.7 }, // 派拉斯特：被蘑菇操控，缓慢游荡
  164: { temperament: 'calm', sight: 20, speed: 2.5, habitat: 'air' }, // 猫头夜鹰：夜里高处巡视，视野极远
  93: { temperament: 'aggressive', sight: 14, speed: 2.8, habitat: 'air' }, // 鬼斯通：从暗处飘出伸手吓人
  94: { temperament: 'aggressive', sight: 14, speed: 3, habitat: 'ground' }, // 耿鬼：躲在影子里，靠近才狞笑现身
  91: { temperament: 'calm', sight: 8, speed: 0.4, habitat: 'shore' }, // 刺甲贝：紧闭外壳，几乎不动
  770: { temperament: 'aggressive', sight: 10, speed: 0.6 }, // 噬沙堡爷：沙堡伪装，吸取靠近者的精气
  75: { temperament: 'aggressive', sight: 10, speed: 1.8 }, // 隆隆石：顺着山坡滚下来撞人
  76: { temperament: 'sleepy', sight: 8, speed: 1.2 }, // 隆隆岩：缩进壳里打盹，被惊动就滚动冲撞
  67: { temperament: 'aggressive', sight: 14, speed: 3.6 }, // 豪力：扛着岩块练力气，看见训练家就上前挑战
  68: { temperament: 'aggressive', sight: 16, speed: 3.8 }, // 怪力：四臂抱胸巡视领地，闯入者会被正面迎击
  397: { temperament: 'aggressive', sight: 18, speed: 5.2, habitat: 'air' }, // 姆克鸟：结群掠过上空，发现目标就俯冲
  398: { temperament: 'aggressive', sight: 22, speed: 6.0, habitat: 'air' }, // 姆克鹰：独自盘旋，不惧强敌径直扑来
  55: { temperament: 'timid', sight: 12, speed: 4.2, habitat: 'shore' }, // 哥达鸭：水边游弋，察觉动静便潜水远离
  195: { temperament: 'calm', sight: 7, speed: 1.6, habitat: 'shore' }, // 沼王：在浅滩发呆，被撞到也只是慢吞吞回头
  284: { temperament: 'timid', sight: 14, speed: 4.0, habitat: 'air' }, // 雨翅蛾：低空悬停，靠触角眼纹吓退靠近的人
  342: { temperament: 'aggressive', sight: 13, speed: 3.0, habitat: 'shore' }, // 铁螯龙虾：占据礁石地盘，挥舞大钳驱赶来者
  119: { temperament: 'calm', sight: 10, speed: 3.2, habitat: 'water' }, // 金鱼王：缓缓巡游，被惊扰时以角冲刺
  // 以下为既有模型的最终进化形态：野外不直接出现（或只在头目巢穴出现），补齐行为供进化/重生/跟随使用
  18: { temperament: 'aggressive', sight: 24, speed: 6.5, habitat: 'air' }, // 大比鸟：高空盘旋，鸡冠迎风，俯冲迅猛
  45: { temperament: 'sleepy', sight: 6, speed: 1.2 }, // 霸王花：大花瓣晒太阳，靠近会撒出花粉
  62: { temperament: 'aggressive', sight: 14, speed: 4.0, habitat: 'shore' }, // 蚊香泳士：在水边练拳，见人就摆架势
  73: { temperament: 'aggressive', sight: 12, speed: 3.6, habitat: 'water' }, // 毒刺水母：触手张开封锁水道
  99: { temperament: 'aggressive', sight: 11, speed: 2.6, habitat: 'shore' }, // 巨钳蟹：举起大钳威吓靠近者
  121: { temperament: 'calm', sight: 12, speed: 4.5, habitat: 'water' }, // 宝石海星：夜里核心闪光，旋转着游走
  130: { temperament: 'aggressive', sight: 20, speed: 5.0, habitat: 'water' }, // 暴鲤龙：一旦发现目标就破浪追击
  157: { temperament: 'aggressive', sight: 14, speed: 4.6 }, // 火暴兽：颈部火焰喷涌，正面冲撞
  260: { temperament: 'calm', sight: 10, speed: 3.0, habitat: 'shore' }, // 巨沼怪：在泥滩里稳步巡视
  279: { temperament: 'calm', sight: 16, speed: 4.0, habitat: 'air' }, // 大嘴鸥：沿海岸低空滑翔，偶尔俯冲叼鱼
  571: { temperament: 'curious', sight: 16, speed: 5.5 }, // 索罗亚克：用幻影试探来者，再悄悄绕后
  723: { temperament: 'timid', sight: 14, speed: 4.2 }, // 投羽枭：耍帅整理羽毛，被盯上就飞开
  724: { temperament: 'calm', sight: 22, speed: 4.0 }, // 狙射树枭：伏在树影里静静瞄准
  20: { temperament: 'aggressive', sight: 14, speed: 4 },
  10: { temperament: 'timid', sleepsAtNight: true, sight: 6, speed: 0.8 },
  11: { temperament: 'calm', sight: 4, speed: 0.2 },
  25: { temperament: 'curious', sight: 12, speed: 3.5 },
  172: { temperament: 'curious', sight: 8, speed: 2 },
  43: { temperament: 'curious', sight: 8, speed: 1.2 },
  60: { temperament: 'curious', sight: 8, speed: 1.5, habitat: 'shore' },
  98: { temperament: 'aggressive', sight: 10, speed: 1.8, habitat: 'shore' },
  120: { temperament: 'calm', sight: 8, speed: 1.5, habitat: 'shore' },
  129: { temperament: 'timid', sight: 6, speed: 1.2, habitat: 'water' },
  72: { temperament: 'calm', sight: 8, speed: 1.5, habitat: 'water' },
  278: { temperament: 'curious', sight: 14, speed: 4, habitat: 'air' },
  570: { temperament: 'timid', sight: 16, speed: 4 },
  722: { temperament: 'sleepy', sleepsAtNight: false, sight: 10, speed: 2 },
  258: { temperament: 'curious', sight: 10, speed: 2, habitat: 'shore' },
  12: { temperament: 'calm', sight: 10, speed: 2.5, habitat: 'air' },
  26: { temperament: 'aggressive', sight: 14, speed: 4 },
  44: { temperament: 'sleepy', sight: 6, speed: 0.8 },
  61: { temperament: 'aggressive', sight: 10, speed: 2, habitat: 'shore' },
  155: { temperament: 'timid', sight: 12, speed: 3 },
  156: { temperament: 'aggressive', sight: 12, speed: 3 },
  182: { temperament: 'curious', sight: 8, speed: 1.5 },
  186: { temperament: 'aggressive', sight: 10, speed: 1.8, habitat: 'shore' },
  259: { temperament: 'calm', sight: 10, speed: 2, habitat: 'shore' },
  // M2 碧潮群岛新物种（45 只）
  27: { temperament: 'timid', sight: 10, speed: 2.4 }, // 穿山鼠：受惊就蜷成球
  28: { temperament: 'aggressive', sight: 12, speed: 3 }, // 穿山王
  41: { temperament: 'aggressive', sleepsAtNight: false, sight: 12, speed: 3.5, habitat: 'air' }, // 超音蝠：洞穴/夜间成群
  42: { temperament: 'aggressive', sight: 14, speed: 4, habitat: 'air' }, // 大嘴蝠
  169: { temperament: 'aggressive', sight: 18, speed: 6, habitat: 'air' }, // 叉字蝠
  58: { temperament: 'curious', sight: 12, speed: 3.5 }, // 卡蒂狗：忠诚好奇
  59: { temperament: 'aggressive', sight: 18, speed: 6 }, // 风速狗
  69: { temperament: 'calm', sight: 6, speed: 1.4 }, // 喇叭芽
  70: { temperament: 'calm', sight: 7, speed: 1.2 }, // 口呆花
  71: { temperament: 'aggressive', sight: 10, speed: 1.2 }, // 大食花：守株待兔
  77: { temperament: 'timid', sight: 16, speed: 5 }, // 小火马：远远看见就跑
  78: { temperament: 'timid', sight: 18, speed: 7 }, // 烈焰马
  79: { temperament: 'sleepy', sight: 4, speed: 0.6, habitat: 'shore' }, // 呆呆兽：岸边发呆
  80: { temperament: 'sleepy', sight: 5, speed: 0.8, habitat: 'shore' }, // 呆壳兽
  199: { temperament: 'calm', sight: 8, speed: 1, habitat: 'shore' }, // 呆呆王
  95: { temperament: 'aggressive', sight: 16, speed: 3 }, // 大岩蛇
  208: { temperament: 'aggressive', sight: 16, speed: 3 }, // 大钢蛇
  104: { temperament: 'timid', sight: 10, speed: 2.4 }, // 卡拉卡拉：孤僻怕生
  105: { temperament: 'aggressive', sight: 12, speed: 2.8 }, // 嘎啦嘎啦
  111: { temperament: 'aggressive', sight: 10, speed: 3.8 }, // 独角犀牛：直线冲撞
  112: { temperament: 'aggressive', sight: 12, speed: 3 }, // 钻角犀兽
  464: { temperament: 'aggressive', sight: 14, speed: 2.6 }, // 超甲狂犀
  165: { temperament: 'timid', sleepsAtNight: true, sight: 10, speed: 2, habitat: 'air' }, // 芭瓢虫：成群，夜里抱团睡
  166: { temperament: 'calm', sight: 12, speed: 3, habitat: 'air' }, // 安瓢虫
  214: { temperament: 'aggressive', sight: 10, speed: 2.5 }, // 赫拉克罗斯：守着树汁
  218: { temperament: 'calm', sight: 6, speed: 0.6 }, // 熔岩虫
  219: { temperament: 'calm', sight: 7, speed: 0.5 }, // 熔岩蜗牛
  228: { temperament: 'aggressive', sight: 14, speed: 4, sleepsAtNight: false }, // 戴鲁比：成群狩猎
  229: { temperament: 'aggressive', sight: 18, speed: 5 }, // 黑鲁加
  285: { temperament: 'sleepy', sleepsAtNight: true, sight: 5, speed: 1 }, // 蘑蘑菇：林下打盹
  286: { temperament: 'aggressive', sight: 12, speed: 4 }, // 斗笠菇
  315: { temperament: 'calm', sight: 8, speed: 1.5 }, // 毒蔷薇
  406: { temperament: 'timid', sleepsAtNight: true, sight: 8, speed: 1.2 }, // 含羞苞
  407: { temperament: 'calm', sight: 12, speed: 2.4 }, // 罗丝雷朵
  322: { temperament: 'sleepy', sight: 6, speed: 1.2 }, // 呆火驼
  323: { temperament: 'aggressive', sight: 10, speed: 1.6 }, // 喷火驼
  324: { temperament: 'calm', sight: 8, speed: 0.8 }, // 煤炭龟
  343: { temperament: 'curious', sight: 10, speed: 2 }, // 天秤偶：转着凑过来
  344: { temperament: 'calm', sight: 14, speed: 1.6, habitat: 'air' }, // 念力土偶
  377: { temperament: 'aggressive', sight: 14, speed: 1.6 }, // 雷吉洛克（遗迹）
  636: { temperament: 'timid', sight: 8, speed: 1 }, // 燃烧虫
  637: { temperament: 'calm', sight: 16, speed: 3, habitat: 'air' }, // 火神蛾
  862: { temperament: 'aggressive', sight: 14, speed: 3.6 }, // 堵拦熊
  864: { temperament: 'calm', sight: 10, speed: 0.6, habitat: 'shore' }, // 魔灵珊瑚：珊瑚礁岸边
  980: { temperament: 'sleepy', sight: 6, speed: 0.8, habitat: 'shore' }, // 土王  // M3-28 雷鸣 / 琉璃 / 冠军之路
  81: { temperament: 'curious', sight: 10, speed: 1.6, habitat: 'air' }, // 小磁怪：被电流吸引，飘过来
  82: { temperament: 'aggressive', sight: 12, speed: 1.8, habitat: 'air' }, // 三合一磁怪
  100: { temperament: 'aggressive', sight: 8, speed: 3.6 }, // 霹雳电球：滚过来撞
  101: { temperament: 'aggressive', sight: 10, speed: 4.2 }, // 顽皮雷弹
  239: { temperament: 'curious', sight: 10, speed: 2.6 }, // 电击怪
  125: { temperament: 'aggressive', sight: 14, speed: 3 }, // 电击兽
  179: { temperament: 'timid', sleepsAtNight: true, sight: 10, speed: 1.6 }, // 咩利羊：成群吃草
  180: { temperament: 'calm', sleepsAtNight: true, sight: 10, speed: 1.8 }, // 茸茸羊
  181: { temperament: 'calm', sight: 16, speed: 2 }, // 电龙
  403: { temperament: 'curious', sight: 10, speed: 3.2 }, // 小猫怪
  404: { temperament: 'aggressive', sight: 14, speed: 3.8 }, // 勒克猫
  299: { temperament: 'sleepy', sight: 6, speed: 0.5 }, // 朝北鼻：一动不动朝北
  476: { temperament: 'calm', sight: 8, speed: 0.6 }, // 大朝北鼻
  220: { temperament: 'curious', sight: 8, speed: 2.4 }, // 小山猪：拱雪找吃的
  221: { temperament: 'calm', sight: 8, speed: 1.4 }, // 长毛猪
  215: { temperament: 'aggressive', sight: 16, speed: 4.4 }, // 狃拉：夜里偷袭
  361: { temperament: 'timid', sight: 10, speed: 2 }, // 雪童子
  362: { temperament: 'aggressive', sight: 12, speed: 1.6 }, // 冰鬼护
  478: { temperament: 'curious', sight: 14, speed: 2.6, habitat: 'air' }, // 雪妖女
  225: { temperament: 'curious', sight: 12, speed: 3.4 }, // 信使鸟
  459: { temperament: 'calm', sight: 8, speed: 1.4 }, // 雪笠怪
  460: { temperament: 'aggressive', sight: 14, speed: 1.6 }, // 暴雪王
  86: { temperament: 'calm', sight: 8, speed: 1.2, habitat: 'shore' }, // 小海狮
  87: { temperament: 'calm', sight: 10, speed: 1.6, habitat: 'water' }, // 白海狮
  363: { temperament: 'sleepy', sight: 6, speed: 1, habitat: 'shore' }, // 海豹球：滚来滚去
  364: { temperament: 'calm', sight: 10, speed: 1.4, habitat: 'shore' }, // 海魔狮
  365: { temperament: 'aggressive', sight: 14, speed: 1.4, habitat: 'shore' }, // 帝牙海狮
  63: { temperament: 'timid', sight: 14, speed: 0.5 }, // 凯西：睡着，一靠近就瞬移
  64: { temperament: 'calm', sight: 12, speed: 1.6 }, // 勇基拉
  280: { temperament: 'timid', sight: 14, speed: 1.6 }, // 拉鲁拉丝：感知情绪，远远躲开
  281: { temperament: 'timid', sight: 14, speed: 2 }, // 奇鲁莉安
  282: { temperament: 'calm', sight: 16, speed: 2 }, // 沙奈朵
  475: { temperament: 'aggressive', sight: 16, speed: 3 }, // 艾路雷朵
  177: { temperament: 'calm', sight: 12, speed: 1.2 }, // 天然雀：一动不动盯着太阳
  178: { temperament: 'calm', sight: 16, speed: 1.4, habitat: 'air' }, // 天然鸟
  200: { temperament: 'aggressive', sight: 12, speed: 2.4, habitat: 'air' }, // 梦妖：吓人
  355: { temperament: 'curious', sight: 12, speed: 1.6, habitat: 'air' }, // 夜巡灵
  356: { temperament: 'aggressive', sight: 14, speed: 1.6 }, // 彷徨夜灵
  425: { temperament: 'curious', sight: 12, speed: 1.2, habitat: 'air' }, // 飘飘球：飘向孩子
  426: { temperament: 'calm', sight: 14, speed: 1.6, habitat: 'air' }, // 随风球
  592: { temperament: 'calm', sight: 8, speed: 0.8, habitat: 'water' }, // 轻飘飘
  593: { temperament: 'aggressive', sight: 12, speed: 1, habitat: 'water' }, // 胖嘟嘟
  170: { temperament: 'curious', sight: 10, speed: 1.6, habitat: 'water' }, // 灯笼鱼
  171: { temperament: 'calm', sight: 12, speed: 1.8, habitat: 'water' }, // 电灯怪
  116: { temperament: 'timid', sight: 10, speed: 2, habitat: 'water' }, // 墨海马
  117: { temperament: 'aggressive', sight: 12, speed: 2.4, habitat: 'water' }, // 海刺龙
  246: { temperament: 'aggressive', sight: 8, speed: 1.4 }, // 幼基拉斯：啃岩石
  247: { temperament: 'calm', sight: 10, speed: 1.6 }, // 沙基拉斯
  443: { temperament: 'aggressive', sight: 10, speed: 3 }, // 圆陆鲨
  444: { temperament: 'aggressive', sight: 14, speed: 4 }, // 尖牙陆鲨
  147: { temperament: 'timid', sight: 12, speed: 1.6, habitat: 'water' }, // 迷你龙
  148: { temperament: 'calm', sight: 14, speed: 2, habitat: 'water' }, // 哈克龙
  149: { temperament: 'curious', sight: 18, speed: 4, habitat: 'air' }, // 快龙
  477: { temperament: 'aggressive', sight: 16, speed: 1.8, habitat: 'air' }, // 黑夜魔灵
  429: { temperament: 'curious', sight: 14, speed: 2.2, habitat: 'air' }, // 梦妖魔
  230: { temperament: 'aggressive', sight: 14, speed: 2.4, habitat: 'water' }, // 刺龙王
};

export function behaviorOf(speciesId: number): Required<SpeciesBehavior> {
  const b = BEHAVIOR[speciesId] ?? { temperament: 'calm' };
  return { temperament: b.temperament, sleepsAtNight: b.sleepsAtNight ?? false, sight: b.sight ?? 10, speed: b.speed ?? 2, habitat: b.habitat ?? 'ground' };
}
