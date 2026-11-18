<#
.SYNOPSIS
  Install the grasp skills for Claude Code and OpenCode, with the walkthrough voice.
.DESCRIPTION
  Copies skills/* to ~/.claude/skills (Claude Code and OpenCode both read it) and
  opencode/commands/*.md to ~/.config/opencode/commands (OpenCode /grasp commands).
  Then installs the walkthrough voice: Kokoro, a text-to-speech model that runs on this
  machine, under ~/.grasp/_voice (about 750 MB, downloaded once). -NoVoice skips it, and
  walkthroughs then speak with the browser's voice.
  Re-run to update. Only grasp's own folders and files are touched.
.EXAMPLE
  ./install.ps1
  ./install.ps1 -NoVoice
  ./install.ps1 -Uninstall
#>
param([switch]$Uninstall, [switch]$NoVoice)
$ErrorActionPreference = 'Stop'

$skillsSrc  = Join-Path $PSScriptRoot 'skills'
$skillsDest = Join-Path $HOME '.claude\skills'
$cmdsSrc    = Join-Path $PSScriptRoot 'opencode\commands'
$cmdsDest   = Join-Path $HOME '.config\opencode\commands'
$graspHome  = if ($env:GRASP_HOME) { $env:GRASP_HOME } else { Join-Path $HOME '.grasp' }
$voiceDir   = Join-Path $graspHome '_voice'
$voiceJs    = Join-Path $skillsDest 'grasp-explain\voice.mjs'

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
  if (Test-Path $voiceDir) { Remove-Item $voiceDir -Recurse -Force; "Removed the walkthrough voice from $voiceDir." }
  "Removed $($skills.Count) grasp skills from $skillsDest and $($cmds.Count) commands from $cmdsDest."
  "Your journals and deck in $graspHome were left alone."
} else {
  "Installed $($skills.Count) skills  -> $skillsDest  (Claude Code + OpenCode)"
  "Installed $($cmds.Count) commands -> $cmdsDest  (OpenCode /grasp...)"
  if ($NoVoice) {
    "Skipped the walkthrough voice (-NoVoice). Walkthroughs speak with the browser's voice."
  } elseif (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    "Node 18+ wasn't found, so the walkthrough voice was skipped. Walkthroughs speak with the browser's voice."
  } else {
    "Installing the walkthrough voice: Kokoro, on this machine (about 750 MB the first time; -NoVoice skips it)"
    & node $voiceJs install
    if ($LASTEXITCODE -ne 0) { "The voice didn't install, so walkthroughs speak with the browser's voice. Retry with: node `"$voiceJs`" install" }
  }
  "Try it: /grasp <task>   (restart Claude Code or OpenCode if it's already running)"
}
