---
name: grasp-explain
description: Step 3 · a narrated walkthrough of the change on real code, entry point to exit point. A natural voice talks the user through every stop line by line, highlighting the code as it speaks, stepping into the methods the path calls, defining each term as it comes up, and moving on by itself. Builds a private, self-contained HTML player (code, call stack, subtitles, transcript, decisions, risks, words to know) under ~/.grasp and opens it. Use for "explain this change", "walk me through what changed", "talk me through the code", "visualize the diff", "explain everything", or as step 3 of grasp.
argument-hint: "[base branch | commit range]"
license: MIT
metadata:
  suite: grasp
  version: "0.4.0"
---

# grasp-explain

You write `tour.json`: the path through the change, plus the script a voice reads over it. You write no code and no HTML. `build.mjs` reads the code from the working tree, marks the diff, checks the budgets, turns each spoken segment into a clip with the bundled voice (Kokoro, running on this machine), and writes `explain.html`, a player that talks the user through the change, highlighting each line as it's discussed.

The voice-over is the explanation, so it carries the depth. The page text stays short.

## 1. Gather

- **Base:** the first that works of `$ARGUMENTS` (if the user gave a base or range and it isn't a literal placeholder), `git merge-base HEAD origin/HEAD`, the merge-base with `main`, the merge-base with `master`.
- **Change:** `git diff <base> --stat` and `git diff <base>` (these include uncommitted work), plus untracked files from `git status --porcelain`.
- **Journal:** `<home>/<repo>/<branch>/journal.md`. `<home>` is `$GRASP_HOME`, or `~/.grasp` if that isn't set; `<repo>` is the git toplevel folder name; `<branch>` has `/` replaced by `-`. Use its Decisions (`D#`), Plan and *Build log*. The user's own parts are the `H#` entries.

## 2. Trace the path, like a debugger

Read each changed file around its hunks, then follow one real input through the change at runtime, the way you would step through it in a debugger.

- **Entry** (first stop, `depth` 0): where data comes in: a route handler, CLI command, event listener or public function.
- **Step into** (`depth` + 1): when a stop calls a function the reader needs to see (it changed, or it decides something on the path), the next stop is that function, one level deeper.
- **Step out** (`depth` back down): when that function returns and the caller still does something with the result, the next stop is the caller again, with `focus` on the lines after the call. Sibling calls from the same caller sit at the same depth.
- **Exit** (last stop): where the result leaves: a response, write, return or render.
- 2 to 12 stops. Depth rises by at most 1 per stop. An unchanged function belongs on the path when the data runs through it and the reader needs it to follow along.
- If nothing runs (docs, config), use only `step` stops at depth 0 and set `"flow": false`.
- Every other changed file goes in `offPath`: models, types, config, wiring, tests.
- **Decisions:** the ones a stop or segment references, plus every locked (🔒) one.
- **After a PM build** (the journal has a *Board* section): put a stop where the path crosses each seam, and label its `in` or `out` with the seam's contract. The board's `path` lines say where to look.

## 3. Write the narration

Write it as a senior engineer pairing with a capable teammate who has never seen this code. Assume they know the language, but not this codebase, its domain or its libraries. They're listening, and their eyes are on the highlighted code.

**Pick a running example first.** Choose one concrete input and trace it through every stop with real values: "the server answers 503 twice, then 200", "a cart with two items, one on sale". Work the values out from the code; never guess them. Saying "so `attempt` is now 2, and we wait up to 200 milliseconds" teaches more than any description.

**`intro`** (3 to 8 segments):
1. What changed, in plain words (`"show": "what"`), and why (`"show": "why"`), with a picture of the problem it solves.
2. The two or three words the whole change rests on, each defined in the sentence that first uses it.
3. A preview of the path: one short segment per stop or two (`"chip": n` lights stop n on the map), saying what each one does. Name the running example.

**Each stop's `walk`** (2 to 14 segments; changed stops get the most):
1. **Arrive.** Where we are (the file and the function), how we got here ("we've stepped into `send`, called on line 4 of `sync.js`"), and what this function is for, in one sentence.
2. **Inputs.** What arrives, and its value in the running example. Point `lines` at the signature or the `in` line.
3. **Line by line.** Walk the focus lines top to bottom in spans of 1 to 5 lines. For each span: what it does, in words rather than reading the code aloud; why it's there; and what the data looks like afterwards. At a branch, say which way the example goes and what the other way would do.
4. **New or old.** Say which lines are new, changed or untouched. For replaced code, add a segment with `"removed": true` (the page unfolds the old lines) saying what the code used to do and why that wasn't enough.
5. **Decisions and ownership.** Tie the code to its decision (`"decision": "D2"` opens it) and the reason for it. If the user wrote this part (`yours`), say "this is the part you wrote".
6. **Leave.** What leaves this stop and where it goes next: "let's step into `backoff`", "back in `send`", "now this returns to `runSync`".

**`outro`** (2 to 6 segments): the whole path in one breath (`"show": "flow"`); the decisions behind the change (`"show": "decisions"`, plus `decision`); the risks and gaps (`"show": "risks"`); then one self-check question with its answer, using the running example.

**Define every term.** The first time the voice says a word a newcomer might not know, define it in that same sentence ("idempotent, which means safe to repeat"). That covers language features (closure, generic, await), library APIs, domain words, project names and acronyms. Add each one to `terms`; the page pops the definition up the moment the voice reaches the word. Five to twenty terms is typical.

**Write for the ear.**
- Short sentences, active voice, "we" and "you". Contractions are fine. No bullet-speak, and no "as you can see".
- Put identifiers in backticks. The page shows them as code and boxes them in the highlighted lines, and the voice says them naturally (`HttpClient.send()` is spoken "Http Client dot send"). Say operators in words ("at least", "is not") unless they're inside backticks, and describe nested calls instead of reading them out.
- Use `speak` only to fix a pronunciation, such as an acronym said as a word. It replaces what the voice says; the page still shows `say`.
- One idea per segment, at most 45 words. Set `lines` to exactly the lines being talked about (at most 12), so the highlight moves with the voice.

**Be exact.** Re-read the code before writing each stop's walk. Every claim must be true of those lines, and every number in the running example must follow from the code.

Aim for 8 to 20 minutes at normal speed. The user can play it faster, read the transcript instead, or switch to captions only.

## 4. Write tour.json

Save it as `<home>/<repo>/<branch>/tour.json`. Never write tour.json, explain.html or the audio into the repo.

```json
{
  "title": "Add retries to the HTTP client",
  "repo": "acme-api", "branch": "feat-retries", "date": "2026-11-18", "base": "a1b2c3d",
  "what": "Failed upstream calls retry up to 3 times with backoff.",
  "why": "Sync jobs were failing on brief upstream blips.",
  "risk": { "level": "med", "note": "retries can amplify an outage" },
  "terms": [ { "term": "backoff", "def": "Waiting before trying again, a little longer after each failure." } ],
  "intro": [
    { "show": "what", "say": "This change makes the HTTP client try again when an upstream call fails, instead of failing the whole sync job." },
    { "show": "flow", "chip": 1, "say": "We'll follow one sync run. It starts in `SyncJob.run`, which asks the client for data." }
  ],
  "stops": [
    { "role": "entry", "at": "SyncJob.run()", "depth": 0, "file": "src/jobs/sync.ts", "lines": [12, 30], "focus": [18, 22],
      "title": "The job asks for data", "say": "SyncJob calls send() and knows nothing about retries.",
      "in": { "line": 18, "label": "request: SyncRequest" }, "out": { "line": 22, "label": "HttpClient.send(req)" },
      "notes": [ { "line": 20, "text": "no retry logic here" } ], "decision": "D2", "yours": "H1",
      "walk": [
        { "lines": [18, 19], "say": "We start in `SyncJob.run`. Line 18 builds the request for this run: which records changed since the last sync." },
        { "lines": [22, 22], "decision": "D2", "say": "Line 22 hands it to `HttpClient.send`. Let's step into it." }
      ] }
  ],
  "outro": [ { "show": "flow", "say": "So: the job sends once, and the client quietly retries up to three times, with backoff, before giving up." } ],
  "decisions": [ { "id": "D2", "title": "Where retries live", "chose": "HTTP client wrapper", "over": "job runner",
    "because": "jobs aren't idempotent", "by": "user", "locked": true, "unconfirmed": false } ],
  "risks": [ { "text": "Retry storms if upstream stays down", "covered": "spec caps attempts at 3", "gap": "jitter under load" } ],
  "offPath": [ { "file": "src/http/types.ts", "what": "HttpError type", "stat": "+12 -0" } ]
}
```

- `role`: `entry`, `step` or `exit`. `depth`: the call depth, 0 at the top (see step 2). `file`: repo-relative, as git prints it. `at`: the function or route.
- `lines`: the window shown. `focus`: the lit range inside it. Both are working-tree line numbers.
- `in`: a labelled rule above its line, where data arrives. `out`: one below its line, where data leaves. Both optional.
- `notes`: pinned to lines inside the window. `decision`: a `D#` from `decisions`. `yours`: the `H#` if the user wrote that code.
- **Stop segments** (`walk`): `say`; `lines` inside the stop's window (default: `focus`); optional `removed`, `decision`, `speak`.
- **Intro and outro segments:** `say`; optional `show` (`what`, `why`, `risk`, `flow`, `decisions`, `risks`, `off` or `terms`), `chip` (a stop number), `decision`, `speak`.
- `terms`: each `term` must be said somewhere in the narration.
- `by`: `user` for `Why (user)`, `agent-approved` for `Why (agent) · approved by user`, `agent` for `Why (agent)`. `locked`: 🔒. `unconfirmed`: as the journal marks it.
- If the journal records no reason, write your best reason and set `"by": "agent", "unconfirmed": true`. Never present a guess as the user's reason.
- `risks`: `covered` and `gap` are optional. `offPath[].stat` comes from `--stat`.

| Field | Budget |
|---|---|
| `what`, `why` | 14 words each |
| `risk.note` | 8 words |
| `stops` | 2 to 12 |
| `at` | 40 characters |
| stop `title` | 6 words |
| stop `say` (the short summary on the page) | 20 words |
| `in.label`, `out.label` | 6 words |
| `notes` | 3 per stop, 10 words each |
| `lines` / `focus` | 30 / 15 lines |
| `decisions` | 8; `chose` 6, `over` 8, `because` 12 words |
| `risks` | 3; `text` 12, `covered` 8, `gap` 8 words |
| `offPath` | 12 files; `what` 8 words |
| page text, all of the above | 600 words |
| `intro` / each `walk` / `outro` | 1 to 8 / 2 to 14 / 1 to 6 segments |
| segment `say` / `speak` | 45 / 60 words |
| segment `lines` | 12 lines |
| `terms` | 20; `term` 4 words, `def` 25 words |
| the whole narration | 3,200 words, about 20 minutes |

## 5. Build

```
node "<this skill's folder>/build.mjs" "<home>/<repo>/<branch>/tour.json"
```

- The folder is `${CLAUDE_SKILL_DIR}` in Claude Code, usually `~/.claude/skills/grasp-explain`. Run it from the repo root, or add `--repo <path>`.
- If `<home>/settings.json` has an `editor` value (`vscode`, `cursor` or `none`), pass it as `--editor`. The builder reads a `voice` value itself: a voice name from `node voice.mjs voices`, or `browser` to skip the clips.
- The first build makes a clip for every segment, at about 6 times real time (10 minutes of narration takes about 2 minutes). Later builds only remake segments whose words changed. Give the command a 10-minute timeout (`timeout: 600000` on Claude Code's Bash tool), or run it in the background.
- It writes `explain.html` and an `audio/` folder next to tour.json, and prints the path, the word counts, the narration's length and the voice. On exit 1 it lists every problem: fix them all, then run it again.
- If it prints that the natural voice isn't installed, the page falls back to the browser's own voice. Tell the user in one line, with the install command it printed (a one-time download of about 750 MB). Don't install it unasked.

No `node`? Copy `template.html` (beside this file) to `explain.html` next to tour.json, and replace `__TOUR__` with the tour JSON. Add to each stop `"status"` (`new`, `changed` or `context`) and `"code"`: the window's lines, copied exactly from the file. Keep the budgets by hand. The page then speaks with the browser's voice.

## 6. Open, journal, hand back

1. **Open** the page unless the user said not to or you're running non-interactively. Print the path either way, and say: "Press Play (or Space) and it talks you through it, about N minutes." Windows: `Start-Process "<path>"` in PowerShell, or `start "" "<path>"`. macOS: `open "<path>"`. Linux: `xdg-open "<path>"`.
2. **Journal:** replace *Files* with the `--stat` summary, add `explain.html · <yyyy-mm-dd> · base <short sha> · <N> min narrated` to *Explain*, and tick `explain` in *Status*.
3. **Hand back.** Ask one question with your harness's question tool (`AskUserQuestion` in Claude Code, `question` in OpenCode, `request_user_input` in Codex, `ask` in omp; use a numbered chat list only if there is none): "Walked through it?" Options: `Quiz me` (inside grasp, go on to step 4; standalone, load grasp-quiz), `I have a question` (answer in 5 lines or fewer, naming the stop, then ask again), `Done for now`. In grasp's auto mode, skip the question and go straight to grasp's wrap-up.
