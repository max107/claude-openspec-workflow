// Tests for plugins/openspec-workflow/scripts/hooks/openspec-gate.js: the one-line OpenSpec gate reminder on every user
// message, taken from the first paragraph of rules/openspec-changes.md.

import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const pluginRoot = path.join(import.meta.dir, '..', 'plugins', 'openspec-workflow');
const script = path.join(pluginRoot, 'scripts', 'hooks', 'openspec-gate.js');
const { run, readGate } = require(script);
const { parseRule } = require(path.join(pluginRoot, 'scripts', 'hooks', 'workflow-context.js'));
const rule = parseRule(fs.readFileSync(path.join(pluginRoot, 'rules', 'openspec-changes.md'), 'utf8'));

describe('openspec-gate', () => {
  test('UserPromptSubmit gets the first paragraph of rule openspec-changes', () => {
    const out = spawnSync(process.execPath, [script], { input: '{"hook_event_name":"UserPromptSubmit"}', encoding: 'utf8' });
    expect(out.status).toBe(0);
    const hook = JSON.parse(out.stdout).hookSpecificOutput;
    expect(hook.hookEventName).toBe('UserPromptSubmit');
    expect(hook.additionalContext).toBe(`OpenSpec gate: ${rule.first}`);
    expect(hook.additionalContext).toBe(readGate());
  });

  test('other events and malformed input get nothing', () => {
    expect(run('{"hook_event_name":"SessionStart"}').stdout).toBe('');
    expect(run('not json').stdout).toBe('');
  });

  test('nothing is printed without the rule file', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'openspec-gate-'));
    try {
      expect(run('{"hook_event_name":"UserPromptSubmit"}', { root: empty }).stdout).toBe('');
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  test('hooks.json registers the script on UserPromptSubmit only', () => {
    const hooks = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'hooks', 'hooks.json'), 'utf8')).hooks;
    const events = Object.entries(hooks)
      .filter(([, entries]) => entries.some(entry => entry.hooks.some(hook => hook.command.includes('openspec-gate.js'))))
      .map(([event]) => event);
    expect(events).toEqual(['UserPromptSubmit']);
  });
});
