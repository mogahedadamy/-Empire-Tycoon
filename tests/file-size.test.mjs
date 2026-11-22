/** Exercises the file-size command against isolated Git working trees. */
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';

const run = promisify(execFile);
const checker = fileURLToPath(new URL('../tools/check-file-size.mjs', import.meta.url));
let root;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'empire-size-'));
  await run('git', ['init', '--quiet'], { cwd: root });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeFixture(path, contents) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

async function check() {
  try {
    const output = await run(process.execPath, [checker], { cwd: root });
    return { status: 0, ...output };
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    return { status: error.code, stdout: error.stdout, stderr: error.stderr };
  }
}

it('accepts 200 and 350 lines, including comments and blank lines', async () => {
  writeFixture('src/target.ts', '// comment\n\n'.repeat(100));
  writeFixture('src/limit.ts', '// comment\r\n\r\n'.repeat(175));
  const result = await check();

  expect(result.status).toBe(0);
  expect(result.stdout).toContain('Checked 2 files');
  expect(result.stderr).toBe('');
});

it('rejects every file over 350 lines, including an unterminated last line', async () => {
  writeFixture('src/too long.ts', '// comment\r\n\r\n'.repeat(175) + 'export {};');
  writeFixture('.github/workflows/ci.yml', '# comment\n'.repeat(352));
  const result = await check();

  expect(result.status).toBe(1);
  expect(result.stderr).toContain('src/too long.ts: 351 lines');
  expect(result.stderr).toContain('.github/workflows/ci.yml: 352 lines');
});

it('excludes data, docs and generated files while checking handwritten code beside them', async () => {
  const oversized = '\n'.repeat(351);
  const data = '[' + '\n'.repeat(350) + ']';
  writeFixture('docs/production/tasks/index.json', data);
  writeFixture('packages/content/data/big-order.json', data);
  writeFixture('docs/README.md', oversized);
  writeFixture('package-lock.json', oversized);
  writeFixture('node_modules/example/index.js', oversized);
  writeFixture('dist/bundle.js', oversized);
  writeFixture('apps/game/dist/bundle.js', oversized);
  writeFixture('docs/research/football-2026-27/uefa-coefficients.json', data);
  writeFixture('public/logo.png', Buffer.from([137, 80, 78, 71, 0]));
  writeFixture('docs/research/football-2026-27/generate.mjs', oversized);
  writeFixture('tools/templates/game.html', oversized);

  const result = await check();
  expect(result.status).toBe(1);
  expect(result.stderr.trim().split('\n')).toEqual([
    'docs/research/football-2026-27/generate.mjs: 351 lines (maximum 350)',
    'tools/templates/game.html: 351 lines (maximum 350)',
  ]);
});

it('checks tracked source even under a local ignore rule and tolerates local deletions', async () => {
  writeFixture('.gitignore', 'android/\n');
  writeFixture('android/Bridge.java', '\n'.repeat(351));
  writeFixture('src/old.ts', 'export {};');
  await run('git', ['add', '-f', '--', 'android/Bridge.java', 'src/old.ts'], { cwd: root });
  rmSync(join(root, 'src/old.ts'));

  const result = await check();
  expect(result.status).toBe(1);
  expect(result.stderr.trim()).toBe('android/Bridge.java: 351 lines (maximum 350)');
});
