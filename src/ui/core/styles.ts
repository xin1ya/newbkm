/**
 * UI-001 · 全局 UI 样式（一次性注入）。
 * 风格：圆角白底卡片 + 深蓝描边（呼应 Toon 描边），翠澜主色 #3fb88a / 强调 #f6c945。
 */
const CSS = /* css */ `
.cl-ui { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif; color: #1d2340; user-select: none; z-index: 10; }
.cl-ui * { box-sizing: border-box; }
.cl-ui .interactive { pointer-events: auto; }
.cl-card { background: #fffdf7; border: 3px solid #27304a; border-radius: 16px; box-shadow: 0 4px 0 #27304a, 0 10px 30px rgba(10,20,50,.25); }
.cl-dialog { position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%); width: min(880px, calc(100% - 32px)); min-height: 124px; padding: 18px 26px 20px; font-size: 21px; line-height: 1.6; letter-spacing: .02em; }
.cl-dialog .speaker { position: absolute; top: -20px; left: 22px; background: #3fb88a; color: #fff; border: 3px solid #27304a; border-radius: 12px; padding: 2px 14px; font-size: 16px; font-weight: 700; }
.cl-dialog .next { position: absolute; right: 18px; bottom: 10px; width: 0; height: 0; border-left: 9px solid transparent; border-right: 9px solid transparent; border-top: 12px solid #e8484a; animation: cl-bob .8s ease-in-out infinite; }
@keyframes cl-bob { 50% { transform: translateY(4px); } }
.cl-menu { position: absolute; padding: 8px; min-width: 180px; font-size: 19px; }
.cl-menu .item { padding: 8px 16px 8px 30px; border-radius: 10px; position: relative; cursor: pointer; white-space: nowrap; }
.cl-menu .item.sel { background: #e7f6ef; }
.cl-menu .item.sel::before { content: ''; position: absolute; left: 10px; top: 50%; margin-top: -7px; border-left: 11px solid #27304a; border-top: 7px solid transparent; border-bottom: 7px solid transparent; }
.cl-menu .item.disabled { color: #9aa0b3; }
.cl-menu .item .sub { font-size: 13px; color: #6a7190; margin-left: 10px; }
.cl-fade { position: absolute; inset: 0; background: #000; opacity: 0; transition: opacity .35s ease; pointer-events: none; }
.cl-swirl { position: absolute; inset: 0; pointer-events: none; }
.cl-toast { position: absolute; left: 50%; top: 26%; transform: translate(-50%, -10px); padding: 10px 22px; font-size: 18px; opacity: 0; transition: opacity .25s, transform .25s; }
.cl-toast.show { opacity: 1; transform: translate(-50%, 0); }
.cl-banner { position: absolute; left: 50%; top: 13%; transform: translateX(-50%); text-align: center; opacity: 0; transition: opacity .6s; color: #fff; text-shadow: 0 2px 0 #27304a, 0 0 12px rgba(0,0,0,.35); }
.cl-banner.show { opacity: 1; }
.cl-banner .name { font-size: 40px; font-weight: 800; letter-spacing: .12em; }
.cl-banner .sub { font-size: 16px; letter-spacing: .3em; opacity: .9; }
.cl-banner .line { height: 3px; margin: 6px auto; width: 70%; background: linear-gradient(90deg, transparent, #fff, transparent); }
.cl-debug { position: absolute; left: 8px; top: 8px; padding: 8px 10px; font: 12px/1.45 ui-monospace, Consolas, monospace; color: #dff; background: rgba(8,14,30,.72); border-radius: 8px; white-space: pre; }
.cl-hint { position: absolute; right: 16px; bottom: 16px; font-size: 13px; color: #fff; text-shadow: 0 1px 2px #000; text-align: right; line-height: 1.7; }
.cl-hint kbd { display: inline-block; min-width: 22px; padding: 0 6px; margin: 0 2px; border: 2px solid #fff; border-radius: 6px; font: 700 12px/18px system-ui; text-align: center; background: rgba(0,0,0,.35); }
.cl-clock { position: absolute; right: 16px; top: 14px; padding: 6px 14px; font-size: 16px; font-weight: 700; }
.cl-loading { position: absolute; inset: 0; background: radial-gradient(circle at 50% 40%, #1d3a5a, #0b1020); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #dfeaff; gap: 18px; pointer-events: auto; transition: opacity .5s; }
.cl-loading .title { font-size: 44px; font-weight: 800; letter-spacing: .3em; color: #fff; text-shadow: 0 3px 0 #3fb88a; }
.cl-loading .bar { width: min(420px, 70vw); height: 12px; border: 2px solid #dfeaff; border-radius: 8px; overflow: hidden; }
.cl-loading .bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #3fb88a, #f6c945); transition: width .2s; }
.cl-loading .msg { font-size: 14px; opacity: .8; }
`;

let injected = false;
const extras = new Set<string>();

/** 注入全局样式；extra 为模块自带样式，同一段只注入一次 */
export function injectUiStyles(extra = ''): void {
  if (!injected) {
    injected = true;
    const style = document.createElement('style');
    style.id = 'cl-ui-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  if (extra && !extras.has(extra)) {
    extras.add(extra);
    const s = document.createElement('style');
    s.textContent = extra;
    document.head.appendChild(s);
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}
