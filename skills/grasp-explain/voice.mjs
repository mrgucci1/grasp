#!/usr/bin/env node
// grasp voice: natural English speech for the walkthrough, made on this machine. Nothing is sent anywhere.
// Engine: Kokoro-82M (Apache-2.0) through kokoro-js, installed under <grasp home>/_voice so skill updates keep it.
//
//   node voice.mjs install           install the engine from engine/package-lock.json and download the model (≈ 740 MB, once)
//   node voice.mjs status            is the engine ready?
//   node voice.mjs voices            list the English voices
//   node voice.mjs sample [voice|all] speak a test line and print where the .wav went
//   node voice.mjs uninstall         remove the engine and the model
//
// build.mjs imports this file to turn each narration segment into a clip.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ENGINE = 'kokoro-js@1.2.1';
export const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DTYPE = 'fp32'; // on CPU, fp32 is both the best-sounding and the fastest (about 6x real time); q8 is 3x slower
export const RATE = 24000;
export const DEFAULT_VOICE = 'af_heart';
export const VOICES = {
  af_heart: 'Heart · American English, female, warm (default)',
  af_bella: 'Bella · American English, female, bright',
  am_michael: 'Michael · American English, male',
  am_fenrir: 'Fenrir · American English, male, deeper',
  am_puck: 'Puck · American English, male, lively',
  bf_emma: 'Emma · British English, female',
  bm_george: 'George · British English, male',
  bm_fable: 'Fable · British English, male',
};

export const graspHome = () => resolve(process.env.GRASP_HOME || join(homedir(), '.grasp'));
// <grasp home>/settings.json, or {} when there is none. Editors on Windows may save it with a byte-order mark.
export function readSettings() {
  try { return JSON.parse(readFileSync(join(graspHome(), 'settings.json'), 'utf8').replace(/^﻿/, '')); } catch { return {}; }
}
export const engineDir = () => join(graspHome(), '_voice');
const entry = () => join(engineDir(), 'node_modules', 'kokoro-js', 'dist', 'kokoro.js');
const transformers = () => join(engineDir(), 'node_modules', '@huggingface', 'transformers', 'dist', 'transformers.node.mjs');
const models = () => join(engineDir(), 'models'); // outside node_modules, so reinstalling the engine keeps the 326 MB model
export const installed = () => existsSync(entry());

// ---- text for the ear --------------------------------------------------------------------------
// Narration is written with `code` in backticks so the page can show it as code. Spoken, `HttpClient.send()`
// becomes "Http Client dot send", operators become words, and a few written-only forms are expanded.
const OPS = [['!==', ' is not '], ['===', ' equals '], ['!=', ' is not '], ['==', ' equals '], ['=>', ' arrow '], ['>=', ' at least '], ['<=', ' at most '],
  ['&&', ' and '], ['||', ' or '], ['??', ' or else '], ['++', ' plus plus '], ['+=', ' plus equals '], ['-=', ' minus equals '], ['**', ' to the power of '],
  ['->', ' arrow '], ['::', ' '], ['...', ' spread '], ['>', ' greater than '], ['<', ' less than '], ['=', ' equals '], ['!', ' not '], ['*', ' times '], ['+', ' plus '], ['%', ' mod '], ['#', ' '], ['@', ' at ']];
// MAX_ATTEMPTS -> "max attempts", withRetry -> "with Retry", XMLParser -> "XML Parser", delay_ms -> "delay milliseconds".
const splitWord = w => (/^[A-Z\d_]+$/.test(w) && w.includes('_') ? w.toLowerCase() : w)
  .replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/_+/g, ' ').replace(/\bms\b/g, 'milliseconds');
function sayCode(c) {
  let s = c.replace(/\(\s*\)/g, '').replace(/(\d)\.(\d)/g, '$1 point $2');
  s = s.replace(/[A-Za-z_$][\w$]*/g, splitWord).replace(/\./g, ' dot ').replace(/\//g, ' slash ').replace(/-(?=[A-Za-z])/g, ' ');
  for (const [op, word] of OPS) s = s.split(op).join(word);
  return s.replace(/[(){}\[\];,:'"`\\|^~$&?]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function speakable(text) {
  return String(text)
    .replace(/`([^`]+)`/g, (_, c) => sayCode(c))
    .replace(/\be\.g\.,?/gi, 'for example,').replace(/\bi\.e\.,?/gi, 'that is,').replace(/\bvs\.?(?=\s)/gi, 'versus')
    .replace(/(\d)\s?ms\b/g, '$1 milliseconds').replace(/→|->/g, ' to ').replace(/&/g, ' and ').replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    .replace(/\s+/g, ' ').trim();
}

// One clip per segment, named by what it says and who says it, so an unchanged segment is never made twice.
export const clipId = (voice, spoken) => createHash('sha1').update(`${ENGINE}|${MODEL}|${DTYPE}|${voice}|${spoken}`).digest('hex').slice(0, 12);

// ---- synthesis ---------------------------------------------------------------------------------
export async function openEngine(log = () => {}) {
  if (!installed()) return null;
  const { env } = await import(pathToFileURL(transformers()).href);
  env.cacheDir = models();
  const { KokoroTTS } = await import(pathToFileURL(entry()).href);
  const seen = new Set();
  const progress = p => {
    if (p.status === 'progress' && p.total > 5e6) {
      const pct = Math.floor(p.progress / 10) * 10;
      if (!seen.has(p.file + pct)) { seen.add(p.file + pct); log(`voice: downloading ${p.file} ${pct}% of ${(p.total / 1e6).toFixed(0)} MB`); }
    }
  };
  return KokoroTTS.from_pretrained(MODEL, { dtype: DTYPE, device: 'cpu', progress_callback: progress });
}

const SENTENCE = /[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g;
// Speaks one segment: sentence by sentence (the model truncates long inputs), trimmed, joined with short natural pauses.
export async function speak(tts, text, voice = DEFAULT_VOICE) {
  const parts = [];
  for (const sentence of (text.match(SENTENCE) || [text]).map(s => s.trim()).filter(Boolean)) {
    const audio = await tts.generate(sentence, { voice });
    parts.push(trim(audio.audio));
  }
  const gap = Math.round(RATE * 0.22), lead = Math.round(RATE * 0.04);
  const len = parts.reduce((n, p) => n + p.length, 0) + gap * Math.max(0, parts.length - 1) + lead * 2;
  const out = new Float32Array(len);
  let at = lead;
  parts.forEach((p, i) => { out.set(p, at); at += p.length + (i < parts.length - 1 ? gap : 0); });
  return out;
}
function trim(x, floor = 0.006) {
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < floor) a++;
  while (b > a && Math.abs(x[b]) < floor) b--;
  return x.subarray(Math.max(0, a - Math.round(RATE * 0.02)), Math.min(x.length, b + Math.round(RATE * 0.06)));
}
// 16-bit PCM mono WAV: half the size of the float WAV the engine writes, and every browser plays it.
export function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return buf;
}
export const wavSeconds = file => (statSync(file).size - 44) / (RATE * 2);

// ---- command line ------------------------------------------------------------------------------
function du(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); n += e.isDirectory() ? du(p) : statSync(p).size; }
  return n;
}
async function sample(voice) {
  const tts = await openEngine(m => console.log(m));
  const dir = join(engineDir(), 'samples');
  mkdirSync(dir, { recursive: true });
  for (const v of voice === 'all' ? Object.keys(VOICES) : [voice]) {
    const line = speakable("Hi, I'm the grasp walkthrough voice. Let's step into `HttpClient.send()`, where a failed call waits a little longer before each retry. That wait is called backoff.");
    const t = Date.now(), samples = await speak(tts, line, v), file = join(dir, `${v}.wav`);
    writeFileSync(file, wav(samples));
    console.log(`${file} · ${(samples.length / RATE).toFixed(1)} s of audio in ${((Date.now() - t) / 1000).toFixed(1)} s`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd = 'status', arg] = process.argv.slice(2);
  const dir = engineDir(), here = dirname(fileURLToPath(import.meta.url));
  if (cmd === 'install') {
    mkdirSync(dir, { recursive: true });
    const lock = join(dir, 'package-lock.json'), same = installed() && existsSync(lock) && readFileSync(lock, 'utf8') === readFileSync(join(here, 'engine', 'package-lock.json'), 'utf8');
    const oldCache = join(dir, 'node_modules', '@huggingface', 'transformers', '.cache');
    if (existsSync(oldCache) && !existsSync(models())) renameSync(oldCache, models()); // keep a model downloaded by an earlier version
    if (same) console.log(`voice: ${ENGINE} is already installed in ${dir}`);
    else {
      for (const f of ['package.json', 'package-lock.json']) copyFileSync(join(here, 'engine', f), join(dir, f));
      console.log(`voice: installing ${ENGINE} into ${dir} (exact versions from engine/package-lock.json)`);
      execSync('npm ci --omit=dev --no-audit --no-fund --loglevel=error', { cwd: dir, stdio: 'inherit' });
    }
    console.log(existsSync(models()) ? 'voice: testing the model' : 'voice: downloading the model (once) and testing it');
    await sample(DEFAULT_VOICE);
    console.log(`voice: ready · ${(du(dir) / 1e6).toFixed(0)} MB in ${dir}`);
  } else if (cmd === 'status') {
    console.log(installed() ? `voice: ready · ${ENGINE} · ${(du(dir) / 1e6).toFixed(0)} MB in ${dir}` : `voice: not installed · the walkthrough falls back to the browser's voice · run: node "${fileURLToPath(import.meta.url)}" install`);
    process.exit(installed() ? 0 : 1);
  } else if (cmd === 'voices') {
    for (const [k, v] of Object.entries(VOICES)) console.log(`${k.padEnd(11)} ${v}`);
  } else if (cmd === 'sample') {
    if (!installed()) { console.error('voice: not installed; run install first'); process.exit(1); }
    if (arg && arg !== 'all' && !VOICES[arg]) { console.error(`voice: unknown voice "${arg}"; see: node voice.mjs voices`); process.exit(1); }
    await sample(arg || DEFAULT_VOICE);
  } else if (cmd === 'uninstall') {
    rmSync(dir, { recursive: true, force: true });
    console.log(`voice: removed ${dir}`);
  } else {
    console.error('usage: node voice.mjs install | status | voices | sample [voice|all] | uninstall');
    process.exit(1);
  }
}
