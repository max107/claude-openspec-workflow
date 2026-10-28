// Tests for plugins/<plugin>/scripts/hooks/workflow-context.js: the digest built from the rule files
// (plugins/<plugin>/rules/<name>.md) and the per-component refinements taken from the same files.
// Baseline spec: openspec/specs/workflow-context/spec.md of the claude-workflow repository, which ships the same script.
// Every case runs for each plugin that ships the hook.

import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.join(import.meta.dir, '..');
const pluginsDir = path.join(root, 'plugins');
const hookFile = path.join('scripts', 'hooks', 'workflow-context.js');

// Plugins that ship the hook script (and with it the rules and the hook registration).
const pluginNames = fs.readdirSync(pluginsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && fs.existsSync(path.join(pluginsDir, entry.name, hookFile)))
  .map(entry => entry.name)
  .sort();

// Component names the spec scenarios use, per plugin. A plugin without an entry fails the "every plugin is covered" test.
// skill/skillTitle: a skill that a rule refines and the title of that rule.
// lineRule: a rule with a line addressed to `skill` (skillLine) and a line addressed to others (otherLine).
// otherSkill: a skill the same rule refines only through its general text and other lines.
// agent: an agent that rules refine (null when the plugin has none) with the titles it must get.
const cases = {
  'openspec-workflow': {
    skill: 'openspec-workflow:openspec',
    bare: 'openspec',
    skillTitle: 'Code discovery for OpenSpec changes',
    lineRule: 'delegation',
    lineSkill: 'openspec-workflow:openspec',
    lineTitle: 'Delegation to cheaper workers',
    generalText: 'An OpenSpec task is one whose files and proving command are named',
    ownLine: '- openspec-workflow:openspec:',
    otherLines: [],
    agent: null,
  },
};

const spawnHook = (script, input) => spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
const hookOf = out => JSON.parse(out.stdout).hookSpecificOutput;

const withRules = (files, body) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-rules-'));
  fs.mkdirSync(path.join(dir, 'rules'));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'rules', name), text);
  try {
    return body(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test('at least one plugin ships the hook, and every one of them is covered by the cases', () => {
  expect(pluginNames).toContain('openspec-workflow');
  expect(pluginNames.filter(name => !cases[name])).toEqual([]);
});

test('every plugin runs one and the same hook script', () => {
  const [first, ...others] = pluginNames.map(name => fs.readFileSync(path.join(pluginsDir, name, hookFile)));
  for (const other of others) expect(Buffer.compare(first, other)).toBe(0);
});

// Components named by the rules of all plugins, for the "existing components" requirement.
const exists = target => {
  const [plugin, name] = target.split(':');
  return Boolean(plugin && name) && [path.join('skills', name, 'SKILL.md'), path.join('agents', `${name}.md`), path.join('commands', `${name}.md`)]
    .some(file => fs.existsSync(path.join(pluginsDir, plugin, file)));
};

for (const plugin of pluginNames) {
  const pluginRoot = path.join(pluginsDir, plugin);
  const script = path.join(pluginRoot, hookFile);
  const { run, readRules, parseRule, loadRules, refinementsFor, addressees, MAX_CONTEXT_CHARS } = require(script);
  const rulesDir = path.join(pluginRoot, 'rules');
  const ruleFiles = fs.readdirSync(rulesDir).filter(file => file.endsWith('.md'));
  const rules = loadRules();
  const spawn = input => spawnHook(script, input);
  const c = cases[plugin] || {};
  const skillEvent = skill => JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill } });

  describe(`workflow-context (${plugin})`, () => {
    test('every rule file has a title and a first paragraph', () => {
      expect(ruleFiles.length).toBeGreaterThan(0);
      expect(ruleFiles.filter(file => !parseRule(fs.readFileSync(path.join(rulesDir, file), 'utf8')))).toEqual([]);
    });

    test('a rule file without a title or a first paragraph is not a rule', () => {
      expect(parseRule('---\nrefines: [a:b]\n---\nRule.\n')).toBeNull();
      expect(parseRule('---\ntitle: T\n---\n\n')).toBeNull();
      expect(parseRule('no frontmatter\n')).toBeNull();
    });

    test('a new rule file appears in the digest with no other edit', () => withRules({
      'one.md': '---\ntitle: One\n---\nFirst rule.\n',
    }, dir => {
      expect(readRules(dir)).not.toContain('**two**');
      fs.writeFileSync(path.join(dir, 'rules', 'two.md'), '---\ntitle: Two\n---\nSecond rule.\n- extra line\n');
      expect(readRules(dir)).toContain('- **two**: Second rule.');
    }));

    test('the digest has one line per rule file, led by its name', () => {
      const lines = [...readRules().matchAll(/^- \*\*([a-z0-9-]+)\*\*: (.+)$/gm)];
      expect(lines.map(([, name]) => `${name}.md`).sort()).toEqual([...ruleFiles].sort());
      for (const rule of rules) expect(readRules()).toContain(`- **${rule.name}**: ${rule.first}`);
      expect(new Set(rules.map(rule => rule.title)).size).toBe(rules.length);
    });

    test('the header says a task request does not lift a rule', () => {
      const header = readRules().split('\n')[0];
      expect(header).toContain("yields only to the project's own CLAUDE.md or AGENTS.md, or to the user's explicit exception that names it");
      expect(header).toContain('a task request that conflicts with a rule is not an exception: name the rule and ask');
    });

    test('the header holds an absolute path to the running plugin rules and every rule file exists there', () => {
      const header = readRules().split('\n')[0];
      const dir = (header.match(/(\/\S+\/rules)\/<name>\.md/) || [])[1];
      expect(path.isAbsolute(dir)).toBe(true);
      expect(dir).toBe(rulesDir);
      expect(fs.statSync(dir).isDirectory()).toBe(true);
      expect(rules.filter(rule => !fs.existsSync(path.join(dir, `${rule.name}.md`))).map(rule => rule.name)).toEqual([]);
    });

    test('the injected text stays under 6000 characters, below the inline limit', () => {
      expect(MAX_CONTEXT_CHARS).toBe(10000);
      expect(readRules().length).toBeLessThan(6000);
      expect(readRules().length).toBeLessThan(MAX_CONTEXT_CHARS);
    });

    test('SessionStart gets the rules as additionalContext, naming the event', () => {
      const out = spawn('{"hook_event_name":"SessionStart"}');
      expect(out.status).toBe(0);
      const hook = hookOf(out);
      expect(hook.hookEventName).toBe('SessionStart');
      expect(hook.additionalContext.startsWith(`Environment rules (${plugin} plugin)`)).toBe(true);
      expect(hook.additionalContext).toBe(readRules());
      for (const rule of rules) expect(hook.additionalContext).toContain(`**${rule.name}**`);
    });

    test('SubagentStart gets the same rules for an agent no refinement names', () => {
      const hook = hookOf(spawn('{"hook_event_name":"SubagentStart","agent_type":"x:no-such-agent"}'));
      expect(hook.hookEventName).toBe('SubagentStart');
      expect(hook.additionalContext).toBe(readRules());
      expect(hookOf(spawn('{"hook_event_name":"SubagentStart"}')).additionalContext).toBe(readRules());
    });

    test('malformed input falls back to the session event', () => {
      expect(JSON.parse(run('not json').stdout).hookSpecificOutput.hookEventName).toBe('SessionStart');
    });

    test('nothing is printed without a digest', () => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-context-'));
      try {
        expect(run('{}', { root: empty }).stdout).toBe('');
        expect(run('{"hook_event_name":"SubagentStart"}', { root: empty }).stdout).toBe('');
      } finally {
        fs.rmSync(empty, { recursive: true, force: true });
      }
    });

    test('a loaded skill gets the refinements that name it, under a header naming the skill', () => {
      const hook = hookOf(spawn(skillEvent(c.skill)));
      expect(hook.hookEventName).toBe('PostToolUse');
      expect(hook.additionalContext).toContain(c.skill);
      expect(hook.additionalContext).toContain('win where they differ');
      expect(hook.additionalContext).toContain(`### ${c.skillTitle}`);
    });

    test('a skill gets the general text and only the lines addressed to it', () => {
      const context = refinementsFor(c.lineSkill);
      const rule = rules.find(rule => rule.name === c.lineRule);
      expect(context).toContain(`### ${c.lineTitle} (\`${c.lineRule}\`)`);
      expect(context).toContain(c.generalText);
      if (c.ownLine) expect(context).toContain(c.ownLine);
      expect(context).not.toContain(rule.first);
      for (const line of c.otherLines) expect(context).not.toContain(line);
    });

    test('a loaded skill gets nothing when no refinement names it', () => {
      expect(spawn(skillEvent(`${plugin}:no-such-skill`)).stdout).toBe('');
    });

    test('a skill loaded without its plugin prefix gets the same refinements', () => {
      const bare = hookOf(spawn(skillEvent(c.bare))).additionalContext;
      expect(bare).toBe(refinementsFor(c.skill));
      expect(bare).toContain(`### ${c.skillTitle}`);
    });

    test('a refinement leaves out the first paragraph of its rule and names the rule by title and file name', () => {
      const targets = new Set(rules.flatMap(rule => rule.refines));
      for (const rule of rules) {
        for (const target of rule.refines) {
          const context = refinementsFor(target);
          expect(context).toContain(`### ${rule.title} (\`${rule.name}\`)`);
          expect(context).not.toContain(rule.first);
        }
      }
      expect(targets.size).toBeGreaterThan(0);
    });

    if (c.agent) {
      test('a starting agent gets the digest and its refinements', () => {
        const hook = hookOf(spawn(JSON.stringify({ hook_event_name: 'SubagentStart', agent_type: c.agent })));
        expect(hook.hookEventName).toBe('SubagentStart');
        const context = hook.additionalContext;
        expect(context.startsWith(readRules())).toBe(true);
        for (const title of c.agentTitles) expect(context).toContain(`### ${title}`);
        for (const line of c.agentLines) expect(context).toContain(line);
        for (const line of c.agentNotLines) expect(context).not.toContain(line);
        expect(context.length).toBeLessThan(MAX_CONTEXT_CHARS);
      });
    }

    test('refinements too long for a subagent leave it the digest alone', () => withRules({
      'big.md': `---\ntitle: Big\nrefines: [${plugin}:big]\n---\nRule B.\n\n- ${plugin}:big: ${'x'.repeat(MAX_CONTEXT_CHARS)}\n`,
    }, dir => {
      const out = run(JSON.stringify({ hook_event_name: 'SubagentStart', agent_type: `${plugin}:big` }), { root: dir }).stdout;
      expect(JSON.parse(out).hookSpecificOutput.additionalContext).toBe(readRules(dir));
    }));

    test('an indented line stays with its bullet across a blank line, an unindented paragraph is general', () => withRules({
      'a.md': `---\ntitle: A\nrefines: [${plugin}:x, ${plugin}:y]\n---\nRule.\n\nGeneral paragraph.\n\n- ${plugin}:x: only x.\n\n  more for x.\n- ${plugin}:y: only y.\n`,
    }, dir => {
      expect(refinementsFor(`${plugin}:x`, dir)).toContain('more for x.');
      expect(refinementsFor(`${plugin}:x`, dir)).toContain('only x.');
      expect(refinementsFor(`${plugin}:y`, dir)).not.toContain('more for x.');
      expect(refinementsFor(`${plugin}:y`, dir)).not.toContain('only x.');
      expect(refinementsFor(`${plugin}:y`, dir)).toContain('only y.');
      expect(refinementsFor(`${plugin}:y`, dir)).toContain('General paragraph.');
    }));

    describe('commands', () => {
      const command = `${plugin}:some-command`;
      const commandRules = {
        'cmd.md': `---\ntitle: Command rule\nrefines: [${command}, ${plugin}:other-command]\n---\nRule C.\n\nGeneral for commands.\n\n- ${command}: for some-command.\n- ${plugin}:other-command: for other-command.\n`,
      };
      const expansion = (name, type = 'slash_command') => JSON.stringify({ hook_event_name: 'UserPromptExpansion', expansion_type: type, command_name: name });

      test('a slash command gets the refinements that name it', () => withRules(commandRules, dir => {
        const hook = JSON.parse(run(expansion(command), { root: dir }).stdout).hookSpecificOutput;
        expect(hook.hookEventName).toBe('UserPromptExpansion');
        expect(hook.additionalContext).toContain(command);
        expect(hook.additionalContext).toContain('### Command rule (`cmd`)');
        expect(hook.additionalContext).toContain('General for commands.');
        expect(hook.additionalContext).toContain('for some-command.');
        expect(hook.additionalContext).not.toContain('for other-command.');
      }));

      test('a command no refinement names, or another expansion, gets nothing', () => withRules(commandRules, dir => {
        expect(run(expansion(`${plugin}:unlisted`), { root: dir }).stdout).toBe('');
        expect(run(expansion(command, 'mcp_prompt'), { root: dir }).stdout).toBe('');
      }));

      test('the real hook prints nothing for a command no refinement names', () => {
        expect(spawn(expansion(`${plugin}:no-such-command`)).stdout).toBe('');
      });
    });
  });

  describe(`workflow refinements (${plugin})`, () => {
    test('every rule refines only existing skills, agents or commands', () => {
      const stale = rules.flatMap(rule => rule.refines.filter(target => !exists(target)).map(target => `${rule.file}: ${target}`));
      expect(stale).toEqual([]);
    });

    test('every line addressed to components names only components the file refines', () => {
      const unreachable = [];
      for (const rule of rules) {
        for (const line of rule.body.split('\n')) {
          for (const name of addressees(line) || []) {
            if (!rule.refines.includes(name)) unreachable.push(`${rule.file}: ${name}`);
          }
        }
      }
      expect(unreachable).toEqual([]);
    });

    test('what a component gets stays under 3000 characters', () => {
      const targets = new Set(rules.flatMap(rule => rule.refines));
      const tooLong = [...targets].filter(target => refinementsFor(target).length >= 3000);
      expect(tooLong).toEqual([]);
    });
  });

  describe(`hooks.json (${plugin})`, () => {
    test('registers the rule hook script on exactly the events the spec describes, other scripts are ignored', () => {
      const hooks = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'hooks', 'hooks.json'), 'utf8')).hooks;
      const registered = Object.entries(hooks).flatMap(([event, entries]) => entries.flatMap(entry => entry.hooks
        .filter(hook => hook.command.includes('workflow-context.js'))
        .map(hook => ({ at: `${event}:${entry.matcher || ''}`, command: hook.command }))));
      expect(registered.map(item => item.at).sort()).toEqual(['PostToolUse:Skill', 'SessionStart:startup|resume|clear|compact|fork', 'SubagentStart:.*', 'UserPromptExpansion:'].sort());
      expect(new Set(registered.map(item => item.command))).toEqual(new Set(['node "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/workflow-context.js"']));
    });
  });
}
