#!/usr/bin/env node
// grasp in your editor: play a walkthrough beside the real code in VS Code or Cursor, and install the extension that does it.
//
//   node editor.mjs open <explain.html> [--in vscode|cursor|browser]   in the editor when its extension is there, else the browser
//   node editor.mjs install [vscode|cursor]   pack the extension (vscode/, beside this file) and install it in each editor found
//   node editor.mjs status                    which editors have it
//   node editor.mjs pack [<file.vsix>]        only write the .vsix, for "Extensions: Install from VSIX…"
//   node editor.mjs uninstall                 remove it from each editor
//
// `open` writes ~/.grasp/_editor/open.json and runs `code <repo>`. The extension in the window that has the repo open
// claims that request and plays the walkthrough. Nothing here needs npm or the network.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { graspHome, readSettings } from './voice.mjs';

const self = fileURLToPath(import.meta.url), src = join(dirname(self), 'vscode');
const PKG = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8')), ID = `${PKG.publisher}.${PKG.name}`;
const win = process.platform === 'win32', mac = process.platform === 'darwin';
const quit = msg => { console.error(msg); process.exit(1); };

// The editors grasp knows: the command that installs into it, where it keeps extensions, and its app on macOS.
const EDITORS = {
  vscode: { name: 'VS Code', cli: 'code', dir: join(homedir(), '.vscode', 'extensions'), app: 'Visual Studio Code', macCli: '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code' },
  cursor: { name: 'Cursor', cli: 'cursor', dir: join(homedir(), '.cursor', 'extensions'), app: 'Cursor', macCli: '/Applications/Cursor.app/Contents/Resources/app/bin/cursor' },
};

function which(ed) {
  const e = EDITORS[ed], [bin, args] = win ? ['where.exe', [e.cli]] : ['sh', ['-c', 'command -v "$0"', e.cli]];
  try {
    const out = execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/).filter(Boolean);
    const hit = win ? out.find(p => /\.cmd$/i.test(p)) || out.find(p => /\.exe$/i.test(p)) : out[0];
    if (hit) return hit;
  } catch { /* not on PATH */ }
  return mac && existsSync(e.macCli) ? e.macCli : null;
}
// A Windows command line run through cmd.exe, passed verbatim so its quotes keep paths with spaces in one piece.
const viaCmd = line => [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${line}"`], { windowsVerbatimArguments: true }];
function detached(cmd, argv, opts = {}) {
  const p = spawn(cmd, argv, { ...opts, detached: true, stdio: 'ignore', windowsHide: true });
  p.on('error', () => {});
  p.unref();
}
// Runs an editor's command line (code.cmd needs cmd.exe on Windows): to completion, or detached to open a window.
function cli(path, args, detach) {
  const [cmd, argv, opts] = win && /\.cmd$/i.test(path) ? viaCmd([path, ...args].map(a => `"${a}"`).join(' ')) : [path, args, {}];
  if (detach) return detached(cmd, argv, opts);
  return spawnSync(cmd, argv, { ...opts, encoding: 'utf8', windowsHide: true, timeout: 120000 });
}
// The installed version, or null. An uninstalled extension can linger on disk until a restart, listed in .obsolete.
function installedIn(ed) {
  const dir = EDITORS[ed].dir;
  let gone = {};
  try { gone = JSON.parse(readFileSync(join(dir, '.obsolete'), 'utf8')); } catch { /* nothing pending removal */ }
  try { return readdirSync(dir).filter(n => n.toLowerCase().startsWith(`${ID}-`) && !gone[n]).map(n => n.slice(ID.length + 1)).pop() || null; } catch { return null; }
}

// ---- the .vsix: a zip of the extension under extension/, plus two small manifests -------------------------------------
const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc32 = buf => { let c = ~0; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return ~c >>> 0; };
function zip(files) {
  const parts = [], dir = [], DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // a fixed date: the same sources make the same bytes
  let at = 0;
  for (const [name, data] of files) {
    const n = Buffer.from(name), body = deflateRawSync(data, { level: 9 }), head = Buffer.alloc(30), ent = Buffer.alloc(46);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8); head.writeUInt16LE(DATE, 12);
    head.writeUInt32LE(crc32(data), 14); head.writeUInt32LE(body.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(n.length, 26);
    // The central directory entry repeats the local header's fields (version to name length), then adds where it starts.
    ent.writeUInt32LE(0x02014b50, 0); ent.writeUInt16LE(20, 4); head.copy(ent, 6, 4, 30); ent.writeUInt32LE(at, 42);
    parts.push(head, n, body);
    dir.push(ent, n);
    at += 30 + n.length + body.length;
  }
  const cd = Buffer.concat(dir), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(at, 16);
  return Buffer.concat([...parts, cd, end]);
}
function vsix() {
  const files = [], x = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const walk = (d, rel) => readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .forEach(e => e.isDirectory() ? walk(join(d, e.name), `${rel}${e.name}/`) : files.push([`extension/${rel}${e.name}`, readFileSync(join(d, e.name))]));
  walk(src, '');
  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${x(PKG.name)}" Version="${x(PKG.version)}" Publisher="${x(PKG.publisher)}"/>
    <DisplayName>${x(PKG.displayName)}</DisplayName>
    <Description xml:space="preserve">${x(PKG.description)}</Description>
    <Tags>${x(PKG.keywords.join(','))}</Tags>
    <Categories>${x(PKG.categories.join(','))}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${x(PKG.engines.vscode)}"/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="${x(PKG.extensionKind.join(','))}"/>
      <Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value=""/>
      <Property Id="Microsoft.VisualStudio.Services.GitHubFlavoredMarkdown" Value="true"/>
    </Properties>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>
  </Assets>
</PackageManifest>
`;
  const types = '<?xml version="1.0" encoding="utf-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    [['json', 'application/json'], ['js', 'application/javascript'], ['md', 'text/markdown'], ['svg', 'image/svg+xml'], ['vsixmanifest', 'text/xml']]
      .map(([e, t]) => `<Default Extension=".${e}" ContentType="${t}"/>`).join('') + '</Types>\n';
  return zip([['extension.vsixmanifest', Buffer.from(manifest)], ['[Content_Types].xml', Buffer.from(types)], ...files]);
}

// ---- commands ------------------------------------------------------------------------------------------------------------
function install(only) {
  const file = join(tmpdir(), `${PKG.name}-${PKG.version}.vsix`);
  writeFileSync(file, vsix());
  let n = 0;
  for (const ed of only ? [only] : Object.keys(EDITORS)) {
    const e = EDITORS[ed], c = which(ed);
    if (!c) { if (only) console.log(`editor: ${e.name} wasn't found (no "${e.cli}" command on PATH)`); continue; }
    const r = cli(c, ['--install-extension', file, '--force']);
    if (r.status === 0) { n++; console.log(`editor: installed the grasp walkthrough extension ${PKG.version} in ${e.name}`); }
    else console.log(`editor: ${e.name} didn't install it: ${String(r.stderr || r.stdout || r.error?.message || 'no output').trim().split('\n').pop()}`);
  }
  rmSync(file, { force: true });
  if (n) console.log('editor: walkthroughs now open beside the code. If that editor is already open, run "Developer: Reload Window" in it once.');
  else if (!only) console.log('editor: neither VS Code nor Cursor was found (no "code" or "cursor" command on PATH), so walkthroughs open in the browser.');
}

function uninstall() {
  for (const ed of Object.keys(EDITORS)) {
    const c = installedIn(ed) && which(ed);
    if (!c) continue;
    const r = cli(c, ['--uninstall-extension', ID]);
    console.log(r.status === 0 ? `editor: removed the grasp walkthrough extension from ${EDITORS[ed].name}` : `editor: ${EDITORS[ed].name} didn't remove it: ${String(r.stderr || r.stdout).trim()}`);
  }
}

// The same tag the extension reads (vscode/extension.js readTour); template.html puts the tour data in it.
function tourOf(file) {
  const m = /<script id="tour" type="application\/json">([\s\S]*?)<\/script>/.exec(readFileSync(file, 'utf8'));
  if (!m) quit(`${file}: not a grasp walkthrough`);
  return JSON.parse(m[1]);
}

function open(file, want) {
  file = resolve(file);
  if (!existsSync(file)) quit(`${file}: not found`);
  const T = tourOf(file), settings = readSettings();
  const to = want || settings.walkthrough || (settings.editor === 'none' ? 'browser' : EDITORS[settings.editor] ? settings.editor : 'vscode');
  if (to !== 'browser' && !EDITORS[to]) quit(`--in "${to}": must be vscode, cursor or browser`);
  let why = '';
  if (to !== 'browser') {
    const e = EDITORS[to];
    if (!T.root) why = 'this page was built before grasp 0.5; build it again to play it in the editor';
    else if (!existsSync(T.root)) why = `the repo isn't at ${T.root} any more; build the walkthrough again from where it is now`;
    else if (!installedIn(to)) why = `the grasp extension isn't in ${e.name}; add it with: node "${self}" install`;
    const c = !why && which(to);
    if (!why && !c && !mac) why = `${e.name} wasn't found (no "${e.cli}" command on PATH)`;
    if (!why) {
      // Always ~/.grasp/_editor, even with GRASP_HOME set: an editor started from a dock or menu doesn't see that variable.
      // `home` tells the extension where the walkthroughs live, for its "Open Walkthrough…" list.
      const dir = join(homedir(), '.grasp', '_editor'), tmp = join(dir, `open.${process.pid}.tmp`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(tmp, JSON.stringify({ html: file, repo: T.root, app: to, home: graspHome(), at: Date.now() }, null, 2));
      renameSync(tmp, join(dir, 'open.json')); // whole or not at all: the windows watching never read half a request
      if (c) cli(c, [T.root], true);
      else detached('open', ['-a', e.app, T.root]);
      console.log(`opened in ${e.name}: ${T.root} · the walkthrough plays in a panel beside the code`);
      return;
    }
  }
  if (win) detached(...viaCmd(`start "" "${file}"`));
  else detached(mac ? 'open' : 'xdg-open', [file]);
  console.log(`opened in the browser: ${file}${why ? ` · not in the editor because ${why}` : ''}`);
}

const argv = process.argv.slice(2), at = argv.indexOf('--in'), want = at < 0 ? undefined : argv.splice(at, 2)[1];
const [cmd = 'status', arg] = argv;
if (cmd === 'open') { if (!arg) quit('usage: node editor.mjs open <explain.html> [--in vscode|cursor|browser]'); open(arg, want); }
else if (cmd === 'install') { if (arg && !EDITORS[arg]) quit(`install: "${arg}", must be vscode or cursor`); install(arg); }
else if (cmd === 'status') for (const [ed, e] of Object.entries(EDITORS)) {
  const v = installedIn(ed);
  console.log(`${e.name.padEnd(8)} ${v ? `grasp walkthrough ${v} installed` : which(ed) ? `found, extension not installed · node "${self}" install` : 'not found'}`);
}
else if (cmd === 'pack') { const out = resolve(arg || `${PKG.name}-${PKG.version}.vsix`); writeFileSync(out, vsix()); console.log(out); }
else if (cmd === 'uninstall') uninstall();
else quit('usage: node editor.mjs open <explain.html> [--in vscode|cursor|browser] | install [vscode|cursor] | status | pack [file.vsix] | uninstall');
