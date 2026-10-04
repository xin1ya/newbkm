/**
 * M1-07 · 家具 / 地标互动配置类型（config/interactions 使用）。
 */

/** 按 flag 切换的文字（从上到下第一条满足的生效） */
export interface FlagPages {
  /** 需要置位的 flag（前缀 ! 表示需要未置位） */
  when: string;
  pages: string[];
}

export type InteractEffect =
  /** 恢复全队（自家床铺：黑屏休息） */
  | { kind: 'heal-party'; fade: boolean; /** 有恢复机演出时播放完整动画（研究所恢复机） */ machine?: boolean }
  /** 一次性拾取道具（flag 记录已拿） */
  | { kind: 'give-item'; item: string; qty: number; flag: string; itemName: string }
  /** 推进游戏内时钟（睡觉） */
  | { kind: 'advance-clock'; toHour: number }
  /** M1-13 执行剧情脚本（config/story） */
  | { kind: 'story'; script: string }
  /** 打开宝可梦寄放系统（电脑） */
  | { kind: 'pc-storage'; title?: string }
  /** 打开能量方块机（计划文档 §9.5） */
  | { kind: 'block-machine' };

export interface InteractionDef {
  /** 与 FurnitureConfig.interact / PoiConfig.id 对应 */
  id: string;
  kind: 'examine' | 'use' | 'rest' | 'ferry';
  /** 提示文字（缺省按 kind：查看 / 使用 / 休息 / 渡船） */
  label?: string;
  pages: string[];
  byFlag?: FlagPages[];
  /** 夜间替换文字 */
  night?: string[];
  effects?: InteractEffect[];
  /** 效果完成后追加的文字 */
  after?: string[];
  /** 需要这个 flag 才出现（例如隐藏道具拿完后 examine 文字改变用 byFlag，而不是隐藏） */
  showIf?: string;
  /** 检测半径（地标可放宽） */
  range?: number;
}
