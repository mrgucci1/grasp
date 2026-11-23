#!/usr/bin/env bash
# Install the grasp skills for Claude Code and OpenCode, with the walkthrough voice.
#   skills/*            -> ~/.claude/skills   (Claude Code and OpenCode both read it)
#   opencode/commands/* -> ~/.config/opencode/commands   (OpenCode /grasp commands)
#   walkthrough voice   -> ~/.grasp/_voice   (Kokoro, a text-to-speech model that runs on this machine; about 750 MB, once)
#   editor extension    -> VS Code and Cursor, if found   (plays walkthroughs beside the real code; about 20 KB)
# Usage: ./install.sh [--no-voice] [--no-editor] [--uninstall]
# Re-run to update. Only grasp's own folders, files and extension are touched.
# Without the voice, walkthroughs speak with the browser's voice; without the extension, they open in the browser.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
skills_dest="$HOME/.claude/skills"
cmds_dest="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands"
grasp_home="${GRASP_HOME:-$HOME/.grasp}"
voice_dir="$grasp_home/_voice"
voice_js="$skills_dest/grasp-explain/voice.mjs"
editor_js="$here/skills/grasp-explain/editor.mjs"
uninstall=false
voice=true
editor=true
for arg in "$@"; do
  case "$arg" in
    --uninstall) uninstall=true ;;
    --no-voice) voice=false ;;
    --no-editor) editor=false ;;
    *) echo "usage: ./install.sh [--no-voice] [--no-editor] [--uninstall]" >&2; exit 1 ;;
  esac
done
has_node=false
command -v node >/dev/null 2>&1 && has_node=true

n_skills=0
for d in "$here"/skills/*/; do
  [ -f "$d/SKILL.md" ] || continue
  name="$(basename "$d")"
  rm -rf "$skills_dest/$name"
  if ! $uninstall; then mkdir -p "$skills_dest"; cp -R "${d%/}" "$skills_dest/"; fi
  n_skills=$((n_skills + 1))
done

n_cmds=0
for f in "$here"/opencode/commands/*.md; do
  rm -f "$cmds_dest/$(basename "$f")"
  if ! $uninstall; then mkdir -p "$cmds_dest"; cp "$f" "$cmds_dest/"; fi
  n_cmds=$((n_cmds + 1))
done

if $uninstall; then
  if [ -d "$voice_dir" ]; then rm -rf "$voice_dir"; echo "Removed the walkthrough voice from $voice_dir."; fi
  if $has_node; then node "$editor_js" uninstall; fi
  echo "Removed $n_skills grasp skills from $skills_dest and $n_cmds commands from $cmds_dest."
  echo "Your journals and deck in $grasp_home were left alone."
else
  echo "Installed $n_skills skills  -> $skills_dest  (Claude Code + OpenCode)"
  echo "Installed $n_cmds commands -> $cmds_dest  (OpenCode /grasp...)"
  if ! $voice; then
    echo "Skipped the walkthrough voice (--no-voice). Walkthroughs speak with the browser's voice."
  elif ! $has_node; then
    echo "Node 18+ wasn't found, so the walkthrough voice was skipped. Walkthroughs speak with the browser's voice."
  else
    echo "Installing the walkthrough voice: Kokoro, on this machine (about 750 MB the first time; --no-voice skips it)"
    node "$voice_js" install || echo "The voice didn't install, so walkthroughs speak with the browser's voice. Retry with: node \"$voice_js\" install"
  fi
  if ! $editor; then
    echo "Skipped the editor extension (--no-editor). Walkthroughs open in the browser."
  elif $has_node; then
    echo "Installing the walkthrough extension, so walkthroughs play beside the code in VS Code or Cursor (--no-editor skips it)"
    node "$editor_js" install || true
  fi
  echo "Try it: /grasp <task>   (restart Claude Code or OpenCode if it's already running)"
fi
