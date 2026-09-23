---
name: grasp-grill
description: Grill the user on how to implement a task before any code is written. Maps the design as a tree of decisions and asks them in short rounds; each question lays out the realistic options with trade-offs, evidence from this codebase and a recommendation, and the user makes the call and says why. Ends with a confirmed plan and records the decisions in a private journal. Use for "grill me", "grill me on this", "help me plan this", "what are my options", "stress-test this design", or as step 1 of grasp.
argument-hint: "[task or plan]"
license: MIT
metadata:
  suite: grasp
  version: "0.1.0"
---

# grasp-grill

Interview the user until you share one understanding of the implementation, and teach them the option space along the way. The task or plan to grill is: `$ARGUMENTS`. If that's empty or a literal placeholder, use the conversation.

**Facts are your job; decisions are the user's.**

## 1. Get the lay of the land

Do this before asking anything. Read the code this task touches:

- entry points
- the closest existing patterns
- tests
- constraints: types, schemas, config, CI

Use a sub-agent if your tool has one. Never ask the user anything you could look up.

Then post a short orientation (≤ 6 lines):

- where the change will live
- 1–3 existing patterns it should follow (`file:line`)
- any constraint that narrows the options

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

The **frontier** is every decision whose prerequisites are settled. Ask the frontier in rounds of **at most 3 questions**, and start each round with `Round 1 of ~N`. A question that depends on one still open in the same round waits for a later round.

```
**Q1 · <decision>**: why it matters, in one line.
- **A) <option>**: how it works. ✚ <upside> · ✖ <cost>
- **B) <option>**: …
- **C) <option>**: … (only if it's genuinely viable)
In this codebase: <evidence with file:line, e.g. an existing pattern or a constraint>
➡️ I'd pick **B**: <reason tied to this code, not generic advice>.
```

End each round with: `Reply like: 1B because …, 2 rec, 3 ?`. Here `rec` means take my pick, and `?` means explain the options more.

**Make it teach.**

- **Mark 🔒 decisions.** These are hard to reverse: data shape, public API, security, cross-cutting patterns. If the user answers `rec` on one, ask for one line, in their own words, on why B beats A. Minor decisions can be accepted with a plain `rec`.
- **Push back once.** If their reasoning is wrong or thin, push back like a senior reviewer, with the concrete case it misses. Then respect their call.
- **On `?`, explain in ≤ 150 words, then ask again.** Cover:
  - an analogy or a tiny example
  - when each option wins
  - what experienced engineers watch out for
  - where this codebase already does something similar

After each round, recompute the frontier. Stop when it's empty: every branch visited and nothing silently assumed. That's typically 2–4 rounds and 5–12 decisions.

## 4. Confirm the plan

Post the plan summary:

1. **Decisions:** a table with columns `D#`, decision, choice, and why. Use the user's own words where they gave a reason.
2. **Build steps:** 7 or fewer, in order.
3. **Your parts:** 2–4 pieces where the user's choices shape behavior (business logic, error handling, a data structure, a tricky condition). Each is 5–25 lines, with its `file` and function. `grasp-guide` hands these to the user. Leave this out in grasp's fast mode.

Ask: "Confirm, or change anything?" **Write no code until the user confirms.**

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
- **Plan:** the build steps, plus your parts as `H1 · file · function · what`.
- **Status:** tick `grill`.

If you're running on your own rather than inside grasp, finish by offering one next step: "Build it with `grasp-guide` (you write the key parts), or shall I build it?"
