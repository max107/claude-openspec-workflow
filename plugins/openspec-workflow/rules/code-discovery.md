---
title: Code discovery for OpenSpec changes
refines: [openspec-workflow:openspec]
---
With `context-explorer` installed, a session writing an OpenSpec change finds unknown code through it; a subagent searches itself (Grep/Glob/Read, then `mcp__jbcontext__code_search`).

- Where `context-explorer` is not installed, the rule is silent: the session neither plans nor offers it and searches with Grep, Glob, Read or `mcp__jbcontext__code_search` itself.
- Known names, "who calls X" and "what breaks if X changes" go to Grep in any session; `context-explorer` is for code whose place is unknown.
- A subagent cannot start another subagent, so its task names its files; when they are not enough, it narrows `mcp__jbcontext__code_search` with `pathFilter` and reads the hits.
- Why (benchmark 2026-10-20, 8 real multi-file changes of `mmgate`, opus writing the change plan): `context-explorer` first cost 10% less than the session without jbcontext, named fewer wrong files and found the same share of the right ones; for single lookups under sonnet the haiku subagent did not pay off (direct `code_search` $0.123 and 18 s, `context-explorer` $0.145 and 39 s).

- openspec-workflow:openspec: locate the impact and each task's files through `context-explorer` before writing them, so every brief names the files its worker reads and the worker needs no discovery of its own.
