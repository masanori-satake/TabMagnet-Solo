import { jest } from '@jest/globals';
import {
  migrateTargetsToGroupSets,
  resolveGroupSets
} from '../projects/app/ui/utils.js';

describe('Data Migration (Property 11 & Requirements 11, 12, 20)', () => {
  beforeEach(() => {
    global.chrome = {
      i18n: {
        getMessage: jest.fn(() => '(名称未設定)')
      }
    };
  });

  afterEach(() => {
    delete global.chrome;
  });

  test('Property 11: migrateTargetsToGroupSets preserves name, pattern, and color for all groups', () => {
    const targets = [
      { name: 'Google', pattern: ['google.com/*'], color: 'blue' },
      { name: 'Jira', pattern: 'jira.example.com/*', color: 'magenta' } // color mapped to red
    ];

    const groupSet = migrateTargetsToGroupSets(targets);

    expect(groupSet.name).toBe('(名称未設定)');
    expect(groupSet.color).toBe('grey');
    expect(groupSet.expanded).toBe(true);
    expect(groupSet.groups.length).toBe(2);

    expect(groupSet.groups[0]).toEqual({
      name: 'Google',
      pattern: ['google.com/*'],
      color: 'blue'
    });

    expect(groupSet.groups[1]).toEqual({
      name: 'Jira',
      pattern: 'jira.example.com/*',
      color: 'red' // compatible mapped
    });
  });

  test('migrateTargetsToGroupSets handles empty array', () => {
    const groupSet = migrateTargetsToGroupSets([]);
    expect(groupSet.groups).toEqual([]);
    expect(groupSet.name).toBe('(名称未設定)');
  });

  test('resolveGroupSets prioritizes groupSets if already present', () => {
    const rawData = {
      groupSets: [{ name: 'Existing Set', color: 'grey', expanded: true, groups: [] }],
      targets: [{ name: 'Old Target', pattern: 'old.com' }]
    };

    const resolved = resolveGroupSets(rawData);

    expect(resolved.migrated).toBe(false);
    expect(resolved.needsCleanup).toBe(false);
    expect(resolved.groupSets[0].name).toBe('Existing Set');
  });

  test('resolveGroupSets converts targets and flags cleanup if groupSets absent', () => {
    const rawData = {
      targets: [{ name: 'Old Target', pattern: 'old.com', color: 'green' }]
    };

    const resolved = resolveGroupSets(rawData);

    expect(resolved.migrated).toBe(true);
    expect(resolved.needsCleanup).toBe(true);
    expect(resolved.groupSets.length).toBe(1);
    expect(resolved.groupSets[0].groups[0].name).toBe('Old Target');
  });

  test('resolveGroupSets creates default groupSet when both keys are absent', () => {
    const resolved = resolveGroupSets({});

    expect(resolved.migrated).toBe(true);
    expect(resolved.needsCleanup).toBe(false);
    expect(resolved.groupSets.length).toBe(1);
    expect(resolved.groupSets[0].name).toBe('(名称未設定)');
    expect(resolved.groupSets[0].groups).toEqual([]);
  });
});
