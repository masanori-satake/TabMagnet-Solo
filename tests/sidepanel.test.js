import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(__dirname, '../projects/app/sidepanel.html'), 'utf8');

describe('sidepanel logic', () => {
  let chromeMock;

  beforeEach(() => {
    document.documentElement.innerHTML = html.toString();

    // Mock chrome APIs
    chromeMock = {
      i18n: {
        getMessage: jest.fn(key => key)
      },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue({})
        },
        onChanged: {
          addListener: jest.fn()
        }
      },
      tabs: {
        query: jest.fn().mockResolvedValue([]),
        onActivated: { addListener: jest.fn() },
        onUpdated: { addListener: jest.fn() }
      },
      runtime: {
        getManifest: jest.fn(() => ({ version: '1.0.0', author: 'Test' }))
      }
    };
    global.chrome = chromeMock;
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('isSpecialPage correctly identifies protocols', async () => {
    const { isSpecialPage } = await import('../projects/app/sidepanel.js');
    expect(isSpecialPage('https://google.com')).toBe(false);
    expect(isSpecialPage('http://example.com')).toBe(false);
    expect(isSpecialPage('chrome://settings')).toBe(true);
    expect(isSpecialPage('about:blank')).toBe(true);
    expect(isSpecialPage('')).toBe(true);
    expect(isSpecialPage(null)).toBe(true);
  });

  test('escapeHtml works', async () => {
    const { escapeHtml } = await import('../projects/app/sidepanel.js');
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('Normal text')).toBe('Normal text');
  });

  test('importData validates format', async () => {
    const { importData } = await import('../projects/app/sidepanel.js');

    // Invalid data
    await expect(importData(null)).rejects.toThrow('Invalid format');
    await expect(importData([])).rejects.toThrow('Invalid format');
    await expect(importData('string')).rejects.toThrow('Invalid format');
  });

  test('importData handles valid data in overwrite mode', async () => {
    const { importData } = await import('../projects/app/sidepanel.js');

    // Set radio button to overwrite
    document.querySelector('input[name="import-mode"][value="overwrite"]').checked = true;
    const toast = document.getElementById('toast');

    const validData = {
      targets: [{ name: 'NewTarget', pattern: ['example.com'], color: 'blue' }],
      settings: { collectFromAllGroups: true }
    };

    await importData(validData);

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      targets: validData.targets,
      settings: expect.objectContaining({ collectFromAllGroups: true })
    }));
    expect(toast.textContent).toBe('importSuccess');
    expect(toast.classList.contains('show')).toBe(true);
  });

  test('importData handles valid data in append mode', async () => {
    const { importData, init } = await import('../projects/app/sidepanel.js');

    // Mock initial targets
    chromeMock.storage.local.get.mockResolvedValue({
      targets: [{ name: 'Existing', pattern: ['old.com'], color: 'grey' }]
    });

    // Initialize to load existing targets
    await init();

    document.querySelector('input[name="import-mode"][value="append"]').checked = true;
    const toast = document.getElementById('toast');

    const validData = {
      targets: [{ name: 'Appended', pattern: ['new.com'], color: 'red' }]
    };

    await importData(validData);

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      targets: [
        { name: 'Existing', pattern: ['old.com'], color: 'grey' },
        { name: 'Appended', pattern: ['new.com'], color: 'red' }
      ]
    }));
    expect(toast.textContent).toBe('importSuccess');
  });

  test('showModal correctly handles edit vs new', async () => {
    const { showModal, init } = await import('../projects/app/sidepanel.js');

    // Mock initial targets
    chromeMock.storage.local.get.mockResolvedValue({
      targets: [{ name: 'Existing', pattern: ['old.com'], color: 'blue' }]
    });
    await init();

    // Show modal for new
    showModal();
    expect(document.getElementById('modal-title').textContent).toBe('addNew');
    expect(document.getElementById('new-name').value).toBe('');
    expect(document.getElementById('delete-target-btn').classList.contains('hidden')).toBe(true);

    // Show modal for edit
    showModal(0);
    expect(document.getElementById('modal-title').textContent).toBe('edit');
    expect(document.getElementById('new-name').value).toBe('Existing');
    expect(document.getElementById('delete-target-btn').classList.contains('hidden')).toBe(false);
  });

  test('handleSaveTarget validates input', async () => {
    const { handleSaveTarget } = await import('../projects/app/sidepanel.js');

    document.getElementById('new-name').value = '';
    await handleSaveTarget();
    expect(document.getElementById('modal-feedback').textContent).toBe('errorInputRequired');
    expect(document.getElementById('modal-feedback').classList.contains('hidden')).toBe(false);
  });

  test('handleSaveTarget prevents special pages', async () => {
    const { handleSaveTarget, addPatternInput } = await import('../projects/app/sidepanel.js');

    document.getElementById('new-name').value = 'Test';
    // Clear patterns and add a special one
    document.getElementById('pattern-list-container').innerHTML = '';
    addPatternInput('chrome://settings');

    await handleSaveTarget();
    expect(document.getElementById('modal-feedback').textContent).toBe('warningSpecialPageIncluded');
  });

  test('handleSaveTarget saves correctly after normalization', async () => {
    const { handleSaveTarget, addPatternInput } = await import('../projects/app/sidepanel.js');

    document.getElementById('new-name').value = 'Test';
    document.getElementById('pattern-list-container').innerHTML = '';
    addPatternInput('https://example.com');

    await handleSaveTarget();
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      targets: expect.arrayContaining([
        expect.objectContaining({ name: 'Test', pattern: ['example.com'] })
      ])
    }));
  });

});
