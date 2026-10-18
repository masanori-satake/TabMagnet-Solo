import { test, expect } from './fixtures.js';

test.describe('Group-Set Operations', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  });

  test('should toggle group-set expand and collapse', async ({ page }) => {
    // Default group-set should be expanded
    await expect(page.locator('.toggle-expand-btn')).toHaveAttribute('aria-expanded', 'true');

    // Click collapse
    const startTime = Date.now();
    await page.click('.toggle-expand-btn');
    await expect(page.locator('.toggle-expand-btn')).toHaveAttribute('aria-expanded', 'false');
    const collapseTime = Date.now() - startTime;
    // Verify toggle completes within expected performance threshold (Requirement 22.2)
    expect(collapseTime).toBeLessThan(1000);

    // Click expand
    await page.click('.toggle-expand-btn');
    await expect(page.locator('.toggle-expand-btn')).toHaveAttribute('aria-expanded', 'true');
  });

  test('should add new group-set from footer', async ({ page }) => {
    await expect(page.locator('.group-set-item')).toHaveCount(1);

    await page.click('#add-group-set-btn');

    await expect(page.locator('.group-set-item')).toHaveCount(2);
  });

  test('should edit group-set name and color', async ({ page }) => {
    await page.click('.edit-set-btn');
    await page.click('#gs-edit-menu-edit-set');

    await page.fill('#gs-edit-name', 'Custom Set Name');
    await page.click('#save-group-set-btn');

    await expect(page.locator('.group-set-item .target-name').first()).toHaveText('Custom Set Name');
  });

  test('should reorder group-sets up and down', async ({ page }) => {
    // Add second set
    await page.click('#add-group-set-btn');
    await expect(page.locator('.group-set-item')).toHaveCount(2);

    // Edit second set name
    await page.locator('.edit-set-btn').nth(1).click();
    await page.click('#gs-edit-menu-edit-set');
    await page.fill('#gs-edit-name', 'Second Set');
    await page.click('#save-group-set-btn');

    // Move second set up
    const startTime = Date.now();
    await page.locator('.edit-set-btn').nth(1).click();
    await page.click('#gs-edit-menu-move-up');
    const moveTime = Date.now() - startTime;

    expect(moveTime).toBeLessThan(1000);
    await expect(page.locator('.group-set-item .target-name').first()).toHaveText('Second Set');
  });

  test('should delete group-set after confirmation', async ({ page }) => {
    // Add second set
    await page.click('#add-group-set-btn');
    await expect(page.locator('.group-set-item')).toHaveCount(2);

    // Open edit for second set and click delete
    await page.locator('.edit-set-btn').nth(1).click();
    await page.click('#gs-edit-menu-edit-set');
    await page.click('#delete-group-set-btn');

    // Confirm delete
    await page.click('#confirm-delete-ok-btn');

    await expect(page.locator('.group-set-item')).toHaveCount(1);
  });

  test('should execute Group-Set magnet', async ({ page }) => {
    // Add group to set first
    await page.click('.edit-set-btn');
    await page.click('#gs-edit-menu-add-group');
    await page.fill('#new-name', 'Example Group');
    await page.fill('.pattern-input', 'example.com/*');
    await page.click('#save-target-btn');

    // Execute Group-Set button
    const executeSetBtn = page.locator('.execute-set-btn').first();
    await expect(executeSetBtn).not.toBeDisabled();
    await executeSetBtn.click();
  });
});
