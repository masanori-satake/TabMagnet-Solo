import {
  COLORS_CHROME,
  COLORS_EDGE,
  COLOR_COMPATIBILITY_MAP
} from '../projects/app/ui/constants.js';
import { getCompatibleColor, isEdge } from '../projects/app/ui/utils.js';

describe('Color Compatibility Utilities', () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true
    });
  });

  test('isEdge identifies Edge browser correctly', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      configurable: true
    });
    expect(isEdge()).toBe(true);

    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      configurable: true
    });
    expect(isEdge()).toBe(false);
  });

  test('getCompatibleColor returns same color if supported (standard 9 colors)', () => {
    // Both Chrome and Edge support the same standard 9 IDs now
    const standardColors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

    // Test in Chrome mode
    Object.defineProperty(navigator, 'userAgent', { value: 'Chrome', configurable: true });
    standardColors.forEach(color => {
      expect(getCompatibleColor(color)).toBe(color);
    });

    // Test in Edge mode
    Object.defineProperty(navigator, 'userAgent', { value: 'Edg/120', configurable: true });
    standardColors.forEach(color => {
      expect(getCompatibleColor(color)).toBe(color);
    });
  });

  test('getCompatibleColor maps non-standard colors correctly via COMPATIBILITY_MAP', () => {
    // Chrome mode
    Object.defineProperty(navigator, 'userAgent', { value: 'Chrome', configurable: true });
    expect(getCompatibleColor('magenta')).toBe('red');
    expect(getCompatibleColor('teal')).toBe('green');
    expect(getCompatibleColor('brown')).toBe('orange');
    expect(getCompatibleColor('white')).toBe('grey');

    // Edge mode (same mapping should apply as API IDs are identical)
    Object.defineProperty(navigator, 'userAgent', { value: 'Edg/120', configurable: true });
    expect(getCompatibleColor('magenta')).toBe('red');
    expect(getCompatibleColor('teal')).toBe('green');
    expect(getCompatibleColor('brown')).toBe('orange');
    expect(getCompatibleColor('white')).toBe('grey');
  });

  test('getCompatibleColor falls back to grey for unknown colors', () => {
    expect(getCompatibleColor('completely-unknown-color')).toBe('grey');
  });
});
