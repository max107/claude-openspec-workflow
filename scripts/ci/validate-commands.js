#!/usr/bin/env node
/**
 * Validate the command markdown files of every plugin: non-empty, readable,
 * valid frontmatter, and valid cross-references to commands, agents and skills
 * (inside the plugin, or `/<plugin>:<name>` into another one).
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Commands, agents and skills of every plugin of the marketplace: plugins/<name>/{commands,agents,skills}.
// A reference without a prefix resolves inside the plugin of the file; `<plugin>:<name>` resolves in that plugin.
const PLUGINS_DIR = path.join(__dirname, '../../plugins');

// Claude Code built-in commands that plugin commands may point to (code.claude.com/docs/en/commands).
const BUILTIN_COMMANDS = ['plan', 'code-review', 'review', 'security-review', 'simplify', 'btw', 'rewind', 'memory', 'init', 'diff', 'compact'];

/** Names of the entries of one plugin directory: `.md` files (suffix stripped) or sub-directories. */
function listNames(dir, { directories }) {
  if (!fs.existsSync(dir)) return new Set();
  const names = new Set();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (directories) {
      if (entry.isDirectory()) names.add(entry.name);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      names.add(entry.name.replace(/\.md$/, ''));
    }
  }
  return names;
}

/** Every plugin under plugins/: its name, the commands directory and the sets of its commands, agents and skills. */
function loadPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) return [];
  return fs
    .readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => {
      const root = path.join(PLUGINS_DIR, e.name);
      return {
        name: e.name,
        commandsDir: path.join(root, 'commands'),
        commands: listNames(path.join(root, 'commands'), { directories: false }),
        agents: listNames(path.join(root, 'agents'), { directories: false }),
        skills: listNames(path.join(root, 'skills'), { directories: true }),
      };
    });
}

function validateFrontmatter(file, content) {
  if (!content.startsWith('---\n')) {
    return [];
  }

  const endIndex = content.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return [`${file} - frontmatter block is missing a closing --- delimiter`];
  }

  try {
    const parsed = yaml.load(content.slice(4, endIndex));
    if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
      return [`${file} - frontmatter must be a YAML mapping`];
    }
  } catch (err) {
    return [`${file} - invalid frontmatter YAML: ${err.reason || err.message}`];
  }
  return [];
}

function validateCommands() {
  const plugins = loadPlugins();
  const byName = new Map(plugins.map(p => [p.name, p]));
  const withCommands = plugins.filter(p => fs.existsSync(p.commandsDir));
  if (withCommands.length === 0) {
    console.error(`ERROR: no commands directory under ${PLUGINS_DIR}/*/commands`);
    process.exit(1);
  }
  // Skill directories of any plugin: a skills/<name>/ path reference may point into another plugin.
  const allSkills = new Set(plugins.flatMap(p => [...p.skills]));

  let hasErrors = false;
  let warnCount = 0;
  let fileCount = 0;

  for (const plugin of withCommands) {
    const files = fs.readdirSync(plugin.commandsDir).filter(f => f.endsWith('.md'));
    const validCommands = new Set([...plugin.commands, ...BUILTIN_COMMANDS]);

    for (const file of files) {
      fileCount++;
      const label = `${plugin.name}/commands/${file}`;
      const filePath = path.join(plugin.commandsDir, file);
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        console.error(`ERROR: ${label} - ${err.message}`);
        hasErrors = true;
        continue;
      }

      // Validate the file is non-empty readable markdown
      if (content.trim().length === 0) {
        console.error(`ERROR: ${label} - Empty command file`);
        hasErrors = true;
        continue;
      }

      for (const error of validateFrontmatter(label, content)) {
        console.error(`ERROR: ${error}`);
        hasErrors = true;
      }

      // Strip fenced code blocks before checking cross-references.
      // Examples/templates inside ``` blocks are not real references.
      const contentNoCodeBlocks = content.replace(/```[\s\S]*?```/g, '');

      // Check cross-references to commands: `/build-fix` (this plugin or a built-in) and
      // `/other-plugin:build-fix` (a command or a skill of that plugin; skills are invoked the same way).
      // Skip lines that describe hypothetical output (e.g., "-> Creates: `/new-table`")
      // Process line-by-line so ALL command refs per line are captured
      for (const line of contentNoCodeBlocks.split('\n')) {
        if (/creates:|would create:/i.test(line)) continue;
        for (const match of line.matchAll(/`\/(?:([a-z][-a-z0-9]*):)?([a-z][-a-z0-9]*)`/g)) {
          const [, pluginName, refName] = match;
          if (pluginName === undefined) {
            if (!validCommands.has(refName)) {
              console.error(`ERROR: ${label} - references non-existent command /${refName}`);
              hasErrors = true;
            }
            continue;
          }
          const target = byName.get(pluginName);
          if (!target) {
            console.error(`ERROR: ${label} - references /${pluginName}:${refName} of unknown plugin ${pluginName}`);
            hasErrors = true;
          } else if (!target.commands.has(refName) && !target.skills.has(refName)) {
            console.error(`ERROR: ${label} - references non-existent command /${pluginName}:${refName}`);
            hasErrors = true;
          }
        }
      }

      // Check agent path references (e.g., "agents/planner.md") against the agents of this plugin;
      // `<plugin>:<name>` references are checked by tests/plugin-references.test.js.
      for (const match of contentNoCodeBlocks.matchAll(/agents\/([a-z][-a-z0-9]*)\.md/g)) {
        const refName = match[1];
        if (!plugin.agents.has(refName)) {
          console.error(`ERROR: ${label} - references non-existent agent agents/${refName}.md`);
          hasErrors = true;
        }
      }

      // Check skill directory references (e.g., "skills/tdd-workflow/")
      // learned and imported are reserved roots (~/.claude/skills/); no local dir expected
      const reservedSkillRoots = new Set(['learned', 'imported']);
      for (const match of contentNoCodeBlocks.matchAll(/skills\/([a-z][-a-z0-9]*)\//g)) {
        const refName = match[1];
        if (reservedSkillRoots.has(refName) || allSkills.has(refName)) continue;
        console.warn(`WARN: ${label} - references skill directory skills/${refName}/ (not found locally)`);
        warnCount++;
      }

      // Check agent name references in workflow diagrams (e.g., "planner -> tdd-guide")
      for (const match of contentNoCodeBlocks.matchAll(/^([a-z][-a-z0-9]*(?:\s*->\s*[a-z][-a-z0-9]*)+)$/gm)) {
        for (const agent of match[1].split(/\s*->\s*/)) {
          if (!plugin.agents.has(agent)) {
            console.error(`ERROR: ${label} - workflow references non-existent agent "${agent}"`);
            hasErrors = true;
          }
        }
      }
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  let msg = `Validated ${fileCount} command files`;
  if (warnCount > 0) {
    msg += ` (${warnCount} warnings)`;
  }
  console.log(msg);
}

validateCommands();
