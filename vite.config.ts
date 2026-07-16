import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      bundleTypes: true,
      insertTypesEntry: true,
      exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
    }),
  ],
  build: {
    copyPublicDir: false,
    lib: {
      entry: {
        main: resolve(import.meta.dirname, 'src/main.ts'),
        'mutation-flow': resolve(
          import.meta.dirname,
          'src/mutation-flow/index.ts',
        ),
        host: resolve(import.meta.dirname, 'src/host/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'cjs' ? 'cjs' : 'js'}`,
    },
    rollupOptions: {
      external: ['vue'],
    },
  },
})
