import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    // 纯逻辑单测在 Node 中运行（systems/ 不依赖 DOM，这本身就是边界检查的一部分）
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/systems/**'] },
  },
});
