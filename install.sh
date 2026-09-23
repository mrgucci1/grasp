#!/usr/bin/env bash
# Install the grasp skills for Claude Code and OpenCode.
#   skills/*            -> ~/.claude/skills   (Claude Code and OpenCode both read it)
#   opencode/commands/* -> ~/.config/opencode/commands   (OpenCode /grasp commands)
# Usage: ./install.sh [--uninstall]   Re-run to update. Only grasp's own folders and files are touched.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
skills_dest="$HOME/.claude/skills"
cmds_dest="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands"
uninstall=false
[ "${1:-}" = "--uninstall" ] && uninstall=true

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
  echo "Removed $n_skills grasp skills from $skills_dest and $n_cmds commands from $cmds_dest."
  echo "Your journals and deck in ~/.grasp were left alone."
else
  echo "Installed $n_skills skills  -> $skills_dest  (Claude Code + OpenCode)"
  echo "Installed $n_cmds commands -> $cmds_dest  (OpenCode /grasp...)"
  echo "Try it: /grasp <task>   (restart Claude Code or OpenCode if it's already running)"
fi
