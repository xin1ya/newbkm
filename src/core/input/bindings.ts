/**
 * ENG-007 · 动作与默认按键表（设计 §3.7 操作）。
 * 键盘使用 KeyboardEvent.code（与布局无关）；手柄使用 Standard Gamepad 按钮索引。
 * 玩家自定义的映射存放在 Platform.storage 的 pref 'input.bindings'。
 */
export type Action =
  | 'jump'
  | 'moveForward'
  | 'moveBack'
  | 'moveLeft'
  | 'moveRight'
  | 'run'
  | 'interact'
  | 'cancel'
  | 'menu'
  | 'throw'
  | 'sendOut'
  | 'ride'
  | 'map'
  | 'questLog'
  | 'toggleView'
  | 'camReset'
  | 'uiUp'
  | 'uiDown'
  | 'uiLeft'
  | 'uiRight'
  | 'confirm'
  | 'back'
  | 'debug'
  | 'quicksave'
  | 'gearUp'
  | 'gearDown'
  | 'fly'
  | 'descend'
  | 'autoBattle'
  | 'autoPath';

export interface Binding {
  keys: string[];
  /** 鼠标按键：0 左 1 中 2 右 */
  mouse?: number[];
  /** Standard Gamepad 按钮索引 */
  pad?: number[];
}

export type BindingTable = Record<Action, Binding>;

/** Standard Gamepad 布局（Xbox 命名） */
export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  LS: 10,
  RS: 11,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

export const DEFAULT_BINDINGS: BindingTable = {
  moveForward: { keys: ['KeyW', 'ArrowUp'] },
  moveBack: { keys: ['KeyS', 'ArrowDown'] },
  moveLeft: { keys: ['KeyA', 'ArrowLeft'] },
  moveRight: { keys: ['KeyD', 'ArrowRight'] },
  run: { keys: ['ShiftLeft', 'ShiftRight'], pad: [PAD.LB] },
  interact: { keys: ['KeyE', 'Enter'], pad: [PAD.A] },
  // 空格跳跃（UI 中空格仍是 confirm）
  jump: { keys: ['Space'], pad: [PAD.B] },
  cancel: { keys: ['KeyQ', 'Backspace'], pad: [PAD.B] },
  menu: { keys: ['Escape', 'Tab'], pad: [PAD.START] },
  throw: { keys: ['KeyR'], mouse: [0], pad: [PAD.RT] },
  sendOut: { keys: ['KeyF'], pad: [PAD.X] },
  ride: { keys: ['KeyC'], pad: [PAD.Y] },
  map: { keys: ['KeyM'], pad: [PAD.BACK] },
  questLog: { keys: ['KeyJ'] },
  toggleView: { keys: ['KeyV'], pad: [PAD.RS] },
  camReset: { keys: ['KeyZ'], pad: [PAD.LS] },
  uiUp: { keys: ['ArrowUp', 'KeyW'], pad: [PAD.UP] },
  uiDown: { keys: ['ArrowDown', 'KeyS'], pad: [PAD.DOWN] },
  uiLeft: { keys: ['ArrowLeft', 'KeyA'], pad: [PAD.LEFT] },
  uiRight: { keys: ['ArrowRight', 'KeyD'], pad: [PAD.RIGHT] },
  confirm: { keys: ['Enter', 'Space', 'KeyE'], pad: [PAD.A] },
  back: { keys: ['Escape', 'Backspace', 'KeyQ'], pad: [PAD.B] },
  debug: { keys: ['F3', 'Backquote'] },
  quicksave: { keys: ['F5'] },
  // 自行车变速（Q 在大世界不用于取消；E 是互动，所以升档用 X）
  gearUp: { keys: ['KeyX'], pad: [PAD.RB] },
  gearDown: { keys: ['KeyQ'], pad: [PAD.LB] },
  // 飞行骑乘：G 起飞 / 降落；Ctrl（或 Shift）下降，空格上升
  fly: { keys: ['KeyG'] },
  descend: { keys: ['ControlLeft', 'ControlRight'], pad: [PAD.LT] },
  // 自动战斗设置（野外区域）
  autoBattle: { keys: ['KeyK'] },
  // 任务自动寻路（追踪任务目标）
  autoPath: { keys: ['KeyT'] },
};

/** 合并玩家自定义映射（未知动作忽略，缺失动作用默认值） */
export function mergeBindings(custom: Partial<Record<string, Partial<Binding>>> | null | undefined): BindingTable {
  const out = structuredClone(DEFAULT_BINDINGS);
  if (!custom) return out;
  for (const [action, b] of Object.entries(custom)) {
    if (!(action in out) || !b) continue;
    const cur = out[action as Action];
    if (Array.isArray(b.keys)) cur.keys = b.keys.filter((k) => typeof k === 'string');
    if (Array.isArray(b.mouse)) cur.mouse = b.mouse.filter((k) => Number.isInteger(k));
    if (Array.isArray(b.pad)) cur.pad = b.pad.filter((k) => Number.isInteger(k));
  }
  return out;
}

/** 找出与某个键冲突的动作（重映射界面提示用）；同组 UI / 移动动作之间允许共享 */
export function findConflicts(table: BindingTable, action: Action, code: string): Action[] {
  const uiGroup = (a: Action) => a.startsWith('ui') || a === 'confirm' || a === 'back';
  return (Object.keys(table) as Action[]).filter(
    (a) => a !== action && table[a].keys.includes(code) && uiGroup(a) === uiGroup(action),
  );
}

/** 键码 → 显示名 */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: '空格',
    ShiftLeft: 'Shift',
    ShiftRight: '右Shift',
    Escape: 'Esc',
    Enter: 'Enter',
    Backspace: '退格',
    Backquote: '`',
    Tab: 'Tab',
  };
  return map[code] ?? code;
}
