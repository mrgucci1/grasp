#!/usr/bin/env node
// grasp-explain: tour.json + the working tree -> one self-contained explain.html. Zero dependencies.
// Usage: node build.mjs <tour.json> [--repo <path>] [--out <path>] [--editor vscode|cursor|none]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const flag = name => { const i = argv.indexOf(name); return i < 0 ? undefined : argv.splice(i, 2)[1]; };
const repoArg = flag('--repo') ?? '.', outArg = flag('--out'), editor = flag('--editor') ?? 'vscode', tourPath = argv[0];
if (!tourPath) quit(['usage: node build.mjs <tour.json> [--repo <path>] [--out <path>] [--editor vscode|cursor|none]']);
if (!['vscode', 'cursor', 'none'].includes(editor)) quit([`--editor: "${editor}", must be vscode, cursor or none`]);

function quit(lines) { console.error(lines.join('\n')); process.exit(1); }
const run = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }); } catch { return null; } };

let tour;
try { tour = JSON.parse(readFileSync(tourPath, 'utf8').replace(/^﻿/, '')); } catch (e) { quit([`${tourPath}: ${e.message}`]); }
const root = run('-C', repoArg, 'rev-parse', '--show-toplevel')?.trim();
if (!root) quit([`--repo ${resolve(repoArg)}: not inside a git repository`]);
const git = (...a) => run('-C', root, ...a);

const errs = [];
let total = 0;
const words = s => s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// A text field: counts toward the page total and must fit its word budget.
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

const flow = tour.flow !== false, last = (tour.stops?.length ?? 0) - 1;
each('stops', tour.stops, 2, 7, (s, p, i) => {
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
  s.code = lines.slice(a - 1, b);
  if (base) Object.assign(s, marks(s.file, a, b));
  if (editor !== 'none' && Array.isArray(s.focus)) s.open = `${editor}://file/${encodeURI(resolve(root, s.file).replace(/\\/g, '/'))}:${s.focus[0]}`;
});

each('risks', tour.risks, 0, 3, (r, p) => { text(`${p}.text`, r.text, 12); text(`${p}.covered`, r.covered, 8, true); text(`${p}.gap`, r.gap, 8, true); });
each('offPath', tour.offPath, 0, 12, (o, p) => { if (typeof o.file !== 'string') errs.push(`${p}.file: missing`); text(`${p}.what`, o.what, 8); });
if (total > 400) errs.push(`whole tour: ${total} words, max 400`);

const out = resolve(outArg ?? join(dirname(resolve(tourPath)), 'explain.html'));
const rel = relative(resolve(root), out);
if (!rel.startsWith('..') && !isAbsolute(rel)) errs.push(`output ${out} is inside the repo; write it under the grasp home`);
if (errs.length) quit([`${tourPath}: ${errs.length} problem${errs.length > 1 ? 's' : ''}`, ...errs.map(e => `  ${e}`)]);

const tpl = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'template.html'), 'utf8');
const data = JSON.stringify({ ...tour, words: total }).replace(/</g, '\\u003c');
writeFileSync(out, tpl.replace('__TOUR__', () => data));
console.log(`${out} · ${total} words`);
