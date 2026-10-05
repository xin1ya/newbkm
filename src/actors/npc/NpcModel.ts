/**
 * M1-06 · NPC 造型：把 NpcLook 模板翻译成 TrainerModel 的配色与部件（设计 §8.5：按身份区分服装与配色）。
 * 手工人物 glb 到位后（ART-003 人物清单），同一 look 改为加载对应 glb，调用方不变。
 */
import { DEFAULT_TRAINER, TrainerModel } from '@/actors/player/TrainerModel';
import type { NpcAppearance, NpcLook, TrainerPalette, TrainerStyle } from '@/systems/npcs';

interface LookPreset {
  palette: Partial<TrainerPalette>;
  style: Partial<TrainerStyle>;
  accent?: string;
}

const NO_BAG = { bag: false } as const;

export const LOOK_PRESETS: Record<NpcLook, LookPreset> = {
  mom: {
    palette: { hair: '#6b3f2a', jacket: '#f29a8e', shirt: '#fff5ec', pants: '#f7d7b5', shoes: '#b0685a' },
    style: { ...NO_BAG, hat: 'none', hair: 'bun', coat: 'dress', apron: true },
    accent: '#ffffff',
  },
  professor: {
    palette: { hair: '#ece8e2', jacket: '#f6f6f2', shirt: '#6f8fc0', pants: '#4a4a5c', shoes: '#5a4a44' },
    style: { ...NO_BAG, hat: 'none', hair: 'bun', coat: 'long', glasses: true, stoop: 0.08 },
  },
  aide: {
    palette: { hair: '#2b2b35', jacket: '#f6f6f2', shirt: '#9fc4a8', pants: '#3d4a6a', shoes: '#3a3a44' },
    style: { ...NO_BAG, hat: 'none', hair: 'short', coat: 'long', glasses: true },
  },
  elder: {
    palette: { hair: '#e6e2dc', skin: '#f1ccb0', jacket: '#8a6aa0', shirt: '#f4ecd8', pants: '#6a4a7a', shoes: '#4a3a3a' },
    style: { ...NO_BAG, hat: 'none', hair: 'bun', coat: 'dress', cane: true, stoop: 0.28, scale: 0.92 },
  },
  nurse: {
    palette: { hair: '#f08aa8', cap: '#ffffff', jacket: '#ffc2d1', shirt: '#ffffff', pants: '#ffc2d1', shoes: '#ffffff' },
    style: { ...NO_BAG, hat: 'nurse', hair: 'long', coat: 'dress' },
    accent: '#e8486a',
  },
  clerk: {
    palette: { hair: '#3b2b2a', cap: '#3a7bd5', capBrim: '#ffffff', jacket: '#7fb3e8', shirt: '#ffffff', pants: '#2f3a5a' },
    style: { ...NO_BAG, hat: 'cap', apron: true },
    accent: '#3a7bd5',
  },
  'villager-m': {
    palette: { hair: '#3b2b2a', jacket: '#6aa05a', shirt: '#f4efe6', pants: '#5a4a3a', shoes: '#4a3a2a' },
    style: { ...NO_BAG, hat: 'none', hair: 'short' },
  },
  'villager-f': {
    palette: { hair: '#5a3a2a', jacket: '#e8a0b4', shirt: '#ffffff', pants: '#f4d4c4', shoes: '#c06a7a' },
    style: { ...NO_BAG, hat: 'none', hair: 'long', coat: 'dress' },
  },
  'child-m': {
    palette: { hair: '#2b2020', cap: '#f2b541', capBrim: '#ffffff', jacket: '#e8484a', pants: '#3d5a8a', shoes: '#ffffff' },
    style: { ...NO_BAG, hat: 'cap', scale: 0.72 },
  },
  'child-f': {
    palette: { hair: '#8a4b2a', jacket: '#ffd35a', pants: '#e87a9a', shoes: '#ffffff' },
    style: { ...NO_BAG, hat: 'none', hair: 'pony', coat: 'dress', scale: 0.7 },
  },
  fisher: {
    palette: { hair: '#3a3030', cap: '#e0b040', capBrim: '#c89a30', jacket: '#f2c230', shirt: '#3a5a7a', pants: '#34495e', shoes: '#2a2a2a' },
    style: { ...NO_BAG, hat: 'bucket', beard: true },
  },
  sailor: {
    palette: { hair: '#3b2b2a', cap: '#ffffff', jacket: '#f4f4f4', shirt: '#2f4f7f', pants: '#23395d', shoes: '#1f1f2a' },
    style: { ...NO_BAG, hat: 'sailor' },
    accent: '#23395d',
  },
  vendor: {
    palette: { hair: '#2b2020', cap: '#d9534f', jacket: '#d96a4a', shirt: '#fff5ec', pants: '#4a3a2a' },
    style: { ...NO_BAG, hat: 'bandana', apron: true },
    accent: '#f4efe6',
  },
  hiker: {
    palette: { hair: '#3a2a20', cap: '#8a6a42', capBrim: '#7a5a36', jacket: '#a0663a', shirt: '#e8dcc4', pants: '#5a5040', shoes: '#4a3a2a', bag: '#6a8a4a' },
    style: { hat: 'bucket', beard: true, scale: 1.06, bag: true },
  },
  'bug-catcher': {
    palette: { hair: '#2b2020', cap: '#8fbf5a', capBrim: '#7aa84a', jacket: '#b8d88a', shirt: '#ffffff', pants: '#e0c070', bag: '#6a8a4a' },
    style: { hat: 'bucket', scale: 0.76, bag: true },
  },
  guide: {
    palette: { hair: '#3b2b2a', cap: '#3a8f8f', capBrim: '#ffffff', jacket: '#3a8f8f', shirt: '#ffffff', pants: '#2f3a4a' },
    style: { ...NO_BAG, hat: 'cap' },
  },
  swimmer: {
    palette: { hair: '#2b2020', jacket: '#2f7fd9', shirt: '#2f7fd9', pants: '#1f5fa8', shoes: '#f4f4f4' },
    style: { ...NO_BAG, hat: 'none', hair: 'spiky' },
  },
  'leader-water': {
    palette: { hair: '#3fa0d9', jacket: '#2b6cb0', shirt: '#e0f4ff', pants: '#1d3557', shoes: '#f4f4f4' },
    style: { ...NO_BAG, hat: 'none', hair: 'long', coat: 'long' },
  },
  youngster: {
    palette: { hair: '#2b2020', cap: '#3a7bd5', capBrim: '#ffffff', jacket: '#f2f2f2', shirt: '#3a7bd5', pants: '#e0b040', shoes: '#e8484a' },
    style: { ...NO_BAG, hat: 'cap', hair: 'short', scale: 0.8 },
    accent: '#3a7bd5',
  },
  lass: {
    palette: { hair: '#c0703a', jacket: '#e86a8a', shirt: '#ffffff', pants: '#3a4a7a', shoes: '#2a2a3a' },
    style: { ...NO_BAG, hat: 'none', hair: 'pony', coat: 'dress', scale: 0.84 },
    accent: '#e86a8a',
  },
  camper: {
    palette: { hair: '#5a3a2a', cap: '#6a8a4a', capBrim: '#5a7a3a', jacket: '#7a9a5a', shirt: '#f4efe6', pants: '#8a6a42', shoes: '#4a3a2a', bag: '#c0703a' },
    style: { hat: 'bucket', hair: 'long', scale: 0.86, bag: true },
  },
  guard: {
    palette: { hair: '#2b2020', cap: '#23395d', capBrim: '#23395d', jacket: '#34568b', shirt: '#ffffff', pants: '#23395d', shoes: '#1f1f2a' },
    style: { ...NO_BAG, hat: 'cap' },
  },
  // ———— M2-19 碧潮群岛（程序化占位造型；手工人物模型到位后按 look 替换） ————
  'leader-grass': {
    palette: { hair: '#5d9a3e', jacket: '#3f7a3a', shirt: '#f2f0d8', pants: '#5a4028', shoes: '#3a2a1a' },
    style: { ...NO_BAG, hat: 'none', hair: 'long', coat: 'dress' },
    accent: '#a6e07a',
  },
  'leader-rock': {
    palette: { hair: '#3a2a1a', skin: '#d9a77c', cap: '#c08a3e', capBrim: '#8a5a2a', jacket: '#8a6440', shirt: '#f2d9a0', pants: '#4a3a2a', shoes: '#2a2018' },
    style: { ...NO_BAG, hat: 'bandana', hair: 'short', beard: true },
  },
  'leader-fire': {
    palette: { hair: '#e8502a', jacket: '#2c2428', shirt: '#f0742a', pants: '#2c2428', shoes: '#c8502a' },
    style: { ...NO_BAG, hat: 'none', hair: 'spiky', coat: 'long' },
    accent: '#f0742a',
  },
  miner: {
    palette: { hair: '#3a2a1a', skin: '#e0b088', cap: '#f2c230', capBrim: '#c89a1a', jacket: '#c07a3a', shirt: '#6a6a72', pants: '#3d4a6a', shoes: '#3a2a1a' },
    style: { ...NO_BAG, hat: 'cap', hair: 'short' },
  },
  researcher: {
    palette: { hair: '#2b2b35', jacket: '#f2f0ea', shirt: '#c8502a', pants: '#3b3640', shoes: '#2a2a30' },
    style: { ...NO_BAG, hat: 'none', hair: 'short', coat: 'long', glasses: true },
  },
  'kimono-f': {
    palette: { hair: '#2b2020', jacket: '#3f6db5', shirt: '#f2e6d0', pants: '#3f6db5', shoes: '#f2e6d0' },
    style: { ...NO_BAG, hat: 'none', hair: 'bun', coat: 'dress' },
    accent: '#e07a8a',
  },
  // ———— M3-29 雷鸣 / 琉璃 馆主、四天王、冠军、关键 NPC（程序化占位；各有区分，共用骨骼命名 hip/spine/head/arm.*/leg.*） ————
  'leader-electric': {
    palette: { hair: '#f2d040', skin: '#f0c8a0', cap: '#2a2e3a', capBrim: '#3a3e4a', jacket: '#2a2e3a', shirt: '#f2c230', pants: '#2a2e3a', shoes: '#f2c230' },
    style: { ...NO_BAG, hat: 'goggles', hair: 'spiky', gloves: true, emblem: 'bolt' },
    accent: '#f2d040',
  },
  'leader-normal': {
    palette: { hair: '#f2c860', cap: '#f6e6b8', capBrim: '#f6e6b8', jacket: '#f2d080', shirt: '#fff8e6', pants: '#8a6a3a', shoes: '#8a5a2a' },
    style: { ...NO_BAG, hat: 'sunhat', hair: 'long', coat: 'long', emblem: 'sun' },
    accent: '#e8902a',
  },
  'leader-ice': {
    palette: { hair: '#e8f4fa', skin: '#f6e0d4', cap: '#6ab0d8', capBrim: '#f2f8fc', jacket: '#bfe0f0', shirt: '#f2f8fc', pants: '#4a6a8a', shoes: '#f2f8fc' },
    style: { ...NO_BAG, hat: 'beanie', hair: 'long', coat: 'long', scarf: true, emblem: 'snow' },
    accent: '#6ab0d8',
  },
  'leader-flying': {
    palette: { hair: '#8ab0e8', cap: '#3a5a8a', capBrim: '#f2f6ff', jacket: '#f2f6ff', shirt: '#8ab0e8', pants: '#3a4a6a', shoes: '#3a4a6a' },
    style: { ...NO_BAG, hat: 'feather', hair: 'pony', cape: 'short', scarf: true, emblem: 'wing' },
    accent: '#e8c050',
  },
  'leader-psychic': {
    palette: { hair: '#d8c0f0', jacket: '#6a3a9a', shirt: '#f2e6ff', pants: '#2a2240', shoes: '#2a2240', capBrim: '#f0d060' },
    style: { ...NO_BAG, hat: 'circlet', hair: 'long', coat: 'dress', emblem: 'eye', prop: 'orb' },
    accent: '#c89af0',
  },
  'leader-ghost': {
    palette: { hair: '#e8e8f0', skin: '#e8d8d0', cap: '#2a2440', jacket: '#2a2440', shirt: '#4a3e5a', pants: '#14141e', shoes: '#14141e' },
    style: { ...NO_BAG, hat: 'hood', hair: 'long', coat: 'long', emblem: 'wisp', prop: 'lantern', stoop: 0.1 },
    accent: '#a88af0',
  },
  'leader-glaze': {
    palette: { hair: '#1a4a6a', cap: '#2a8a9a', capBrim: '#f2f8ff', jacket: '#5fc0d0', shirt: '#f2f8ff', pants: '#2a8a9a', shoes: '#f2f8ff' },
    style: { ...NO_BAG, hat: 'circlet', hair: 'long', coat: 'dress', cape: 'short', emblem: 'wave', prop: 'staff' },
    accent: '#9fe8f0',
  },
  'e4-dark': {
    palette: { hair: '#c83a5a', cap: '#141018', jacket: '#2a2234', shirt: '#4a2a3a', pants: '#141018', shoes: '#141018' },
    style: { ...NO_BAG, hat: 'none', hair: 'spiky', cape: 'long', gloves: true, emblem: 'moon' },
    accent: '#c83a5a',
  },
  'e4-ghost': {
    palette: { hair: '#2a1a3a', jacket: '#5a3a8a', shirt: '#e8dcf0', pants: '#5a3a8a', shoes: '#e8dcf0', capBrim: '#f0d060' },
    style: { ...NO_BAG, hat: 'veil', hair: 'long', coat: 'dress', emblem: 'wisp', prop: 'fan' },
    accent: '#3a2a5a',
  },
  'e4-ice': {
    palette: { hair: '#e8f4ff', jacket: '#bfe6f8', shirt: '#ffffff', pants: '#5a8ab8', shoes: '#ffffff', capBrim: '#ffffff' },
    style: { ...NO_BAG, hat: 'circlet', hair: 'long', coat: 'long', scarf: true, emblem: 'snow', cape: 'short' },
    accent: '#5a8ab8',
  },
  'e4-dragon': {
    palette: { hair: '#e8e8e8', skin: '#e8b890', cap: '#2a2a3a', jacket: '#8a2a2a', shirt: '#2a2a3a', pants: '#2a2a3a', shoes: '#1a1a22' },
    style: { ...NO_BAG, hat: 'none', hair: 'short', beard: true, cape: 'long', shoulders: true, emblem: 'diamond', scale: 1.06 },
    accent: '#d8a040',
  },
  champion: {
    palette: { hair: '#7ac8e8', cap: '#2a4a8a', jacket: '#f2f6fa', shirt: '#3a6ab8', pants: '#3a6ab8', shoes: '#f2f6fa', capBrim: '#f2f6fa' },
    style: { ...NO_BAG, hat: 'none', hair: 'short', cape: 'long', shoulders: true, gloves: true, emblem: 'wave' },
    accent: '#e8c050',
  },
  oracle: {
    palette: { hair: '#e8e2ff', jacket: '#7a4a9a', shirt: '#f2e6ff', pants: '#7a4a9a', shoes: '#e8e2ff', capBrim: '#f0d060' },
    style: { ...NO_BAG, hat: 'veil', hair: 'long', coat: 'dress', prop: 'staff', emblem: 'eye', stoop: 0.12 },
    accent: '#c8b0f0',
  },
  engineer: {
    palette: { hair: '#3a3a40', cap: '#4a4a52', capBrim: '#6a6a72', jacket: '#e8b73a', shirt: '#4a4a52', pants: '#3d4a6a', shoes: '#2a2a30' },
    style: { ...NO_BAG, hat: 'goggles', hair: 'short', gloves: true, glasses: true },
    accent: '#8ad0f0',
  },
};

export function createNpcModel(a: NpcAppearance): TrainerModel {
  const preset = LOOK_PRESETS[a.look];
  const palette: TrainerPalette = { ...DEFAULT_TRAINER, ...preset.palette, ...a.palette };
  const style = { ...preset.style, ...a.style };
  return new TrainerModel(palette, style, { accent: a.accent ?? preset.accent });
}
