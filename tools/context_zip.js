#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const root = process.cwd();
const KEEP_LAST_ZIPS = 5;

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const outDir = path.join(root, '_chat_upload');
const zipName = `chat_context_${timestamp()}.zip`;
const zipPath = path.join(root, zipName);
const manifest = [];

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function readClipboard() {
  try {
    return execSync('powershell -NoProfile -Command "Get-Clipboard"', { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function ensureCleanDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyFilePreserveTree(file) {
  if (!fs.existsSync(file)) {
    console.log(`NOT FOUND: ${file}`);
    manifest.push(`NOT FOUND: ${file}`);
    return;
  }

  const stat = fs.statSync(file);
  if (!stat.isFile()) return;

  const abs = path.resolve(file);
  const rel = path.relative(root, abs);
  const dest = path.join(outDir, rel);

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(abs, dest);

  console.log(`COPIED: ${rel}`);
  manifest.push(`FILE: ${rel}`);
}

function collectDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`NOT FOUND: ${dir}`);
    manifest.push(`NOT FOUND: ${dir}`);
    return;
  }

  for (const item of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isFile()) copyFilePreserveTree(full);
  }
}

function collectWildcard(pattern) {
  const normalized = pattern.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  const dir = idx === -1 ? '.' : normalized.slice(0, idx);
  const mask = normalized.slice(idx + 1);

  const rx = new RegExp(
    '^' + mask.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$',
    'i'
  );

  if (!fs.existsSync(dir)) {
    console.log(`NOT FOUND: ${pattern}`);
    manifest.push(`NOT FOUND: ${pattern}`);
    return;
  }

  for (const item of fs.readdirSync(dir).sort()) {
    if (!rx.test(item)) continue;
    const full = path.join(dir, item);
    if (fs.statSync(full).isFile()) copyFilePreserveTree(full);
  }
}

function writeCommandOutput(name, content) {
  const file = path.join(outDir, '_commands', name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content + '\n', 'utf8');

  console.log(`ADDED: _commands/${name}`);
  manifest.push(`COMMAND: _commands/${name}`);
}

function normalizeToken(s) {
  return s
    .trim()
    .replace(/^[-*•]\s*/, '')
    .replace(/^`+|`+$/g, '')
    .replace(/^["']|["']$/g, '')
    .replace(/,$/, '')
    .trim();
}

function looksLikePath(s) {
  if (!s) return false;
  if (s.includes('://')) return false;
  if (s.length > 260) return false;

  const hasSlash = s.includes('/') || s.includes('\\');
  const hasKnownExt = /\.(js|ts|json|csv|md|txt|html|css|yml|yaml|log|xml|bat|ps1|py)$/i.test(s);
  const hasWildcard = s.includes('*');

  return hasSlash || hasKnownExt || hasWildcard;
}

function parseClipboardText(text) {
  const found = [];
  const lines = text.split(/\r?\n/);

  for (let line of lines) {
    line = normalizeToken(line);
    if (!line) continue;

    const lower = line.toLowerCase();

    if (lower.includes('git status --short')) found.push('--git-status');
    if (lower.includes('git log --oneline -5')) found.push('--git-log');
    if (lower.includes('git diff --stat')) found.push('--git-diff');

    const codeMatches = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    for (const m of codeMatches) {
      const t = normalizeToken(m);
      if (looksLikePath(t)) found.push(t);
    }

    if (looksLikePath(line)) found.push(line);
  }

  return [...new Set(found)];
}

function cleanupOldZips() {
  const zips = fs
    .readdirSync(root)
    .filter((f) => /^chat_context_\d{8}_\d{6}\.zip$/i.test(f))
    .map((f) => {
      const full = path.join(root, f);
      return {
        name: f,
        full,
        mtime: fs.statSync(full).mtimeMs
      };
    })
    .sort((a, b) => b.mtime - a.mtime);

  const old = zips.slice(KEEP_LAST_ZIPS);

  for (const z of old) {
    fs.rmSync(z.full, { force: true });
    console.log(`DELETED OLD ZIP: ${z.name}`);
  }
}

let effectiveArgs = [...args];

if (args.includes('--from-clipboard')) {
  const clip = readClipboard();
  const parsed = parseClipboardText(clip);

  effectiveArgs = effectiveArgs
    .filter((a) => a !== '--from-clipboard')
    .concat(parsed);

  console.log('Parsed from clipboard:');
  for (const p of parsed) console.log(`  ${p}`);
  console.log('');
}

ensureCleanDir(outDir);

for (const arg of effectiveArgs) {
  switch (arg) {
    case '--git-status':
      writeCommandOutput('git_status_short.txt', run('git status --short'));
      break;

    case '--git-log':
      writeCommandOutput('git_log_oneline_5.txt', run('git log --oneline -5'));
      break;

    case '--git-diff':
      writeCommandOutput('git_diff_stat.txt', run('git diff --stat'));
      break;

    default:
      if (arg.includes('*')) collectWildcard(arg);
      else if (fs.existsSync(arg) && fs.statSync(arg).isDirectory()) collectDirectory(arg);
      else copyFilePreserveTree(arg);
  }
}

const manifestText = [
  'CCW Chat Upload Manifest',
  `Generated: ${new Date().toISOString()}`,
  `Root: ${root}`,
  '',
  ...manifest,
  ''
].join('\n');

fs.writeFileSync(path.join(outDir, '_manifest.txt'), manifestText, 'utf8');

const ps = `Compress-Archive -Path "${outDir}\\*" -DestinationPath "${zipPath}" -Force`;
execSync(`powershell -NoProfile -Command "${ps.replace(/\n/g, ' ')}"`);

cleanupOldZips();

console.log('');
console.log(`ZIP created: ${zipPath}`);
console.log('');
console.log(`Keeping only last ${KEEP_LAST_ZIPS} chat_context ZIPs.`);
console.log('Ready to upload.');
console.log('Use your existing Explorer window, press F5 if needed,');
console.log(`then copy/paste this file into ChatGPT: ${zipName}`);

process.stdout.write('\x07');