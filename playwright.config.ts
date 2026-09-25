import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'chrome', headless: true, screenshot: 'only-on-failure' },
  reporter: 'list',
});
