import { jest } from '@jest/globals';
import {
  matchUrl,
  validateImportData,
  validateGroupSet,
  validateGroupSets,
  createDefaultGroupSet,
  migrateTargetsToGroupSets,
  resolveGroupSets,
  getTimestamp,
  getExportTimestamp
} from '../projects/app/ui/utils.js';

describe('validateImportData & validateGroupSets', () => {
  test('should accept valid groupSets and settings', () => {
    expect(() => validateImportData({
      groupSets: [{
        name: 'Test Set',
        color: 'grey',
        expanded: true,
        groups: [{ name: 'Test', pattern: 'http://example.com/*' }]
      }]
    })).not.toThrow();
  });

  test('should accept valid Old Format targets for backward compatibility', () => {
    expect(() => validateImportData({
      targets: [{ name: 'Test', pattern: 'http://example.com/*' }]
    })).not.toThrow();
  });

  test('Property 15: Property-based check - validateGroupSets rejects invalid groupSets structures', () => {
    // Non-array groupSets
    expect(() => validateGroupSets('not an array')).toThrow('Invalid format: groupSets must be an array');

    // Invalid elements count (> 20)
    const twentyOneSets = Array.from({ length: 21 }, (_, i) => ({
      name: `Set ${i}`, color: 'grey', expanded: true, groups: []
    }));
    expect(() => validateGroupSets(twentyOneSets)).toThrow('Invalid format: groupSets array exceeds limit');

    // Extra property on Group-Set
    expect(() => validateGroupSet({
      name: 'Set', color: 'grey', expanded: true, groups: [], extra: 'bad'
    })).toThrow('Invalid group-set property');

    // Invalid name
    expect(() => validateGroupSet({
      name: '', color: 'grey', expanded: true, groups: []
    })).toThrow('Invalid group-set name');

    expect(() => validateGroupSet({
      name: 'a'.repeat(101), color: 'grey', expanded: true, groups: []
    })).toThrow('Invalid group-set name');

    // Invalid color
    expect(() => validateGroupSet({
      name: 'Set', color: 'invalid_color', expanded: true, groups: []
    })).toThrow('Invalid group-set color');

    // Invalid expanded
    expect(() => validateGroupSet({
      name: 'Set', color: 'grey', expanded: 'not boolean', groups: []
    })).toThrow('Invalid group-set expanded');

    // Invalid groups (> 100)
    const hundredOneGroups = Array.from({ length: 101 }, (_, i) => ({
      name: `G ${i}`, pattern: 'example.com'
    }));
    expect(() => validateGroupSet({
      name: 'Set', color: 'grey', expanded: true, groups: hundredOneGroups
    })).toThrow('Invalid group-set groups');

    // Invalid target in groups (dangerous scheme)
    expect(() => validateGroupSet({
      name: 'Set', color: 'grey', expanded: true,
      groups: [{ name: 'Bad', pattern: 'javascript:alert(1)' }]
    })).toThrow('Invalid target pattern');
  });

  test('should reject dangerous/special scheme pattern URLs', () => {
    expect(() => validateImportData({
      targets: [{ name: 'Test', pattern: 'javascript:alert(1)' }]
    })).toThrow('Invalid target pattern');

    expect(() => validateImportData({
      targets: [{ name: 'Test', pattern: 'data:text/html,<h1>test</h1>' }]
    })).toThrow('Invalid target pattern');

    expect(() => validateImportData({
      targets: [{ name: 'Test', pattern: 'file:///C:/Windows/System32' }]
    })).toThrow('Invalid target pattern');

    expect(() => validateImportData({
      targets: [{ name: 'Test', pattern: 'chrome://settings' }]
    })).toThrow('Invalid target pattern');

    expect(() => validateImportData({
      targets: [{ name: 'Test', pattern: ['https://valid.com/*', 'about:blank'] }]
    })).toThrow('Invalid target pattern');
  });
});

describe('Property 2: resolveGroupSets and createDefaultGroupSet', () => {
  beforeEach(() => {
    global.chrome = {
      i18n: { getMessage: jest.fn(() => '(名称未設定)') }
    };
  });

  afterEach(() => {
    delete global.chrome;
  });

  test('createDefaultGroupSet creates default Group-Set structure', () => {
    const defaultSet = createDefaultGroupSet();
    expect(defaultSet).toEqual({
      name: '(名称未設定)',
      color: 'grey',
      expanded: true,
      groups: []
    });
  });

  test('resolveGroupSets handles empty, undefined, and valid inputs', () => {
    // Empty / null rawData
    const res1 = resolveGroupSets(null);
    expect(res1.groupSets.length).toBe(1);
    expect(res1.groupSets[0].name).toBe('(名称未設定)');
    expect(res1.migrated).toBe(true);

    // Existing groupSets
    const existing = [{ name: 'Set 1', color: 'blue', expanded: false, groups: [] }];
    const res2 = resolveGroupSets({ groupSets: existing });
    expect(res2.groupSets).toBe(existing);
    expect(res2.migrated).toBe(false);

    // Old format targets
    const oldTargets = [{ name: 'Google', pattern: 'google.com', color: 'blue' }];
    const res3 = resolveGroupSets({ targets: oldTargets });
    expect(res3.groupSets.length).toBe(1);
    expect(res3.groupSets[0].groups.length).toBe(1);
    expect(res3.groupSets[0].groups[0].name).toBe('Google');
    expect(res3.migrated).toBe(true);
    expect(res3.needsCleanup).toBe(true);
  });
});

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

  test('special characters match', () => {
    expect(matchUrl('https://example.com/search?q=1', 'example.com/search?q=1')).toBe(true);
    expect(matchUrl('https://example.com/a.b', 'example.com/a.b')).toBe(true);
    expect(matchUrl('https://example.com/axb', 'example.com/a.b')).toBe(false);
  });

  test('normalization test', () => {
    expect(matchUrl('https://example.com/path', 'https://example.com/*')).toBe(true);
    expect(matchUrl('https://example.com/path', 'http://example.com/*')).toBe(true);
    expect(matchUrl('https://notebooklm.google.com/', 'notebooklm.google.com/*')).toBe(true);
  });

  test('ReDoS prevention and consecutive wildcard handling', () => {
    expect(matchUrl('https://jira.example.com/browse/PROJ-1', 'jira.example.com/***browse/PROJ-***')).toBe(true);
  });
});

describe('getTimestamp & getExportTimestamp', () => {
  test('format check', () => {
    expect(getTimestamp()).toMatch(/^\d{8}_\d{6}$/);
    expect(getExportTimestamp()).toMatch(/^\d{6}_\d{4}$/);
  });
});
