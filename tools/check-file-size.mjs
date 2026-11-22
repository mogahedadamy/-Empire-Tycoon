/** Checks physical line counts in tracked and non-ignored working-tree files. */
import { execFile } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { promisify, TextDecoder } from 'node:util';

const run = promisify(execFile);
const maximumLines = 350;
const dataFiles = new Set([
  'docs/production/tasks/index.json',
  'packages/content/data/big-order.json',
  'docs/research/football-2026-27/competition-calendar.json',
  'docs/research/football-2026-27/continental-membership.json',
  'docs/research/football-2026-27/domestic-membership.json',
  'docs/research/football-2026-27/uefa-coefficients.json',
]);
const lockfiles = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock']);
const generatedPaths = /^(?:dist|coverage)\/|^apps\/game\/dist\/|(?:^|\/)node_modules\//;
const decoder = new TextDecoder('utf-8', { fatal: true });

async function git(args, cwd) {
  const { stdout } = await run('git', args, { cwd, encoding: 'utf8' });
  return stdout;
}

function isExcluded(path) {
  return dataFiles.has(path) || lockfiles.has(basename(path)) ||
    /\.(?:md|mdx|rst|adoc)$/i.test(path) || generatedPaths.test(path);
}

function readText(path) {
  // Git can still list tracked paths deleted locally. Symlinks have no source content.
  if (!lstatSync(path, { throwIfNoEntry: false })?.isFile()) {
    return null;
  }

  const bytes = readFileSync(path);
  if (bytes.includes(0)) {
    return null;
  }

  try {
    return decoder.decode(bytes);
  } catch (error) {
    if (error instanceof TypeError) {
      return null; // Non-UTF-8 binary asset.
    }
    throw error;
  }
}

function countLines(source) {
  if (source.length === 0) {
    return 0;
  }
  const lines = source.split(/\r\n|\n|\r/);
  return lines.at(-1) === '' ? lines.length - 1 : lines.length;
}

const root = (await git(['rev-parse', '--show-toplevel'])).replace(/\r?\n$/, '');
const listedFiles = await git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], root);
const files = new Set(listedFiles.split('\0'));
let checked = 0;

for (const path of files) {
  if (!path || isExcluded(path)) {
    continue;
  }

  const source = readText(join(root, path));
  if (source === null) {
    continue;
  }

  checked += 1;
  const lines = countLines(source);
  if (lines > maximumLines) {
    console.error(`${path}: ${lines} lines (maximum ${maximumLines})`);
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  console.log(`Checked ${checked} files (maximum ${maximumLines} lines per file).`);
}
