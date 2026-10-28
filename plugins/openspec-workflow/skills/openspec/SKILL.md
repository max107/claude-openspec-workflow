---
name: openspec
description: "Run a non-trivial change through OpenSpec: add openspec/ to a project, mine the baseline spec, write the change (proposal, deltas, tasks), hand tasks to workers, accept them against scenarios, archive. Use for a change across several files or a delegated task."
---

> **Precedence.** Project instructions (CLAUDE.md, AGENTS.md) and environment rules win: who may be spawned, which worker runs which task, how commits and change logs are written.

# OpenSpec

The change folder is the brief: an executor reads only it, the orchestrator accepts work only against its scenarios, and the
requirements stay in `openspec/specs/` after the change is archived. CLI: `DO_NOT_TRACK=1 <pkg-runner> @fission-ai/openspec@1.14.1`
(below: `openspec`).

## When

- **Yes:** a behaviour change touching several files; anything handed to a subagent or a worker; a change whose decisions
  must outlive the conversation.
- **No:** a one-line fix, debugging, review, an exploratory spike, a change the user wants done inline without ceremony.
  Acceptance criteria for those stay in the conversation.
- **First:** the problem, its evidence or the success metric is unclear: settle them with `/requirements`, which hands its answers to step 4.

## Process

1. **Set up, once per project** (no `openspec/` yet): `openspec init --tools none --language <language of the project's
   docs> .` creates only `openspec/` (`config.yaml`, `specs/`, `changes/archive/`); `--tools` other than `none` writes agent
   files into the project. In `config.yaml` add `context` (what the project is, where its process rules and change log
   live) and `rules` per artifact — quote every rule string: an unquoted `: ` makes YAML read it as a mapping and the CLI
   drops the artifact's rules. Add `/openspec/` to the project's `.gitignore` and commit only that line; add one row
   about `openspec/` (local, not in git) to the project's AGENTS.md or CLAUDE.md.
2. **Baseline of the area only.** Before the first change in an area with no spec, the `spec-miner` agent writes
   `openspec/specs/<capability>/spec.md` for that one capability (name the files in and out of scope); spot-check its
   `file:line` anchors and read its "unverified" list. Never back-fill the whole system.
3. **Questions before the plan.** Before writing the artifacts, list every open question: unclear requirements, scope
   and what is out of it, edge cases and error behaviour, choices between alternatives, data and compatibility, what users
   see, anything irreversible. Drop the ones the code, docs or baseline spec answer, then ask the user the rest, one
   question at a time; with each, give the options, what each changes and your recommended answer. Questions that depend
   on an earlier answer wait for it; an answer that opens new questions adds them to the list. Ask until none is left;
   "decide yourself" settles a question with your recommendation, recorded as yours. No artifact is written while a
   question is open, and none of them carries an assumption the user did not confirm.
4. **The change.** `openspec new change <id>`, then `openspec instructions <proposal|design|specs|tasks> --change <id>`
   for each artifact's format.
   - `proposal.md`: Why; What Changes, with what is out of scope and the decisions from step 3 with who took each;
     Capabilities; Impact from real call sites, the rest marked `unverified`: each affected item points to a reference
     (file and symbol, contract path, schema), nothing is guessed from directory names.
   - `design.md` only when there are decisions with alternatives.
   - Spec deltas (`## ADDED|MODIFIED Requirements`): every requirement observable — a state, one trigger, a result an
     outsider can check — with numbers and how they were measured.
   - `tasks.md`: one task = one executor; it names the files it may touch and the command that proves it; order by
     dependency; tasks on disjoint files may run in parallel; a task that changes what users see, data or anything
     irreversible waits for the user's approval.
   - `openspec validate --all --strict` must pass before anyone starts.
5. **Hand off a task.** The brief is short because the folder carries the rest: the repository path; "read proposal,
   design, spec deltas and tasks of change `<id>`; do task N.M and nothing else"; touch only the named files; no commits,
   no git commands that change anything, no installs; run the task's command; report the diff, the commands with their
   output and exit codes, and every decision taken alone. Mention files a parallel executor is editing.
6. **Accept.** Read the diff, rerun the task's command and the scenarios it covers, check nothing outside its files
   changed. Only the orchestrator ticks `- [x]` in `tasks.md`. A gap the executor found in the task is fixed in the
   artifacts, not just in the code. Count returns per task: they measure the brief.
7. **Archive and commit.** When every task is accepted, compare the whole diff with the proposal and tasks and show the
   user what went beyond the declared scope and which criteria no check covers; archive after the user accepts.
   `openspec archive <id> --yes` moves the change to `changes/archive/<date>-<id>/` and merges its deltas into `specs/`. A new capability gets a placeholder Purpose that
   `validate --strict` flags: replace it in the main spec. Validate again, then commit the code with the project's own
   rules (change log, message style); the archive itself makes no commit.

## Outside git

`openspec/` lives only on disk: it is in `.gitignore`, so its edits never add commits to the project.

- Never stage or commit a file under `openspec/`; never `git add -f` it.
- Still tracked (`git ls-files openspec` prints files): `git rm -r -q --cached openspec`, add `/openspec/` to
  `.gitignore`, and commit only those two with the project's message style. A `.gitignore` line alone does not untrack
  files already in the index. The leading `/` matters: an unanchored `openspec/` also ignores every nested directory
  of that name.
- Git treats ignored files as expendable: a checkout, bisect or rebase onto a commit from before `openspec/` left the
  index silently replaces the local files with that commit's copies, and coming back deletes them. Copy `openspec/`
  outside the repository first and restore it afterwards.
- A git worktree has its own `openspec/`. Write and run the change there, but do not archive in the worktree: after its
  branch merges, copy `openspec/changes/<id>/` into the main checkout and archive there, so the deltas reach the main
  specs. Remove the worktree only after that copy.

## Rules

- The orchestrator owns `tasks.md`, the commit and the archive; executors never edit the change folder.
- An executor's report is evidence to check, never acceptance.
- In zsh a command kept in one variable is passed as one argument (`$cmd` is not split): when rerunning commands, write
  them out or use arrays.
- Follow the project's language for artifacts; keep OpenSpec headings and SHALL/MUST in English.

## Output

- The questions asked and the user's answers, the change id and path, `validate --strict` result, the task list with
  who did each.
- Per task: accepted or returned (and why), the commands rerun with their results.
- After archive: the specs that changed and the commit.

## Anti-patterns

- Specs for the whole system before the first change.
- Writing the plan with a question still open, or filling a gap with a guess instead of asking.
- Asking the user what the code or docs already answer, or a batch of questions where one answer changes the next.
- A task that says "improve X" with no files and no proving command.
- Ticking a task from the executor's report.
- Two executors editing one file in parallel.
- A commit that holds `openspec/` files, or a commit whose only content is spec or task edits.
- A visual, data or irreversible change done without the user's approval because it was in `tasks.md`.
