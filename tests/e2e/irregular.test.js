import { test, expect } from './fixtures.js';

test.describe('Irregular and Edge Cases', () => {

  test('closing tab during "Add from domain" creation', async ({ page, extensionId, context }) => {
    // 1. Open a regular page
    const targetPage = await context.newPage();
    await targetPage.goto('https://www.google.com');
    await targetPage.bringToFront();

    // 2. Open sidepanel
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // 3. Click "Add from domain" from group set edit menu
    await page.click('.group-set-item .target-name');
    await page.click('#gs-edit-menu-add-from-domain');

    // Verify modal is open and populated
    await expect(page.locator('#target-modal-scrim')).toBeVisible();
    await expect(page.locator('#new-name')).toHaveValue('Google');

    // 4. Close the target page
    await targetPage.close();

    // 5. Try to save
    await page.click('#save-target-btn');

    // Verify target was saved in the group list
    await expect(page.locator('.group-item .target-name')).toHaveText('Google');
  });

  test('handling duplicate target names', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // 1. Add first target to default group set
    await page.click('.group-set-item .target-name');
    await page.click('#gs-edit-menu-add-group');
    await page.fill('#new-name', 'Duplicate');
    await page.fill('.pattern-input', 'example.com');
    await page.click('#save-target-btn');

    // 2. Add second target with same name
    await page.click('.group-set-item .target-name');
    await page.click('#gs-edit-menu-add-group');
    await page.fill('#new-name', 'Duplicate');
    await page.fill('.pattern-input', 'other.com');
    await page.click('#save-target-btn');

    // Verify both exist
    const targets = page.locator('.group-item .target-name');
    await expect(targets).toHaveCount(2);
    await expect(targets.first()).toHaveText('Duplicate');
    await expect(targets.last()).toHaveText('Duplicate');
  });

  test('importing malformed JSON', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.click('#settings-btn');

    await page.evaluate(() => {
      window.alert = (msg) => { window.lastAlert = msg; };
    });

    await page.evaluate(() => {
      navigator.clipboard.writeText(JSON.stringify({ settings: {} }));
    });

    await page.click('#paste-import-btn');
  });

  test('multi-window synchronization', async ({ context, extensionId }) => {
    const page1 = await context.newPage();
    await page1.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    const page2 = await context.newPage();
    await page2.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // 1. Add target in page1
    await page1.click('.group-set-item .target-name');
    await page1.click('#gs-edit-menu-add-group');
    await page1.fill('#new-name', 'SyncTest');
    await page1.fill('.pattern-input', 'sync.com');
    await page1.click('#save-target-btn');

    // 2. Check if page2 reflects the change
    await expect(page2.locator('.group-item .target-name')).toHaveText('SyncTest');

    // 3. Delete in page2
    await page2.click('.group-item');
    await page2.click('#delete-target-btn');
    await page2.click('#confirm-delete-ok-btn');

    // 4. Check if page1 reflects the deletion
    await expect(page1.locator('.group-item')).toHaveCount(0);
  });

  test('race condition: simultaneous execution', async ({ context, extensionId }) => {
    const page1 = await context.newPage();
    await page1.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Add a target
    await page1.click('.group-set-item .target-name');
    await page1.click('#gs-edit-menu-add-group');
    await page1.fill('#new-name', 'Race');
    await page1.fill('.pattern-input', 'race.com');
    await page1.click('#save-target-btn');

    const page2 = await context.newPage();
    await page2.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Trigger execution
    const promise1 = page1.click('.execute-btn');
    const promise2 = page2.click('.execute-btn');

    await Promise.all([promise1, promise2]);
  });
});
