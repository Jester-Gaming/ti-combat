/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import path from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'html-branch-title',
      apply: 'serve',
      transformIndexHtml(html) {
        const branch = execSync('git rev-parse --abbrev-ref HEAD')
          .toString()
          .trim()
        return html.replace(
          /<title>(.*?)<\/title>/,
          `<title>[${branch}] $1</title>`,
        )
      },
    },
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    css: true,
    setupFiles: ['tests/utils/expect.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      'tests/snapshots',
    ],
  },
})
