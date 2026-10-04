import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

// 约束（见 docs/00-MASTER-CONTROL.md §2.3 / 设计 §2.3）：
// - base 使用相对路径，保证构建产物可被 Tauri 直接加载
// - 开发服务器监听 0.0.0.0，便于局域网/远程预览
// - assets/ 作为静态资源根目录（岛屿高度图、模型、解码器），运行时通过 Platform.assets.url() 访问
// - 多页面：index.html（游戏）+ style-guide.html（ART-001 Toon 样张 / 调参页）+ model-viewer.html（宝可梦模型展示台）
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: './',
  publicDir: 'assets',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16)),
  },
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        styleGuide: fileURLToPath(new URL('./style-guide.html', import.meta.url)),
        modelViewer: fileURLToPath(new URL('./model-viewer.html', import.meta.url)),
      },
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
