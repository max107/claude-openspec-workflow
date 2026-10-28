#!/usr/bin/env node
/**
 * Validate skill directories of every plugin (plugins/<name>/skills/).
 *
 * Checks:
 *   1. Each sub-directory of skills/ contains a SKILL.md file.
 *   2. SKILL.md is non-empty.
 *   3. SKILL.md frontmatter, when present, is valid YAML (a mapping) and
 *      declares non-empty string `name` and `description` fields.
 *   4. `description` is not a literal block scalar (`|` / `|-` / `|+`),
 *      which preserves internal newlines and breaks flat-table renderers.
 *
 * All findings are errors (exit 1). A SKILL.md with no frontmatter block at
 * all is tolerated. A plugin without skills/ is skipped.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '../..');
// Every plugin of the marketplace keeps its skills in plugins/<name>/skills/.
const PLUGINS_DIR = path.join(ROOT, 'plugins');
const SKILLS_DIRS = (fs.existsSync(PLUGINS_DIR) ? fs.readdirSync(PLUGINS_DIR) : [])
  .map(name => path.join(PLUGINS_DIR, name, 'skills'))
  .filter(dir => fs.existsSync(dir));

// Tolerant of UTF-8 BOM and CRLF line endings.
function extractFrontmatter(content) {
  const match = content.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match ? match[1] : null;
}

/** Returns the list of frontmatter problems for one frontmatter block. */
function inspectFrontmatter(block) {
  let parsed;
  try {
    parsed = yaml.load(block);
  } catch (error) {
    return [`invalid YAML: ${error.reason || error.message}`];
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return ['must be a top-level YAML mapping'];
  }

  const problems = [];
  for (const key of ['name', 'description']) {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
      problems.push(`missing required field: ${key}`);
    } else if (typeof parsed[key] !== 'string') {
      problems.push(`${key}: value must be a string`);
    } else if (parsed[key].trim() === '') {
      problems.push(`'${key}' is empty`);
    }
  }

  // Block-scalar indicators accept chomp and indent modifiers, e.g. `|`, `|-`, `|2`, `|-2`.
  const literal = block.match(/^description:[ \t]*(\|(?:[+-]?\d+|\d+[+-]?|[+-])?)[ \t]*(?:#.*)?$/m);
  if (literal) {
    problems.push(
      `description uses literal block scalar '${literal[1]}' which preserves internal newlines; use an inline string or folded '>' scalar instead`
    );
  }
  return problems;
}

/** Returns the list of ERROR messages for one skill directory. */
function validateSkillDir(skillsDir, dir) {
  const label = `${path.relative(ROOT, skillsDir)}/${dir}/SKILL.md`;
  const skillMd = path.join(skillsDir, dir, 'SKILL.md');

  if (!fs.existsSync(skillMd)) return [`${label} - Missing SKILL.md`];

  let content;
  try {
    content = fs.readFileSync(skillMd, 'utf-8');
  } catch (err) {
    return [`${label} - ${err.message}`];
  }
  if (content.trim().length === 0) return [`${label} - Empty file`];

  const block = extractFrontmatter(content);
  if (block === null) return [];
  return inspectFrontmatter(block).map(p => `${label} - frontmatter ${p}`);
}

function validateSkills() {
  const dirs = SKILLS_DIRS.flatMap(skillsDir =>
    fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => [skillsDir, e.name]));

  let hasErrors = false;
  for (const [skillsDir, dir] of dirs) {
    for (const message of validateSkillDir(skillsDir, dir)) {
      console.error(`ERROR: ${message}`);
      hasErrors = true;
    }
  }

  if (hasErrors) process.exit(1);
  console.log(`Validated ${dirs.length} skill directories`);
}

validateSkills();
