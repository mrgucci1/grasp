---
name: grasp-teach
description: Learn one concept from your own codebase with a quick exercise, or review due cards with "review" (spaced repetition of past quiz misses and key decisions). Use for "teach me X", "I don't get X", "explain X with an exercise", "review my cards", "what should I review", or when a grasp quiz finds a gap.
argument-hint: "<concept> | review"
license: MIT
metadata:
  suite: grasp
  version: "0.3.0"
---

# grasp-teach

The request is: `$ARGUMENTS`. If it's empty or a literal placeholder, use the conversation.

**Ask with the question tool.** Every question to the user goes through your harness's question tool (`AskUserQuestion` in Claude Code, `question` in OpenCode, `request_user_input` in Codex, `ask` in omp), so they pick with the arrow keys and Enter, or choose Other to type. Ask from the main conversation, never from a sub-agent. Each question must make sense without the chat above it. Put your pick first, labelled "(Recommended)". Stay inside the tool's limits; if it takes fewer options than a step lists, keep the first ones. Only when the tool is missing or refuses, post a numbered list in chat and take a number as the reply.

This skill has two modes:

- **Teach** a concept. This is the default.
- **Review** due cards, when the request is `review` or the user asks to review.

## Teach a concept (5–10 min)

1. **Probe.** Ask "Which is closest to how you'd explain <concept> right now?" with 3 options: the right idea and two common misconceptions, in mixed order, none recommended.
2. **Intuition.** Give a plain-language explanation plus an analogy or toy example, in 100 words or fewer. Fix the misconception they picked.
3. **In this codebase.**
   - Show where the concept lives, as `file:line` with a 5–15 line excerpt.
   - Say what would break without it.
4. **Try it.** One multiple-choice exercise: predict an output or spot the bug.
5. **Check.** If they miss, ask one follow-up question. Stop once it clicks.
6. **Card.** Add 1–2 cards to the deck, in box 1, due tomorrow.

Ask the user something at least every ~100 words. Never lecture.

## Review due cards (≈5 min)

1. **Pick cards.** Read the deck and take the cards with `Due` ≤ today, oldest first, at most 10. If none are due, say so and offer 3 cards from the lowest box.
2. **Ask**, two calls per card:
   - Header `Card 3/8`. Question: the card's `Q`, then "Answer in your head, then reveal." Options: `Reveal` and `Skip`. `Skip` leaves the card as it is. If the user types an answer through Other, grade it yourself as `Got it`, `Partly` or `Missed` and skip the next call.
   - Question: "A: <the stored answer> (<source>). How did you do?" Options: `Got it`, `Partly`, `Missed`. If the code has changed since the card was written, add one line on what it looks like now.
3. **Reschedule:**
   - `Got it`: move the card up one box, to a maximum of 5. The new box sets the next due date: box 2 → 3 days, box 3 → 7 days, box 4 → 16 days, box 5 → 35 days.
   - `Partly`: keep the box; due tomorrow.
   - `Missed`: back to box 1; due tomorrow.
4. **Summary:** `8 reviewed · 6 ✅ · next due <date>`

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
