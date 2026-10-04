export { UiRoot } from './UiRoot';
export type { UiWidget } from './UiRoot';
export { Dialog } from './Dialog';
export type { DialogOptions } from './Dialog';
export { ChoiceMenu } from './ChoiceMenu';
export type { ChoiceItem, ChoiceOptions } from './ChoiceMenu';
export { Transition } from './Transition';
export { Toaster } from './Toast';
export { injectUiStyles, el } from './styles';

import type { UiRoot } from './UiRoot';
import { Dialog, type DialogOptions } from './Dialog';
import { ChoiceMenu, type ChoiceItem, type ChoiceOptions } from './ChoiceMenu';

/** 便捷函数：显示对话并等待结束 */
export function say(root: UiRoot, pages: string | string[], opts?: DialogOptions): Promise<void> {
  return root.push(new Dialog(root, Array.isArray(pages) ? pages : [pages], opts)).done;
}

/** 便捷函数：显示选择菜单 */
export function choose<T>(root: UiRoot, items: ChoiceItem<T>[], opts?: ChoiceOptions): Promise<T | null> {
  return root.push(new ChoiceMenu(root, items, opts)).done;
}
