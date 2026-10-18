import { test, expect } from './fixtures.js';

test.describe('Normal Operations', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  });

  test('should create, edit and delete a group', async ({ page }) => {
    // 1. Open edit menu for the default Group-Set and add a new group
    await page.click('.edit-set-btn');
    await page.click('#gs-edit-menu-add-group');

    await page.fill('#new-name', 'Test Target');
    await page.fill('.pattern-input', 'example.com');
    await page.click('#save-target-btn');
    await expect(page.locator('.group-item .target-name')).toHaveText('Test Target');

    // 2. Edit group
    await page.click('.group-item');
    await page.fill('#new-name', 'Updated Target');
    await page.click('#save-target-btn');
    await expect(page.locator('.group-item .target-name')).toHaveText('Updated Target');

    // 3. Delete group
    await page.click('.group-item');
    await page.click('#delete-target-btn');
    await page.click('#confirm-delete-ok-btn');
    await expect(page.locator('.group-item')).toHaveCount(0);
  });

  test('should toggle settings', async ({ page }) => {
    await page.click('#settings-btn');

    const collectSwitch = page.locator('#collect-all-groups-switch');
    const collapseSwitch = page.locator('#collapse-after-collect-switch');

    await page.locator('label:has(#collect-all-groups-switch) .slider').click();
    await expect(collectSwitch).toBeChecked();

    await page.locator('label:has(#collapse-after-collect-switch) .slider').click();
    await expect(collapseSwitch).toBeChecked();

    await page.reload();
    await page.click('#settings-btn');
    await expect(collectSwitch).toBeChecked();
    await expect(collapseSwitch).toBeChecked();
  });
});
