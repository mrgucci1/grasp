<#
.SYNOPSIS
  Install the grasp skills for Claude Code and OpenCode.
.DESCRIPTION
  Copies skills/* to ~/.claude/skills (Claude Code and OpenCode both read it) and
  opencode/commands/*.md to ~/.config/opencode/commands (OpenCode /grasp commands).
  Re-run to update. Only grasp's own folders and files are touched.
.EXAMPLE
  ./install.ps1
  ./install.ps1 -Uninstall
#>
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'

$skillsSrc  = Join-Path $PSScriptRoot 'skills'
$skillsDest = Join-Path $HOME '.claude\skills'
$cmdsSrc    = Join-Path $PSScriptRoot 'opencode\commands'
$cmdsDest   = Join-Path $HOME '.config\opencode\commands'

$skills = Get-ChildItem $skillsSrc -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'SKILL.md') }
foreach ($s in $skills) {
  $dest = Join-Path $skillsDest $s.Name
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  if (-not $Uninstall) {
    New-Item -ItemType Directory -Force $skillsDest | Out-Null
    Copy-Item $s.FullName $dest -Recurse
  }
}

$cmds = Get-ChildItem $cmdsSrc -Filter '*.md'
foreach ($c in $cmds) {
  $dest = Join-Path $cmdsDest $c.Name
  if (Test-Path $dest) { Remove-Item $dest -Force }
  if (-not $Uninstall) {
    New-Item -ItemType Directory -Force $cmdsDest | Out-Null
    Copy-Item $c.FullName $dest
  }
}

if ($Uninstall) {
  "Removed $($skills.Count) grasp skills from $skillsDest and $($cmds.Count) commands from $cmdsDest."
  "Your journals and deck in ~/.grasp were left alone."
} else {
  "Installed $($skills.Count) skills  -> $skillsDest  (Claude Code + OpenCode)"
  "Installed $($cmds.Count) commands -> $cmdsDest  (OpenCode /grasp...)"
  "Try it: /grasp <task>   (restart Claude Code or OpenCode if it's already running)"
}
