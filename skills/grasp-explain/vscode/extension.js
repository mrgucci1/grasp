// grasp walkthrough, for VS Code and Cursor.
// grasp-explain builds explain.html, a narrated walkthrough of a change. This extension plays that page in a panel beside the
// editor and drives the editor with it: it opens each stop's file, lights up the lines the voice is talking about, fades the
// rest, boxes the identifiers it names, and switches files when the walkthrough steps into a method. Nothing leaves this machine.
//
// How a walkthrough arrives: grasp-explain's editor.mjs writes ~/.grasp/_editor/open.json and runs `code <repo>`. Every
// window watches that file; the one with exactly that repo open claims it by renaming it, then plays it.
'use strict';
const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const FRESH_MS = 2 * 60 * 1000; // an open request older than this is ignored
let ctx, log, bar, deco; // log, bar and deco are made on first use, so windows that never play a walkthrough carry nothing
let panel = null;
let run = null; // the walkthrough on screen: { tour, root, view, seq, playing, where, shifts, cmdAt }

const cfg = key => vscode.workspace.getConfiguration('grasp').get(key);
// Where the walkthroughs live: the setting, $GRASP_HOME, or the home the last open request came from (an editor started
// from a dock or menu doesn't see $GRASP_HOME), else ~/.grasp.
const home = () => path.resolve(cfg('home') || process.env.GRASP_HOME || ctx.globalState.get('grasp.home') || path.join(os.homedir(), '.grasp'));
// The hand-off is always under ~/.grasp, for that same reason; the request carries the walkthrough's full path.
const inbox = () => path.join(os.homedir(), '.grasp', '_editor');
const folders = () => (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);
const say = line => {
  if (!log) ctx.subscriptions.push(log = vscode.window.createOutputChannel('grasp'));
  log.appendLine(line);
};

function activate(context) {
  ctx = context;
  const send = cmd => () => { if (!panel) return; run.cmdAt = Date.now(); panel.webview.postMessage({ type: 'cmd', cmd }); };
  context.subscriptions.push(
    vscode.commands.registerCommand('grasp.open', pick),
    vscode.commands.registerCommand('grasp.toggle', send('toggle')),
    vscode.commands.registerCommand('grasp.nextStop', send('next')),
    vscode.commands.registerCommand('grasp.prevStop', send('prev')),
    vscode.commands.registerCommand('grasp.nextSentence', send('fwd')),
    vscode.commands.registerCommand('grasp.prevSentence', send('back')),
    vscode.commands.registerCommand('grasp.close', () => { if (panel) panel.dispose(); }),
    // Decorations belong to an editor; switching tabs makes a new one, so paint again whenever the visible editors change.
    vscode.window.onDidChangeVisibleTextEditors(() => { if (run) paintAll(); }));
  watchInbox();
}

function deactivate() { if (panel) panel.dispose(); }

// ---- the editor side: what the voice is talking about, shown on the real code ---------------------------------------
function decorations() {
  const c = id => new vscode.ThemeColor(id), make = o => vscode.window.createTextEditorDecorationType(o);
  const all = {
    dim: make({ opacity: '0.42' }),
    focus: make({ isWholeLine: true, backgroundColor: c('grasp.focusBackground') }),
    spot: make({ isWholeLine: true, backgroundColor: c('grasp.spotlightBackground'), borderColor: c('grasp.spotlightBorder'), borderStyle: 'solid', borderWidth: '0 0 0 3px',
      overviewRulerColor: c('grasp.spotlightBorder'), overviewRulerLane: vscode.OverviewRulerLane.Full }),
    name: make({ backgroundColor: c('grasp.identifierBackground'), borderColor: c('grasp.identifierBorder'), borderStyle: 'solid', borderWidth: '1px', borderRadius: '3px' }),
    added: make({ gutterIconPath: vscode.Uri.joinPath(ctx.extensionUri, 'media', 'added.svg'), gutterIconSize: 'contain',
      overviewRulerColor: c('grasp.addedForeground'), overviewRulerLane: vscode.OverviewRulerLane.Left }),
    gone: make({ isWholeLine: true, borderColor: c('grasp.removedForeground'), borderStyle: 'dashed', borderWidth: '1px 0 0 0',
      after: { color: c('grasp.removedForeground'), margin: '0 0 0 2.5em', fontStyle: 'italic' } }),
    note: make({ after: { color: c('grasp.annotationForeground'), margin: '0 0 0 2.5em', fontStyle: 'italic' } }),
  };
  ctx.subscriptions.push(...Object.values(all));
  return all;
}

// Line numbers in the tour are from build time. If the file was edited since, find the stop's lines again nearby.
function shift(doc, s) {
  const key = `${s.file}:${s.lines[0]}:${doc.version}`;
  if (run.shifts.has(key)) return run.shifts.get(key);
  const want = (s.code || []).map(l => l.trimEnd()), a = s.lines[0] - 1, n = doc.lineCount;
  const at = i => i >= 0 && i + want.length <= n && want.every((l, j) => doc.lineAt(i + j).text.trimEnd() === l);
  let d = 0;
  if (want.length && !at(a)) {
    for (let k = 1; k < n && !d; k++) d = at(a - k) ? -k : at(a + k) ? k : 0;
    say(d ? `${s.file}: lines moved by ${d} since the walkthrough was built; following them`
      : `${s.file}: changed since the walkthrough was built; highlights use the old line numbers`);
  }
  run.shifts.set(key, d);
  return d;
}
// A tour line (1-based) to a document line (0-based), moved by d and kept inside the document.
const docLine = (doc, d, n) => Math.min(doc.lineCount - 1, Math.max(0, n - 1 + d));

function paintAll() { for (const ed of vscode.window.visibleTextEditors) paint(ed); }
// run.view holds what the page says this sentence lights up: spot (its lines, or null for a preview), names and gone.
function paint(ed) {
  if (!deco) return;
  const v = run && run.view, sets = Object.fromEntries(Object.keys(deco).map(k => [k, []]));
  if (v && ed.document.uri.toString() === v.uri) {
    const s = run.tour.stops[v.stop], doc = ed.document, N = doc.lineCount, L = n => docLine(doc, v.d, n);
    const span = (a, b) => new vscode.Range(L(a), 0, L(b), doc.lineAt(L(b)).text.length);
    const [fa, fb] = s.focus;
    if (v.spot) {
      const [a, b] = v.spot, top = L(a), end = Math.max(L(b), ...v.gone.map(x => L(x.line)));
      sets.spot.push(span(a, b));
      for (let n = fa; n <= fb; n++) if (n < a || n > b) sets.focus.push(span(n, n));
      if (cfg('dimOtherLines') !== false) {
        if (top > 0) sets.dim.push(new vscode.Range(0, 0, top - 1, doc.lineAt(top - 1).text.length));
        if (end < N - 1) sets.dim.push(new vscode.Range(end + 1, 0, N - 1, doc.lineAt(N - 1).text.length));
      }
      if (v.names.length) {
        const re = new RegExp('(?<![\\w$])(' + v.names.map(x => x.replace(/[$]/g, '\\$')).join('|') + ')(?![\\w$])', 'g');
        for (let i = top; i <= L(b); i++) {
          const t = doc.lineAt(i).text;
          let m;
          re.lastIndex = 0;
          while ((m = re.exec(t))) sets.name.push(new vscode.Range(i, m.index, i, m.index + m[0].length));
        }
      }
      v.gone.forEach(x => sets.gone.push({ range: span(x.line, x.line),
        renderOptions: { after: { contentText: `− ${x.n} line${x.n > 1 ? 's' : ''} removed above this line · the old code is in the grasp panel` } } }));
    } else sets.focus.push(span(fa, fb)); // a preview from the overview: the stop's key lines, nothing faded
    (s.added || []).forEach(n => sets.added.push(span(n, n)));
    const notes = new Map(), add = (n, text) => { if (Number.isInteger(n)) notes.set(n, (notes.has(n) ? notes.get(n) + '   ' : '') + text); };
    if (s.in) add(s.in.line, (s.role === 'entry' ? '◀ entry · ' : '◀ in · ') + s.in.label);
    (s.notes || []).forEach((t, k) => add(t.line, `● ${k + 1} · ${t.text}`));
    if (s.out) add(s.out.line, (s.role === 'exit' ? '▶ exit · ' : '▶ out · ') + s.out.label);
    notes.forEach((text, n) => sets.note.push({ range: span(n, n), renderOptions: { after: { contentText: text } } }));
  }
  for (const k of Object.keys(deco)) ed.setDecorations(deco[k], sets[k]);
}

// Code goes in the editor group the panel isn't in.
const codeColumn = () => (panel && panel.viewColumn === vscode.ViewColumn.One ? vscode.ViewColumn.Two : vscode.ViewColumn.One);
async function showFile(s) {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(run.root, s.file)));
  return vscode.window.visibleTextEditors.find(e => e.document === doc && e.viewColumn !== undefined) ||
    vscode.window.showTextDocument(doc, { viewColumn: codeColumn(), preserveFocus: true, preview: true });
}

// The page says what it's on and what it lights up; the editor follows.
async function cue(m) {
  const seq = ++run.seq, S = run.tour.stops;
  const i = m.kind === 'stop' ? m.stop : m.chip ? m.chip - 1 : -1;
  if (!S[i]) { // overview or recap, naming no stop: the overview keeps the last stop's key lines lit; the recap clears
    run.view = m.kind === 'intro' && run.view ? { ...run.view, spot: null, names: [], gone: [] } : null;
    return paintAll();
  }
  const s = S[i], spot = m.kind === 'stop' ? m.spot : null;
  let ed;
  try { ed = await showFile(s); } catch (e) { say(`can't open ${s.file}: ${e.message}`); return; }
  if (!run || seq !== run.seq) return; // a newer cue arrived while the file opened
  const d = shift(ed.document, s), r = spot || s.focus;
  run.view = { uri: ed.document.uri.toString(), stop: i, d, spot, names: spot ? m.names || [] : [], gone: spot ? m.gone || [] : [] };
  paintAll();
  ed.revealRange(new vscode.Range(docLine(ed.document, d, r[0]), 0, docLine(ed.document, d, r[1]), 0),
    m.k === 0 || !spot ? vscode.TextEditorRevealType.InCenter : vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

function status() {
  if (!run) return void (bar && bar.hide());
  if (!bar) { ctx.subscriptions.push(bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)); bar.command = 'grasp.toggle'; }
  bar.text = `${run.playing ? '$(debug-pause)' : '$(play)'} grasp${run.where ? ' · ' + run.where : ''}`;
  bar.tooltip = `grasp walkthrough · ${run.tour.title}\n${run.playing ? 'Pause' : 'Play'}: click, or Ctrl+Alt+Space`;
  bar.show();
}

// ---- the panel: explain.html itself, told it's inside the editor ------------------------------------------------------
// The same tag editor.mjs reads (tourOf); template.html puts the tour data in it.
function readTour(file) {
  const html = fs.readFileSync(file, 'utf8'), m = /<script id="tour" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('no walkthrough data in it');
  return { html, tour: JSON.parse(m[1]) };
}

function page(webview, html, dir) {
  const nonce = crypto.randomBytes(18).toString('base64'), src = webview.cspSource;
  const base = webview.asWebviewUri(vscode.Uri.file(dir)).toString().replace(/\/?$/, '/'); // so audio/<clip>.wav loads
  const csp = `default-src 'none'; img-src ${src} data:; media-src ${src} blob:; style-src ${src} 'unsafe-inline'; font-src ${src}; script-src 'nonce-${nonce}'`;
  const boot = JSON.stringify({ settings: ctx.globalState.get('grasp.player', {}) }).replace(/</g, '\\u003c');
  return html.replace(/<script(?=[\s>])/g, () => `<script nonce="${nonce}"`).replace(/<head>/i, () =>
    `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<base href="${base}">\n<script nonce="${nonce}">window.__grasp = ${boot};</script>`);
}

async function open(file) {
  let data;
  try { data = readTour(file); } catch (e) { return void vscode.window.showErrorMessage(`grasp: can't open ${file}: ${e.message}`); }
  if (!data.html.includes('acquireVsCodeApi')) {
    const go = await vscode.window.showWarningMessage('grasp: this walkthrough was built before grasp 0.5, so it plays only in the browser. Build it again to walk through it here.', 'Open in Browser');
    if (go) vscode.env.openExternal(vscode.Uri.file(file));
    return;
  }
  const T = data.tour, root = (T.root && fs.existsSync(T.root) && T.root) || folders().find(f => path.basename(f) === T.repo) || folders()[0];
  if (!root) return void vscode.window.showErrorMessage(`grasp: open the ${T.repo || 'repo'} folder first, then run "grasp: Open Walkthrough…" again.`);
  if (panel) panel.dispose();
  if (!deco) deco = decorations();
  run = { tour: T, root, view: null, seq: 0, playing: false, where: '', shifts: new Map(), cmdAt: 0 };
  // Code on the left, the panel on the right. With at most one editor group, split 62/38 first and put the panel in the
  // second; the code opens in the first when the page is ready. With more groups, leave the user's layout alone.
  const split = vscode.window.tabGroups.all.length <= 1;
  if (split) await vscode.commands.executeCommand('vscode.setEditorLayout', { orientation: 0, groups: [{ size: 0.62 }, { size: 0.38 }] }).then(undefined, e => say(`layout: ${e.message}`));
  const dir = path.dirname(file);
  const me = panel = vscode.window.createWebviewPanel('grasp.walkthrough', `grasp · ${T.title}`, { viewColumn: split ? vscode.ViewColumn.Two : vscode.ViewColumn.Beside, preserveFocus: false },
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.file(dir)] });
  me.iconPath = vscode.Uri.joinPath(ctx.extensionUri, 'media', 'icon.svg');
  me.webview.onDidReceiveMessage(onMessage);
  me.onDidDispose(() => { if (panel !== me) return; panel = run = null; paintAll(); status(); vscode.commands.executeCommand('setContext', 'grasp.walkthrough', false); });
  me.webview.html = page(me.webview, data.html, dir);
  vscode.commands.executeCommand('setContext', 'grasp.walkthrough', true);
  status();
  say(`playing ${file} · code from ${root}`);
}

async function onMessage(m) {
  if (!run || !m) return;
  if (m.type === 'cue') cue(m).catch(e => say(`cue: ${e.stack || e.message}`));
  else if (m.type === 'state') { run.playing = !!m.playing; run.where = m.where || ''; status(); }
  else if (m.type === 'set') ctx.globalState.update('grasp.player', { ...ctx.globalState.get('grasp.player', {}), [m.key]: m.value });
  else if (m.type === 'ready') {
    // The page has loaded: show stop 1's key lines, then start talking unless the user turned that off.
    await cue({ kind: 'intro', chip: 1 }).catch(e => say(`cue: ${e.message}`));
    if (panel && cfg('autoplay') !== false) panel.webview.postMessage({ type: 'cmd', cmd: 'toggle' });
  } else if (m.type === 'blocked') {
    // The editor allows sound in a panel only after a key press or click inside it. Focus the panel so Space starts it.
    if (panel) panel.reveal(undefined, false);
    run.where = 'press Space in the panel to start';
    status();
    if (Date.now() - run.cmdAt < 3000) vscode.window.showInformationMessage('grasp: press Space or click Play in the walkthrough panel once to turn its sound on. After that, the status bar and Ctrl+Alt+Space work too.');
  }
}

// "grasp: Open Walkthrough…": the walkthroughs under the grasp home, newest first, this workspace's repos on top.
// build.mjs puts each walkthrough's title in its <title>, so the list reads only the start of each page.
function titleOf(file, fallback) {
  try {
    const buf = Buffer.alloc(4096), fd = fs.openSync(file, 'r'), n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const m = /<title>([^<]*) · grasp<\/title>/.exec(buf.toString('utf8', 0, n));
    return m ? m[1].replace(/&(lt|gt|quot|amp);/g, (_, e) => ({ lt: '<', gt: '>', quot: '"', amp: '&' }[e])) : fallback;
  } catch { return fallback; }
}
async function pick() {
  const top = home(), found = [], dirs = p => { try { return fs.readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('_')).map(d => d.name); } catch { return []; } };
  for (const repo of dirs(top)) for (const branch of dirs(path.join(top, repo))) {
    const f = path.join(top, repo, branch, 'explain.html');
    try { found.push({ f, t: fs.statSync(f).mtimeMs, repo, branch }); } catch { /* no walkthrough built here */ }
  }
  const here = new Set(folders().map(f => path.basename(f)));
  found.sort((a, b) => (here.has(b.repo) - here.has(a.repo)) || b.t - a.t);
  const items = found.slice(0, 25).map(x => ({ label: titleOf(x.f, x.branch), description: `${x.repo} / ${x.branch}`, detail: `built ${new Date(x.t).toLocaleString()}`, file: x.f }));
  items.push({ label: '$(folder-opened) Browse for an explain.html…', file: null });
  const it = await vscode.window.showQuickPick(items, { placeHolder: found.length ? 'Pick a walkthrough to play beside the code' : `No walkthroughs under ${top} yet`, matchOnDescription: true });
  if (!it) return;
  let file = it.file;
  if (!file) {
    const u = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { 'grasp walkthrough': ['html'] }, defaultUri: vscode.Uri.file(top) });
    if (!u) return;
    file = u[0].fsPath;
  }
  open(file);
}

// ---- open requests from grasp-explain ---------------------------------------------------------------------------------
let timer = 0;
function later(ms = 150) { clearTimeout(timer); timer = setTimeout(claim, ms); }
function watchInbox() {
  try {
    fs.mkdirSync(inbox(), { recursive: true });
    const w = fs.watch(inbox(), () => later());
    ctx.subscriptions.push({ dispose: () => w.close() });
  } catch (e) {
    say(`can't watch ${inbox()}: ${e.message}; checking for walkthroughs when this window gets focus instead`);
    ctx.subscriptions.push(vscode.window.onDidChangeWindowState(s => { if (s.focused) later(); }));
  }
  later(0);
}
// editor.mjs runs `code <repo>`, which focuses or opens a window on exactly that folder, so only an exact match claims it.
function claim() {
  const f = path.join(inbox(), 'open.json'), read = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
  const req = read(f);
  if (!req || typeof req.html !== 'string' || typeof req.repo !== 'string' || !(Date.now() - req.at < FRESH_MS)) return;
  if (req.app && req.app !== vscode.env.uriScheme) return; // meant for VS Code, and this is Cursor, or the other way round
  if (!folders().some(x => path.relative(x, req.repo) === '')) return;
  const mine = `${f}.${process.pid}.claimed`;
  try { fs.renameSync(f, mine); } catch { return; } // another window claimed it first
  const got = read(mine) || req;
  try { fs.unlinkSync(mine); } catch { /* already gone */ }
  if (got.home) ctx.globalState.update('grasp.home', got.home);
  open(got.html);
}

module.exports = { activate, deactivate };
