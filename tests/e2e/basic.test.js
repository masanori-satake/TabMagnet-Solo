import { test, expect } from './fixtures.js';

test('should load sidepanel', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(page).toHaveTitle('TabMagnet-Solo');

  // Check if initial UI is rendered
  const addNewBtn = page.locator('#add-new-btn');
  await expect(addNewBtn).toBeVisible();
});
