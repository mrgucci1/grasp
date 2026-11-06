---
name: grasp
description: Learn while you build · grill, build, explain, quiz on one task. Usage is /grasp TASK [full|fast|auto|pm], or /grasp alone for the menu. Full has the user write the key parts with a guide. Fast has the agent write the code while the user still decides, reads the walkthrough and takes the quiz. Auto asks every design question up front, then the agent finishes alone with no quiz. PM is for big tasks: sub-agents build the parts in parallel, and the user reviews every choice they made. Questions arrive as dialogs with the recommended option first. Keeps a private decision journal outside the repo and never touches commit messages. Use when the user says "grasp", "/grasp", "grasp auto", "grasp pm", "grasp this task", "grill me then guide me", "teach me while we build this", or wants to understand a change deeply while making it. Not for quick fixes where the user only wants code.
argument-hint: "<task> [full|fast|auto|pm]"
license: MIT
compatibility: Any agent with Agent Skills support (Claude Code, OpenCode, Codex). Needs git and a shell, and Node 18+ for the walkthrough and the quiz page.
metadata:
  suite: grasp
  version: "0.3.0"
---

# grasp

Run one task through four steps, so the user ends up owning the change instead of just shipping it:

**grill → build → explain → quiz**. `grasp-teach` fills any gaps, and the journal remembers the why.

**Ask with the question tool.** Every question to the user goes through your harness's question tool (`AskUserQuestion` in Claude Code, `question` in OpenCode, `request_user_input` in Codex, `ask` in omp), so they pick with the arrow keys and Enter, or choose Other to type. Ask from the main conversation, never from a sub-agent. Each question must make sense without the chat above it. Put your pick first, labelled "(Recommended)". Stay inside the tool's limits; if it takes fewer options than a step lists, keep the first ones. Only when the tool is missing or refuses, post a numbered list in chat and take a number as the reply.

## Start

1. **Menu.** If `$ARGUMENTS` is empty, a literal placeholder, or `help`, and the user's request names no task: print the usage card below as a code block, with your harness's prefix (`$` instead of `/` in Codex), then ask "What do you want to do? Or choose Other and type the task to build." with the options that apply, at most 4. If fewer than 2 apply, skip the dialog and ask "What are we building?" after the card.
   - `Resume "<task>"`: this branch has a journal with unfinished steps. Recommended when present.
   - `Walk through this change`: the branch has a diff. Load `grasp-explain`.
   - `Quiz me on this change`: the branch has a diff. Load `grasp-quiz`.
   - `Review <n> due cards`: the deck has cards due. Load `grasp-teach` with `review`.
2. **Task.** Otherwise the task is `$ARGUMENTS` (or what the user typed), minus a trailing mode word (`full`, `fast`, `auto` or `pm`). A word that belongs to the task's own sentence, as in "run it at 5 pm", is not a mode word.
3. **Journal.** Find or create the private journal (see *Storage*). If one exists for this branch with unfinished steps and the user did not just pick Resume, ask: `Resume at <step> (Recommended)` or `Start over`. To resume, keep the journal's mode and go to its first unfinished step.
4. **Mode and branch.** One dialog holding only the questions still open. **Branch**, only on the default branch (main, master or develop): `Create <slug> (Recommended)` or `Stay on <branch>`. Never create a branch unasked. **Mode**, unless the arguments named one, with no option recommended:
   - `Full`: "You write the key parts, with a guide. 45–90 min."
   - `Fast`: "I write the code. You still decide, read the walkthrough and take the quiz. 15–20 min."
   - `Auto`: "You answer every design question now, then I finish alone. No quiz. 10–20 min, all up front."
   - `PM`: "A big task. Sub-agents build it in parallel and I manage them. You decide, then review every choice they made. 25–40 min, plus the build."

Usage card:
```
grasp · learn while you build
/grasp <task> [full|fast|auto|pm]   grill → build → explain → quiz
    full   you write the key parts               45–90 min
    fast   I write the code, you decide          15–20 min
    auto   answer everything up front, no quiz   10–20 min
    pm     big task, built by sub-agents         25–40 min
/grasp-grill [task]                 design questions only
/grasp-guide                        write the key parts of an agreed plan
/grasp-pm [task | review]           build with sub-agents · review their choices
/grasp-explain [base]               step through the current change
/grasp-quiz [page] [last commit | <sha> | plan]   check yourself, 80% passes
/grasp-teach <concept> | review     learn a concept · review due cards
/grasp-why <file:line | question>   why is this code like this?
```

## Steps

Start every message with a progress line, e.g. `grasp · 2/4 build · part 1 of 3`. Work one step at a time and don't pre-announce later steps.

| # | Step | Skill to load | Done when |
|---|------|---------------|-----------|
| 1 | grill | `grasp-grill` | The user confirms the plan summary. In Fast and PM mode, ask only about decisions that are hard to reverse, in at most 2 rounds (3 in PM mode). In Auto mode, ask every question, as in Full mode, and follow grasp-grill's *Auto mode* section. |
| 2 | build | Full: `grasp-guide`. PM: `grasp-pm`. Fast and Auto: none, you build it | **Full:** the user has written every "your part", no `TODO(human)` markers are left, and the checks pass. **PM:** every part has landed, the checks pass, and the user has reviewed the sub-agents' choices or chose hands-off. **Fast and Auto:** you've implemented the plan, the checks pass, and any decision that wasn't in the plan got one line in chat and a *Build log* entry: `deviation: … because …`. |
| 3 | explain | `grasp-explain` | The walkthrough is open and the user picks `Quiz me` or `Done for now` in grasp-explain's closing question. `Done for now` pauses the loop; the quiz waits for Resume. In Auto mode and a hands-off PM build, it's done once the page is written and opened; don't wait for the user. |
| 4 | quiz | `grasp-quiz` | The score on the multiple-choice quiz is ≥ 80%. If not, load `grasp-teach` for each missed concept the user picks, then re-quiz only the missed areas with new questions. Auto mode and a hands-off PM build skip this step. |

**To load a step's skill,** use your skill tool: the Skill tool in Claude Code, `skill` in OpenCode, `$grasp-grill` and so on in Codex. If your agent has no skill tool, read the step's `SKILL.md` from the sibling folder, e.g. `../grasp-grill/SKILL.md` relative to this file, and follow it.

In Auto mode, every question comes first: the ones in *Start*, then the whole grill. Once the user confirms the plan, don't stop again until the wrap-up.

The user can pick Other and type `skip` at any step. Log the step as skipped in the journal and move on without arguing.

## Wrap-up

In Full, Fast and PM mode, wrap up when the quiz passes:

1. Tick every step in the journal's *Status* and add `done @ <short HEAD sha>`.
2. Tell the user, in 6 lines or fewer:
   - what they built
   - which parts they wrote themselves, or in PM mode which of the sub-agents' choices they kept and changed
   - their quiz score
   - the cards added to their review deck
   - the journal path
3. End with: "Ready to merge. Commit however your team formats commits; grasp never writes to them."

In Auto mode and a hands-off PM build, wrap up once the walkthrough is written:

1. Tick every step in the journal's *Status*, mark the quiz `skipped (auto)`, and add `done @ <short HEAD sha>`.
2. Tell the user, in 15 lines or fewer:
   - what you built, and which checks passed
   - one line per 🔒 decision (`D1 · <choice> · <why, in 8 words or fewer>`), then the count of the rest
   - every `deviation` from the plan and every decision marked `unconfirmed`, since the user hasn't reviewed them. Past 5, give the 5 that matter most and the count. After a PM build, add that `/grasp-pm review` goes through them as dialogs.
   - the walkthrough and journal paths
   - that `grasp-quiz` works on this branch whenever they have 5 minutes, and `grasp-why <file:line>` answers questions later
3. End with: "Before you merge, skim the walkthrough (≈5 min). Commit however your team formats commits; grasp never writes to them."

## Rules

- **Private by design.** The journal, the walkthrough (`tour.json`, `explain.html`), the quiz files and the deck live under the grasp home. They never go in the repo, commit messages, PR text or code comments. `TODO(human)` markers are temporary and must be gone before step 3.
- **Don't commit or push** unless the user asks. Their commit format is theirs.
- **Facts are your job; decisions are the user's.** Look things up in the codebase rather than asking.
- **Few words.** Put the progress line first, then 12 lines or fewer. Never repeat in chat what a dialog is about to ask. End with one thing for the user to do, or with a dialog.
- **Unanswered.** If a question comes back unanswered, don't guess: say in one line what you're waiting for, and wait.

## Storage

- **Home:** `$GRASP_HOME` if set, otherwise `~/.grasp` (on Windows, `%USERPROFILE%\.grasp`).
- **Journal:** `<home>/<repo>/<branch>/journal.md`.
  - `<repo>` is the folder name of `git rev-parse --show-toplevel`.
  - `<branch>` is `git branch --show-current`, with `/` replaced by `-`.
  - Outside git, use `<home>/_scratch/<yyyy-mm-dd>-<task-slug>/` instead.
- **Walkthrough and quiz page:** `tour.json` and `explain.html` (see `grasp-explain`), `quiz.json`, `quiz.html` and `quiz-result.json` (see `grasp-quiz`), in the journal's folder.
- **Review deck:** `<home>/deck.md`, shared by all repos (see `grasp-teach`).
- **Settings:** `<home>/settings.json`, for example `{"editor": "vscode"}` (see `grasp-guide`).

Create a new journal from this skeleton. Drop the `session:` line if it shows a literal placeholder instead of an ID.

```markdown
# <task title>
repo: <repo> · branch: <branch> · started: <yyyy-mm-dd> · mode: full|fast|auto|pm
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
