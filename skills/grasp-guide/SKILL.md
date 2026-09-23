---
name: grasp-guide
description: Guided implementation where the user writes the parts that matter and the agent does the rest. The agent builds scaffolding and routine code, marks each real design decision with a TODO(human) spot plus context, a task and guidance (never the answer), waits, then reviews the user's code with questions and escalating hints before any fix. Use for "guide me", "let me write it", "learning mode", "teach me by making me code it", or as the build step of grasp.
license: MIT
metadata:
  suite: grasp
  version: "0.1.0"
---

# grasp-guide

The user writes the code that carries the decisions, and you write everything around it. Learning comes from producing the code, not from reading it, so never hand over answers unasked.

## Pick the user's parts

If the journal's *Plan* has a **Your parts** list (`H1`, `H2`, …), use it. Otherwise pick 2–4 spots with a real choice in them: business logic, error handling, a data structure, an algorithm, or a tricky condition. Each should be 5–25 lines.

Never give the user boilerplate, config, wiring, repetitive code or plain CRUD. Write those yourself.

## For each part

1. **Prepare the spot.**
   - Write the surrounding code, the function signature with types, and the tests or checks for this part.
   - Where their code goes, add a comment `TODO(human): <one-line task>` in the file's comment syntax.
   - If you can, stub the body so the project still builds.
2. **Hand it over:**
   ```
   ✍️ Your turn · H1 of 3 · ~10 lines · src/http/client.ts:48
   Context:  what's already built around this, and who calls it.
   Task:     implement shouldRetry(err, attempt): return true when …
   Guidance: what to weigh (link the decision: "you chose D2 = A"),
             constraints, and a similar pattern at file:line. No solution.
   Check:    npm test -- client.spec.ts
   Reply "done", "hint", or "show me".
   ```
3. **Wait.** Don't write that code yourself.
4. **Review** when they say done:
   - Read their code and run the check.
   - Start with what's right, specifically.
   - Then raise at most 2 problems, as questions: "What happens when `attempt` is 0?"
   - Let them fix it. Give the fix only after 2 misses, or when they say "show me".
5. **Hints** escalate one level each time the user asks:
   1. the concept
   2. a pointer to similar code in the repo
   3. pseudo-code
   4. the code
6. **Close** with an insight:
   ```
   ★ Insight ─────────────────────────────
   - how their code connects to the rest of the system
   - the trade-off they just handled
   - one thing an expert would also consider
   ─────────────────────────────────────────
   ```
7. **Log** it in the journal's *Build log*, e.g. `H1 · written by you · 2 tries · 1 hint · learned: …`. If they struggled with a concept, add it under *Learnings* as a card candidate.

Between parts, keep doing the routine work yourself. If you make a decision that isn't in the plan, say so in one line and log it: `deviation: … because …`.

## Finish

1. Search for leftover markers, e.g. `git grep -n "TODO(human)"`. There must be none.
2. Run the checks.
3. Summarize in 3 lines: what they wrote (the parts and roughly how many lines), what you wrote, and what's left.
4. Tick `build` in the journal's *Status*.

The journal is `<home>/<repo>/<branch>/journal.md`:

- `<home>` is `$GRASP_HOME`, or `~/.grasp` if that isn't set.
- `<repo>` is the git toplevel folder name.
- `<branch>` is the branch name, with `/` replaced by `-`.

Don't commit unless the user asks.
