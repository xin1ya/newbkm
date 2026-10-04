/**
 * 配音台词 ID：去掉首尾空白后的文本做 FNV-1a 32 位哈希（浏览器 / Node 通用，无依赖）。
 * 运行时对话框按显示文本查 manifest；提取脚本用同一函数生成。
 */
export function voiceId(text: string): string {
  const t = text.trim();
  if (!t) return '';
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `v${h.toString(16).padStart(8, '0')}${t.length.toString(36)}`;
}
