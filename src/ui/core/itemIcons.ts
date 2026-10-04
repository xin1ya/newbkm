/**
 * 道具图标：全部为手绘风格的内联 SVG（48×48，深色描边 + 平涂 + 高光，与卡通渲染一致），
 * 不依赖外部图片资源（Tauri / 离线都能用）。按 id 精确匹配，其次按口袋 / 分类回退。
 */

import natures from '@/config/data/natures.json';
import { BERRIES } from '@/config/berries';
import { ALPHA_MATERIALS } from '@/config/alpha/materials';

const O = '#27304a';
const SW = 2.2;
const HL = 'rgba(255,255,255,.55)';

type Svg = string;
const wrap = (body: string): Svg => `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

// ———————————————————— 精灵球 ————————————————————

function ball(top: string, extra = '', bottom = '#ffffff'): Svg {
  return wrap(
    `<circle cx="24" cy="24" r="19" fill="${bottom}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M5 24a19 19 0 0 1 38 0z" fill="${top}" stroke="${O}" stroke-width="${SW}"/>` +
      extra +
      `<path d="M5 24h38" stroke="${O}" stroke-width="3.2"/>` +
      `<circle cx="24" cy="24" r="6" fill="#fff" stroke="${O}" stroke-width="${SW + 0.6}"/>` +
      `<circle cx="24" cy="24" r="2.6" fill="#fff" stroke="${O}" stroke-width="1.2"/>` +
      `<path d="M13 13.5a12 12 0 0 1 7-4.5" stroke="${HL}" stroke-width="3" fill="none"/>`,
  );
}

const BALLS: Record<string, () => Svg> = {
  'poke-ball': () => ball('#e8484a'),
  'great-ball': () => ball('#3a7bd5', `<path d="M10 17l7-7.5 3 2.5-6 8z M38 17l-7-7.5-3 2.5 6 8z" fill="#e8484a" stroke="${O}" stroke-width="1.4"/>`),
  'ultra-ball': () => ball('#2e2f36', `<path d="M15 23V9.5h5V23z M28 23V9.5h5V23z" fill="#f2c230" stroke="${O}" stroke-width="1.2"/>`),
  'master-ball': () =>
    ball(
      '#7b4cc7',
      `<circle cx="13" cy="15" r="3.4" fill="#e86aa8" stroke="${O}" stroke-width="1.2"/><circle cx="35" cy="15" r="3.4" fill="#e86aa8" stroke="${O}" stroke-width="1.2"/>` +
        `<path d="M18.5 19.5l2-9 3.5 5 3.5-5 2 9" fill="none" stroke="#fff" stroke-width="2"/>`,
    ),
  'quick-ball': () =>
    ball('#3a8fd5', `<path d="M24 5.5l3.5 9.5h-7z M8 16l9 2.5-3 5.5z M40 16l-9 2.5 3 5.5z" fill="#f2c230" stroke="${O}" stroke-width="1.2"/>`, '#f2c230'),
  'net-ball': () =>
    ball('#2fb3a8', `<path d="M9 22l6-12M17 22l4-16M27 22l-4-16M33 22l-6-12M7 16h34M10 11h28" stroke="#1d2340" stroke-width="1.2" fill="none" opacity=".7"/>`),
  'dusk-ball': () =>
    ball('#2f5a3c', `<path d="M7 19c6-3 28-3 34 0M9 14c6-3 24-3 30 0" stroke="#f08a3c" stroke-width="2.4" fill="none"/>`, '#3a3b44'),
};

// ———————————————————— 药 ————————————————————

/** 喷雾瓶（伤药系列） */
function spray(body: string, label = '#ffffff'): Svg {
  return wrap(
    `<rect x="19" y="4" width="10" height="6" rx="1.5" fill="#d7dce8" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M29 6h6l2 3" fill="none" stroke="${O}" stroke-width="${SW}"/>` +
      `<rect x="17" y="10" width="14" height="5" rx="1" fill="#eef1f7" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M13 21c0-4 3-6 6-6h10c3 0 6 2 6 6v19c0 2-1.5 4-4 4H17c-2.5 0-4-2-4-4z" fill="${body}" stroke="${O}" stroke-width="${SW}"/>` +
      `<rect x="16.5" y="24" width="15" height="11" rx="2" fill="${label}" stroke="${O}" stroke-width="1.4"/>` +
      `<path d="M24 26.5v6M21 29.5h6" stroke="${body}" stroke-width="2.4"/>` +
      `<path d="M16 20v14" stroke="${HL}" stroke-width="2.4"/>`,
  );
}

/** 小药瓶（异常状态药） */
function vial(liquid: string, cap: string, mark = ''): Svg {
  return wrap(
    `<rect x="17" y="4" width="14" height="7" rx="2" fill="${cap}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M19 11h10v5l6 7v16c0 3-2 5-5 5H18c-3 0-5-2-5-5V23l6-7z" fill="#eef6fb" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M14.2 27h19.6v12c0 2.4-1.6 4-4 4H18.2c-2.4 0-4-1.6-4-4z" fill="${liquid}"/>` +
      mark +
      `<path d="M17 24v12" stroke="${HL}" stroke-width="2.4"/>`,
  );
}

/** 营养剂：高瓶 + 彩色瓶盖 + 能力标签 */
function vitamin(color: string, glyph: string): Svg {
  return wrap(
    `<rect x="16" y="3.5" width="16" height="7" rx="2" fill="${color}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M18 10.5h12v3c3 1 5 3 5 6V40c0 2.5-2 4.5-4.5 4.5h-13C15 44.5 13 42.5 13 40V19.5c0-3 2-5 5-6z" fill="#fbfbf7" stroke="${O}" stroke-width="${SW}"/>` +
      `<rect x="13.2" y="22" width="21.6" height="14" fill="${color}"/>` +
      `<path d="M13 22h22M13 36h22" stroke="${O}" stroke-width="1.4"/>` +
      `<text x="24" y="33.2" font-size="10" font-weight="900" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${glyph}</text>` +
      `<path d="M16.5 17v4M16.5 38v3" stroke="${HL}" stroke-width="2.2"/>`,
  );
}

function revive(): Svg {
  return wrap(
    `<path d="M24 4l14 20-14 20-14-20z" fill="#f6cd3a" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M24 4v40M10 24h28M24 4l-6 20 6 20 6-20z" fill="none" stroke="#c99a12" stroke-width="1.4"/>` +
      `<path d="M17 18l5-8" stroke="${HL}" stroke-width="2.6"/>`,
  );
}

// ———————————————————— 树果 ————————————————————

type BerryIconShape = 'round' | 'oval' | 'lum' | 'twin' | 'heart' | 'leafy' | 'root' | 'spiky' | 'bumpy';

function berryBody(fruit: string, shade: string, shape: BerryIconShape): string | null {
  const st = `fill="${fruit}" stroke="${O}" stroke-width="${SW}"`;
  switch (shape) {
    case 'twin':
      return `<circle cx="17" cy="30" r="10" ${st}/><circle cx="31" cy="30" r="10" ${st}/><path d="M17 20l7-6 7 6" stroke="#6b4a2a" stroke-width="2" fill="none"/>`;
    case 'heart':
      return `<path d="M24 43C13 35 9 29 9 23a8 8 0 0 1 15-4 8 8 0 0 1 15 4c0 6-4 12-15 20z" ${st}/>`;
    case 'leafy':
      return `<circle cx="24" cy="29" r="14" ${st}/><path d="M13 22c4-6 18-6 22 0" stroke="${shade}" stroke-width="2.2" fill="none"/><path d="M15 36c5 3 13 3 18 0" stroke="${shade}" stroke-width="1.6" fill="none"/>`;
    case 'root':
      return `<path d="M24 14c9 0 13 6 13 13 0 6-4 10-8 12l-2 6-3-5-3 5-2-6c-4-2-8-6-8-12 0-7 4-13 13-13z" ${st}/>`;
    case 'spiky':
      return `<path d="M24 13l4 5 6-2 0 6 6 3-4 5 3 6-6 1-2 6-5-3-5 3-2-6-6-1 3-6-4-5 6-3 0-6 6 2z" ${st}/>`;
    case 'bumpy':
      return `<circle cx="24" cy="29" r="14" ${st}/><circle cx="18" cy="24" r="3" fill="${shade}" opacity=".55"/><circle cx="29" cy="25" r="3" fill="${shade}" opacity=".55"/><circle cx="23" cy="33" r="3" fill="${shade}" opacity=".55"/><circle cx="31" cy="34" r="2.4" fill="${shade}" opacity=".55"/>`;
    default:
      return null;
  }
}

function berry(fruit: string, shade: string, shape: BerryIconShape = 'round'): Svg {
  const custom = berryBody(fruit, shade, shape);
  const body =
    custom !== null
      ? custom
      : shape === 'oval'
      ? `<ellipse cx="24" cy="28" rx="15" ry="13" fill="${fruit}" stroke="${O}" stroke-width="${SW}"/>`
      : shape === 'lum'
        ? `<path d="M24 14c10 0 15 7 15 15s-6 14-15 14S9 37 9 29s5-15 15-15z" fill="${fruit}" stroke="${O}" stroke-width="${SW}"/><path d="M15 30c3 5 15 5 18 0" stroke="${shade}" stroke-width="2" fill="none"/>`
        : `<circle cx="24" cy="28" r="15" fill="${fruit}" stroke="${O}" stroke-width="${SW}"/>`;
  return wrap(
    body +
      `<path d="M24 14c0-4 1-7 3-9" stroke="#6b4a2a" stroke-width="2.4" fill="none"/>` +
      `<path d="M26 9c5-4 11-3 13 0-4 4-9 4-13 0z" fill="#5fbf5a" stroke="${O}" stroke-width="1.6"/>` +
      `<path d="M14 24a10 10 0 0 1 6-6" stroke="${HL}" stroke-width="3" fill="none"/>` +
      `<circle cx="20" cy="35" r="1.3" fill="${shade}"/><circle cx="29" cy="33" r="1.3" fill="${shade}"/><circle cx="25" cy="38" r="1.3" fill="${shade}"/>`,
  );
}

// ———————————————————— 进化石 ————————————————————

function stone(fill: string, inner: string, glyph: string): Svg {
  return wrap(
    `<path d="M14 9l13-4 13 9 2 15-9 13-15 1-11-11 1-14z" fill="${fill}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M14 9l6 10-12 4M20 19l13 1 7-6M33 20l9 9M33 20l-6 23M20 19l-2 24" fill="none" stroke="${inner}" stroke-width="1.2" opacity=".6"/>` +
      glyph +
      `<path d="M15 13l4-2" stroke="${HL}" stroke-width="2.6"/>`,
  );
}

// ———————————————————— 携带物 ————————————————————

function orb(c: string, glow: string): Svg {
  return wrap(
    `<circle cx="24" cy="24" r="17" fill="${c}" stroke="${O}" stroke-width="${SW}"/>` +
      `<circle cx="24" cy="24" r="9" fill="${glow}" opacity=".55"/>` +
      `<path d="M13 18a12 12 0 0 1 8-7" stroke="${HL}" stroke-width="3.2" fill="none"/>`,
  );
}

function band(c: string): Svg {
  return wrap(
    `<ellipse cx="24" cy="22" rx="17" ry="8" fill="none" stroke="${O}" stroke-width="7"/>` +
      `<ellipse cx="24" cy="22" rx="17" ry="8" fill="none" stroke="${c}" stroke-width="4.4"/>` +
      `<path d="M30 28l4 14 4-3 3 4-1-15" fill="${c}" stroke="${O}" stroke-width="1.8"/>`,
  );
}

function scarf(c: string, stripe = '#ffffff'): Svg {
  return wrap(
    `<path d="M8 14c8 5 24 5 32 0l-2 8c-8 4-20 4-28 0z" fill="${c}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M28 21l2 21 6-2 1-20" fill="${c}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M30 36h6.5M29.6 31h7" stroke="${stripe}" stroke-width="1.8"/>`,
  );
}

function specs(): Svg {
  return wrap(
    `<circle cx="14" cy="25" r="8.5" fill="#bfe6f7" stroke="${O}" stroke-width="3"/>` +
      `<circle cx="34" cy="25" r="8.5" fill="#bfe6f7" stroke="${O}" stroke-width="3"/>` +
      `<path d="M22.5 24c1-2 2-2 3 0M5.5 23L3 19M42.5 23l2.5-4" stroke="${O}" stroke-width="2.6" fill="none"/>` +
      `<path d="M10 22l4-3M30 22l4-3" stroke="#fff" stroke-width="2"/>`,
  );
}

function shades(): Svg {
  return wrap(
    `<path d="M5 20h16l-1 8c-1 4-4 5-7 5s-6-2-7-6z M27 20h16l-1 7c-1 4-4 6-7 6s-6-1-7-5z" fill="#2e2f36" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M21 21c2-1.5 4-1.5 6 0" stroke="${O}" stroke-width="2.4" fill="none"/><path d="M9 23l4-1M31 23l4-1" stroke="#7a7f94" stroke-width="2"/>`,
  );
}

function belt(c: string, buckle = '#f2c230'): Svg {
  return wrap(
    `<path d="M3 20c7 3 35 3 42 0v9c-7 3-35 3-42 0z" fill="${c}" stroke="${O}" stroke-width="${SW}"/>` +
      `<rect x="17" y="17" width="14" height="15" rx="2" fill="${buckle}" stroke="${O}" stroke-width="${SW}"/>` +
      `<rect x="21" y="21" width="6" height="7" rx="1" fill="${c}" stroke="${O}" stroke-width="1.4"/>`,
  );
}

function sash(): Svg {
  return wrap(
    `<path d="M10 6l9-1 21 34-9 3z" fill="#f4f4f0" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M14 11l20 30" stroke="#e8484a" stroke-width="2"/>` +
      `<circle cx="20" cy="20" r="5" fill="#e8484a" stroke="${O}" stroke-width="1.6"/>`,
  );
}

function leftovers(): Svg {
  return wrap(
    `<path d="M17 12c-6 2-8 10-6 18 2 9 8 12 13 12s11-3 13-12c2-8 0-16-6-18-3-1-5 1-7 1s-4-2-7-1z" fill="#e8484a" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M16 22c3 2 3 10 0 13 5 2 11 2 16 0-3-3-3-11 0-13-5 2-11 2-16 0z" fill="#fbf1d0" stroke="${O}" stroke-width="1.6"/>` +
      `<path d="M24 12c0-3 1-5 3-7" stroke="#6b4a2a" stroke-width="2.4" fill="none"/>`,
  );
}

function rock(c: string, mark = ''): Svg {
  return wrap(
    `<path d="M8 30l4-13 11-7 12 4 6 12-4 12-15 4-12-4z" fill="${c}" stroke="${O}" stroke-width="${SW}"/>` +
      mark +
      `<path d="M13 19l7-5" stroke="${HL}" stroke-width="2.6"/>`,
  );
}

function drop(c: string): Svg {
  return wrap(
    `<path d="M24 4c7 10 14 17 14 25a14 14 0 0 1-28 0c0-8 7-15 14-25z" fill="${c}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M17 27c0-4 2-8 5-11" stroke="${HL}" stroke-width="3" fill="none"/>`,
  );
}

function seed(): Svg {
  return wrap(
    `<path d="M24 42c-9 0-14-7-14-15 0-9 7-16 14-21 7 5 14 12 14 21 0 8-5 15-14 15z" fill="#c9a35a" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M24 12c-1 8 3 12 6 14M24 6v36" stroke="#8a6a2a" stroke-width="1.6" fill="none"/>` +
      `<path d="M24 6c2-3 7-4 10-2-2 4-7 4-10 2z" fill="#5fbf5a" stroke="${O}" stroke-width="1.4"/>`,
  );
}

function magnet(): Svg {
  return wrap(
    `<path d="M10 8h9v17a5 5 0 0 0 10 0V8h9v17a14 14 0 0 1-28 0z" fill="#e8484a" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M10 8h9v7h-9zM29 8h9v7h-9z" fill="#d7dce8" stroke="${O}" stroke-width="${SW}"/>`,
  );
}

function beak(): Svg {
  return wrap(
    `<path d="M6 20c10-10 26-12 36-4-8 0-14 3-18 8 6 0 12 1 16 4-12 6-26 4-34-8z" fill="#f2b541" stroke="${O}" stroke-width="${SW}"/>` +
      `<circle cx="15" cy="20" r="2" fill="${O}"/>`,
  );
}

function powder(): Svg {
  return wrap(
    `<path d="M14 18h20l3 22c0 2-2 4-4 4H15c-2 0-4-2-4-4z" fill="#e3e6ef" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M14 18c1-4 4-6 10-6s9 2 10 6" fill="#c7cbd8" stroke="${O}" stroke-width="${SW}"/>` +
      `<circle cx="20" cy="8" r="1.6" fill="#b6bdcf"/><circle cx="27" cy="5" r="1.2" fill="#b6bdcf"/><circle cx="30" cy="10" r="1.4" fill="#b6bdcf"/>` +
      `<path d="M15 30h18" stroke="#9aa2bd" stroke-width="1.4"/>`,
  );
}

function barb(): Svg {
  return wrap(
    `<path d="M24 3l6 18-6 24-6-24z" fill="#9b5ac0" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M18 21l-8 4 9 2M30 21l8 4-9 2" fill="#9b5ac0" stroke="${O}" stroke-width="1.8"/>` +
      `<path d="M22 10l1-4" stroke="${HL}" stroke-width="2.4"/>`,
  );
}

function ice(): Svg {
  return wrap(
    `<path d="M24 4l9 9-3 13 9 6-9 12H18L9 32l9-6-3-13z" fill="#bfe8f5" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M24 4v40M15 13l15 13M33 13L18 26" stroke="#7cc7e0" stroke-width="1.4" fill="none"/>` +
      `<path d="M18 11l3-3" stroke="#fff" stroke-width="2.4"/>`,
  );
}

function tag(): Svg {
  return wrap(
    `<path d="M12 6h24v30l-12 8-12-8z" fill="#f4ecd6" stroke="${O}" stroke-width="${SW}"/>` +
      `<circle cx="24" cy="12" r="2.4" fill="#fff" stroke="${O}" stroke-width="1.6"/>` +
      `<path d="M18 20c4 3 8 3 12 0M24 22v12M19 28h10" stroke="#7b4cc7" stroke-width="2.2" fill="none"/>`,
  );
}

function spoon(): Svg {
  return wrap(
    `<ellipse cx="15" cy="14" rx="8" ry="10" transform="rotate(-25 15 14)" fill="#d7dce8" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M20 22c4 4 2 8 6 10s6 3 12 10" stroke="${O}" stroke-width="6" fill="none"/><path d="M20 22c4 4 2 8 6 10s6 3 12 10" stroke="#d7dce8" stroke-width="3.2" fill="none"/>` +
      `<path d="M11 10l3-3" stroke="#fff" stroke-width="2.4"/>`,
  );
}

function fang(): Svg {
  return wrap(
    `<path d="M14 6c8-2 16-2 22 2-2 10-6 22-14 34-2-12-6-24-8-36z" fill="#f7f3e6" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M14 6c8 2 15 2 22 2" stroke="#6b7bd8" stroke-width="3" fill="none"/>` +
      `<path d="M19 12c1 6 2 11 3 16" stroke="#d8d2bf" stroke-width="2" fill="none"/>`,
  );
}

function protector(): Svg {
  return wrap(
    `<path d="M24 6l15 6v12c0 9-7 15-15 18C16 39 9 33 9 24V12z" fill="#8a6a4a" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M24 12l9 4v8c0 5-4 9-9 11-5-2-9-6-9-11v-8z" fill="#c9a36a" stroke="${O}" stroke-width="1.4"/><circle cx="24" cy="22" r="3.4" fill="#e8484a" stroke="${O}" stroke-width="1.2"/>`,
  );
}

function coat(): Svg {
  return wrap(
    `<path d="M12 8h24l6 10-6 4v20H12V22l-6-4z" fill="#b8c0cc" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M20 8l4 7 4-7M24 15v27" stroke="${O}" stroke-width="1.6" fill="none"/><path d="M16 14v24" stroke="#fff" stroke-width="2.4"/>`,
  );
}

function sandBag(): Svg {
  return wrap(
    `<path d="M14 18c-4 6-5 14-2 20 2 4 6 6 12 6s10-2 12-6c3-6 2-14-2-20z" fill="#d9b876" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M14 18c3-3 17-3 20 0M18 14l6 4 6-4" stroke="${O}" stroke-width="1.8" fill="none"/>` +
      `<circle cx="20" cy="30" r="1.2" fill="#a68745"/><circle cx="27" cy="34" r="1.2" fill="#a68745"/><circle cx="24" cy="26" r="1.2" fill="#a68745"/>`,
  );
}

function feather(c: string): Svg {
  return wrap(
    `<path d="M38 6C22 8 10 20 10 36l4 2c10-2 22-14 24-32z" fill="${c}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M8 42L36 9M20 28l-6-2M25 22l-6-3M30 16l-5-3" stroke="${O}" stroke-width="1.4" fill="none"/>`,
  );
}

function linkingCord(): Svg {
  return wrap(
    `<path d="M10 30c0-10 8-16 14-10s14 0 14-10" fill="none" stroke="${O}" stroke-width="7"/>` +
      `<path d="M10 30c0-10 8-16 14-10s14 0 14-10" fill="none" stroke="#e85a8a" stroke-width="4"/>` +
      `<path d="M10 30c0 6 4 10 10 10s10-4 14-8" fill="none" stroke="${O}" stroke-width="7"/>` +
      `<path d="M10 30c0 6 4 10 10 10s10-4 14-8" fill="none" stroke="#5aa8e8" stroke-width="4"/>` +
      `<circle cx="38" cy="10" r="4" fill="#f2c230" stroke="${O}" stroke-width="${SW}"/><circle cx="34" cy="32" r="4" fill="#f2c230" stroke="${O}" stroke-width="${SW}"/>`,
  );
}

function crownRock(): Svg {
  return wrap(
    `<path d="M7 36l3-22 8 9 6-14 6 14 8-9 3 22z" fill="#f2c230" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M7 36h34v5H7z" fill="#d99a1a" stroke="${O}" stroke-width="${SW}"/>` +
      `<circle cx="24" cy="29" r="3" fill="#3aa0c8" stroke="${O}" stroke-width="1.4"/>`,
  );
}

// ———————————————————— 重要物品 / 学习器 / 洗练 ————————————————————

function rod(line: string): Svg {
  return wrap(
    `<path d="M6 42L38 6" stroke="${O}" stroke-width="5"/><path d="M6 42L38 6" stroke="#9a6b3e" stroke-width="2.6"/>` +
      `<circle cx="13" cy="34" r="4" fill="#d7dce8" stroke="${O}" stroke-width="1.8"/>` +
      `<path d="M38 6c4 8 4 18 2 26" stroke="${line}" stroke-width="1.4" fill="none"/>` +
      `<circle cx="40" cy="34" r="3" fill="#e8484a" stroke="${O}" stroke-width="1.4"/>`,
  );
}

function bicycle(): Svg {
  const wheel = (cx: number): string =>
    `<circle cx="${cx}" cy="32" r="9" fill="none" stroke="${O}" stroke-width="3"/><circle cx="${cx}" cy="32" r="6.5" fill="none" stroke="#c9d0dc" stroke-width="1"/><circle cx="${cx}" cy="32" r="1.6" fill="${O}"/>`;
  return wrap(
    wheel(12) +
      wheel(36) +
      `<path d="M12 32l9-12h13l-9 12zM21 20l-2-5M34 20l2 12M33 13l2 7" fill="none" stroke="#2fa59a" stroke-width="3"/>` +
      `<path d="M16 14h7M31 13h6" stroke="${O}" stroke-width="2.6"/><circle cx="25" cy="32" r="2.4" fill="#e8b84a" stroke="${O}" stroke-width="1.2"/>` +
      `<path d="M36 13h6v5h-6z" fill="#e8c890" stroke="${O}" stroke-width="1.4"/>`,
  );
}

function ticket(): Svg {
  return wrap(
    `<path d="M4 14h40v7a3 3 0 0 0 0 6v7H4v-7a3 3 0 0 0 0-6z" fill="#7fd0f0" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M32 14v20" stroke="${O}" stroke-width="1.4" stroke-dasharray="2 2"/>` +
      `<path d="M9 27c3-3 6-3 9 0s6 3 9 0" stroke="#fff" stroke-width="2" fill="none"/><path d="M12 22h10" stroke="${O}" stroke-width="1.6"/>`,
  );
}

function toolbox(): Svg {
  return wrap(
    `<path d="M17 14v-4h14v4" fill="none" stroke="${O}" stroke-width="${SW}"/>` +
      `<rect x="5" y="14" width="38" height="26" rx="3" fill="#3f7fd6" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M5 23h38" stroke="${O}" stroke-width="1.6"/><rect x="20" y="20" width="8" height="6" rx="1" fill="#f2c230" stroke="${O}" stroke-width="1.4"/>`,
  );
}

function herb(): Svg {
  return wrap(
    `<path d="M24 44V18" stroke="#4a8a3a" stroke-width="2.6"/>` +
      `<path d="M24 30c-10 0-15-6-15-12 8 0 14 4 15 12zM24 24c10 0 15-6 15-12-8 0-14 4-15 12zM24 18c-4-3-4-10 0-14 4 4 4 11 0 14z" fill="#6fcf8a" stroke="${O}" stroke-width="1.8"/>` +
      `<circle cx="24" cy="10" r="2.6" fill="#f6f0a8" stroke="${O}" stroke-width="1.2"/>`,
  );
}

/** 采集素材（计划文档 §9.2） */
function shell(c: string, rib: string): Svg {
  return wrap(
    `<path d="M24 8c11 0 18 9 18 18 0 6-4 10-8 12H14c-4-2-8-6-8-12 0-9 7-18 18-18z" fill="${c}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M24 38V10M24 38l-9-27M24 38l9-27M24 38L9 18M24 38l15-20" stroke="${rib}" stroke-width="1.5" fill="none"/>` +
      `<path d="M16 38h16v4H16z" fill="${c}" stroke="${O}" stroke-width="1.6"/>`,
  );
}
function pearlIcon(): Svg {
  return wrap(
    `<circle cx="24" cy="25" r="15" fill="#f4eef6" stroke="${O}" stroke-width="${SW}"/>` +
      `<circle cx="27" cy="28" r="9" fill="#e6dcef" opacity=".7"/><circle cx="18" cy="19" r="4" fill="#fff"/>`,
  );
}
function mushroom(cap: string, dots: string, glow = false): Svg {
  return wrap(
    (glow ? `<circle cx="24" cy="22" r="20" fill="${cap}" opacity=".25"/>` : '') +
      `<path d="M19 26h10l2 16H17z" fill="#f3ead6" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M6 27c0-11 8-19 18-19s18 8 18 19z" fill="${cap}" stroke="${O}" stroke-width="${SW}"/>` +
      `<circle cx="16" cy="19" r="2.6" fill="${dots}"/><circle cx="27" cy="15" r="2.2" fill="${dots}"/><circle cx="33" cy="22" r="2.4" fill="${dots}"/>`,
  );
}
function honeyJar(): Svg {
  return wrap(
    `<rect x="12" y="10" width="24" height="6" rx="2" fill="#c98a3a" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M10 18h28v20a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6z" fill="#f2b541" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M10 22c4 4 8-2 12 2s8-2 16 0" stroke="#d98a12" stroke-width="2" fill="none"/>` +
      `<path d="M15 28v8" stroke="${HL}" stroke-width="3"/>`,
  );
}

/** 种植工具与肥料（计划文档 §9.3） */
function wateringCan(): Svg {
  return wrap(
    `<path d="M10 20h22v18a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="#5aa9e6" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M32 26l10-10 3 3-11 13" fill="#5aa9e6" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M42 14l5 1-1 5z" fill="#c9d4e6" stroke="${O}" stroke-width="1.4"/>` +
      `<path d="M14 20c0-8 14-8 14 0" fill="none" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M14 26v10" stroke="${HL}" stroke-width="3"/>`,
  );
}
/** 金色喷壶（计划文档 §9.4，培育家 9 级） */
function goldenCan(): Svg {
  return wrap(
    `<path d="M10 20h22v18a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="#f2c84a" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M32 26l10-10 3 3-11 13" fill="#f2c84a" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M42 14l5 1-1 5z" fill="#fff2b8" stroke="${O}" stroke-width="1.4"/>` +
      `<path d="M14 20c0-8 14-8 14 0" fill="none" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M14 26v10" stroke="#fffbe6" stroke-width="3"/><path d="M21 31l2-4 2 4 4 1-4 1-2 4-2-4-4-1z" fill="#fff" stroke="#d99a1a" stroke-width="1"/>`,
  );
}
/** 性格薄荷（计划文档 §9.5）：按增加的能力着色的薄荷叶 */
const MINT_COLOR: Record<string, string> = { atk: '#e8504a', def: '#f2b632', spa: '#4a8fe0', spd: '#5cb85c', spe: '#f39ac0' };
function mintLeaf(c: string): Svg {
  return wrap(
    `<path d="M24 44V22" stroke="#3f7a3a" stroke-width="2.4"/>` +
      `<path d="M24 26C12 26 8 16 10 8c9 1 15 8 14 18z" fill="${c}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M24 30c11 0 16-8 14-17-9 1-15 8-14 17z" fill="#7fd08a" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M12 11l10 13M36 16l-11 12" stroke="${O}" stroke-width="1" opacity=".5"/>`,
  );
}
function mulchBag(c: string, glyph: string): Svg {
  return wrap(
    `<path d="M12 12h24l4 30H8z" fill="#c9a36a" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M12 12l3-5h18l3 5" fill="#a8844a" stroke="${O}" stroke-width="1.8"/>` +
      `<circle cx="24" cy="27" r="8" fill="${c}" stroke="${O}" stroke-width="1.6"/>` +
      glyph,
  );
}

/** 头目专属素材：菱形晶片 + 主色 */
function alphaMatIcon(c: string): Svg {
  return wrap(
    `<path d="M24 5l13 17-13 21-13-21z" fill="${c}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M24 11l7 11-7 13-7-13z" fill="#ffffff" fill-opacity="0.35" stroke="#c0202a" stroke-width="1.6"/>`,
  );
}

/** 头目之鳞：暗红菱形鳞片 + 金边 + 高光 */
function alphaScaleIcon(): Svg {
  return wrap(
    `<path d="M24 4l14 18-14 22-14-22z" fill="#c0202a" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M24 10l8 12-8 14-8-14z" fill="#e8484a" stroke="#f2c230" stroke-width="1.6"/>` +
      `<path d="M24 4v40M10 22h28" stroke="${O}" stroke-width="1" opacity=".35"/>` +
      `<path d="M18 16l4-5" stroke="${HL}" stroke-width="3" fill="none"/>`,
  );
}

/** 心之鳞片：粉色心形鳞片 + 珠光高光 */
function heartScaleIcon(): Svg {
  return wrap(
    `<path d="M24 41C12 32 6 25 6 17a9 9 0 0 1 18-2 9 9 0 0 1 18 2c0 8-6 15-18 24z" fill="#f59ab8" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M24 34c-7-6-11-10-11-15a5 5 0 0 1 9-3" fill="none" stroke="#fde3ec" stroke-width="2"/>` +
      `<path d="M14 24c3 2 6 2 9 0M25 24c3 2 6 2 9 0M18 30c2 1.5 4 1.5 6 0M24 30c2 1.5 4 1.5 6 0" fill="none" stroke="#d76a92" stroke-width="1.2"/>` +
      `<circle cx="15" cy="15" r="2.2" fill="${HL}"/>`,
  );
}

function disc(c: string): Svg {
  return wrap(
    `<circle cx="24" cy="24" r="19" fill="${c}" stroke="${O}" stroke-width="${SW}"/>` +
      `<circle cx="24" cy="24" r="13" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.4"/>` +
      `<circle cx="24" cy="24" r="5" fill="#f3f5fa" stroke="${O}" stroke-width="1.8"/>` +
      `<path d="M11 17a14 14 0 0 1 8-7" stroke="${HL}" stroke-width="3" fill="none"/>`,
  );
}

function rerollStone(single: boolean): Svg {
  const facets = single
    ? `<path d="M24 6l8 12H16z" fill="#f2c230" opacity=".9"/>`
    : `<path d="M24 6l8 12H16z" fill="#f2c230" opacity=".8"/><path d="M16 18h16l-8 24z" fill="#3a7bd5" opacity=".55"/><path d="M8 18h8l8 24z" fill="#e8484a" opacity=".5"/><path d="M40 18h-8l-8 24z" fill="#3fb88a" opacity=".55"/>`;
  return wrap(
    `<path d="M14 6h20l8 12-18 26L6 18z" fill="#c9b8f0" stroke="${O}" stroke-width="${SW}"/>` +
      facets +
      `<path d="M6 18h36M14 6l2 12 8 26 8-26 2-12" fill="none" stroke="${O}" stroke-width="1.4"/>` +
      `<path d="M14 11l3-3" stroke="#fff" stroke-width="2.6"/>` +
      `<path d="M38 4l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z" fill="#fff" stroke="${O}" stroke-width=".8"/>`,
  );
}

function cap(fill: string, rim: string): Svg {
  let teeth = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    teeth += `${i ? 'L' : 'M'}${(24 + Math.cos(a) * 19).toFixed(1)} ${(26 + Math.sin(a) * 15).toFixed(1)}L${(24 + Math.cos(a + 0.26) * 16.5).toFixed(1)} ${(26 + Math.sin(a + 0.26) * 13).toFixed(1)}`;
  }
  return wrap(
    `<path d="${teeth}z" fill="${rim}" stroke="${O}" stroke-width="${SW}"/>` +
      `<ellipse cx="24" cy="24" rx="13" ry="10" fill="${fill}" stroke="${O}" stroke-width="1.8"/>` +
      `<path d="M17 25l2-7 5 4 5-4 2 7z" fill="#fff" opacity=".85" stroke="${O}" stroke-width="1.2"/>` +
      `<path d="M15 20a9 7 0 0 1 6-4" stroke="#fff" stroke-width="2.4" fill="none"/>`,
  );
}

// ———————————————————— 映射 ————————————————————

const VITAMIN_ICON: Record<string, [string, string]> = {
  'hp-up': ['#3fb88a', 'HP'],
  protein: ['#e8484a', '攻'],
  iron: ['#6a7a9a', '防'],
  calcium: ['#3a7bd5', '特攻'],
  zinc: ['#d99a1a', '特防'],
  carbos: ['#f08a3c', '速'],
};

const ICONS: Record<string, () => Svg> = {
  ...BALLS,
  potion: () => spray('#9b6ad0'),
  'super-potion': () => spray('#f08a3c'),
  'hyper-potion': () => spray('#e8569a'),
  'full-restore': () => spray('#f2c230'),
  antidote: () => vial('#8fd16a', '#5a9a3a'),
  'paralyze-heal': () => vial('#f6d84a', '#c9a012'),
  awakening: () => vial('#6aa8f0', '#3a6fc0'),
  'burn-heal': () => vial('#f07a5a', '#c04a32'),
  'ice-heal': () => vial('#a8e6f5', '#5ab0d0'),
  'full-heal': () => vial('#f6e9a0', '#e0b830', `<path d="M24 30v8M20 34h8" stroke="#e8484a" stroke-width="2.4"/>`),
  revive: revive,
  'oran-berry': () => berry('#4a8fe0', '#2f63b0'),
  'sitrus-berry': () => berry('#f2d24a', '#c9a012', 'oval'),
  'lum-berry': () => berry('#7fcf6a', '#4a9a3a', 'lum'),
  'fire-stone': () => stone('#f08a3c', '#c04a1a', `<path d="M24 34c-5 0-7-4-6-8 1-3 4-4 4-8 3 2 4 4 4 6 1-1 2-2 2-4 3 3 4 6 3 9-1 3-3 5-7 5z" fill="#f6d84a" stroke="#c04a1a" stroke-width="1.2"/>`),
  'water-stone': () => stone('#5aa9e6', '#2f6db5', `<path d="M24 14c4 6 7 10 7 14a7 7 0 0 1-14 0c0-4 3-8 7-14z" fill="#d8f0ff" stroke="#2f6db5" stroke-width="1.2"/>`),
  'thunder-stone': () => stone('#8fd16a', '#4a8a3a', `<path d="M27 12l-8 14h6l-4 12 10-16h-6l4-10z" fill="#f6d84a" stroke="#8a6a12" stroke-width="1.2"/>`),
  'leaf-stone': () => stone('#c9a35a', '#8a6a2a', `<path d="M24 38c-7-6-8-16 0-24 8 8 7 18 0 24zM24 16v22" fill="#5fbf5a" stroke="#2f7a3a" stroke-width="1.2"/>`),
  'sun-stone': () => stone('#f2b541', '#c97a12', `<circle cx="24" cy="25" r="5" fill="#e8484a" stroke="#8a3a12" stroke-width="1.2"/><path d="M24 15v4M24 31v4M14 25h4M30 25h4M17 18l3 3M28 29l3 3M31 18l-3 3M20 29l-3 3" stroke="#e8484a" stroke-width="1.6"/>`),
  'kings-rock': crownRock,
  'linking-cord': linkingCord,
  leftovers: leftovers,
  'choice-band': () => band('#e8484a'),
  'choice-specs': specs,
  'choice-scarf': () => scarf('#3a7bd5'),
  'life-orb': () => orb('#7b4cc7', '#e86aa8'),
  'focus-sash': sash,
  'expert-belt': () => belt('#2e2f36', '#e8484a'),
  charcoal: () => rock('#3a3b44', `<path d="M16 26l6-4 4 6 6-4" stroke="#f08a3c" stroke-width="1.6" fill="none"/>`),
  'mystic-water': () => drop('#5aa9e6'),
  'miracle-seed': seed,
  magnet: magnet,
  'sharp-beak': beak,
  'silver-powder': powder,
  'poison-barb': barb,
  'silk-scarf': () => scarf('#f4f4f0', '#c7cbd8'),
  'black-belt': () => belt('#2e2f36'),
  'soft-sand': sandBag,
  'hard-stone': () => rock('#a8987a', `<path d="M14 28l10-6 12 4M24 22l2 14" stroke="#6b5f4a" stroke-width="1.4" fill="none"/>`),
  'never-melt-ice': ice,
  'spell-tag': tag,
  'twisted-spoon': spoon,
  'dragon-fang': fang,
  'black-glasses': shades,
  'metal-coat': coat,
  protector,
  'fairy-feather': () => feather('#f6b4d8'),
  'old-rod': () => rod('#9aa2bd'),
  'good-rod': () => rod('#3a7bd5'),
  'super-rod': () => rod('#e8484a'),
  'ferry-pass': ticket,
  bicycle,
  'fisher-tackle': toolbox,
  'moon-herb': herb,
  'medicinal-herb': herb,
  'fragrant-herb': () => herb().replace('#6fcf8a', '#a8e0b4').replace('#f6f0a8', '#ffffff'),
  seashell: () => shell('#f7c9b0', '#d9907a'),
  pearl: pearlIcon,
  'tiny-mushroom': () => mushroom('#e8484a', '#ffffff'),
  'big-mushroom': () => mushroom('#c96a2a', '#f6e0b0'),
  'glow-mushroom': () => mushroom('#5ad6e0', '#e6fdff', true),
  gravel: () => rock('#9a9488', `<path d="M14 30l6-3M26 24l6 3M20 34l8-1" stroke="#6b665c" stroke-width="1.4" fill="none"/>`),
  'hard-ore': () => rock('#6a7488', `<path d="M16 24l8 4 8-6M22 34l3-6" stroke="#c9d4e6" stroke-width="1.6" fill="none"/>`),
  honey: honeyJar,
  'watering-can': wateringCan,
  'growth-mulch': () => mulchBag('#6fcf8a', `<path d="M24 32v-9M20 26l4-4 4 4" stroke="#fff" stroke-width="2" fill="none"/>`),
  'rich-mulch': () => mulchBag('#f2c230', `<path d="M20 27h8M24 23v8" stroke="#fff" stroke-width="2.2"/>`),
  'damp-mulch': () => mulchBag('#5aa9e6', `<path d="M24 21c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z" fill="#fff"/>`),
  'surprise-mulch': () => mulchBag('#b68ae0', `<path d="M24 21l1.8 4 4.2.5-3.1 2.9.8 4.2-3.7-2.1-3.7 2.1.8-4.2-3.1-2.9 4.2-.5z" fill="#fff"/>`),
  'alpha-scale': alphaScaleIcon,
  'heart-scale': heartScaleIcon,
  'reroll-stone': () => rerollStone(false),
  'focus-reroll-stone': () => rerollStone(true),
  'bottle-cap': () => cap('#e3e6ef', '#b6bdcf'),
  'gold-bottle-cap': () => cap('#f6d84a', '#d99a1a'),
};
for (const [id, [c, g]] of Object.entries(VITAMIN_ICON)) ICONS[id] = () => vitamin(c, g);
ICONS['golden-watering-can'] = goldenCan;
for (const n of natures as { id: string; plus: string | null; minus: string | null }[]) {
  if ((n.plus && n.plus !== n.minus) || n.id === 'serious') ICONS[`mint-${n.id}`] = () => mintLeaf(n.plus && n.plus !== n.minus ? (MINT_COLOR[n.plus] ?? '#8fd6a0') : '#c9d4e6');
}
// 树果：按 berries.json 的果色与形状（已有手绘图标的 3 种保留）
for (const m of ALPHA_MATERIALS) ICONS[m.id] = () => alphaMatIcon(m.color);
for (const b of BERRIES) if (!ICONS[b.id]) ICONS[b.id] = () => berry(b.color.fruit, b.color.shade, b.shape);

const cache = new Map<string, Svg>();

/**
 * 道具图标 SVG 字符串。
 * @param tmColor 招式学习器的属性色（按招式属性着色）
 * @param pocket 未登记图标时按口袋回退
 */
export function itemIconSvg(id: string, opts: { tmColor?: string | undefined; pocket?: string | undefined } = {}): Svg {
  const key = `${id}|${opts.tmColor ?? ''}|${opts.pocket ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let svg: Svg;
  const f = ICONS[id];
  if (f) svg = f();
  else if (id.startsWith('tm-')) svg = disc(opts.tmColor ?? '#8a8fa3');
  else if (id.endsWith('-ball')) svg = ball('#8a8fa3');
  else if (id.endsWith('-berry')) svg = berry('#e8484a', '#a8322a');
  else if (opts.pocket === 'medicine') svg = vial('#f6a0c0', '#c04a7a');
  else if (opts.pocket === 'evolution') svg = stone('#b6bdcf', '#6a7190', '');
  else if (opts.pocket === 'held') svg = orb('#8a8fa3', '#ffffff');
  else svg = toolbox();
  cache.set(key, svg);
  return svg;
}

/** 生成图标元素（span，内含 SVG） */
export function itemIconEl(id: string, size: number, opts: { tmColor?: string | undefined; pocket?: string | undefined } = {}): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = 'cl-item-icon';
  s.style.cssText = `display:inline-flex;width:${size}px;height:${size}px;flex:none;`;
  s.innerHTML = itemIconSvg(id, opts);
  const svg = s.firstElementChild as SVGElement | null;
  if (svg) {
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
  }
  return s;
}

/** 已登记专属图标的道具 id（测试用：保证所有道具都有图标） */
export function hasItemIcon(id: string): boolean {
  return id in ICONS || id.startsWith('tm-');
}
