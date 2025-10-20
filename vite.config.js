import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: './',             // プロジェクトのルートを固定
  publicDir: 'public',    // 公開フォルダ
  build: {
    outDir: 'dist',       // 出力先
    emptyOutDir: true,
  },
});
