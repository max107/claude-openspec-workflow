---
description: "Settle the problem, evidence, hypothesis, success metric and scope of a feature before its OpenSpec change (what and why, no how). Use when a feature's problem or success measure is unclear (\"сформулируй требования\", \"зачем нам это\")."
argument-hint: "[product/feature idea] (blank = start with questions)"
---

# Problem-first requirements

The requirements stage in front of the `openspec` skill: it answers *what* must be true and *why*, and stops before *how*. Its answers become the change's `proposal.md` and spec deltas; it writes no file of its own.

**Input**: `$ARGUMENTS`. If it is blank, ask for the idea in one or two sentences and stop.

## Questions

Ask them the way `openspec` step 3 does: drop what the code, docs or a baseline spec already answer; ask the rest one at a time, each with the options, what each changes and your recommended answer; a question that depends on an earlier answer waits for it. "Skip" or "decide yourself" settles a question with your recommendation, recorded as yours.

1. **Frame.** Restate the idea in one sentence and confirm it. Then: who has the problem (a role or segment), the observable pain (behaviour, not assumed needs), why what exists today does not solve it, why now.
2. **Evidence.** User quotes, tickets, metrics, observed behaviour, failed workarounds. Without any, the record is `Assumption — needs validation via {user research | analytics | prototype}`.
3. **Hypothesis and metric.** *We believe {capability} will {solve problem} for {users}; we'll know when {measurable outcome}* — a number and how it is measured, or `TBD — needs validation via {method}`.
4. **Scope.** The MVP that tests the hypothesis; what is explicitly not built; milestones, each a user-visible outcome that can ship on its own.

Never invent a requirement, a user or a number to fill a gap.

## Hand-off

A milestone that meets the OpenSpec gate becomes one change; start with the first, list the rest in its out-of-scope with their future ids. Hand it to the `openspec` skill at step 4, with the answers placed as:

| Answer | Goes to |
| --- | --- |
| Problem, evidence, hypothesis | `proposal.md` → Why |
| MVP, out of scope, other milestones, who decided what | `proposal.md` → What Changes |
| Success metric, user-visible behaviour | spec deltas: observable requirements with the number and how it is measured |
| Assumptions and `TBD` items | `proposal.md`, marked `unverified`, and the questions still open |

A milestone below the gate (one file, no worker) keeps the answers as acceptance criteria in the conversation and goes straight to implementation, tests first.

## Output

The answers, each marked as the user's or yours, the milestones with the change id planned for each, and the next step: the `openspec` change for the first milestone, or the acceptance criteria when it is below the gate.

## Anti-patterns

- Files, libraries, tasks or architecture in the requirements: they belong to the change's design and tasks.
- A metric without a number or a way to measure it, written as settled.
- One change for all milestones.
- A requirements file outside `openspec/`, or a plan written before the questions are settled.
