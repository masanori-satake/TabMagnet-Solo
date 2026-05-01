import { matchUrl, getTimestamp } from '../projects/app/ui/utils.js';

describe('matchUrl', () => {
  test('basic prefix match', () => {
    expect(matchUrl('https://jira.example.com/browse/PROJ-1', 'jira.example.com')).toBe(true);
  });

  test('wildcard match', () => {
    expect(matchUrl('https://jira.example.com/browse/PROJ-1', 'jira.example.com/*/PROJ-*')).toBe(true);
    expect(matchUrl('https://github.com/masanori-satake/TabMagnet-Solo', 'github.com/*/TabMagnet-Solo')).toBe(true);
  });

  test('no protocol match', () => {
    expect(matchUrl('http://example.com', 'example.com')).toBe(true);
    expect(matchUrl('https://example.com', 'example.com')).toBe(true);
  });

  test('non-matching', () => {
    expect(matchUrl('https://google.com', 'example.com')).toBe(false);
  });

  test('normalization test', () => {
    expect(matchUrl('https://example.com/path', 'https://example.com/*')).toBe(true);
    expect(matchUrl('https://example.com/path', 'http://example.com/*')).toBe(true);
  });
});

describe('getTimestamp', () => {
  test('format check', () => {
    const ts = getTimestamp();
    expect(ts).toMatch(/^\d{8}_\d{6}$/);
  });
});
