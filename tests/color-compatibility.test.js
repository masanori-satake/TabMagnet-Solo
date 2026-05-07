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

  test('getCompatibleColor returns same color if supported in current browser', () => {
    // Chrome
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Chrome',
      configurable: true
    });
    expect(getCompatibleColor('red')).toBe('red');
    expect(getCompatibleColor('grey')).toBe('grey');

    // Edge
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Edg/120',
      configurable: true
    });
    expect(getCompatibleColor('magenta')).toBe('magenta');
    expect(getCompatibleColor('teal')).toBe('teal');
  });

  test('getCompatibleColor maps incompatible colors correctly', () => {
    // Edge (magenta) -> Chrome (red)
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Chrome',
      configurable: true
    });
    expect(getCompatibleColor('magenta')).toBe('red');
    expect(getCompatibleColor('teal')).toBe('green');
    expect(getCompatibleColor('brown')).toBe('orange');

    // Chrome (red) -> Edge (magenta)
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Edg/120',
      configurable: true
    });
    expect(getCompatibleColor('red')).toBe('magenta');
    expect(getCompatibleColor('green')).toBe('teal');
  });

  test('getCompatibleColor falls back to grey for unknown colors', () => {
    expect(getCompatibleColor('unknown-color')).toBe('grey');
  });
});
