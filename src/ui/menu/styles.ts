/**
 * M1-18 · 菜单样式：半透明遮罩 + 居中大面板（圆角白底、深蓝描边，与 ui/core 统一），左侧栏 + 内容区 + 底部提示。
 */
export const MENU_CSS = /* css */ `
.cl-pause { position: absolute; inset: 0; background: rgba(12, 20, 40, 0.55); display: flex; align-items: center; justify-content: center; pointer-events: auto; animation: cl-pause-in .18s ease-out; }
@keyframes cl-pause-in { from { opacity: 0; } to { opacity: 1; } }
.cl-pause .panel { width: min(1000px, calc(100% - 32px)); height: min(600px, calc(100% - 32px)); display: grid; grid-template-columns: 170px 1fr; grid-template-rows: 54px 1fr 36px; overflow: hidden; padding: 0; }
.cl-pause .head { grid-column: 1 / 3; display: flex; align-items: center; gap: 18px; padding: 0 20px; background: #3fb88a; color: #fff; border-bottom: 3px solid #27304a; font-weight: 700; }
.cl-pause .head .title { font-size: 22px; letter-spacing: .1em; }
.cl-pause .head .meta { margin-left: auto; display: flex; gap: 16px; font-size: 14px; }
.cl-pause .side { border-right: 3px solid #27304a; background: #f3f7f4; padding: 10px 8px; display: flex; flex-direction: column; gap: 4px; }
.cl-pause .side .tab { padding: 10px 14px; border-radius: 10px; font-size: 18px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
.cl-pause .side .tab.sel { background: #fff; box-shadow: inset 0 0 0 2px #27304a; }
.cl-pause .side.inactive .tab.sel { box-shadow: inset 0 0 0 2px #9aa0b3; }
.cl-pause .side .tab .ico { width: 22px; text-align: center; }
.cl-pause .side .spacer { flex: 1; }
.cl-pause .body { position: relative; overflow: hidden; }
.cl-pause .foot { grid-column: 1 / 3; border-top: 3px solid #27304a; display: flex; align-items: center; gap: 16px; padding: 0 16px; font-size: 13px; color: #4a5270; background: #fbfaf4; }
.cl-pause .foot kbd { display: inline-block; min-width: 20px; padding: 0 5px; margin-right: 4px; border-radius: 5px; background: #27304a; color: #fff; font: 700 12px/18px system-ui; text-align: center; }
.cl-page { position: absolute; inset: 0; display: none; }
.cl-page.show { display: grid; }
.cl-page.blurred .sel { outline-color: #9aa0b3 !important; }

.cl-mon-icon.has-img { position: relative; overflow: visible; padding: 2px; box-sizing: border-box; }
.cl-mon-icon { flex: none; border-radius: 50%; border: 2px solid #27304a; color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; text-shadow: 0 1px 0 rgba(0,0,0,.4); }
.cl-type { display: inline-block; padding: 1px 8px; border-radius: 8px; color: #fff; font-size: 12px; font-weight: 700; margin-right: 4px; text-shadow: 0 1px 0 rgba(0,0,0,.35); }
.cl-bar { flex: 1; height: 8px; border-radius: 5px; background: #dfe3ec; overflow: hidden; border: 1.5px solid #27304a; }
.cl-bar i { display: block; height: 100%; }
.cl-hp { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; }
.cl-hp .lbl { color: #e8923a; }
.cl-hp .num { min-width: 60px; text-align: right; font-variant-numeric: tabular-nums; }
.cl-status { display: inline-block; padding: 0 6px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #fff; background: #8a8fa3; margin-left: 4px; }
.cl-status.psn, .cl-status.tox { background: #a040a0; } .cl-status.par { background: #d8b020; } .cl-status.brn { background: #e8603a; }
.cl-status.slp { background: #7a86a8; } .cl-status.frz { background: #58b8d8; } .cl-status.fnt { background: #c03030; }

/* 队伍 */
.cl-party { grid-template-columns: 330px 1fr; }
.cl-party .list { padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.cl-party .card { display: grid; grid-template-columns: 44px 1fr; gap: 4px 10px; align-items: center; padding: 8px 10px; border-radius: 12px; background: #fff; border: 2px solid #d5dae6; cursor: pointer; }
.cl-party .card.sel { border-color: #27304a; background: #e7f6ef; outline: 3px solid #3fb88a; outline-offset: 1px; }
.cl-party .card.swap { border-style: dashed; border-color: #e8923a; }
.cl-party .card.fainted { background: #f6e4e4; }
.cl-party .card .icon { grid-row: 1 / 3; }
.cl-party .card .name { font-weight: 800; font-size: 16px; display: flex; align-items: center; gap: 6px; }
.cl-party .card .name .lv { margin-left: auto; font-size: 13px; color: #4a5270; }
.cl-party .card .held { font-size: 11px; color: #6a7190; }
.cl-party .empty { color: #9aa0b3; text-align: center; padding: 30px 0; }
.cl-detail { padding: 14px 18px; overflow-y: auto; border-left: 2px dashed #d5dae6; }
.cl-detail .top { display: flex; gap: 14px; align-items: center; }
.cl-detail .top .nm { font-size: 22px; font-weight: 800; }
.cl-detail .top .sub { font-size: 13px; color: #6a7190; }
.cl-detail .tabs { display: flex; gap: 6px; margin: 12px 0 8px; }
.cl-detail .tabs span { padding: 3px 12px; border-radius: 8px; font-size: 13px; font-weight: 700; background: #eef1f6; cursor: pointer; }
.cl-detail .tabs span.on { background: #27304a; color: #fff; }
.cl-kv { display: grid; grid-template-columns: 90px 1fr; gap: 6px 10px; font-size: 14px; }
.cl-kv .k { color: #6a7190; }
.cl-kv .desc { grid-column: 2; font-size: 12px; color: #6a7190; margin-top: -4px; }
.cl-stats { display: grid; grid-template-columns: 64px 44px 1fr; gap: 6px 10px; align-items: center; font-size: 14px; }
.cl-stats .up { color: #e8484a; } .cl-stats .down { color: #3a7bd5; }
.cl-stats .v { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.cl-talent { display: grid; grid-template-columns: 150px 1fr; gap: 10px; align-items: center; }
.cl-talent svg { width: 150px; height: 150px; }
.cl-talent .rows { display: grid; grid-template-columns: 40px 64px 1fr 58px; gap: 5px 8px; align-items: center; font-size: 13px; }
.cl-talent .rows .h { font-size: 11px; color: #8a90a8; font-weight: 700; }
.cl-talent .g { font-weight: 800; }
.cl-talent .g.best { color: #d99a1a; } .cl-talent .g.fantastic { color: #e0702f; } .cl-talent .g.very-good { color: #3fae6a; }
.cl-talent .g.pretty-good { color: #3a7bd5; } .cl-talent .g.decent { color: #7a8299; } .cl-talent .g.no-good { color: #b0b5c6; }
.cl-talent .ev { font-variant-numeric: tabular-nums; text-align: right; color: #48506a; }
.cl-talent .ev.max { color: #3a7bd5; font-weight: 800; }
.cl-talent-sum { margin-top: 10px; padding: 8px 12px; border-radius: 10px; background: #f3f5fa; font-size: 13px; line-height: 1.6; }
.cl-talent-sum b { color: #27304a; }
.cl-moves { display: flex; flex-direction: column; gap: 6px; }
.cl-moves .mv { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 6px 10px; border-radius: 10px; background: #f3f5fa; font-size: 14px; }
.cl-moves .mv .n { font-weight: 800; }
.cl-moves .mv .pp { font-variant-numeric: tabular-nums; font-weight: 700; }
.cl-moves .mv .meta { grid-column: 1 / 3; font-size: 12px; color: #6a7190; }

/* 背包 */
.cl-bag { grid-template-rows: 44px 1fr 88px; }
.cl-bag .pockets { display: flex; gap: 4px; padding: 8px 12px 0; border-bottom: 2px solid #d5dae6; overflow-x: auto; }
.cl-bag .pockets span { padding: 6px 12px; border-radius: 10px 10px 0 0; font-size: 14px; font-weight: 700; cursor: pointer; color: #6a7190; white-space: nowrap; }
.cl-bag .pockets span.on { background: #27304a; color: #fff; }
.cl-bag .items { overflow-y: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px; }
.cl-bag .it { display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-radius: 10px; font-size: 16px; cursor: pointer; }
.cl-bag .it.sel { background: #e7f6ef; outline: 2px solid #3fb88a; }
.cl-bag .it .q { margin-left: auto; font-variant-numeric: tabular-nums; color: #4a5270; }
.cl-bag .it .tag { font-size: 11px; color: #fff; background: #8a8fa3; border-radius: 6px; padding: 0 6px; margin-left: 8px; }
.cl-bag .none { color: #9aa0b3; padding: 30px; text-align: center; }
.cl-bag .desc { border-top: 2px solid #d5dae6; padding: 10px 16px; font-size: 14px; line-height: 1.55; background: #fbfaf4; }
.cl-bag .desc b { font-size: 16px; display: block; margin-bottom: 2px; }
.cl-money { font-variant-numeric: tabular-nums; }

/* 图鉴 */
.cl-dex { grid-template-columns: 300px 1fr; }
.cl-dex .col { display: flex; flex-direction: column; min-height: 0; }
.cl-dex .count { padding: 10px 14px; font-size: 13px; color: #4a5270; border-bottom: 2px solid #d5dae6; display: flex; gap: 14px; font-weight: 700; }
.cl-dex .rows { overflow-y: auto; padding: 6px 8px; }
.cl-dex .row { display: flex; align-items: center; gap: 8px; padding: 5px 10px; border-radius: 10px; font-size: 15px; cursor: pointer; }
.cl-dex .row.sel { background: #e7f6ef; outline: 2px solid #3fb88a; }
.cl-dex .row .no { font-variant-numeric: tabular-nums; color: #6a7190; width: 34px; }
.cl-dex .row.unknown .nm { color: #9aa0b3; }
.cl-dex .row .mark { margin-left: auto; width: 14px; height: 14px; border-radius: 50%; }
.cl-dex .row .mark.caught { background: radial-gradient(circle at 50% 50%, #fff 0 22%, #27304a 23% 32%, transparent 33%), linear-gradient(#e8484a 0 48%, #27304a 48% 56%, #fff 56%); border: 1.5px solid #27304a; }
.cl-dex .row .mark.seen { border: 2px solid #9aa0b3; }
.cl-dex .entry { padding: 16px 20px; overflow-y: auto; border-left: 2px dashed #d5dae6; }
.cl-dex .entry .hero { display: flex; gap: 16px; align-items: center; }
.cl-dex .entry .hero .nm { font-size: 24px; font-weight: 800; }
.cl-dex .entry .hero .genus { font-size: 13px; color: #6a7190; }
.cl-dex .entry .flavor { margin: 14px 0; padding: 10px 14px; border-radius: 12px; background: #f3f5fa; line-height: 1.7; font-size: 15px; }
.cl-dex .entry .locked { color: #9aa0b3; margin-top: 16px; }

/* 存档 */
.cl-save { grid-template-rows: 1fr auto; padding: 22px 28px; }
.cl-save .card { display: grid; grid-template-columns: 120px 1fr; gap: 10px 16px; font-size: 16px; align-content: start; }
.cl-save .card .k { color: #6a7190; }
.cl-save .team { display: flex; gap: 6px; flex-wrap: wrap; }
.cl-save .btn { justify-self: start; margin-top: 16px; padding: 10px 28px; border-radius: 12px; font-size: 18px; font-weight: 800; background: #fff; border: 3px solid #27304a; cursor: pointer; }
.cl-save .btn.sel { background: #3fb88a; color: #fff; }

/* 设置 */
.cl-settings { align-content: start; padding: 16px 22px; overflow-y: auto; gap: 4px; }
.cl-settings .row { display: grid; grid-template-columns: 160px 1fr; align-items: center; padding: 8px 12px; border-radius: 10px; font-size: 16px; cursor: pointer; }
.cl-settings .row.sel { background: #e7f6ef; outline: 2px solid #3fb88a; }
.cl-settings .row .val { display: flex; align-items: center; gap: 10px; }
.cl-settings .row .arrow { color: #9aa0b3; font-weight: 800; padding: 0 4px; }
.cl-settings .row.sel .arrow { color: #27304a; }
.cl-settings .row .note { font-size: 12px; color: #6a7190; margin-left: 8px; }
.cl-settings .row .cl-bar { max-width: 220px; }
.cl-settings .sec { font-size: 12px; color: #6a7190; font-weight: 700; padding: 10px 12px 2px; letter-spacing: .1em; }
`;
