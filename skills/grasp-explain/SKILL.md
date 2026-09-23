---
name: grasp-explain
description: Turn the current change into a visual, self-contained HTML explainer covering what changed and why, a before/after diagram, the runtime flow, a reading-order walkthrough of the real diff with the user's own parts marked, the decisions and trade-offs, and the risks. Saves it privately under ~/.grasp (never in the repo) and opens it in the browser. Use for "explain this change", "visualize the diff", "walk me through what changed", "explain everything", or as step 3 of grasp.
argument-hint: "[base branch or commit range]"
license: MIT
metadata:
  suite: grasp
  version: "0.1.0"
---

# grasp-explain

Produce one HTML page that lets the user understand the change in about 5 minutes: first the picture, then the path through the code, then the reasons.

## 1. Gather

- **Base.** Use the first of these that works:
  1. `$ARGUMENTS`, if the user gave a base or range and it isn't a literal placeholder
  2. `git merge-base HEAD origin/HEAD`
  3. the merge-base with `main`
  4. the merge-base with `master`
- **Change:**
  - `git diff <base> --stat` and `git diff <base>`. These include uncommitted work.
  - New untracked files, from `git status --porcelain`.
- **Why.** Read the journal at `<home>/<repo>/<branch>/journal.md`:
  - `<home>` is `$GRASP_HOME`, or `~/.grasp` if that isn't set.
  - `<repo>` is the git toplevel folder name, and `<branch>` has `/` replaced by `-`.
  - Use its Decisions (`D#`), Plan and *Build log*. The user's own parts are the `H#` entries.
- **Read before you draw.** Read each changed file around its hunks, identify the components touched, and trace the main runtime path the change affects.

## 2. Build the page

Copy `template.html` to `<home>/<repo>/<branch>/explain.html`. The template sits next to this SKILL.md: `${CLAUDE_SKILL_DIR}/template.html` in Claude Code, usually `~/.claude/skills/grasp-explain/template.html`. If you can't find it, write the page yourself with the same sections.

Replace `{{TITLE}}` and `{{META}}`, then fill in every `<!-- FILL: … -->` block, replacing its example content:

1. **TL;DR.** Three lines: what changed, why, and the risk (`low`, `med` or `high`) with a one-phrase reason.
2. **Before → after.** A Mermaid `flowchart` of the components and data flow involved:
   - Mark nodes with `:::added`, `:::changed` or `:::removed`, and keep the template's `classDef` lines.
   - Use 15 nodes or fewer.
   - Label edges with what flows along them.
3. **Runtime flow.** A Mermaid `sequenceDiagram` of the main path through the changed code. Delete this section if nothing runs, e.g. for docs or config-only changes.
4. **Reading order.** 3–8 stops, in the order a newcomer should read them. Each stop has:
   - the location as `file:line-range`
   - what it does, in 1–2 lines
   - why it's shaped this way, linking the relevant `D#`
   - an excerpt pasted from real `git diff` output (never retyped from memory) inside `<pre class="diff"><code>`
   - the `you wrote this · H#` badge on the user's own parts
5. **Decisions and trade-offs.** One row per `D#`: chosen, rejected and why. If a reason isn't in the journal, wrap it in `<span class="inferred">inferred: …</span>`. Never present a guess as the recorded rationale.
6. **Risks and checks.** Where it could break, what the tests cover, and what they don't.
7. **Terms** (optional). Up to 5 concepts the reader may not know, one line each. Otherwise delete the section.

Page rules:

- HTML-escape all code: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`.
- In Mermaid, quote labels that contain punctuation: `A["parse(input)"]`.
- It must be readable in 5 minutes. Cut before you add.

## 3. Save and open

1. **Save** the page only under the grasp home. **Never write it into the repo.**
2. **Open** it in the default browser, unless the user said not to or you're running non-interactively. Print the path either way.
   - Windows: `Start-Process "<path>"` in PowerShell, or `start "" "<path>"`
   - macOS: `open "<path>"`
   - Linux: `xdg-open "<path>"`
3. **Journal:**
   - Replace *Files* with the `--stat` summary.
   - Add to *Explain*: `explain.html · <yyyy-mm-dd> · base <short sha>`.
   - Tick `explain` in *Status*.

Then tell the user: "Skim it: the diagram, then the reading order (≈5 min). Say `ready` for the quiz." If you're running on your own rather than inside grasp, end with: "Want to be quizzed on it? That's `grasp-quiz`."
