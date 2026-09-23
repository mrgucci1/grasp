---
name: grasp-teach
description: Teach a concept the user is shaky on, using their own codebase, and check that it stuck. Also runs spaced-repetition reviews of cards collected from past grasp sessions (quiz misses and key decisions). Use for "teach me <concept>", "I don't get <X>", "explain <X> with an exercise", "review my cards", "what should I review", or when a grasp quiz finds a gap.
argument-hint: "[concept | review]"
license: MIT
metadata:
  suite: grasp
  version: "0.1.0"
---

# grasp-teach

The request is: `$ARGUMENTS`. If it's empty or a literal placeholder, use the conversation.

This skill has two modes:

- **Teach** a concept. This is the default.
- **Review** due cards, when the request is `review` or the user asks to review.

## Teach a concept (5–10 min)

1. **Probe.** Ask: "How would you explain <concept> right now, in one sentence?" Build on what they already know.
2. **Intuition.** Give a plain-language explanation plus an analogy or toy example, in ≤ 120 words. Fix the specific misconception from their answer in step 1.
3. **In this codebase.**
   - Show where the concept lives, as `file:line` with a 5–15 line excerpt.
   - Say what would break without it.
4. **Try it.** Set one small exercise: predict an output, spot a bug, or write 3–5 lines. Wait for their answer.
5. **Check.** Grade it. If it's shaky, ask one follow-up. Stop once it clicks.
6. **Card.** Add 1–2 cards to the deck, in box 1, due tomorrow.

Ask the user something at least every ~150 words. Never lecture.

## Review due cards (≈5 min)

1. **Pick cards.** Read the deck and take the cards with `Due` ≤ today, oldest first, at most 10. If none are due, say so and offer 3 cards from the lowest box.
2. **Ask** one question at a time. The user answers from memory.
3. **Grade** ✅ / 🟡 / ❌. Then show the stored answer and its source. If the code has changed since the card was written, add one line on what it looks like now.
4. **Reschedule:**
   - ✅ Move the card up one box, to a maximum of 5. The new box sets the next due date: box 2 → 3 days, box 3 → 7 days, box 4 → 16 days, box 5 → 35 days.
   - 🟡 Keep the box; due tomorrow.
   - ❌ Back to box 1; due tomorrow.
5. **Summary:** `8 reviewed · 6 ✅ · next due <date>`

## Deck format

The deck is `<home>/deck.md`, where `<home>` is `$GRASP_HOME`, or `~/.grasp` if that isn't set. Create it if it's missing. Each card is one block:

```markdown
## c-20260923-01
Q: Why do retries live in the HTTP client and not in the job runner?
A: Jobs aren't idempotent, so job-level retries would repeat side effects; the client keeps one place to tune the policy.
From: acme-api · feat-retries · D2 · src/http/client.ts:42
Box: 1 · Due: 2026-09-24
```

- Card IDs are `c-<yyyymmdd>-<nn>`.
- Keep `Q` answerable without the code open.
- Keep `A` to 1–3 lines.
