import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    
    return {
      plugins: [react()],
      base: isProduction ? '/calculadora/' : '/',
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false
      }
    };
});
