import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests for pure logic (lib/**). No DOM, no React.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
