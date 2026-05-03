import { test, expect } from './fixtures.js';

test.describe('Normal Operations', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  });

  test('should create, edit and delete a target', async ({ page }) => {
    // 1. Create
    await page.click('#add-new-btn');
    await page.fill('#new-name', 'Test Target');
    await page.fill('.pattern-input', 'example.com');
    await page.click('#save-target-btn');
    await expect(page.locator('.target-name')).toHaveText('Test Target');

    // 2. Edit
    await page.click('.target-list-item');
    await page.fill('#new-name', 'Updated Target');
    await page.click('#save-target-btn');
    await expect(page.locator('.target-name')).toHaveText('Updated Target');

    // 3. Delete
    await page.click('.target-list-item');
    await page.click('#delete-target-btn');
    await page.click('#confirm-delete-ok-btn');
    await expect(page.locator('.target-list-item')).toHaveCount(0);
  });

  test('should toggle settings', async ({ page }) => {
    await page.click('#settings-btn');

    // Switch is inside a label and might be hidden, click the slider or container
    const collectSwitch = page.locator('#collect-all-groups-switch');
    const collapseSwitch = page.locator('#collapse-after-collect-switch');

    // Clicking the parent .slider is usually safer if the input is opacity: 0
    await page.locator('label:has(#collect-all-groups-switch) .slider').click();
    await expect(collectSwitch).toBeChecked();

    await page.locator('label:has(#collapse-after-collect-switch) .slider').click();
    await expect(collapseSwitch).toBeChecked();

    // Reload and check if persisted
    await page.reload();
    await page.click('#settings-btn');
    await expect(collectSwitch).toBeChecked();
    await expect(collapseSwitch).toBeChecked();
  });
});
