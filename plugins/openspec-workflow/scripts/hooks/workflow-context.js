#!/usr/bin/env node
'use strict';

/**
 * Workflow hook. The user's environment rules live in rules/<name>.md, one plain file per rule: frontmatter `title` and
 * an optional `refines` list, then the rule as the first paragraph, its cases, and lines addressed to components.
 * SessionStart: the digest built from the files (one line per rule). SubagentStart: the digest, then the rules that
 * refine the starting agent. PostToolUse on the Skill tool and UserPromptExpansion of a slash command: the rules that
 * refine that skill or command.
 * A component gets a rule's general lines and only the lines addressed to it, so the
 * user's workflow refines skills, agents and commands without being written into them.
 */

const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
// Claude Code moves additionalContext above this size into a file the model is not asked to read.
const MAX_CONTEXT_CHARS = 10000;

// The plugin that carries the rules, named in the texts the model reads.
function pluginName(root = PLUGIN_ROOT) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8')).name || path.basename(root);
  } catch {
    return path.basename(root);
  }
}

// A rule file: frontmatter with `title: <title>` and optionally `refines: [plugin:name, ...]`, then the body.
function parseRule(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const title = match[1].match(/^title:\s*(.+)$/m);
  const refines = match[1].match(/^refines:\s*\[([^\]]*)\]\s*$/m);
  const body = match[2].trim();
  const [paragraph, ...rest] = body.split(/\n\s*\n/);
  const first = paragraph.replace(/\s*\n\s*/g, ' ').trim();
  if (!title || !first) return null;
  return {
    title: title[1].trim(),
    refines: refines ? refines[1].split(',').map(name => name.trim()).filter(Boolean) : [],
    body,
    first,
    rest: rest.join('\n\n'),
  };
}

function loadRules(root = PLUGIN_ROOT) {
  const dir = path.join(root, 'rules');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.md'))
    .sort()
    .map(file => ({ file, name: file.replace(/\.md$/, ''), ...parseRule(fs.readFileSync(path.join(dir, file), 'utf8')) }))
    .filter(rule => rule.title);
}

// The digest: a header that names where the full rules are, then one line per rule led by its file name.
function readRules(root = PLUGIN_ROOT) {
  const rules = loadRules(root);
  if (rules.length === 0) return '';
  const header = `Environment rules (${pluginName(root)} plugin) hold in every project and subagent and win over skills. `
    + "A rule yields only to the project's own CLAUDE.md or AGENTS.md, or to the user's explicit exception that names it; "
    + 'a task request that conflicts with a rule is not an exception: name the rule and ask. '
    + `Full text: ${path.join(root, 'rules')}/<name>.md, read when a decision turns on it.`;
  return [header, ...rules.map(rule => `- **${rule.name}**: ${rule.first}`)].join('\n');
}

// A body line led by `- plugin:name[, plugin:name]: ` is addressed to those components; any other line is general.
function addressees(line) {
  const match = line.match(/^- ((?:[a-z0-9-]+:[a-z0-9-]+)(?:,\s*[a-z0-9-]+:[a-z0-9-]+)*):\s/);
  return match ? match[1].split(',').map(name => name.trim()) : null;
}

// The general lines of a rule and only the lines addressed to `component`. An indented line belongs to the bullet above
// it, even across blank lines; a blank line never changes who gets the next indented line.
function bodyFor(body, component) {
  let keep = true;
  return body.split('\n').filter(line => {
    if (!line.trim()) return true;
    if (/^\s/.test(line)) return keep;
    const names = addressees(line);
    keep = !names || names.includes(component);
    return keep;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function refinementsFor(name, root = PLUGIN_ROOT) {
  const rules = loadRules(root);
  // A skill loaded without its plugin prefix ("swarm-delegate") stands for the listed component of that name.
  const component = name.includes(':')
    ? name
    : rules.flatMap(rule => rule.refines).find(target => target.endsWith(`:${name}`)) || name;
  const matching = rules.filter(rule => rule.refines.includes(component));
  if (matching.length === 0) return '';
  return [
    `Workflow refinements for ${component} (the user's environment rules, ${pluginName(root)} plugin): they say how the rules apply here and win where they differ from ${component}.`,
    // The rule's first paragraph is left out: the digest already carries it under the same title and name.
    ...matching.map(rule => [`### ${rule.title} (\`${rule.name}\`)`, bodyFor(rule.rest, component)].filter(Boolean).join('\n')),
  ].join('\n\n');
}

function contextFor(input, root) {
  const event = input.hook_event_name;
  if (event === 'UserPromptExpansion') {
    const command = input.expansion_type === 'slash_command' && input.command_name;
    return { event, text: command ? refinementsFor(command, root) : '' };
  }
  if (event === 'PostToolUse') {
    const skill = input.tool_name === 'Skill' && input.tool_input && input.tool_input.skill;
    return skill ? { event, text: refinementsFor(skill, root) } : { event, text: '' };
  }
  if (event === 'SubagentStart') {
    const digest = readRules(root);
    const extra = input.agent_type ? refinementsFor(input.agent_type, root) : '';
    const text = [digest, extra].filter(Boolean).join('\n\n');
    // Over the inline limit nothing would be shown; the digest alone still reaches the agent.
    return { event, text: text.length > MAX_CONTEXT_CHARS ? digest : text };
  }
  return { event: 'SessionStart', text: readRules(root) };
}

function run(raw, options = {}) {
  let input = {};
  try {
    input = JSON.parse(raw || '{}');
  } catch {
    // malformed input: answer as the session event
  }
  const { event, text } = contextFor(input, options.root);
  const output = {};
  if (text && text.length <= MAX_CONTEXT_CHARS) output.hookSpecificOutput = { hookEventName: event, additionalContext: text };
  return { stdout: Object.keys(output).length ? JSON.stringify(output) : '', exitCode: 0 };
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => (raw += chunk));
  process.stdin.on('end', () => process.stdout.write(run(raw).stdout));
}

module.exports = { run, readRules, parseRule, loadRules, refinementsFor, addressees, MAX_CONTEXT_CHARS };
