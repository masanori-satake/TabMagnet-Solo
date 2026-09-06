import { jest } from '@jest/globals';
import { applyI18n } from '../projects/app/ui/i18n.js';

describe('ui/i18n.js', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = {
      i18n: {
        getMessage: jest.fn(key => `msg_${key}`)
      }
    };
    global.chrome = chromeMock;
    document.body.innerHTML = `
      <div data-i18n="testKey">Original</div>
      <input data-i18n-placeholder="placeholderKey" placeholder="Original">
      <button data-i18n-aria-label="cancel" data-i18n-title="cancel"></button>
    `;
  });

  test('applyI18n translates elements', () => {
    applyI18n();
    expect(document.querySelector('[data-i18n]').textContent).toBe('msg_testKey');
    expect(document.querySelector('[data-i18n-placeholder]').placeholder).toBe('msg_placeholderKey');
    expect(document.querySelector('[data-i18n-aria-label]').getAttribute('aria-label')).toBe('msg_cancel');
    expect(document.querySelector('[data-i18n-title]').getAttribute('title')).toBe('msg_cancel');
  });

  test('applyI18n handles missing messages', () => {
    chromeMock.i18n.getMessage.mockReturnValue(null);
    applyI18n();
    expect(document.querySelector('[data-i18n]').textContent).toBe('Original');
  });
});
