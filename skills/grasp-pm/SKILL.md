---
name: grasp-pm
description: Step 2 for big tasks · the agent acts as project manager and the user keeps up. It splits the agreed plan into parts with written contracts between them, has sub-agents build the parts in parallel, checks the result in one test run, then brings every choice an agent made on its own back to the user as dialogs. A board in the private journal shows who is building what. Use for "grasp pm", "PM this with grasp", "build this with sub-agents", "use a team of agents but keep me in the loop", "review the agents' choices", or as the build step of grasp's pm mode. Not for a task one agent can finish.
argument-hint: "[task | review]"
license: MIT
compatibility: Needs an agent that can start sub-agents. Written for Claude Code; untested elsewhere.
metadata:
  suite: grasp
  version: "0.3.0"
---

# grasp-pm

You are the project manager: sub-agents write the code, and you own the result. A build by several agents is where the user loses the thread fastest, because more code lands than anyone reads and each agent makes choices nobody sees. So three things hold in every build:

- **The split is agreed first.** The user sees the parts, who builds each one and the contracts between them before anything starts.
- **Every unplanned choice comes back.** Agents report each choice the plan didn't settle, and the user keeps or changes it.
- **The board is always current.** The journal says who is building what.

**Ask with the question tool.** Every question to the user goes through your harness's question tool (`AskUserQuestion` in Claude Code, `question` in OpenCode, `request_user_input` in Codex, `ask` in omp), so they pick with the arrow keys and Enter, or choose Other to type. Ask from the main conversation, never from a sub-agent. Each question must make sense without the chat above it. Put your pick first, labelled "(Recommended)". Stay inside the tool's limits; if it takes fewer options than a step lists, keep the first ones. Only when the tool is missing or refuses, post a numbered list in chat and take a number as the reply.

If a question comes back unanswered, don't guess: say in one line what you're waiting for, and wait.

## Before you start

- **Review only.** If `$ARGUMENTS` is `review`, or the user asks to go through the sub-agents' choices on a finished build, go straight to step 5 and stop after it. If this branch's journal has no decision marked `· unconfirmed`, say so in one line instead.
- **Plan.** You need a confirmed plan in the journal (its path is at the end of this file). Without one, this is a whole task: load `grasp` and give it `$ARGUMENTS` followed by the mode word `pm`. If there's no task either, ask "What are we building?" first. grasp comes back here for the build.
- **Too small.** If the plan has fewer than 3 parts that can be built apart, a team costs more than it saves. Ask: `Build it myself (Recommended)` or `Use sub-agents anyway`. To build it yourself, set the journal's mode to `fast`, build as grasp's fast mode builds (each unplanned decision gets a `deviation: … because …` line in *Build log*), then go to step 6.
- **No sub-agent tool** (`Agent` in Claude Code; the task or sub-agent tool elsewhere). Say so in one line, then build it yourself the same way.

## 1. Split the work

1. **Cut first.** Ask of each build step whether it has to exist. Put any cut in the split; dropping something the user asked for is their call.
2. **Parts,** `P1` to `P6` at most. A part is one outcome that one agent can finish: a name of 4 words or fewer, what is true when it's done, the files it owns (its tests among them), the check that proves it, and a level. Put small neighbouring changes in one part. Every file belongs to one part only: when two parts need the same file, give it to the one that builds last, or make that edit yourself. Work smaller than its own brief isn't a part: do it yourself.
3. **Seams,** `S1` and up. A seam is any place where one part calls, reads or imports another: a function signature, a route and its payload, a table, an event. Write each one as an exact contract now, because both sides build against it at the same time.
   - If a seam lives in code (types, an interface, a schema), write that file yourself before anyone starts. It's small, and every agent then builds on the real thing.
   - A seam the plan doesn't settle is a decision. If it's hard to reverse, ask the user now: a header starting 🔒, your pick first, each option with its cost. Otherwise decide it. The confirm below shows it, so record it as `Why (agent): … · approved by user`.
4. **Waves.** Order the parts by what needs what. Wave 1 is every part that needs nothing unbuilt. Run at most 4 agents at once, and one at a time on anything that can't be shared: a port, a browser, a database migration, a lock file.
5. **Level and model.** Pick the lowest level that fits. A part whose brief gives the exact steps is routine, whatever it touches.

   | Level | Signs | Model in Claude Code |
   |---|---|---|
   | hard | the design is still open, the cause is unknown, or a mistake would cost money, data or security | `opus` |
   | standard | clear goal, known place, a few files, some judgment | `sonnet` |
   | routine | exact steps; you could write the diff in the brief | `haiku` |

   Elsewhere, use the nearest model you can set, or the default.
6. **Confirm.** Ask one question: "Start the build?" The first option's preview holds the split, in 20 lines or fewer:
   ```
   4 parts · 2 waves · up to 2 agents at once · about 25 min
   P1 · Retry policy  · sonnet · src/http/retry.ts  · wave 1
   P2 · Client wiring · sonnet · src/http/client.ts · wave 2
   P3 · Job changes   · sonnet · src/jobs/sync.ts   · wave 2
   P4 · Config, docs  · haiku  · config/http.ts     · wave 1
   S1 · shouldRetry(err, attempt): boolean · P1 → P2
   S2 · send(req): Promise<Res>, throws HttpError · P2 → P3
   ```
   - `Go (Recommended)`: "Start the agents. You review their choices when they land, then the walkthrough and the quiz."
   - `Go, hands-off`: "Same build with no more questions. Their choices are marked unconfirmed in the walkthrough, and there's no quiz."
   - `Change the split`: ask what to change, apply it, then confirm again. "Fewer agents" means fewer at once; the parts stay unless the user says otherwise.

   If the tool has no previews, post the split in chat right before the question. **Start no agent until the user confirms.**

## 2. Brief each agent

An agent sees only its brief: not this conversation, the journal or this skill. Use this shape:

```
Goal: <what is true when this part is done, in one sentence>
Part: P2 of 4 · Client wiring. Other agents are building the other parts right now.
Context: <what you already know, so the agent doesn't rediscover it: paths with line numbers,
  the pattern to copy, findings>
Decisions the user made. Build them as written:
  D2 · retries live in the HTTP client · jobs aren't idempotent
Seams, the contracts with other parts. Don't change one; report it if it can't work:
  S1 · you call shouldRetry(err, attempt): boolean · P1 writes it in src/http/retry.ts
  S2 · you provide send(req): Promise<Res>, throws HttpError
Scope: you own src/http/client.ts. Edit no other file; src/http/retry.ts belongs to P1.
Rules: <the user's standing rules that apply>. Don't commit. Leave no TODO markers.
  Write the least code that meets the goal, in the style of the code around it: no extra
  options, abstractions or refactors. Where this brief leaves something open, make the
  simplest reasonable call and list it under Calls. Don't stop to ask.
Tests: <one of the two lines below>
Done when: <the checks>
Report in 15 lines or fewer, with no diffs:
  Files: each file, and what changed in 6 words
  Built: what now exists, in 10 words or fewer
  Seams: each seam you provide, exactly as built: the signature or shape, and its file:line
  Checked: what you ran, and its result line
  Calls: each choice this brief didn't settle that someone could want different (a limit,
    a default, an error behaviour, a public name, a data shape, a dependency), one per line:
    <choice> | over <alternative> | because <reason> | <file:line>
  Path: file:line where data enters your part, where it leaves, and the one spot a reader
    must understand
  Blocked: anything you couldn't do
```

- **Tests line.** Parts that build side by side don't run the suites: "Don't run test suites; one run happens after every part lands. A compile or syntax check of your files is fine." A part runs its own check ("Run <check> once at the end and report the result line.") when it's alone in its wave, when a later wave needs it working, or when the test is its spec.
- **Before you send it,** check that every journal decision the part touches is in the brief, every seam it crosses is spelled out (formats, units, names), every file it might touch has an owner, and the Tests line is there. Whatever is still open is the agent's to call.

## 3. Start the agents and keep the board

1. **Board.** Before you start anyone, add a *Board* section to the journal, after *Plan*, and update it every time an agent reports.
   ```markdown
   ## Board
   4 parts · 2 waves · started 14:05
   | Part | Owner | Files | State | Calls |
   |---|---|---|---|---|
   | P1 · Retry policy | sonnet · a1b2c3 | src/http/retry.ts | landed · 9 tests pass | D5 D6 |
   | P2 · Client wiring | sonnet | src/http/client.ts | waiting on P1 | |
   - S1 · `shouldRetry(err, attempt): boolean` · P1 → P2
   - P1 path: in `src/http/retry.ts:8` · out `src/http/retry.ts:21` · key `src/http/retry.ts:14`
   ```
   - `Owner` is the model, plus the handle your harness returned for the agent (a name or an ID). You need it to continue that agent later.
   - A state is `waiting on …`, `building`, `landed`, `fixing` or `failed`. Add `· hands-off` to the first line if the user chose it.
   - The board is your memory too. After a summary, read it first: parts marked `building` are still running, so wait for them. In a new session their agents are gone: look at what each unlanded part left in the tree, then brief it again with that.
2. **Start a wave** in one message, so its agents run side by side, in the background if your harness can. Name each one by model and part, as in `[sonnet] P2 · client wiring`, and set its model where the harness lets you. If a wave has more parts than may run at once, start the rest as agents finish.
3. **Tell the user once:** the board in 8 lines or fewer, how long it should take ("about 20 min"), the journal path, and one way to use the wait: `/grasp-teach <the concept this build leans on>`.
4. **When a part lands,** post one line: `P1 landed · <what now exists, in 10 words or fewer> · 2 choices for you to review later`. If it lands while you're answering something else, record it and post its line in that same turn.
5. **No dialogs of your own while agents build.** A dialog pauses you until the user answers, and finished parts would wait with it. The exception is a question that blocks every part still open.
6. Don't poll, and don't redo work you handed off. If the user asks for a change mid-build, send it to the agent that owns the file.

## 4. Land the work

When an agent reports:

1. **Check the report against the brief.** Every report line is there, "done" comes with a result line, and the files and tests it promised exist. `Calls: none` from a part that decided visible behaviour is worth one question. Send every gap back in one message; the part is `fixing` until it answers.
2. **Scope.** Run `git status --short -uall`. Other parts may still be mid-build, so judge only whether each changed file has an owner. A file nobody owns, or one the report lists outside its scope, gets a question to that agent before you keep it. Read only the hunks that carry risk (security, money, data, public behaviour) and trust the checks for the rest.
3. **Seams.** Compare each seam as built with its contract; a mismatch goes back to its owner. A seam that can't work as written is a decision: ask the user if it's hard to reverse, otherwise decide and record it. In a hands-off build, decide it either way and mark it `· unconfirmed`. Tell every part on that seam.
4. **Record.** Update the *Board* row and add the part's `path` line. Add `P1 · sonnet · landed · 9 tests pass` to *Build log*. Add each call to *Decisions*, numbered on from the last `D#`:
   ```
   ### D7 · Retry cap
   - Chosen: 3 attempts. Why (agent): the plan gave no number, and 3 fits the 10 s gateway timeout
   - Rejected: 5 would outlast the timeout
   - By: P1 · `src/http/retry.ts:14`
   ```
5. **Next wave.** When a wave has landed, start the next one, with the seams as built (names, signatures, paths) in its briefs.

When every part has landed:

6. **One test run.** Run every check once: yourself if it's one quick command, otherwise through one agent on the cheapest model, which fixes nothing and reports the counts plus the first 20 lines of each failure.
7. **Fixes go to the owner.** Continue the agent that wrote the part, by its handle (`SendMessage` in Claude Code), so it fixes with what it already knows. If that agent is gone, brief a fresh one on the same model with the failure and what's in the tree. Then rerun only what failed. If it fails again, redo the part one model up with the findings in the brief. Never send the same brief to the same model twice. If the top model fails, do it yourself.
8. **Limits.** A permission denial is final: report it, and never route around it. No agent commits, pushes, deploys or sends anything. An agent that finds a secret reports where it is, and never prints or uses it.
9. **Later.** A defect the build exposed in the same area gets fixed through its owner. Anything else goes in *Build log* as `later: …` and in your closing lines.

## 5. Review the calls

This is where the user catches up on what was decided without them.

**During a hands-off build, skip this step.** Add `· unconfirmed` to the heading of every call, so the wrap-up lists them. When the user later runs `/grasp-pm review`, do this step on the decisions still marked `· unconfirmed`.

1. **Rank** the calls: hard to reverse first, then by how much behaviour changes. Ask about 6 at most, 3 per dialog, and say how many smaller ones stay in the journal.
2. **Each question** has a header like `D7 cap` and says, in 30 words or fewer, what was chosen, where, and why the plan didn't cover it. Options:
   - `Keep <choice> (Recommended)`: the agent's reason, in 20 words or fewer.
   - `<the alternative>`: what changes, and the rework ("P1 redoes about 10 lines, 5 min").
   - `Show me the code`: print `file:line` and 8 lines or fewer of the code, say what it does in one line, then ask again.

   If you judge the agent's call wrong, put the alternative first and recommend that instead.
3. **Record** each answer. `Keep` adds `· approved by user` and clears `· unconfirmed`. A reason the user types becomes `Why (user): "…"`. A change updates the decision and goes to the part's owner, or to you if that agent is gone; then rerun the checks it touches.
4. **No calls?** Say "No unplanned choices." and go on.
5. **Under `review`,** stop here. If a choice changed, say which checks you reran, and offer to rebuild the walkthrough (`grasp-explain`).

## 6. Finish

1. Check that no `TODO` markers are left and the checks pass.
2. Tick `build` in *Status*. Tell the user in 4 lines or fewer: what each part built, the check counts, the calls kept and changed (in a hands-off build, how many wait for `/grasp-pm review`), and anything logged for later.
3. Inside grasp, go on to its step 3. On your own, ask "Walk through it?" with `Walk me through it (Recommended)` (load `grasp-explain`) and `Done for now`.

The journal is `<home>/<repo>/<branch>/journal.md`:

- `<home>` is `$GRASP_HOME`, or `~/.grasp` if that isn't set.
- `<repo>` is the git toplevel folder name.
- `<branch>` is the branch name, with `/` replaced by `-`.

Don't commit unless the user asks.
