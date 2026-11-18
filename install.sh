#!/usr/bin/env bash
# Install the grasp skills for Claude Code and OpenCode, with the walkthrough voice.
#   skills/*            -> ~/.claude/skills   (Claude Code and OpenCode both read it)
#   opencode/commands/* -> ~/.config/opencode/commands   (OpenCode /grasp commands)
#   walkthrough voice   -> ~/.grasp/_voice   (Kokoro, a text-to-speech model that runs on this machine; about 750 MB, once)
# Usage: ./install.sh [--no-voice] [--uninstall]   Re-run to update. Only grasp's own folders and files are touched.
# Without the voice, walkthroughs speak with the browser's voice.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
skills_dest="$HOME/.claude/skills"
cmds_dest="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands"
grasp_home="${GRASP_HOME:-$HOME/.grasp}"
voice_dir="$grasp_home/_voice"
voice_js="$skills_dest/grasp-explain/voice.mjs"
uninstall=false
voice=true
for arg in "$@"; do
  case "$arg" in
    --uninstall) uninstall=true ;;
    --no-voice) voice=false ;;
    *) echo "usage: ./install.sh [--no-voice] [--uninstall]" >&2; exit 1 ;;
  esac
done

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
  echo "Removed $n_skills grasp skills from $skills_dest and $n_cmds commands from $cmds_dest."
  echo "Your journals and deck in $grasp_home were left alone."
else
  echo "Installed $n_skills skills  -> $skills_dest  (Claude Code + OpenCode)"
  echo "Installed $n_cmds commands -> $cmds_dest  (OpenCode /grasp...)"
  if ! $voice; then
    echo "Skipped the walkthrough voice (--no-voice). Walkthroughs speak with the browser's voice."
  elif ! command -v node >/dev/null 2>&1; then
    echo "Node 18+ wasn't found, so the walkthrough voice was skipped. Walkthroughs speak with the browser's voice."
  else
    echo "Installing the walkthrough voice: Kokoro, on this machine (about 750 MB the first time; --no-voice skips it)"
    node "$voice_js" install || echo "The voice didn't install, so walkthroughs speak with the browser's voice. Retry with: node \"$voice_js\" install"
  fi
  echo "Try it: /grasp <task>   (restart Claude Code or OpenCode if it's already running)"
fi
