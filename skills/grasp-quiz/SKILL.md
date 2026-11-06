---
name: grasp-quiz
description: Step 4 · multiple-choice quiz on the current change before merge, covering why it's built this way, what it does for specific inputs, and where it could break. Asks one question per dialog, or opens a clickable page with "page" that sends the score back. 80% passes, and misses become review cards. Use for "quiz me", "quiz me before I merge", "test my understanding", "am I ready to merge", "check I understand this diff", or as step 4 of grasp.
argument-hint: "[page] [last commit | <sha> | plan]"
license: MIT
metadata:
  suite: grasp
  version: "0.2.0"
---

# grasp-quiz

Check that the user can explain and predict this change without looking. This is active recall, not a review, so **don't explain anything before they answer.**

**Ask with the question tool.** Every question to the user goes through your harness's question tool (`AskUserQuestion` in Claude Code, `question` in OpenCode, `request_user_input` in Codex, `ask` in omp), so they pick with the arrow keys and Enter, or choose Other to type. Ask from the main conversation, never from a sub-agent. Each question must make sense without the chat above it. Put your pick first, labelled "(Recommended)". Stay inside the tool's limits; if it takes fewer options than a step lists, keep the first ones. Only when the tool is missing or refuses, post a numbered list in chat and take a number as the reply.

## 1. Source

The arguments are: `$ARGUMENTS`. Ignore them if they're empty or a literal placeholder. A leading `page` selects *Page mode*. The rest picks the source:

- **Default:** the branch's change, `git diff <base>`, plus new untracked files. The base is the merge-base with `origin/HEAD`, or else with `main` or `master`.
- **`last commit`:** `git diff HEAD~1 HEAD`
- **`<sha>`:** `git show <sha>`
- **`plan`:** the journal's Decisions and Plan only, for quizzing before anything is built.

Add the journal's Decisions and *Build log*. The journal is `<home>/<repo>/<branch>/journal.md`:

- `<home>` is `$GRASP_HOME`, or `~/.grasp` if that isn't set.
- `<repo>` is the git toplevel folder name.
- `<branch>` is the branch name, with `/` replaced by `-`.

## 2. Write the questions

Write 5 by default: 3 for a small change, up to 7 for a large one.

| Count | Type | What it asks |
|---|---|---|
| 2 | why | Why this option over the rejected one (`D#`), and what would go wrong with the alternative. |
| 2 | predict | Given a concrete input or state, what happens: the output, error or side effect. A code excerpt goes in `code`, in page mode only. |
| 1 | break/debug | "This error shows up in prod. Where do you look first, and why?" |

- **Multiple choice**, 4 options: the right answer and 3 wrong ones a developer could really believe, 20 words or fewer each. Vary where the right one sits. No option is marked recommended.
- The question stands alone: name the function and the input in the question itself ("`shouldRetry` gets a 404 on attempt 1. What happens?").
- At least one question must target code the user did **not** write. That's where the blind spots are.
- No trivia: nothing about names or line numbers, and nothing answerable by copying a line.
- Every answer must be checkable against the code.

## 3. Ask them (the default)

1. One question per call. Header: `Q2/5 why`.
2. After each answer, one line: ✅ or ❌, the reason, and `file:line`.
3. On a miss, ask **one** follow-up that exposes the gap ("You picked X. What happens when Y?"), also multiple choice. Right: 0.5 points. Wrong: 0, plus a correction of 2 lines or fewer.
4. If the user types an answer through Other, grade it as written: 1, 0.5 or 0.

Tone: a tough but supportive senior dev. If they ace it, say so plainly.

## 4. Page mode

Use it for `page`, or when your harness has no question tool.

1. Write `quiz.json` in the journal's folder:
   ```json
   {
     "title": "Add retries to the HTTP client",
     "pass": 0.8,
     "questions": [
       { "id": "q1", "type": "why",
         "q": "Why do retries live in the HTTP client and not in the job runner?",
         "options": ["Jobs aren't idempotent, so job-level retries repeat side effects",
                     "The client is faster", "Jobs cannot catch errors"],
         "answer": 0,
         "because": "Job-level retries would repeat side effects; the client keeps one place to tune.",
         "ref": "src/http/client.ts:42 · D2" }
     ]
   }
   ```
   Limits: 3–7 questions; 2–4 options; `q` 40 words; an option 20 words; `because` 25 words; an optional `code` excerpt of 12 lines. `type` is `why`, `predict` or `break`. `answer` is an index into `options`.
2. Run `node "<this skill's folder>/quiz.mjs" "<quiz.json>"`. `quiz.mjs` sits next to this SKILL.md: `${CLAUDE_SKILL_DIR}` in Claude Code, usually `~/.claude/skills/grasp-quiz`. It builds `quiz.html`, opens it in the browser, and exits when the user presses **Send to agent**.
   - Run it in the background when your harness wakes you on a background command's exit (`run_in_background` in Claude Code, `async` in omp). Otherwise run it in the foreground with `--timeout 9` and the longest tool timeout you can set.
   - Tell the user in one line: "The quiz is open in your browser. Press Send when you're done."
3. Read the one JSON line it prints: `score`, `total`, `percent`, `passed`, `missed`. The same result is saved as `quiz-result.json`. Exit code 1 lists what to fix in quiz.json. The page shows each correction itself, so there are no follow-ups in page mode.
4. If the wait times out (exit code 2), the open page still works: ask the user to press **Copy results** and paste them. If node is missing, ask the questions in chat as a numbered list.

## 5. Score and record

- **Pass at ≥ 80%** (4/5): "✅ Passed 4.5/5, ready to merge", plus one line on their strongest and weakest area.
- **Fail:**
  1. Ask "Which of these do you want taught?" as a multi-select of the missed concepts.
  2. Load `grasp-teach` for each one picked.
  3. Afterwards, re-quiz only the missed areas, with **new** questions, in the same mode.
- **Journal:**
  - Append to *Quiz*: `<yyyy-mm-dd> · 4.5/5 · passed @ <short HEAD sha>`, plus one line per miss.
  - On a pass, tick `quiz` in *Status*.
- **Cards:**
  - For each miss, add a card to `<home>/deck.md` (format in `grasp-teach`), in box 1, due tomorrow.
  - Also add one card for the change's most important decision, even if they got it right.
