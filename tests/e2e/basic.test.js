import { test, expect } from './fixtures.js';

test('should load sidepanel', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(page).toHaveTitle('TabMagnet-Solo');

  // Check if initial UI is rendered
  const addGroupSetBtn = page.locator('#add-group-set-btn');
  await expect(addGroupSetBtn).toBeVisible();
});
