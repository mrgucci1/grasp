---
name: grasp-grill
description: Step 1 · design questions before any code. Maps the decisions a task needs and asks them as dialogs in short rounds, each with the realistic options, their trade-offs, evidence from this codebase and a recommendation; the user makes every call. Ends with a confirmed plan and records the decisions in a private journal. Use for "grill me", "grill me on this", "help me plan this", "what are my options", "stress-test this design", or as step 1 of grasp.
argument-hint: "[task or plan]"
license: MIT
metadata:
  suite: grasp
  version: "0.3.0"
---

# grasp-grill

Interview the user until you share one understanding of the implementation, and teach them the option space along the way. The task or plan to grill is: `$ARGUMENTS`. If that's empty or a literal placeholder, use the conversation.

**Facts are your job; decisions are the user's.**

**Ask with the question tool.** Every question to the user goes through your harness's question tool (`AskUserQuestion` in Claude Code, `question` in OpenCode, `request_user_input` in Codex, `ask` in omp), so they pick with the arrow keys and Enter, or choose Other to type. Ask from the main conversation, never from a sub-agent. Each question must make sense without the chat above it. Put your pick first, labelled "(Recommended)". Stay inside the tool's limits; if it takes fewer options than a step lists, keep the first ones. Only when the tool is missing or refuses, post a numbered list in chat and take a number as the reply.

## 1. Get the lay of the land

Do this before asking anything. Read the code this task touches:

- entry points
- the closest existing patterns
- tests
- constraints: types, schemas, config, CI

Use a sub-agent if your tool has one. Never ask the user anything you could look up.

Then post a short orientation (3 lines or fewer):

- where the change will live
- the pattern it follows (`file:line`)
- the constraint that narrows the options

The evidence for each decision goes in that decision's question.

## 2. Map the design tree

List the decisions the task needs, and which ones depend on others. Draw from whichever of these areas apply:

- behavior and scope: what's in, what's out, edge cases
- interface: signatures, API shape, data contracts
- data: model, storage, migrations, backwards compatibility
- placement: which module or layer owns it
- failure: errors, retries, timeouts, partial failure
- concurrency and performance
- testing: what would prove it works
- rollout: flags, migration order, reversibility

Skip any decision the codebase has already made. Follow the existing convention and mention it in the orientation. Don't show the tree to the user; work through it as questions.

## 3. Ask in rounds

The **frontier** is every decision whose prerequisites are settled. Ask it in rounds of **at most 3 questions**, one question-tool call per round. A question that depends on one still open waits for a later round. Before each call, post one line: `Round 1 of ~N`.

Build each question like this:

- **header:** the decision in 12 characters or fewer. Start it with 🔒 if the decision is hard to reverse: data shape, public API, security, cross-cutting patterns.
- **question:** the decision as a question, then why it matters and the evidence, in 30 words or fewer: "Where should retries live? Jobs aren't idempotent (`jobs/sync.ts:40`)."
- **options:** 2–4 realistic ones, your pick first with "(Recommended)". The label is the option in 5 words or fewer. The description, in 20 words or fewer, says how it works, then `✚ upside · ✖ cost`, tied to this code and not generic advice.
- **preview:** only when the options differ in code shape (a signature, a schema, a call site), 8 lines or fewer each.

**Make it teach.**

- **Reason check on 🔒 decisions.** After a round, make one more call with one question per 🔒 decision the user just made: "Why does <choice> beat <runner-up> here?" Offer the strongest true reason and two tempting wrong ones, in mixed order, none marked recommended. A wrong pick gets one line on the case it misses; then move on.
- **Push back once.** If the user's pick breaks on a concrete case, ask once: "<choice> will <failure> (`file:line`). Keep it?" with `Switch to <your pick> (Recommended)` and `Keep <choice>`. Then respect their call.
- **Other.** If the user types a question or `?`, explain in 100 words or fewer (a tiny example, when each option wins, where this codebase already does it), then ask again. If they type their own option or reason, take it and record their words.

After each round, recompute the frontier. Stop when it's empty: every branch visited and nothing silently assumed. That's typically 2–4 rounds and 5–12 decisions.

**Fallback, only with no question tool.** Post each round in chat:
```
**Q1 · <decision>**: why it matters, with evidence (file:line).
- **A) <option>**: how it works. ✚ <upside> · ✖ <cost>
- **B) <option>**: …
➡️ I'd pick **B**: <reason tied to this code>.
Reply like: 1B because …, 2 rec, 3 ?
```

`rec` takes your pick and `?` asks for more on the options. On a 🔒 decision answered `rec`, ask for their reason in one line.

## 4. Confirm the plan

Ask one question, "Build this plan?". The dialog can hide the chat, so the plan goes in the first option's preview:

- `Confirm (Recommended)`: its preview is the plan, 25 lines or fewer:
  1. **Decisions:** one line each, `D# · decision · choice`.
  2. **Build steps:** 7 or fewer, in order.
  3. **Your parts:** 2–4 pieces where the user's choices shape behavior (business logic, error handling, a data structure, a tricky condition), each 5–25 lines, as `H# · file · function`. Leave this out in grasp's fast, auto and pm modes.
- `Change something`: ask which decision or step, apply it, then confirm again.

If the tool has no previews, post the plan in chat right before the question. **Write no code until the user confirms.**

## 5. Record

Write the journal. Its path is `<home>/<repo>/<branch>/journal.md`, where:

- `<home>` is `$GRASP_HOME`, or `~/.grasp` if that isn't set
- `<repo>` is the git toplevel folder name
- `<branch>` is the current branch, with `/` replaced by `-`

If the journal doesn't exist, create it with the sections Status, Task, Decisions, Plan, Build log, Files, Explain, Quiz and Learnings.

- **Task:** the task in the user's words, plus the agreed scope.
- **Decisions:** one entry per decision:
  ```
  ### D2 · Where retries live 🔒
  - Options: A) HTTP client wrapper · B) job runner · C) per call site
  - Chosen: A. Why (user): "one place to tune; jobs aren't idempotent"
  - Rejected: B would repeat side effects · C duplicates the policy
  - Revisit if: we add non-idempotent POSTs
  ```
  Label every reason with whose it is:
  - `Why (user): "…"` is the user's reason: their typed words, or the reason they picked in a reason check, written as `picked "…"`.
  - `Why (agent): … · approved by user` means the user took your pick and gave no reason.
  - `Why (agent): …` means you made the call without asking (see *Auto mode*). If it's 🔒, add `· unconfirmed` to its heading.
- **Plan:** the build steps, plus your parts as `H1 · file · function · what`.
- **Status:** tick `grill`.

If you're running on your own rather than inside grasp, finish by asking: `Guide me, I write the key parts` (load `grasp-guide`) or `You build it`.

## Auto mode

In grasp's auto mode the user answers every question now, then leaves the rest to you. Run steps 1–5 as usual, and give the Confirm option this description: "I build it, write the walkthrough and update the journal without stopping again."

If no one can reply (a non-interactive run, for example) or the user said not to ask, make each call yourself and record it as `Why (agent)`. Then post the plan summary and go on without waiting for a confirmation.
