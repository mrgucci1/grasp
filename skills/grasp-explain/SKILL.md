---
name: grasp-explain
description: Step 3 · walk through the change on real code, entry point to exit point, one stop at a time. Builds a private, self-contained HTML walkthrough (code with decorations, Next and Prev, the key decisions, the risks) under ~/.grasp and opens it. Use for "explain this change", "walk me through what changed", "visualize the diff", "explain everything", or as step 3 of grasp.
argument-hint: "[base branch | commit range]"
license: MIT
metadata:
  suite: grasp
  version: "0.3.0"
---

# grasp-explain

You write a small `tour.json` (no code, no HTML). `build.mjs` reads the code from the working tree, marks the diff, enforces the word budgets and writes `explain.html`.

## 1. Gather

- **Base:** the first that works of `$ARGUMENTS` (if the user gave a base or range and it isn't a literal placeholder), `git merge-base HEAD origin/HEAD`, the merge-base with `main`, the merge-base with `master`.
- **Change:** `git diff <base> --stat` and `git diff <base>` (these include uncommitted work), plus untracked files from `git status --porcelain`.
- **Journal:** `<home>/<repo>/<branch>/journal.md`. `<home>` is `$GRASP_HOME`, or `~/.grasp` if that isn't set; `<repo>` is the git toplevel folder name; `<branch>` has `/` replaced by `-`. Use its Decisions (`D#`), Plan and *Build log*. The user's own parts are the `H#` entries.

## 2. Trace the path

Read each changed file around its hunks, then follow the data through the change at runtime.

- **Entry** (first stop): where data comes in: a route handler, CLI command, event listener or public function.
- **Steps:** each place the change transforms the data or decides something, in runtime order. Add an unchanged function only when the path runs through it and the reader needs it.
- **Exit** (last stop): where the result leaves: a response, write, return or render.
- 2 to 7 stops. If nothing runs (docs, config), use only `step` stops and set `"flow": false`.
- Every other changed file goes in `offPath`: models, types, config, wiring, tests.
- **Decisions:** the ones a stop references, plus every locked (🔒) one.
- **After a PM build** (the journal has a *Board* section): put a stop where the path crosses each seam, and label its `in` or `out` with the seam's contract. The board's `path` lines say where to look.

## 3. Write tour.json

Save it as `<home>/<repo>/<branch>/tour.json`. Never write tour.json or explain.html into the repo.

```json
{
  "title": "Add retries to the HTTP client",
  "repo": "acme-api", "branch": "feat-retries", "date": "2026-11-06", "base": "a1b2c3d",
  "what": "Failed upstream calls retry up to 3 times with backoff.",
  "why": "Sync jobs were failing on brief upstream blips.",
  "risk": { "level": "med", "note": "retries can amplify an outage" },
  "stops": [
    { "role": "entry", "at": "SyncJob.run()", "file": "src/jobs/sync.ts", "lines": [12, 30], "focus": [18, 22],
      "title": "The job asks for data", "say": "SyncJob calls send() and knows nothing about retries.",
      "in": { "line": 18, "label": "request: SyncRequest" }, "out": { "line": 22, "label": "HttpClient.send(req)" },
      "notes": [ { "line": 20, "text": "no retry logic here" } ], "decision": "D2", "yours": "H1" }
  ],
  "decisions": [ { "id": "D2", "title": "Where retries live", "chose": "HTTP client wrapper", "over": "job runner",
    "because": "jobs aren't idempotent", "by": "user", "locked": true, "unconfirmed": false } ],
  "risks": [ { "text": "Retry storms if upstream stays down", "covered": "spec caps attempts at 3", "gap": "jitter under load" } ],
  "offPath": [ { "file": "src/http/types.ts", "what": "HttpError type", "stat": "+12 -0" } ]
}
```

- `role`: `entry`, `step` or `exit`. `file`: repo-relative, as git prints it. `at`: the function or route.
- `lines`: the window shown. `focus`: the lit range inside it. Both are working-tree line numbers.
- `in`: a labelled rule above its line, where data arrives. `out`: one below its line, where data leaves. Both optional.
- `notes`: pinned to lines inside the window. `decision`: a `D#` from `decisions`. `yours`: the `H#` if the user wrote that code.
- `by`: `user` for `Why (user)`, `agent-approved` for `Why (agent) · approved by user`, `agent` for `Why (agent)`. `locked`: 🔒. `unconfirmed`: as the journal marks it.
- If the journal records no reason, write your best reason and set `"by": "agent", "unconfirmed": true`. Never present a guess as the user's reason.
- `risks`: `covered` and `gap` are optional. `offPath[].stat` comes from `--stat`.
- Plain words. Say what the code does at this stop, not what the reader will see.

| Field | Budget |
|---|---|
| `what`, `why` | 14 words each |
| `risk.note` | 8 words |
| `stops` | 2 to 7 |
| `at` | 40 characters |
| stop `title` | 6 words |
| `say` | 20 words |
| `in.label`, `out.label` | 6 words |
| `notes` | 3 per stop, 10 words each |
| `lines` / `focus` | 30 / 15 lines |
| `decisions` | 8; `chose` 6, `over` 8, `because` 12 words |
| `risks` | 3; `text` 12, `covered` 8, `gap` 8 words |
| `offPath` | 12 files; `what` 8 words |
| the whole tour | 400 words |

## 4. Build

```
node "<this skill's folder>/build.mjs" "<home>/<repo>/<branch>/tour.json"
```

- The folder is `${CLAUDE_SKILL_DIR}` in Claude Code, usually `~/.claude/skills/grasp-explain`. Run it from the repo root, or add `--repo <path>`.
- If `<home>/settings.json` exists and has an `editor` value (`vscode`, `cursor` or `none`), pass it as `--editor`. Otherwise leave the flag off.
- It writes `explain.html` next to tour.json and prints its path and word count. On exit 1 it lists every problem: fix them all, then run it again.

No `node`? Copy `template.html` (beside this file) to `explain.html` next to tour.json, and replace `__TOUR__` with the tour JSON. Add to each stop `"status"` (`new`, `changed` or `context`) and `"code"`: the window's lines, copied exactly from the file. Keep the budgets by hand.

## 5. Open, journal, hand back

1. **Open** the page unless the user said not to or you're running non-interactively. Print the path either way. Windows: `Start-Process "<path>"` in PowerShell, or `start "" "<path>"`. macOS: `open "<path>"`. Linux: `xdg-open "<path>"`.
2. **Journal:** replace *Files* with the `--stat` summary, add `explain.html · <yyyy-mm-dd> · base <short sha>` to *Explain*, and tick `explain` in *Status*.
3. **Hand back.** Ask one question with your harness's question tool (`AskUserQuestion` in Claude Code, `question` in OpenCode, `request_user_input` in Codex, `ask` in omp; use a numbered chat list only if there is none): "Walked through it?" Options: `Quiz me` (inside grasp, go on to step 4; standalone, load grasp-quiz), `I have a question` (answer in 5 lines or fewer, naming the stop, then ask again), `Done for now`. In grasp's auto mode, skip the question and go straight to grasp's wrap-up.
