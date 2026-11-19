import { defineConfig } from '@playwright/test'

const port = 3123

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  outputDir: 'e2e/.results',
  use: {
    baseURL: process.env.E2E_URL ?? `http://localhost:${port}`,
    viewport: { width: 1280, height: 800 },
    ...(process.env.E2E_GPU && {
      channel: 'chromium',
      launchOptions: { args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] },
    }),
  },
  webServer: process.env.E2E_URL
    ? undefined
    : {
        command: `bunx next start -p ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: true,
      },
})
