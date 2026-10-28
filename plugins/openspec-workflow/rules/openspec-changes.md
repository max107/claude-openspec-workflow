---
title: Changes run through OpenSpec
---
A behaviour change in 2+ code files, or file edits handed to a worker, starts as an OpenSpec change (`openspec-workflow:openspec`) before the first edit, in every project. Not for: one-file fixes, renames, docs, config, rules, translations, debugging, review, exploration, or when the user says "без openspec". Unsure: ask in one line.

- The change holds a proposal, spec deltas with observable scenarios, and tasks naming their files and a proving command.
- A project without `openspec/` gets one.
- Before the first handoff the change passes `openspec validate --all --strict`.
- A skill, agent or command that describes a handoff points to `openspec-workflow:openspec` instead of its own brief or task format.
- The one exception is the own standards of the plugin repositories that carry these rules (claude-openspec, claude-workflow): their environment rules (`rules/`) and their authoring standard (`skill-authoring.md`) are plain text, changed by an ordinary commit after the user agrees. Code there, and every other project, follows the rule above.
