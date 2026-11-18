#!/usr/bin/env node
// grasp-explain: tour.json + the working tree -> explain.html, a narrated walkthrough, plus one voice clip per spoken segment.
// Usage: node build.mjs <tour.json> [--repo <path>] [--out <path>] [--editor vscode|cursor|none] [--voice <name>|browser]
// The page is self-contained; its clips go in an audio/ folder beside it. Without the voice engine (voice.mjs install),
// or with --voice browser, the page speaks with the browser's own voice instead.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_VOICE, VOICES, clipId, graspHome, installed, openEngine, speak, speakable, wav, wavSeconds } from './voice.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = name => { const i = argv.indexOf(name); return i < 0 ? undefined : argv.splice(i, 2)[1]; };
const repoArg = flag('--repo') ?? '.', outArg = flag('--out'), editor = flag('--editor') ?? 'vscode', voiceArg = flag('--voice'), tourPath = argv[0];
const USAGE = 'usage: node build.mjs <tour.json> [--repo <path>] [--out <path>] [--editor vscode|cursor|none] [--voice <name>|browser]';
if (!tourPath) quit([USAGE]);
if (!['vscode', 'cursor', 'none'].includes(editor)) quit([`--editor: "${editor}", must be vscode, cursor or none`]);

function quit(lines) { console.error(lines.join('\n')); process.exit(1); }
const run = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }); } catch { return null; } };

let tour, settings = {};
try { tour = JSON.parse(readFileSync(tourPath, 'utf8').replace(/^﻿/, '')); } catch (e) { quit([`${tourPath}: ${e.message}`]); }
try { settings = JSON.parse(readFileSync(join(graspHome(), 'settings.json'), 'utf8').replace(/^﻿/, '')); } catch { /* no settings */ }
let voice = voiceArg ?? tour.voice ?? settings.voice ?? DEFAULT_VOICE;
if (voice === 'off') voice = 'browser';
if (voice !== 'browser' && !VOICES[voice]) quit([`voice: "${voice}" is not one of ${Object.keys(VOICES).join(', ')}, browser`]);
const root = run('-C', repoArg, 'rev-parse', '--show-toplevel')?.trim();
if (!root) quit([`--repo ${resolve(repoArg)}: not inside a git repository`]);
const git = (...a) => run('-C', root, ...a);

const errs = [];
let total = 0, spoken = 0;
const words = s => s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// A text field shown on the page: counts toward the page total and must fit its word budget.
function text(path, v, max, optional) {
  if (v == null || v === '') return optional || errs.push(`${path}: missing`);
  if (typeof v !== 'string') return errs.push(`${path}: must be text`);
  total += words(v);
  if (max && words(v) > max) errs.push(`${path}: ${words(v)} words, max ${max}`);
}
function each(path, v, min, max, fn) {
  if (v == null) v = [];
  if (!Array.isArray(v)) return errs.push(`${path}: must be a list`);
  if (v.length < min || v.length > max) errs.push(`${path}: ${v.length} items, allowed ${min} to ${max}`);
  v.forEach((x, i) => isObj(x) ? fn(x, `${path}[${i}]`, i) : errs.push(`${path}[${i}]: must be an object`));
}
function span(path, r, lo, hi, max, where) {
  if (!Array.isArray(r) || r.length !== 2 || !r.every(Number.isInteger) || r[0] > r[1]) return !errs.push(`${path}: must be [first, last] line numbers`);
  if (r[0] < lo || r[1] > hi) errs.push(`${path}: [${r[0]}, ${r[1]}] is outside ${where} (${lo}-${hi})`);
  if (r[1] - r[0] + 1 > max) errs.push(`${path}: ${r[1] - r[0] + 1} lines, max ${max}`);
  return true;
}

// Change marks for a window: added lines, and removed lines anchored before the working-tree line they used to precede.
function marks(file, a, b) {
  if (git('cat-file', '-e', `${tour.base}:${file}`) === null) return { status: 'new', added: Array.from({ length: b - a + 1 }, (_, k) => a + k), removed: [] };
  const added = [], removed = [];
  let hunk;
  for (const l of (git('diff', '--no-color', '--no-ext-diff', '-U0', tour.base, '--', file) ?? '').split('\n')) {
    const h = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (h) {
      const at = +h[2], n = +(h[3] ?? 1);
      for (let k = at; k < at + n; k++) if (k >= a && k <= b) added.push(k);
      hunk = { before: n ? at : at + 1, lines: [] };
      if (+(h[1] ?? 1) && hunk.before >= a && hunk.before <= b + 1) removed.push(hunk);
    } else if (hunk && l[0] === '-') hunk.lines.push(l.slice(1).replace(/\r$/, ''));
  }
  return { status: added.length || removed.length ? 'changed' : 'context', added, removed };
}

text('title', tour.title);
text('what', tour.what, 14);
text('why', tour.why, 14);
if (!['low', 'med', 'high'].includes(tour.risk?.level)) errs.push('risk.level: must be low, med or high');
text('risk.note', tour.risk?.note, 8);
const base = typeof tour.base === 'string' && git('rev-parse', '--verify', '--quiet', `${tour.base}^{commit}`);
if (!base) errs.push(`base: ${JSON.stringify(tour.base)} does not resolve to a commit in ${root}`);

const ids = new Set();
each('decisions', tour.decisions, 0, 8, (d, p) => {
  if (typeof d.id === 'string') ids.add(d.id); else errs.push(`${p}.id: missing`);
  text(`${p}.title`, d.title);
  text(`${p}.chose`, d.chose, 6);
  text(`${p}.over`, d.over, 8);
  text(`${p}.because`, d.because, 12);
  if (!['user', 'agent-approved', 'agent'].includes(d.by)) errs.push(`${p}.by: must be user, agent-approved or agent`);
});

// ---- narration: what the voice says, and what the page lights up while it says it ------------
const SHOW = ['what', 'why', 'risk', 'flow', 'decisions', 'risks', 'off', 'terms'];
const nStops = Array.isArray(tour.stops) ? tour.stops.length : 0;
function segment(g, p, at) {
  if (g.say == null || g.say === '') errs.push(`${p}.say: missing`);
  else if (typeof g.say !== 'string') errs.push(`${p}.say: must be text`);
  else { spoken += words(g.say); if (words(g.say) > 45) errs.push(`${p}.say: ${words(g.say)} words, max 45 (split it: one idea per segment)`); }
  if (g.speak != null && (typeof g.speak !== 'string' || words(g.speak) > 60)) errs.push(`${p}.speak: must be text of 60 words or fewer`);
  if (g.decision != null && !ids.has(g.decision)) errs.push(`${p}.decision: "${g.decision}" is not in decisions`);
  if (at) {
    if (g.lines != null) span(`${p}.lines`, g.lines, at[0], at[1], 12, "the stop's lines");
    if (g.removed != null && typeof g.removed !== 'boolean') errs.push(`${p}.removed: must be true or false`);
    if (g.show != null || g.chip != null) errs.push(`${p}: "show" and "chip" are for intro and outro segments; a stop segment uses "lines"`);
  } else {
    if (g.lines != null || g.removed != null) errs.push(`${p}: "lines" and "removed" are for stop segments; use "show" or "chip"`);
    if (g.show != null && !SHOW.includes(g.show)) errs.push(`${p}.show: "${g.show}", must be one of ${SHOW.join(', ')}`);
    if (g.chip != null && !(Number.isInteger(g.chip) && g.chip >= 1 && g.chip <= nStops)) errs.push(`${p}.chip: must be a stop number, 1 to ${nStops}`);
  }
}
each('intro', tour.intro, 1, 8, (g, p) => segment(g, p));
each('outro', tour.outro, 1, 6, (g, p) => segment(g, p));

const flow = tour.flow !== false, last = nStops - 1;
each('stops', tour.stops, 2, 12, (s, p, i) => {
  const want = !flow || (i > 0 && i < last) ? 'step' : i === 0 ? 'entry' : 'exit';
  if (s.role !== want) errs.push(`${p}.role: ${JSON.stringify(s.role)}, must be "${want}" ${!flow ? 'when "flow" is false' : i === 0 ? '(first stop: where data comes in)' : i === last ? '(last stop: where the result leaves)' : '(middle stop)'}`);
  text(`${p}.at`, s.at);
  if (typeof s.at === 'string' && s.at.length > 40) errs.push(`${p}.at: ${s.at.length} characters, max 40`);
  text(`${p}.title`, s.title, 6);
  text(`${p}.say`, s.say, 20);
  if (s.in != null) text(`${p}.in.label`, s.in.label, 6);
  if (s.out != null) text(`${p}.out.label`, s.out.label, 6);
  each(`${p}.notes`, s.notes, 0, 3, (n, q) => text(`${q}.text`, n.text, 10));
  if (s.decision != null && !ids.has(s.decision)) errs.push(`${p}.decision: "${s.decision}" is not in decisions`);
  // depth is the call depth: 0 for the top level, +1 when this stop steps into a function the previous stop calls.
  s.depth ??= 0;
  const up = i ? (tour.stops[i - 1]?.depth ?? 0) + 1 : 0;
  if (!Number.isInteger(s.depth) || s.depth < 0 || s.depth > 5) errs.push(`${p}.depth: must be a whole number, 0 to 5`);
  else if (s.depth > up) errs.push(`${p}.depth: ${s.depth}, max ${up} (step into one call at a time${i ? '' : '; the first stop is 0'})`);

  if (typeof s.file !== 'string') return errs.push(`${p}.file: missing`);
  let src;
  try { src = readFileSync(join(root, s.file), 'utf8'); } catch { return errs.push(`${p}.file: ${s.file} not found in ${root}`); }
  const lines = src.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  if (!span(`${p}.lines`, s.lines, 1, lines.length, 30, 'the file')) return;
  const [a, b] = s.lines;
  span(`${p}.focus`, s.focus, a, b, 15, 'lines');
  const pins = [['in', s.in], ['out', s.out], ...(Array.isArray(s.notes) ? s.notes : []).map((x, k) => [`notes[${k}]`, x])];
  for (const [q, x] of pins) if (isObj(x) && !(Number.isInteger(x.line) && x.line >= a && x.line <= b)) errs.push(`${p}.${q}.line: ${x.line} is outside lines (${a}-${b})`);
  each(`${p}.walk`, s.walk, 2, 14, (g, q) => segment(g, q, [a, b]));
  s.code = lines.slice(a - 1, b);
  if (base) Object.assign(s, marks(s.file, a, b));
  if (editor !== 'none' && Array.isArray(s.focus)) s.open = `${editor}://file/${encodeURI(resolve(root, s.file).replace(/\\/g, '/'))}:${s.focus[0]}`;
});

each('risks', tour.risks, 0, 3, (r, p) => { text(`${p}.text`, r.text, 12); text(`${p}.covered`, r.covered, 8, true); text(`${p}.gap`, r.gap, 8, true); });
each('offPath', tour.offPath, 0, 12, (o, p) => { if (typeof o.file !== 'string') errs.push(`${p}.file: missing`); text(`${p}.what`, o.what, 8); });

// Words to know: each term must be spoken somewhere, so its definition can pop up when the voice reaches it.
const allSaid = [...(tour.intro ?? []), ...(tour.stops ?? []).flatMap(s => s?.walk ?? []), ...(tour.outro ?? [])].map(g => g?.say ?? '').join(' \n ').toLowerCase();
each('terms', tour.terms, 0, 20, (t, p) => {
  if (typeof t.term !== 'string' || !t.term.trim()) return errs.push(`${p}.term: missing`);
  if (words(t.term) > 4) errs.push(`${p}.term: ${words(t.term)} words, max 4`);
  if (typeof t.def !== 'string' || !t.def.trim()) errs.push(`${p}.def: missing`);
  else if (words(t.def) > 25) errs.push(`${p}.def: ${words(t.def)} words, max 25`);
  const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${t.term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u');
  if (!re.test(allSaid)) errs.push(`${p}.term: "${t.term}" is never said in the narration; say it where it first matters, or drop it`);
});

if (total > 600) errs.push(`page text: ${total} words, max 600 (the narration has its own budget)`);
if (spoken > 3200) errs.push(`narration: ${spoken} words, max 3200 (about 20 minutes)`);

const out = resolve(outArg ?? join(dirname(resolve(tourPath)), 'explain.html'));
const rel = relative(resolve(root), out);
if (!rel.startsWith('..') && !isAbsolute(rel)) errs.push(`output ${out} is inside the repo; write it under the grasp home`);
if (errs.length) quit([`${tourPath}: ${errs.length} problem${errs.length > 1 ? 's' : ''}`, ...errs.map(e => `  ${e}`)]);

// ---- voice: one clip per segment, reused while its words and voice stay the same ---------------
const segs = [...tour.intro, ...tour.stops.flatMap(s => s.walk), ...tour.outro];
for (const g of segs) g.spoken = g.speak || speakable(g.say);
const audioDir = join(dirname(out), 'audio');
let made = 0, note = '';
if (voice === 'browser') note = 'browser voice (--voice browser)';
else {
  for (const g of segs) g.clip = clipId(voice, g.spoken);
  const missing = segs.filter(g => !existsSync(join(audioDir, `${g.clip}.wav`)));
  if (missing.length && !installed()) note = `browser voice: the natural voice isn't installed. Install it once with: node "${join(here, 'voice.mjs')}" install`;
  else if (missing.length) {
    try {
      const tts = await openEngine(m => console.error(m)), t0 = Date.now();
      mkdirSync(audioDir, { recursive: true });
      for (const [k, g] of missing.entries()) {
        writeFileSync(join(audioDir, `${g.clip}.wav`), wav(await speak(tts, g.spoken, voice)));
        made++;
        if (k === missing.length - 1 || (k + 1) % Math.max(1, Math.ceil(missing.length / 10)) === 0) console.error(`voice: ${k + 1}/${missing.length} clips · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      }
    } catch (e) { note = `voice failed after ${made} clips (${e.message}); missing clips fall back to the browser voice`; }
  }
  for (const g of segs) {
    const f = join(audioDir, `${g.clip}.wav`);
    if (existsSync(f)) { g.audio = `audio/${g.clip}.wav`; g.secs = +wavSeconds(f).toFixed(2); }
    delete g.clip;
  }
  // Clips this tour no longer says are deleted, so the folder doesn't grow with every rebuild.
  const keep = new Set(segs.map(g => g.audio?.slice(6)));
  if (existsSync(audioDir)) for (const f of readdirSync(audioDir)) if (/^[0-9a-f]{12}\.wav$/.test(f) && !keep.has(f)) rmSync(join(audioDir, f));
  if (!note) note = `${voice}${made ? `, ${made} new clip${made > 1 ? 's' : ''}` : ''}`;
}

const tpl = readFileSync(join(here, 'template.html'), 'utf8');
const secs = segs.reduce((n, g) => n + (g.secs ?? words(g.spoken) / 2.6), 0);
const data = JSON.stringify({ ...tour, voice, words: total, spokenWords: spoken }).replace(/</g, '\\u003c');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, tpl.replace('__TOUR__', () => data));
console.log(`${out} · ${total} words on the page · ${spoken} spoken, about ${Math.round(secs / 60)} min · voice: ${note}`);
