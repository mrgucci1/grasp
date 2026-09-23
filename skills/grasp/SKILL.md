---
name: grasp
description: Learn-while-you-build loop for a coding task. Grills the user on the design (options, trade-offs, their call), has them write the key parts with guidance, shows the change as a visual HTML explainer, then quizzes them before merge. Auto mode, for when time is short, asks all the design questions up front, then writes the code, the explainer and the journal without stopping, and skips the quiz. Keeps a private decision journal outside the repo and never touches commit messages. Use when the user says "grasp", "/grasp", "grasp auto", "grasp this task", "grill me then guide me", "teach me while we build this", or wants to understand a change deeply while making it. Not for quick fixes where the user only wants code.
argument-hint: "[task] [fast|auto]"
license: MIT
compatibility: Any agent with Agent Skills support (Claude Code, OpenCode, Codex). Needs git and a shell.
metadata:
  suite: grasp
  version: "0.1.0"
---

# grasp

Run one task through four steps, so the user ends up owning the change instead of just shipping it:

**grill → build → explain → quiz**. `grasp-teach` fills any gaps, and the journal remembers the why.

## Start

1. **Task.** The task is: `$ARGUMENTS`, minus a trailing mode word (`fast` or `auto`). If that's empty or shows a literal placeholder, use the user's request. If there's still nothing, ask: "What are we building?"
2. **Journal.** Find or create the private journal (see *Storage*). If one already exists for this branch with unfinished steps, show its *Status* and offer to resume at the first unfinished step.
3. **Branch.** The journal is keyed by branch. If the user is on the default branch (main, master or develop), suggest creating a feature branch first. Don't create it without asking.
4. **Mode.** If the arguments end with `fast` or `auto`, use that mode. Otherwise ask once, with the time cost:
   - **Full** (≈45–90 min): you write the key parts yourself, with a guide.
   - **Fast** (≈15–20 min): I write the code; you still get grilled, the explainer and the quiz.
   - **Auto** (≈10–20 min, all at the start): you answer every design question now, then I write the code, the explainer and the journal without stopping again. No quiz.

## Steps

Start every message with a progress line, e.g. `grasp · 2/4 build · part 1 of 3`. Work one step at a time and don't pre-announce later steps.

| # | Step | Skill to load | Done when |
|---|------|---------------|-----------|
| 1 | grill | `grasp-grill` | The user confirms the plan summary. In Fast mode, ask only about decisions that are hard to reverse, in at most 2 rounds. In Auto mode, ask every question, as in Full mode, and follow grasp-grill's *Auto mode* section. |
| 2 | build | Full: `grasp-guide`. Fast and Auto: none, you build it | **Full:** the user has written every "your part", no `TODO(human)` markers are left, and the checks pass. **Fast and Auto:** you've implemented the plan, the checks pass, and any decision that wasn't in the plan got one line in chat and a *Build log* entry: `deviation: … because …`. |
| 3 | explain | `grasp-explain` | The HTML explainer is open and the user says they've skimmed it (≈5 min). In Auto mode, it's done once the page is written and opened; don't wait for the user. |
| 4 | quiz | `grasp-quiz` | The score is ≥ 80%. If not, load `grasp-teach` for each missed concept, then re-quiz only the missed areas with new questions. Auto mode skips this step. |

**To load a step's skill,** use your skill tool: the Skill tool in Claude Code, `skill` in OpenCode, `$grasp-grill` and so on in Codex. If your agent has no skill tool, read the step's `SKILL.md` from the sibling folder, e.g. `../grasp-grill/SKILL.md` relative to this file, and follow it.

In Auto mode, every question comes first: the ones in *Start*, then the whole grill. Once the user confirms the plan, don't stop again until the wrap-up.

The user can say `skip` at any step. Log the step as skipped in the journal and move on without arguing.

## Wrap-up

In Full and Fast mode, wrap up when the quiz passes:

1. Tick every step in the journal's *Status* and add `done @ <short HEAD sha>`.
2. Tell the user, in 6 lines or fewer:
   - what they built
   - which parts they wrote themselves
   - their quiz score
   - the cards added to their review deck
   - the journal path
3. End with: "Ready to merge. Commit however your team formats commits; grasp never writes to them."

In Auto mode, wrap up once the explainer is written:

1. Tick every step in the journal's *Status*, mark the quiz `skipped (auto)`, and add `done @ <short HEAD sha>`.
2. Tell the user, in 15 lines or fewer:
   - what you built, and which checks passed
   - one line per decision: `D1 · <choice> · <why, in 8 words or fewer>`
   - every `deviation` from the plan and every decision marked `unconfirmed`, since the user hasn't reviewed them
   - the explainer and journal paths
   - that `grasp-quiz` works on this branch whenever they have 5 minutes, and `grasp-why <file:line>` answers questions later
3. End with: "Before you merge, skim the explainer (≈5 min). Commit however your team formats commits; grasp never writes to them."

## Rules

- **Private by design.** The journal, the explainer and the deck live under the grasp home. They never go in the repo, commit messages, PR text or code comments. `TODO(human)` markers are temporary and must be gone before step 3.
- **Don't commit or push** unless the user asks. Their commit format is theirs.
- **Facts are your job; decisions are the user's.** Look things up in the codebase rather than asking.
- **Short messages.** Put the progress line first, stay under ~25 lines, and end with exactly one thing for the user to do.

## Storage

- **Home:** `$GRASP_HOME` if set, otherwise `~/.grasp` (on Windows, `%USERPROFILE%\.grasp`).
- **Journal:** `<home>/<repo>/<branch>/journal.md`.
  - `<repo>` is the folder name of `git rev-parse --show-toplevel`.
  - `<branch>` is `git branch --show-current`, with `/` replaced by `-`.
  - Outside git, use `<home>/_scratch/<yyyy-mm-dd>-<task-slug>/` instead.
- **Review deck:** `<home>/deck.md`, shared by all repos (see `grasp-teach`).

Create a new journal from this skeleton. Drop the `session:` line if it shows a literal placeholder instead of an ID.

```markdown
# <task title>
repo: <repo> · branch: <branch> · started: <yyyy-mm-dd> · mode: full|fast|auto
session: ${CLAUDE_SESSION_ID}

## Status
- [ ] grill
- [ ] build
- [ ] explain
- [ ] quiz

## Task
## Decisions
## Plan
## Build log
## Files
## Explain
## Quiz
## Learnings
```

Each step's skill says which sections it writes.
