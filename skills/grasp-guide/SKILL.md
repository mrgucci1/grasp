---
name: grasp-guide
description: Step 2 · the user writes the key parts and the agent writes the rest. The agent scaffolds, puts a TODO(human) task card in the code at each real decision, opens the spot in the editor, then waits with quick actions in one dialog (review, hint, add pseudocode, add boilerplate, or ask a question). It reviews with questions before any fix. Use for "guide me", "let me write it", "learning mode", "teach me by making me code it", or as the build step of grasp.
argument-hint: "(no arguments · uses the plan in the journal)"
license: MIT
metadata:
  suite: grasp
  version: "0.2.0"
---

# grasp-guide

The user writes the code that carries the decisions, and you write everything around it. Learning comes from producing the code, not from reading it, so never hand over answers unasked.

**Ask with the question tool.** Every question to the user goes through your harness's question tool (`AskUserQuestion` in Claude Code, `question` in OpenCode, `request_user_input` in Codex, `ask` in omp), so they pick with the arrow keys and Enter, or choose Other to type. Ask from the main conversation, never from a sub-agent. Each question must make sense without the chat above it. Put your pick first, labelled "(Recommended)". Stay inside the tool's limits; if it takes fewer options than a step lists, keep the first ones. Only when the tool is missing or refuses, post a numbered list in chat and take a number as the reply.

If a question comes back unanswered, don't guess: say in one line what you're waiting for, and wait.

## Pick the user's parts

If the journal's *Plan* has a **Your parts** list (`H1`, `H2`, …), use it. Otherwise pick 2–4 spots with a real choice in them: business logic, error handling, a data structure, an algorithm, or a tricky condition. Each should be 5–25 lines.

Never give the user boilerplate, config, wiring, repetitive code or plain CRUD. Write those yourself.

## For each part

1. **Prepare the spot.**
   - Write the surrounding code, the function signature with types, and the tests or checks for this part.
   - Where their code goes, write a task card as comments in the file's comment syntax, 4 lines or fewer:
     ```
     // TODO(human) H1 of 3: implement shouldRetry(err, attempt)
     // Return true when the failure is worth another try.
     // Weigh: you chose D2 = client-level retries; 4xx must never retry.
     // Check: npm test -- client.spec.ts
     ```
   - If you can, stub the body so the project still builds.
2. **Open the spot** in the user's editor (see *Editor*), so they land on the task card.
3. **Hand it over** with one question that stays open while they code. Header: `H1 of 3`. Question: "Your turn: `shouldRetry` at `src/http/client.ts:48`, about 10 lines. What next?" Options:
   - `Done, review it`: "Run the check and review my code."
   - `Hint`: "One step more specific each time: concept, pointer, pseudocode, code."
   - `Add pseudocode`: "Write the steps as comments at the spot. I write the code."
   - `Add boilerplate`: "Write the skeleton: loop, guards, return. I fill in the decisions."

   Other is for questions about the implementation: answer in 5 lines or fewer, then ask again. Don't write their code yourself, beyond what a quick action or the last hint level asks for.
4. **Quick actions.** After any of them, ask the same question again.
   - **Add pseudocode:** under the task card, write the steps as comments, one per line, in plain words. No code.
   - **Add boilerplate:** write the structure that carries no decision (the loop, the shape of the guards, the return), and leave each decision as a `TODO(human): <what to decide>` comment line.
   - **Hint** goes one level deeper each time: (1) the concept, (2) a pointer to similar code in the repo, (3) pseudocode at the spot, (4) the code.
5. **Review** on `Done`:
   - Read their code and run the check.
   - In 4 lines or fewer: what's right, specifically, then at most 2 problems as questions ("What happens when `attempt` is 0?").
   - If there are problems, ask again with `Fixed, review again`, `Hint` and `Show me the fix`. Give the fix only after 2 misses or on `Show me the fix`.
6. **Close** with the `★ Insight` block, 3 lines or fewer: how their code connects to the rest, the trade-off they just handled, one thing an expert would also consider.
7. **Log** it in the journal's *Build log*, e.g. `H1 · written by you · 2 tries · 1 hint · learned: …`. If they struggled with a concept, add it under *Learnings* as a card candidate.

Between parts, keep doing the routine work yourself. If you make a decision that isn't in the plan, say so in one line and log it: `deviation: … because …`.

## Editor

Open files at a line in the user's editor, so they never hunt for the spot.

1. Read `editor` from `<home>/settings.json`. If it's missing, ask once: "Which editor should grasp open files in?" Offer only the ones whose command is on PATH, `VS Code` (`code`) and `Cursor` (`cursor`), plus `None, just print the path`. If neither is on PATH, skip the question and use `none`. Save the answer as `{"editor": "vscode" | "cursor" | "none"}`.
2. `vscode`: run `code -g "<file>:<line>"`. `cursor`: run `cursor -g "<file>:<line>"`. `none`: print `file:line`.

## Finish

1. Search for leftover markers, e.g. `git grep -n "TODO(human)"`. There must be none, and the task cards go with them.
2. Run the checks.
3. Summarize in 3 lines: what they wrote (the parts and roughly how many lines), what you wrote, and what's left.
4. Tick `build` in the journal's *Status*.

The journal is `<home>/<repo>/<branch>/journal.md`:

- `<home>` is `$GRASP_HOME`, or `~/.grasp` if that isn't set.
- `<repo>` is the git toplevel folder name.
- `<branch>` is the branch name, with `/` replaced by `-`.

Don't commit unless the user asks.
