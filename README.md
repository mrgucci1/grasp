# grasp

grasp is a set of agent skills for keeping up with code that an agent writes for you. On a task, you make the design calls, write the parts that carry them, read a visual explainer of the diff, and pass a quiz before you merge. A private journal keeps your reasons, so you can still answer "why is it built this way?" months later.

```
grill ──► build ──► explain ──► quiz ──► merge
  │         │          │          │
  │         │          │          └─ miss? → grasp-teach, then re-quiz
  │         │          └─ private HTML: diagram, reading order, decisions, risks
  │         └─ you write the parts that carry the decisions (TODO(human) spots)
  └─ options + trade-offs + a recommendation; you make each call and say why
```

| Skill | What it does | Time |
|---|---|---|
| `grasp` | Runs the whole loop and keeps the journal. Add `fast` to skip the hands-on build. | 45–90 min, or 15–20 min fast |
| `grasp-grill` | Maps the decisions a task needs and asks about them in rounds of up to 3 questions. Each question shows the options, their trade-offs, evidence from your code, and a recommendation. You make the call. | 10–20 min |
| `grasp-guide` | Writes the scaffolding and marks `TODO(human)` spots with context, a task, and guidance. You write those parts, and hints get more specific only when you ask. | 20–60 min |
| `grasp-explain` | Builds a self-contained HTML page with a before/after diagram, the runtime flow, a reading order through the real diff, the decisions, and the risks. | 5 min to read |
| `grasp-quiz` | Asks 5 questions one at a time (why, predict, break) and follows up before correcting you. The pass mark is 80%, and misses become review cards. | 5–10 min |
| `grasp-teach` | Teaches one concept with examples from your codebase and a small exercise. `review` runs the cards that are due (spaced repetition). | 5–10 min |
| `grasp-why` | Answers "why is this code like this?" from your journals, git history, and past sessions, and keeps what was recorded apart from what it infers. | 1 min |

## Install

Run the installer from this folder:

```
./install.ps1     # Windows (PowerShell)
./install.sh      # macOS and Linux
```

It copies the skills to `~/.claude/skills`, which Claude Code and OpenCode both read, and adds `/grasp` commands for OpenCode to `~/.config/opencode/commands`. Run it again to update. `./install.ps1 -Uninstall` or `./install.sh --uninstall` removes the skills and commands and leaves your journals alone.

For other agents, use the skills CLI: `npx skills add <path-to-grasp> -g -a codex` (or `-a cursor`, and so on). The skills use the [Agent Skills](https://agentskills.io) format.

To use grasp on another machine, copy this folder or clone it from your git host, then run the installer there.

## Use

| Agent | Start the loop | Run one step |
|---|---|---|
| Claude Code | `/grasp add retries to the http client` | `/grasp-grill`, `/grasp-quiz`, `/grasp-teach review`, `/grasp-why src/app.ts:42` |
| OpenCode | `/grasp add retries to the http client` | `/grasp-grill`, `/grasp-quiz`, and the other installed commands |
| Codex | `$grasp add retries to the http client` | `$grasp-quiz` and the rest |

Add `fast` for the short version, as in `/grasp fix the flaky date parser fast`.

## Where your data lives

| File | Path under `~/.grasp/` |
|---|---|
| Journal | `<repo>/<branch>/journal.md` |
| Explainer | `<repo>/<branch>/explain.html` |
| Review deck | `deck.md` |

Set `GRASP_HOME` to keep them somewhere else.

grasp writes nothing to your repo, commit messages, PR text, or code comments. The one exception is the `TODO(human)` markers during the build step, and those are gone before the explainer runs. It never commits or pushes unless you ask, so your team's commit format stays as it is.

The journal records each decision, the options you rejected, and your reasons in your own words. `grasp-why` reads it when someone asks why the code looks the way it does.

## Works well with Claude Code

- `/output-style learning` gives you the same `TODO(human)` style of practice for everyday work outside grasp.
- `"cleanupPeriodDays": 3650` in `~/.claude/settings.json` keeps session transcripts for ten years instead of the default 30 days. With that set, the `session:` line in a journal can reopen the original conversation with `claude --resume <id>`.

## Why this design

- In Shen and Tamkin's 2026 trial at Anthropic, developers who asked "why" follow-up questions after generating code scored 86% on a later quiz, and those who only delegated scored 39%. The groups behind those two numbers were small.
- In Sankaranarayanan's 2026 study, having to explain code back before merging cut failures on a later maintenance task, done without AI, from 77% to 39%.
- Producing an answer builds memory better than rereading one (Bjork and Bjork's work on desirable difficulties), so grasp has you decide, write, and recall.

## Credits

- The grill rounds adapt Matt Pocock's [`grilling`](https://github.com/mattpocock/skills) skill (MIT), which walks a design as a tree of decisions.
- The quiz's one-question-at-a-time follow-ups adapt rodbv's [`quiz-me`](https://github.com/rodbv/socratic-skills) (MIT).
- The guided build is modeled on Claude Code's Learning output style, with its `TODO(human)` contributions and `★ Insight` notes.
- The explainer draws on Geoffrey Litt's explain-diff and nicobailon's [visual-explainer](https://github.com/nicobailon/visual-explainer).

## Status

Version 0.1.0. On Windows with Claude Code, the installers work, and the grill and explain steps have run against a demo repo. OpenCode and Codex should pick the skills up from their documented skill folders, but neither has been tried yet.

## License

MIT
