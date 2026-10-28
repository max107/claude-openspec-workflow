#!/usr/bin/env node
'use strict';

/**
 * OpenSpec gate hook. UserPromptSubmit: a one-line reminder of when a change starts as an OpenSpec change, taken from
 * the first paragraph of rule openspec-changes, because a ruleset injected once fades when other plugins inject their
 * own instructions every turn.
 */

const fs = require('fs');
const path = require('path');
const { parseRule } = require('./workflow-context');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
// Claude Code moves additionalContext above this size into a file the model is not asked to read.
const MAX_CONTEXT_CHARS = 10000;

// The reminder is the rule's first paragraph, so it cannot drift from the rule.
function readGate(root = PLUGIN_ROOT) {
  const file = path.join(root, 'rules', 'openspec-changes.md');
  if (!fs.existsSync(file)) return '';
  const rule = parseRule(fs.readFileSync(file, 'utf8'));
  return rule ? `OpenSpec gate: ${rule.first}` : '';
}

function run(raw, options = {}) {
  let input = {};
  try {
    input = JSON.parse(raw || '{}');
  } catch {
    // malformed input: no event to answer
  }
  if (input.hook_event_name !== 'UserPromptSubmit') return { stdout: '', exitCode: 0 };
  const text = readGate(options.root);
  if (!text || text.length > MAX_CONTEXT_CHARS) return { stdout: '', exitCode: 0 };
  return { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } }), exitCode: 0 };
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => (raw += chunk));
  process.stdin.on('end', () => process.stdout.write(run(raw).stdout));
}

module.exports = { run, readGate, MAX_CONTEXT_CHARS };
