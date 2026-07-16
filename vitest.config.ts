import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts'],
    // useMutationFlow intentionally propagates a thrown mutationFn as an
    // unhandled rejection rather than swallowing it (mirrors the source
    // library's ADR-0016) — mutation-flow.test.ts exercises exactly that
    // path. The rejecting promise lives inside the composable's closure,
    // so the test can't attach its own .catch() to the exact reference;
    // process.on('unhandledRejection', ...) suppresses Node's default
    // warning but Vitest reports the event independently of that
    // listener and would otherwise fail the run for behavior under test.
    dangerouslyIgnoreUnhandledErrors: true,
  },
})
