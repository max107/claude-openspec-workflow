// Every reference inside the marketplace's plugins must point at something that exists: `<plugin>:<name>` agents, skills
// and commands (in skills, agents, commands and rules, including a rule's `refines` and its `- <plugin>:<name>:` lines),
// skill names written in backticks as skills, and relative markdown links in skills, agents and commands.

import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dir, '..');
const marketplace = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), 'utf8'));
const list = (dir, strip = '') => (fs.existsSync(dir) ? fs.readdirSync(dir).map(name => name.replace(strip, '')) : []);

// Plugins come from the marketplace; each holds its skills, agents and commands by name.
const plugins = Object.fromEntries(
  marketplace.plugins.map(entry => {
    const dir = path.join(root, entry.source);
    const skills = new Set(list(path.join(dir, 'skills')));
    const agents = new Set(list(path.join(dir, 'agents'), /\.md$/));
    const commands = new Set(list(path.join(dir, 'commands'), /\.md$/));
    return [entry.name, { dir, skills, agents, commands, names: new Set([...skills, ...agents, ...commands]) }];
  }),
);
const allSkills = new Set([...Object.values(plugins).flatMap(p => [...p.skills])]);
const allAgents = new Set(Object.values(plugins).flatMap(p => [...p.agents]));

function markdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

const componentFiles = dir => ['skills', 'agents', 'commands'].flatMap(sub => markdownFiles(path.join(dir, sub)));
const files = Object.values(plugins).flatMap(p => componentFiles(p.dir)); // skills, agents, commands
const ruleFiles = Object.values(plugins).flatMap(p => markdownFiles(path.join(p.dir, 'rules')));
const read = file => fs.readFileSync(file, 'utf8');
const rel = file => path.relative(root, file);
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const pluginPattern = new RegExp(`(?<![\\w-])(${Object.keys(plugins).join('|')}):([a-z0-9][a-z0-9-]*[a-z0-9])\\b`, 'g');
const NAME = '[a-z0-9][a-z0-9-]*[a-z0-9]';

describe('plugin references', () => {
  test('there is something to check', () => {
    expect(Object.keys(plugins).length).toBeGreaterThanOrEqual(1);
    expect(files.length).toBeGreaterThan(0);
    expect(ruleFiles.length).toBeGreaterThan(0);
  });

  test('every <plugin>:<name> names an existing agent, skill or command of that plugin', () => {
    const missing = [];
    for (const file of [...files, ...ruleFiles]) {
      const text = read(file);
      for (const match of text.matchAll(pluginPattern)) {
        const [, plugin, name] = match;
        if (!plugins[plugin].names.has(name)) missing.push(`${rel(file)}:${lineOf(text, match.index)}: ${plugin}:${name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test('every rule\'s refines entry is a <plugin>:<name> of an existing component', () => {
    const bad = [];
    for (const file of ruleFiles) {
      const text = read(file);
      const refines = /^refines:\s*\[([^\]]*)\]\s*$/m.exec(text);
      if (!refines) continue;
      for (const entry of refines[1].split(',').map(s => s.trim()).filter(Boolean)) {
        const [plugin, name, ...extra] = entry.split(':');
        if (extra.length || !plugins[plugin]?.names.has(name)) bad.push(`${rel(file)}:${lineOf(text, refines.index)}: ${entry}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test('every skill or agent named in backticks as one exists in some plugin', () => {
    const missing = [];
    const typed = [
      // `name` skill, skill `name`
      [new RegExp(`\`(${NAME})\` skills?\\b|\\bskills? \`(${NAME})\``, 'g'), allSkills, 'skill'],
      // `name` agent, agent `name`
      [new RegExp(`\`(${NAME})\` agents?\\b|\\bagents? \`(${NAME})\``, 'g'), allAgents, 'agent'],
      // "(→ `name`)": the cross-reference form of "Not for X (→ `name`)"; the target is a skill or an agent
      [new RegExp(`\\(→ \`(${NAME})\``, 'g'), new Set([...allSkills, ...allAgents]), 'skill or agent'],
    ];
    for (const file of [...files, ...ruleFiles]) {
      const text = read(file);
      for (const [pattern, known, kind] of typed) {
        for (const match of text.matchAll(pattern)) {
          const name = match[1] ?? match[2];
          if (!known.has(name)) missing.push(`${rel(file)}:${lineOf(text, match.index)}: ${kind} \`${name}\``);
        }
      }
      // the description line of a skill names its neighbours as "→ `name`" or "→ `a` or `b`"
      const description = /^description:.*$/m.exec(text);
      if (description) {
        for (const match of description[0].matchAll(new RegExp(`→ \`(${NAME})\`(?: or \`(${NAME})\`)?`, 'g'))) {
          for (const name of match.slice(1).filter(Boolean)) {
            if (!allSkills.has(name) && !allAgents.has(name)) missing.push(`${rel(file)}:${lineOf(text, description.index)}: \`${name}\``);
          }
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  test('a backticked name of another plugin\'s component carries that plugin\'s prefix', () => {
    const bare = [];
    for (const [plugin, { dir }] of Object.entries(plugins)) {
      for (const file of componentFiles(dir)) {
        const text = read(file);
        for (const match of text.matchAll(/(?<![\w:-])`([a-z0-9][a-z0-9-]*)`/g)) {
          const name = match[1];
          if (plugins[plugin].names.has(name)) continue;
          const owners = Object.keys(plugins).filter(other => plugins[other].names.has(name));
          if (owners.length) bare.push(`${rel(file)}:${lineOf(text, match.index)}: \`${name}\` → \`${owners[0]}:${name}\``);
        }
      }
    }
    expect(bare).toEqual([]);
  });

  test('every relative markdown link resolves', () => {
    const missing = [];
    for (const file of files) {
      // code blocks and inline code hold Go like `errors.AsType[*E](err)`, which only looks like a link; blank them out
      // keeping the newlines so that line numbers stay right
      const text = read(file).replace(/```[\s\S]*?```/g, block => block.replace(/[^\n]/g, ' ')).replace(/`[^`\n]*`/g, code => ' '.repeat(code.length));
      for (const match of text.matchAll(/\]\(((?![a-z]+:|#|\/)[^)\s]+)\)/g)) {
        const target = match[1];
        const targetPath = decodeURIComponent(target.split('#')[0]);
        if (!fs.existsSync(path.resolve(path.dirname(file), targetPath))) missing.push(`${rel(file)}:${lineOf(text, match.index)}: ${target}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
