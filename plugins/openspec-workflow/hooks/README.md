# Hooks

`hooks/hooks.json` registers two scripts. `scripts/hooks/workflow-context.js` delivers the environment rules on four events:

| Event | What it injects |
| --- | --- |
| SessionStart (startup, resume, clear, compact, fork) | The digest of the rules in `rules/` (one line per rule) as `additionalContext` |
| SubagentStart | The digest, then the rules whose `refines` names the starting agent (`agent_type`, e.g. `openspec-workflow:spec-miner`) |
| PostToolUse, matcher `Skill` | The rules whose `refines` names the skill the `Skill` tool just loaded (`tool_input.skill`); nothing when none does |
| UserPromptExpansion | The rules whose `refines` names the slash command being expanded (`command_name`); nothing for other expansions or when none does |

The script is the same file as `plugins/my-workflow/scripts/hooks/workflow-context.js` of the claude-workflow repository:
it takes the plugin name from `.claude-plugin/plugin.json`. Change both copies together.

`scripts/hooks/openspec-gate.js` runs on UserPromptSubmit: a one-line reminder `OpenSpec gate: <first paragraph of
rules/openspec-changes.md>` on every user message, so the gate does not fade behind other plugins' instructions.

Each environment rule is one plain file `rules/<name>.md`:

```markdown
---
title: <the rule's title>
refines: [openspec-workflow:openspec, openspec-workflow:spec-miner]
---
The rule in one paragraph: this paragraph is the rule's line in the digest.

- Cases the paragraph alone does not make obvious (general: every listed component gets them).

- openspec-workflow:openspec: how it applies in that skill.
- openspec-workflow:spec-miner: how it applies in that agent.
```

The digest is built at run time: a header saying how a rule may be lifted (the project's CLAUDE.md or AGENTS.md, or the
user's explicit exception for a named rule; a task request is not one) and naming `<running plugin>/rules/<name>.md`, then
``- **name**: first paragraph`` per file. `refines` is optional; keep the frontmatter to these two keys with an inline list:
the hook parses it without a YAML library. A body line led by `- plugin:name[, plugin:name]: ` reaches only the components
it names; every other line is general and reaches all of them. An indented line belongs to the bullet above it, even across
a blank line. A component gets its rules headed `### Title (`name`)` without the first paragraph, which the digest already
carries; if a subagent's digest plus rules would pass 10000 characters, it gets the digest alone. Both scripts print nothing
when there is nothing to inject or the text is longer than 10000 characters. Claude Code rejects unknown keys in
`hooks.json`, so descriptions live here. Slash commands the user types are refined on `UserPromptExpansion`
(`command_name`, e.g. `openspec-workflow:requirements`); a command the model runs through the `Skill` tool is refined on
`PostToolUse`.
