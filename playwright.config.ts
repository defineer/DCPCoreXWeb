import { defineConfig, devices } from '@playwright/test';

const live = process.env.DCP_TEST_BASE_URL;
const port = Number(process.env.DCP_FIXTURE_PORT ?? '4173');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid DCP_FIXTURE_PORT.');
const local = 'http://127.0.0.1:' + port;
const browser = process.env.DCP_BROWSER_CHANNEL;
export default defineConfig({
  testDir: './tests/browser',
  testMatch: live ? /live\.spec\.ts/ : /fixture\.spec\.ts/,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    channel: browser,
    baseURL: live ?? local,
    timezoneId: 'UTC',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: live ? undefined : {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ' + port + ' --strictPort',
    url: local,
    reuseExistingServer: false,
  },
});
