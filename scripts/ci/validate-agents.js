#!/usr/bin/env node
/**
 * Validate agent markdown files have required frontmatter
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Agents of every plugin of the marketplace: plugins/<name>/agents/.
const PLUGINS_DIR = path.join(__dirname, '../../plugins');
const AGENT_FILES = fs
  .readdirSync(PLUGINS_DIR)
  .map(name => path.join(PLUGINS_DIR, name, 'agents'))
  .filter(dir => fs.existsSync(dir))
  .flatMap(dir => fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => path.join(dir, f)));
const REQUIRED_FIELDS = ['model']; // tools is optional: without it an agent inherits every tool
const VALID_MODELS = ['haiku', 'sonnet', 'opus', 'fable', 'inherit'];

/**
 * Parse the frontmatter block as YAML. Returns null when there is no block;
 * throws on a YAML error (including duplicate keys, which js-yaml rejects).
 */
function extractFrontmatter(content) {
  const match = content.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const parsed = yaml.load(match[1]);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('frontmatter must be a YAML mapping');
  }
  return parsed;
}

function validateAgents() {
  if (AGENT_FILES.length === 0) {
    console.error(`ERROR: no agent files under ${PLUGINS_DIR}/*/agents`);
    process.exit(1);
  }

  const files = AGENT_FILES.map(filePath => path.relative(PLUGINS_DIR, filePath));
  let hasErrors = false;

  for (const file of files) {
    const filePath = path.join(PLUGINS_DIR, file);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.error(`ERROR: ${file} - ${err.message}`);
      hasErrors = true;
      continue;
    }
    let frontmatter;
    try {
      frontmatter = extractFrontmatter(content);
    } catch (err) {
      console.error(`ERROR: ${file} - invalid frontmatter YAML: ${err.reason || err.message}`);
      hasErrors = true;
      continue;
    }

    if (!frontmatter) {
      console.error(`ERROR: ${file} - Missing frontmatter`);
      hasErrors = true;
      continue;
    }

    for (const field of REQUIRED_FIELDS) {
      if (!frontmatter[field] || (typeof frontmatter[field] === 'string' && !frontmatter[field].trim())) {
        console.error(`ERROR: ${file} - Missing required field: ${field}`);
        hasErrors = true;
      }
    }

    if (Array.isArray(frontmatter.tools)) {
      console.error(`ERROR: ${file} - Agent tools must be a comma-separated scalar, not a YAML sequence`);
      hasErrors = true;
    }

    // Validate model is a known value
    if (frontmatter.model && !VALID_MODELS.includes(frontmatter.model)) {
      console.error(`ERROR: ${file} - Invalid model '${frontmatter.model}'. Must be one of: ${VALID_MODELS.join(', ')}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`Validated ${files.length} agent files`);
}

validateAgents();
