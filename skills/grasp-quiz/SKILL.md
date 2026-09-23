---
name: grasp-quiz
description: Quiz the user on the current change before they merge. Questions cover why it's built this way, what it does for specific inputs, and where it could break. Asks one question at a time and follows up with a probing question before correcting. The pass mark is 80%. Records the result in the private journal and turns misses into spaced-repetition cards. Use for "quiz me", "quiz me before I merge", "test my understanding", "am I ready to merge", "check I understand this diff", or as step 4 of grasp.
argument-hint: "[last commit | <sha> | plan]"
license: MIT
metadata:
  suite: grasp
  version: "0.1.0"
---

# grasp-quiz

Check that the user can explain and predict this change without looking. This is active recall, not a review, so **don't explain anything before they answer.**

## 1. Source

The arguments are: `$ARGUMENTS`. Ignore them if they're empty or a literal placeholder.

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
| 2 | predict | Given a concrete input or state, what happens: the output, error or side effect. Include a short excerpt if needed. |
| 1 | break/debug | "This error shows up in prod. Where do you look first, and why?" |

- At least one question must target code the user did **not** write. That's where the blind spots are.
- No trivia: nothing about names or line numbers, and nothing answerable by copying a line.
- Every answer must be checkable against the code.

## 3. Run it

1. Ask one question at a time, headed like `Q2/5 · predict`, then wait.
2. Grade the answer:

   | Mark | Meaning | Points |
   |---|---|---|
   | ✅ | Correct: gets the *why*, not just the *what* | 1 |
   | 🟡 | Partial: right idea, but a key nuance is missing | 0.5 |
   | ❌ | Wrong, or `skip` | 0 |

   If the answer is vague ("it's more efficient"), ask them to be specific before grading.
3. On a partial or wrong answer, ask **one** follow-up that exposes the gap: "You said X. What happens when Y?"
4. If they still miss it, give a correction of 3 lines or fewer with a `file:line` reference, then move on. No lecture.

Tone: a tough but supportive senior dev. If they ace it, say so plainly.

## 4. Score and record

- **Pass at ≥ 80%** (4/5): "✅ Passed 4.5/5, ready to merge", plus one line on their strongest and weakest area.
- **Fail:**
  1. List the missed concepts.
  2. Offer `grasp-teach` on each one.
  3. Afterwards, re-quiz only the missed areas, with **new** questions.
- **Journal:**
  - Append to *Quiz*: `<yyyy-mm-dd> · 4.5/5 · passed @ <short HEAD sha>`, plus one line per miss.
  - On a pass, tick `quiz` in *Status*.
- **Cards:**
  - For each miss, add a card to `<home>/deck.md` (format in `grasp-teach`), in box 1, due tomorrow.
  - Also add one card for the change's most important decision, even if they got it right.
