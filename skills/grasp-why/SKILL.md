---
name: grasp-why
description: Why is this code like this? Answers for a file, line, function or past decision from the private grasp journals in ~/.grasp, git blame and log, and past agent sessions, keeping what was recorded at the time apart from what is inferred. Use for "why is X like this", "why did we choose Y", "a colleague asked why", "what was the reasoning behind", or "/grasp-why src/file.ts:42".
argument-hint: "<file:line | symbol | question>"
license: MIT
metadata:
  suite: grasp
  version: "0.2.0"
---

# grasp-why

Find the reason that was written down when the code was made, or say plainly that there isn't one. **Never invent rationale.**

The question is: `$ARGUMENTS`. If that's empty or a literal placeholder, use the conversation.

## Look it up

Stop as soon as you have a recorded answer.

1. **Git.**
   - `git blame -L <line>,<line> --porcelain -- <file>` gives the commit, author and date.
   - `git log -1 <sha>` gives the commit message.
   - If it's a squash or merge commit, note the PR number or branch name in its message.
2. **grasp journals.** They live at `<home>/<repo>/*/journal.md`. `<home>` is `$GRASP_HOME`, or `~/.grasp` if that isn't set. Match on any of:
   - the file path, under *Files*
   - a recorded `passed @ <sha>` or `done @ <sha>`
   - the branch name
   - keywords from the question

   Read the matching Decisions (`D#`) and *Build log*.
3. **Session links.** These are optional and local-only:
   - `git notes --ref=claude show <sha>`
   - the journal's `session:` line

   A session ID means the original conversation can be reopened with `claude --resume <id>`, if its transcript still exists.
4. **Code and tests.** Use these only for the *inferred* part of the answer.

## Answer

Keep it to 10 lines or fewer.

- **Recorded:** the reason as written at the time, with its source: the journal path and `D#`, or the commit and date. Say whose reason it is. `Why (user)` is the user's own, typed or picked from a list (`picked "…"`). `Why (agent)` is the agent's, either accepted by the user without a reason of their own (`approved by user`) or never shown to them. If the decision is marked `unconfirmed`, say that nobody reviewed it.
- **Inferred:** use this only if nothing was recorded, and label it, e.g. "inferred from the code and tests: …".
- **Unknown:** say that nothing was recorded. Point to the blame author as the person to ask, or to where else to look.
- **Last line:** one plain sentence the user could say to a colleague.
