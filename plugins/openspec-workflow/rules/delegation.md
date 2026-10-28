---
title: Delegation to cheaper workers
refines: [openspec-workflow:openspec]
---
OpenSpec tasks go to subagents unasked (`sonnet` for judgement, `haiku` for mechanical work); the main model writes the change, briefs, verifies, integrates and commits, and does a task only for shared files or one smaller than its brief. Every `Agent`/`agent()` call names `model`; `opus` only for independent review, design decisions or on request. Other work may be delegated on the main model's own judgement. Verify every result.

- An OpenSpec task is one whose files and proving command are named; it goes to a Claude subagent.
- An `Agent` call or `agent()` without `model` inherits the main model.
- Delegating other work needs no request from the user in each task.
- A delegated task is ticked only after the diff is read and its proving command rerun.
- This rule picks the worker even where another plugin's skill or agent offers its own delegation.
- Agents of other plugins are Claude workers like any other: used only where this rule would pick a Claude subagent, with `model` named in the call (one that sets none inherits the main model), never instead of the worker this rule picks.

- openspec-workflow:openspec: a task of an OpenSpec change counts as pre-authorized: hand it off without offering first. Pick the worker per task: `sonnet` for a task that needs judgement or is too large to brief as one task; `haiku` for mechanical edits, reading and inventories; `opus` for the independent verification of a change, not for implementation.
