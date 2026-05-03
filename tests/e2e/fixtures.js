import { test as base, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pathToExtension = path.join(__dirname, '../../projects/app');

export const test = base.extend({
  context: async ({ }, use) => {
    const userDataDir = path.join(__dirname, '../../.test-user-data-' + Math.random().toString(36).substring(7));
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        `--headless=new`
      ],
    });
    await use(context);
    await context.close();
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  },
  extensionId: async ({ context }, use) => {
    // For MV3, background is a service worker
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }

    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});
export { expect } from '@playwright/test';
