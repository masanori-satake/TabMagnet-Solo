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
      windows: {
        getCurrent: jest.fn().mockResolvedValue({ id: 1 })
      },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue({}),
          remove: jest.fn().mockResolvedValue({})
        },
        sync: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue({}),
          remove: jest.fn().mockResolvedValue({})
        },
        onChanged: {
          addListener: jest.fn()
        }
      },
      tabs: {
        query: jest.fn().mockResolvedValue([]),
        group: jest.fn().mockResolvedValue(100),
        move: jest.fn().mockResolvedValue(),
        onActivated: { addListener: jest.fn() },
        onUpdated: { addListener: jest.fn() }
      },
      tabGroups: {
        query: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(),
        TAB_GROUP_ID_NONE: -1
      },
      runtime: {
        getManifest: jest.fn(() => ({ version: '9.9.9', author: 'Test' }))
      }
    };
    global.chrome = chromeMock;
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('init initializes the sidepanel', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();
    expect(chromeMock.storage.local.get).toHaveBeenCalledWith(['targets', 'settings']);
  });

  test('UI interactions trigger storage updates', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    // Test settings switch
    const collectAllSwitch = document.getElementById('collect-all-groups-switch');
    collectAllSwitch.checked = true;
    collectAllSwitch.dispatchEvent(new Event('change'));

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({ collectFromAllGroups: true })
    }));
  });

  test('Add new target modal interaction', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    document.getElementById('add-new-btn').click();
    expect(document.getElementById('target-modal-scrim').style.display).toBe('flex');

    document.getElementById('new-name').value = 'Test Target';
    document.querySelector('.pattern-input').value = 'example.com';
    document.getElementById('save-target-btn').click();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      targets: expect.arrayContaining([
        expect.objectContaining({ name: 'Test Target' })
      ])
    }));
  });

  test('Add new target modal boundary check prevents saving invalid inputs', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    document.getElementById('add-new-btn').click();

    // Oversized target name
    document.getElementById('new-name').value = 'A'.repeat(101);
    document.querySelector('.pattern-input').value = 'example.com';
    document.getElementById('save-target-btn').click();

    const feedbackEl = document.getElementById('modal-feedback');
    expect(feedbackEl.classList.contains('hidden')).toBe(false);

    // Oversized pattern
    document.getElementById('new-name').value = 'Valid Name';
    document.querySelector('.pattern-input').value = 'B'.repeat(501);
    document.getElementById('save-target-btn').click();

    expect(feedbackEl.classList.contains('hidden')).toBe(false);
  });

  test('header layout and sync icon elements exist', () => {
    const settingsBtn = document.getElementById('settings-btn');
    expect(settingsBtn).not.toBeNull();
    expect(getComputedStyle(settingsBtn).marginLeft).toBe('auto');

    const syncIndicator = document.getElementById('sync-indicator');
    expect(syncIndicator).not.toBeNull();
    const svgPath = syncIndicator.querySelector('svg path');
    expect(svgPath).not.toBeNull();
    // Verify device sync icon path is used
    expect(svgPath.getAttribute('d')).toContain('M150-760h220q20');
  });

  test('インポートデータは許可された target と settings のみ受け付ける', async () => {
    const { validateImportData } = await import('../projects/app/sidepanel.js');

    expect(() => validateImportData({
      targets: [{ name: 'Allowed', pattern: ['example.com/*'], color: 'blue' }],
      settings: { collapseAfterCollect: true, syncEnabled: false }
    })).not.toThrow();
    expect(() => validateImportData({
      targets: [{ name: 'Unknown', pattern: 'example.com', note: 'not allowed' }]
    })).toThrow('Invalid target property');
    expect(() => validateImportData({
      metadata: 'not allowed',
      targets: [{ name: 'Unknown top level', pattern: 'example.com' }]
    })).toThrow('Invalid import property');
    expect(() => validateImportData({
      targets: Array.from({ length: 101 }, (_, index) => ({
        name: `Target ${index}`,
        pattern: 'example.com'
      }))
    })).toThrow('targets array exceeds limit');
    expect(() => validateImportData({
      targets: [{ name: 'x'.repeat(101), pattern: 'example.com' }]
    })).toThrow('Invalid target name');
    expect(() => validateImportData({
      targets: [{ name: 'Huge pattern', pattern: 'x'.repeat(501) }]
    })).toThrow('Invalid target pattern');
    expect(() => validateImportData({
      targets: [{ name: 'Huge color', pattern: 'example.com', color: 'x'.repeat(21) }]
    })).toThrow('Invalid target color');
    expect(() => validateImportData({
      targets: [{ name: 'Unknown color', pattern: 'example.com', color: 'navy' }]
    })).toThrow('Invalid target color');
    expect(() => validateImportData({
      targets: [{ name: 'Unknown setting', pattern: 'example.com' }],
      settings: { arbitrarySetting: true }
    })).toThrow('Invalid settings property');
    expect(() => validateImportData({
      targets: [{ name: 'Wrong setting type', pattern: 'example.com' }],
      settings: { collapseAfterCollect: 'true' }
    })).toThrow('Invalid settings value');
  });

  test('貼り付けテキストは JSON.parse 前に全体サイズを検証する', async () => {
    const { init, MAX_IMPORT_DATA_SIZE } = await import('../projects/app/sidepanel.js');
    await init();

    document.getElementById('paste-import-textarea').value = 'x'.repeat(MAX_IMPORT_DATA_SIZE + 1);
    const parseSpy = jest.spyOn(JSON, 'parse');
    document.getElementById('confirm-paste-import-btn').click();

    expect(parseSpy).not.toHaveBeenCalled();
    expect(chromeMock.i18n.getMessage).toHaveBeenCalledWith('importError');
    parseSpy.mockRestore();
  });

  test('ファイルは FileReader.readAsText 前に全体サイズを検証する', async () => {
    const { init, MAX_IMPORT_DATA_SIZE } = await import('../projects/app/sidepanel.js');
    await init();

    const fileInput = document.getElementById('file-input');
    const file = new Blob(['x'.repeat(MAX_IMPORT_DATA_SIZE + 1)], { type: 'application/json' });
    global.FileReader = jest.fn();

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false
    });
    fileInput.dispatchEvent(new Event('change'));

    expect(global.FileReader).not.toHaveBeenCalled();
    expect(chromeMock.i18n.getMessage).toHaveBeenCalledWith('importError');
  });

  test('Delete target interaction', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      targets: [{ name: 'ToDelete', pattern: ['delete.me'] }]
    });
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    // Click item to edit (skipping static Magnet All row)
    document.querySelector('.target-list-item:not([data-static="true"])').click();
    // Click delete in modal
    document.getElementById('delete-target-btn').click();
    // Click confirm in dialog
    document.getElementById('confirm-delete-ok-btn').click();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      targets: []
    }));
  });

  test('Solo tab interaction and keyboard navigation', async () => {
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    const generalTabBtn = document.querySelector('.tab-item[data-tab="general"]');
    const soloTabBtn = document.querySelector('.tab-item[data-tab="solo"]');
    const aboutTabBtn = document.querySelector('.tab-item[data-tab="about"]');

    expect(soloTabBtn).not.toBeNull();

    soloTabBtn.click();

    expect(soloTabBtn.classList.contains('active')).toBe(true);
    expect(soloTabBtn.getAttribute('aria-selected')).toBe('true');
    expect(soloTabBtn.getAttribute('tabindex')).toBe('0');
    expect(generalTabBtn.getAttribute('aria-selected')).toBe('false');
    expect(generalTabBtn.getAttribute('tabindex')).toBe('-1');
    expect(document.getElementById('tab-content-solo').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('tab-content-general').classList.contains('hidden')).toBe(true);

    // Keyboard navigation: ArrowRight from Solo to About
    soloTabBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(aboutTabBtn.classList.contains('active')).toBe(true);
    expect(aboutTabBtn.getAttribute('aria-selected')).toBe('true');

    // Keyboard navigation: ArrowLeft from About back to Solo
    aboutTabBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(soloTabBtn.classList.contains('active')).toBe(true);
    expect(soloTabBtn.getAttribute('aria-selected')).toBe('true');
  });

  test('Solo tab contains all badge images and links', () => {
    const soloPane = document.getElementById('tab-content-solo');
    expect(soloPane).not.toBeNull();

    const links = soloPane.querySelectorAll('a');
    expect(links.length).toBe(8);

    const images = soloPane.querySelectorAll('img');
    expect(images.length).toBe(8);

    images.forEach(img => {
      expect(img.getAttribute('src')).toMatch(/^assets\/badges\/solo\/badge-.*\.svg$/);
    });
  });

  test('エクスポート処理において syncEnabled は常に false に設定される', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      targets: [{ name: 'Test', pattern: ['example.com/*'], color: 'grey' }],
      settings: { collectFromAllGroups: true, syncEnabled: true }
    });
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    let writeTextArg = null;
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(async (text) => {
          writeTextArg = text;
        })
      }
    });

    document.getElementById('copy-export-btn').click();
    await Promise.resolve();

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const exportedData = JSON.parse(writeTextArg);
    expect(exportedData.settings.syncEnabled).toBe(false);
    expect(exportedData.settings.collectFromAllGroups).toBe(true);
  });

  test('ファイルエクスポート処理においても syncEnabled は常に false に設定される', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      targets: [{ name: 'Test', pattern: ['example.com/*'], color: 'grey' }],
      settings: { collectFromAllGroups: true, syncEnabled: true }
    });
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    let createdContent = null;
    const originalBlob = global.Blob;
    global.Blob = jest.fn((content, options) => {
      createdContent = content[0];
      return new originalBlob(content, options);
    });
    global.URL.createObjectURL = jest.fn(() => 'blob:dummy');
    global.URL.revokeObjectURL = jest.fn();

    document.getElementById('file-export-btn').click();

    expect(createdContent).not.toBeNull();
    const exportedData = JSON.parse(createdContent);
    expect(exportedData.settings.syncEnabled).toBe(false);
    clickSpy.mockRestore();
  });

  test('インポート処理（追記・上書き両モード）において共通設定が保存され、syncEnabled は現在の端末状態を維持する', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      targets: [],
      settings: { collectFromAllGroups: false, syncEnabled: true }
    });
    const { init } = await import('../projects/app/sidepanel.js');
    await init();

    const importDataObj = {
      targets: [{ name: 'ImportedTarget', pattern: ['imported.com/*'], color: 'blue' }],
      settings: { collectFromAllGroups: true, syncEnabled: false }
    };

    // モード: 追記 (append)
    document.querySelector('input[name="import-mode"][value="append"]').checked = true;
    document.getElementById('paste-import-textarea').value = JSON.stringify(importDataObj);
    document.getElementById('confirm-paste-import-btn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        collectFromAllGroups: true,
        syncEnabled: true // インポート前の true を維持
      })
    }));

    // モード: 上書き (overwrite)
    document.querySelector('input[name="import-mode"][value="overwrite"]').checked = true;
    document.getElementById('paste-import-textarea').value = JSON.stringify(importDataObj);
    document.getElementById('confirm-paste-import-btn').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        collectFromAllGroups: true,
        syncEnabled: true // インポート前の true を維持
      })
    }));
  });
});
