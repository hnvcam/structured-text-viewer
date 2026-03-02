import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import path from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      lib: {
        entry: 'electron/main.ts',
        formats: ['es'],
      },
      rollupOptions: {
        output: {
          format: 'es',
        },
      },
    },
    resolve: {
      alias: {
        '@electron': path.resolve(__dirname, './electron'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      lib: {
        entry: 'electron/preload.ts',
        formats: ['es'],
      },
      rollupOptions: {
        output: {
          format: 'es',
        },
      },
    },
    resolve: {
      alias: {
        '@electron': path.resolve(__dirname, './electron'),
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: '../../dist',
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src/renderer'),
      },
    },
  },
});
