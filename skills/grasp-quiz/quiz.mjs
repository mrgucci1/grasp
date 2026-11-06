#!/usr/bin/env node
// grasp-quiz: turn quiz.json into a self-contained quiz page, serve it on localhost,
// wait for the graded result, print it as one JSON line.
// Usage: node quiz.mjs <quiz.json> [--no-open] [--timeout <minutes>] [--build-only]
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

const TYPES = ['why', 'predict', 'break'];
const words = s => s.trim().split(/\s+/).length;
const str = v => typeof v === 'string' && v.trim() !== '';

// Returns every violation, so the agent can fix them all in one go.
function validate(d) {
  const qs = d?.questions;
  if (!Array.isArray(qs)) return ['"questions" must be an array'];
  const errs = [], seen = new Set();
  if (qs.length < 3 || qs.length > 7) errs.push(`need 3 to 7 questions, got ${qs.length}`);
  if (d.pass !== undefined && !(d.pass > 0 && d.pass <= 1)) errs.push('"pass" must be a number above 0 and at most 1');
  qs.forEach((x, i) => {
    const { id, type, q, options, answer, because, code } = x ?? {};
    const bad = m => errs.push(`question ${i + 1}${str(id) ? ` (${id})` : ''}: ${m}`);
    if (!str(id)) bad('missing id');
    else if (seen.has(id)) bad(`duplicate id "${id}"`);
    else seen.add(id);
    if (!TYPES.includes(type)) bad(`type must be one of ${TYPES.join(', ')}`);
    if (!str(q)) bad('missing q');
    else if (words(q) > 40) bad(`q is ${words(q)} words (max 40)`);
    const opts = Array.isArray(options) ? options : [];
    if (opts.length < 2 || opts.length > 4) bad(`need 2 to 4 options, got ${opts.length}`);
    opts.forEach((o, j) => {
      if (!str(o)) bad(`option ${j} is empty`);
      else if (words(o) > 20) bad(`option ${j} is ${words(o)} words (max 20)`);
    });
    if (!Number.isInteger(answer) || answer < 0 || answer >= opts.length) bad(`answer ${JSON.stringify(answer)} is not an index into options`);
    if (!str(because)) bad('missing because');
    else if (words(because) > 25) bad(`because is ${words(because)} words (max 25)`);
    if (code !== undefined && (typeof code !== 'string' || code.trimEnd().split('\n').length > 12)) bad('code must be text of at most 12 lines');
  });
  return errs;
}

// Grades on the server. Returns null unless every question has an in-range pick.
function grade(quiz, body) {
  const given = Array.isArray(body?.answers) ? body.answers : [];
  const answers = [];
  for (const q of quiz.questions) {
    const a = given.find(x => x?.id === q.id);
    if (!Number.isInteger(a?.picked) || a.picked < 0 || a.picked >= q.options.length) return null;
    answers.push({ id: q.id, type: q.type, picked: a.picked, correct: a.picked === q.answer });
  }
  const score = answers.filter(a => a.correct).length, total = answers.length;
  return {
    score, total, percent: Math.round(100 * score / total), passed: score / total >= quiz.pass,
    answers, missed: answers.filter(a => !a.correct).map(a => a.id),
  };
}

function open(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref();
}

function main() {
  const argv = process.argv.slice(2);
  const ti = argv.indexOf('--timeout');
  const minutes = ti >= 0 ? Number(argv[ti + 1]) : 30;
  const file = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--timeout');
  if (!file || !(minutes > 0)) {
    console.error('usage: node quiz.mjs <quiz.json> [--no-open] [--timeout <minutes>] [--build-only]');
    return void (process.exitCode = 1);
  }

  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')); }
  catch (e) { console.error(`cannot read ${file}: ${e.message}`); return void (process.exitCode = 1); }
  const errs = validate(data);
  if (errs.length) {
    console.error(`${file} is invalid:\n` + errs.map(e => '  - ' + e).join('\n'));
    return void (process.exitCode = 1);
  }

  const quiz = { title: data.title || 'Quiz', pass: data.pass ?? 0.8, questions: data.questions };
  const json = JSON.stringify(quiz).replace(/</g, '\\u003c'); // a "</script>" in a question can't end the data block
  const html = readFileSync(new URL('./quiz.html', import.meta.url), 'utf8').replace('{{QUIZ}}', () => json);
  const dir = dirname(resolve(file)), htmlPath = join(dir, 'quiz.html');
  writeFileSync(htmlPath, html);
  if (argv.includes('--build-only')) return void console.log(htmlPath);

  const token = randomBytes(16).toString('hex');
  const finish = code => { clearTimeout(timer); server.close(); process.exitCode = code; };

  const receive = (req, res) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > 64 * 1024) { res.writeHead(413, { connection: 'close' }).end(() => req.destroy()); chunks.length = 0; return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (size > 64 * 1024) return;
      let result = null;
      try { result = grade(quiz, JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch {}
      if (!result) return void res.writeHead(400, { connection: 'close' }).end();
      writeFileSync(join(dir, 'quiz-result.json'), JSON.stringify(result, null, 2) + '\n');
      console.log(JSON.stringify(result));
      res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }).end('{"ok":true}', () => finish(0));
    });
  };

  const server = createServer((req, res) => {
    const path = req.url.split('?')[0];
    if (req.method === 'GET' && (path === `/${token}/` || path === `/${token}`)) {
      return void res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html);
    }
    if (req.method === 'POST' && path === `/${token}/result`) return receive(req, res);
    res.writeHead(404).end();
  });

  const timer = setTimeout(() => { console.log('{"timeout":true}'); finish(2); }, minutes * 60_000);
  server.listen(0, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}/${token}/`;
    console.log('quiz: ' + url);
    if (!argv.includes('--no-open')) open(url);
  });
}

main();
