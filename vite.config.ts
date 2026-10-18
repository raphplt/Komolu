import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/rooms': {
        target: 'http://127.0.0.1:8787',
        ws: true,
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
})
