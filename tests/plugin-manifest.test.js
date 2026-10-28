// An installed plugin is refreshed only when its version changes, and Claude Code reads the version from the plugin's own
// manifest and, when the marketplace entry states one, from the entry: for every plugin of the marketplace the plugin.json
// must carry the entry's name and a MAJOR.MINOR.PATCH version, and the same version as the entry when the entry has one.

import { expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dir, '..');
const marketplace = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));

test('the marketplace lists plugins', () => {
  expect(marketplace.plugins.length).toBeGreaterThan(0);
});

test.each(marketplace.plugins.map(entry => [entry.name, entry]))('%s: plugin.json carries the entry\'s name and a version, the entry\'s when it states one', (_, entry) => {
  const plugin = JSON.parse(fs.readFileSync(path.join(root, entry.source, '.claude-plugin', 'plugin.json'), 'utf8'));
  expect(plugin.name).toBe(entry.name);
  expect(plugin.version).toMatch(/^\d+\.\d+\.\d+$/);
  if ('version' in entry) expect(plugin.version).toBe(entry.version);
});
