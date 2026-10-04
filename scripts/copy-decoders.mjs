/**
 * 把 three 自带的 Draco / Basis(KTX2) 解码器复制到 assets/_decoders/（ENG-008）。
 * 运行时不能访问 CDN（Tauri 离线、§2.3），所以解码器必须随构建产物一起发布。
 * 产物目录已加入 .gitignore，每次 dev/build 前自动执行，幂等。
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libs = join(root, 'node_modules/three/examples/jsm/libs');
const out = join(root, 'assets/_decoders');

for (const [src, dst] of [
  ['draco/gltf', 'draco'],
  ['basis', 'basis'],
]) {
  const from = join(libs, src);
  if (!existsSync(from)) {
    console.warn(`[copy-decoders] 缺少 ${from}，跳过`);
    continue;
  }
  mkdirSync(join(out, dst), { recursive: true });
  cpSync(from, join(out, dst), { recursive: true });
}
console.info('[copy-decoders] 解码器已就绪 → assets/_decoders/');
