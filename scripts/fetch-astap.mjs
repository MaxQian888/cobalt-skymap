#!/usr/bin/env node
/**
 * Fetch the ASTAP command-line solver (astap_cli) and the W08 wide-field star
 * database from SourceForge so Tauri can bundle them with the desktop app:
 *
 *   - astap_cli  -> src-tauri/binaries/astap_cli-<target-triple>[.exe]
 *                   (bundle.externalBin sidecar; Tauri requires the
 *                    `-<target-triple>` suffix at build time)
 *   - W08 db     -> src-tauri/resources/astap_data/
 *                   (bundle.resources; ~0.3MB, FOV 20-180 deg preset so the
 *                    app can plate-solve out of the box; larger databases are
 *                    downloaded in-app)
 *
 * Idempotent: skips anything that already exists. Safe to chain in
 * beforeDevCommand/beforeBuildCommand.
 *
 * Usage:
 *   node scripts/fetch-astap.mjs                 # current host target triple
 *   node scripts/fetch-astap.mjs --target <triple>  # cross-build (repeatable)
 *   node scripts/fetch-astap.mjs --all           # every supported triple
 *
 * ASTAP is (C) Han Kleijn, https://www.hnsky.org/astap.htm, GPLv3
 * (source: https://github.com/han-k59/astap). Star databases derive from
 * ESA/Gaia/DPAC data (free to use with credit).
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BIN_DIR = join(ROOT, 'src-tauri', 'binaries');
const DATA_DIR = join(ROOT, 'src-tauri', 'resources', 'astap_data');

const SF = 'https://sourceforge.net/projects/astap-program/files';

/** target triple -> { zip URL, name of the executable inside the zip } */
const CLI_SOURCES = {
  'x86_64-pc-windows-msvc': {
    url: `${SF}/windows_installer/astap_command-line_version_win64.zip/download`,
    exe: 'astap_cli.exe',
  },
  'aarch64-pc-windows-msvc': {
    url: `${SF}/windows_installer/astap_command-line_version_win11_aarch64.zip/download`,
    exe: 'astap_cli.exe',
  },
  'x86_64-unknown-linux-gnu': {
    url: `${SF}/linux_installer/astap_command-line_version_Linux_amd64.zip/download`,
    exe: 'astap_cli',
  },
  'aarch64-unknown-linux-gnu': {
    url: `${SF}/linux_installer/astap_command-line_version_Linux_aarch64.zip/download`,
    exe: 'astap_cli',
  },
  'x86_64-apple-darwin': {
    url: `${SF}/macOS%20installer/astap_command-line_version_macOS_x86_64.zip/download`,
    exe: 'astap_cli',
  },
  'aarch64-apple-darwin': {
    url: `${SF}/macOS%20installer/astap_command-line_version_macOS_aarch64.zip/download`,
    exe: 'astap_cli',
  },
};

const W08_URL = `${SF}/star_databases/w08_star_database_mag08_astap.zip/download`;

function hostTriple() {
  try {
    const out = execFileSync('rustc', ['-Vv'], { encoding: 'utf8' });
    const m = out.match(/^host:\s*(\S+)/m);
    if (m) return m[1];
  } catch {
    /* rustc unavailable; fall through */
  }
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
  if (process.platform === 'win32') return `${arch}-pc-windows-msvc`;
  if (process.platform === 'darwin') return `${arch}-apple-darwin`;
  return `${arch}-unknown-linux-gnu`;
}

async function download(url, dest) {
  console.log(`  downloading ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error(`Suspiciously small download (${buf.length} B) from ${url}`);
  writeFileSync(dest, buf);
}

function extract(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${destDir}" -Force`,
    ]);
  } else {
    try {
      execFileSync('unzip', ['-o', '-q', zipPath, '-d', destDir]);
    } catch {
      execFileSync('tar', ['-xf', zipPath, '-C', destDir]);
    }
  }
}

function findFile(dir, name) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(p, name);
      if (found) return found;
    } else if (entry.name.toLowerCase() === name.toLowerCase()) {
      return p;
    }
  }
  return null;
}

async function fetchCli(triple) {
  const source = CLI_SOURCES[triple];
  if (!source) {
    console.warn(`! No ASTAP CLI source known for target triple '${triple}' — skipping sidecar`);
    return;
  }
  const suffix = triple.includes('windows') ? '.exe' : '';
  const dest = join(BIN_DIR, `astap_cli-${triple}${suffix}`);
  if (existsSync(dest)) {
    console.log(`= astap_cli for ${triple} already present`);
    return;
  }
  console.log(`+ astap_cli for ${triple}`);
  mkdirSync(BIN_DIR, { recursive: true });
  const work = join(tmpdir(), `astap-cli-${triple}-${process.pid}`);
  mkdirSync(work, { recursive: true });
  try {
    const zip = join(work, 'cli.zip');
    await download(source.url, zip);
    extract(zip, join(work, 'x'));
    const exe = findFile(join(work, 'x'), source.exe);
    if (!exe) throw new Error(`${source.exe} not found inside downloaded zip`);
    copyFileSync(exe, dest); // copy, not rename: temp dir may be on another drive
    if (process.platform !== 'win32') {
      execFileSync('chmod', ['+x', dest]);
    }
    console.log(`  -> ${dest}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function fetchW08() {
  if (existsSync(DATA_DIR) && readdirSync(DATA_DIR).some((f) => f.toLowerCase().startsWith('w08'))) {
    console.log('= W08 star database already present');
    return;
  }
  console.log('+ W08 star database');
  const work = join(tmpdir(), `astap-w08-${process.pid}`);
  mkdirSync(work, { recursive: true });
  try {
    const zip = join(work, 'w08.zip');
    await download(W08_URL, zip);
    extract(zip, DATA_DIR);
    const files = readdirSync(DATA_DIR).filter((f) => f.toLowerCase().startsWith('w08'));
    if (files.length === 0) throw new Error('No w08* files found after extraction');
    console.log(`  -> ${DATA_DIR} (${files.length} files, ${files
      .map((f) => statSync(join(DATA_DIR, f)).size)
      .reduce((a, b) => a + b, 0)} bytes)`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
const triples = args.includes('--all')
  ? Object.keys(CLI_SOURCES)
  : args.flatMap((a, i) => (a === '--target' && args[i + 1] ? [args[i + 1]] : []));
if (triples.length === 0) triples.push(hostTriple());

try {
  for (const triple of triples) {
    await fetchCli(triple);
  }
  await fetchW08();
  console.log('fetch-astap: done');
} catch (err) {
  console.error(`fetch-astap: FAILED — ${err.message}`);
  console.error('The app still builds without bundled ASTAP if you remove bundle.externalBin/resources, but plate solving will require a manual ASTAP install.');
  process.exit(1);
}
