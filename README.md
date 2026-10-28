# claude-openspec

[Русский](README.ru.md) | English

The `claude-openspec` marketplace with the `openspec-workflow` plugin: Claude Code reserves names with the `claude-` prefix for Anthropic.

A Claude Code plugin for working through [OpenSpec](https://github.com/Fission-AI/OpenSpec). A large change goes as an OpenSpec change: a proposal, spec deltas, and tasks that name their files and a proving command. Tasks are handed to subagents, work is accepted against the scenarios, and the change is archived after acceptance.

The components were copied from the `my-workflow` plugin (the `claude-workflow` repository) so that OpenSpec can be installed on its own.

## Contents

| Component | Path | What it does |
| --- | --- | --- |
| Skill `openspec` | `plugins/openspec-workflow/skills/openspec/SKILL.md` | The process: `openspec/` in the project, a baseline spec of the area, questions, the change, task handoff, acceptance, archive |
| Agent `spec-miner` | `plugins/openspec-workflow/agents/spec-miner.md` | Extracts the current behaviour of the code into `openspec/specs/<capability>/spec.md` or into a change delta |
| Command `/requirements` | `plugins/openspec-workflow/commands/requirements.md` | The problem, evidence, hypothesis, metric and scope of a feature before its change |
| Rule `openspec-changes` | `plugins/openspec-workflow/rules/openspec-changes.md` | The gate: when a change starts as an OpenSpec change |
| Rule `delegation` | `plugins/openspec-workflow/rules/delegation.md` | Change tasks go to subagents (`sonnet`, `haiku`); the main model writes the change and accepts the work |
| Rule `code-discovery` | `plugins/openspec-workflow/rules/code-discovery.md` | How to find code while writing a change |
| Hooks | `plugins/openspec-workflow/hooks/` | Deliver the rules and a reminder of the gate on every message, see `hooks/README.md` |

## Installation

From GitHub:

```bash
claude plugin marketplace add max107/claude-openspec-workflow
claude plugin install openspec-workflow@claude-openspec
```

From a local clone:

```bash
claude plugin marketplace add ~/projects/falaleev/claude-openspec
claude plugin install openspec-workflow@claude-openspec
```

With `my-workflow` enabled, the same skill, agent, command and rules arrive twice: `my-workflow:openspec` and `openspec-workflow:openspec`.

## Checks

```bash
bun install
bun run check </dev/null   # validators, openspec validate --strict (when openspec/ exists), tests
claude plugin validate .
claude plugin validate plugins/openspec-workflow
```

## Releasing changes

1. Make the change and run the checks from "Checks".
2. Bump the plugin's patch version in `plugins/openspec-workflow/.claude-plugin/plugin.json`; `.claude-plugin/marketplace.json` holds no versions.
3. `git push origin main`.

GitHub Actions (`.github/workflows/ci.yml`) runs the `check` job on every push and pull request: `bun run check` (validators, tests; `openspec validate --strict` only locally, where `openspec/` exists) and `claude plugin validate` of the marketplace and of each plugin with a pinned CLI version.

After a green `check` on `main`, the `release` job tags the commit with the next `0.0.N` and creates a GitHub Release with the commits since the previous tag. Then the `package` job publishes `@max107/openspec-workflow` at the tag's version to GitHub Packages (`https://npm.pkg.github.com/`), authenticating with `GITHUB_TOKEN`. Both jobs are part of the same workflow: a tag pushed with `GITHUB_TOKEN` starts no new workflow. The package holds `.claude-plugin/`, `plugins/`, `README.md`, `README.ru.md` and `THIRD_PARTY_LICENSES.md` (`files` in `package.json`; contents: `bun pm pack --dry-run`). The release tag is the repository's version; the plugin's version is still set by its `plugin.json`.

Installing the package:

```bash
printf '@max107:registry=https://npm.pkg.github.com/\n//npm.pkg.github.com/:_authToken=<GitHub token with read:packages>\n' >> ~/.npmrc
bun add @max107/openspec-workflow
```
