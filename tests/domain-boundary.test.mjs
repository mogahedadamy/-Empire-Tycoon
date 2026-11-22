/** Verifies the domain compiler rejects browser APIs and application imports. */
import { execFile } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';

const run = promisify(execFile);
const config = new URL('../packages/tsconfig.domain.json', import.meta.url);
const compiler = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'empire-domain-'));
  mkdirSync(join(root, 'packages/simulation/src'), { recursive: true });
  copyFileSync(config, join(root, 'packages/tsconfig.domain.json'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

async function compileDomain(source) {
  writeFileSync(join(root, 'packages/simulation/src/index.ts'), source);
  const command = [compiler, '-p', 'packages/tsconfig.domain.json'];
  try {
    const { stdout } = await run(process.execPath, command, { cwd: root });
    return { status: 0, stdout };
  } catch (error) {
    if (typeof error.code !== 'number') throw error;
    return { status: error.code, stdout: error.stdout };
  }
}

it('allows standard ECMAScript APIs but rejects a DOM global', async () => {
  const accepted = await compileDomain('export const value = new Map([[1, 2]]);');
  expect(accepted.status, accepted.stdout).toBe(0);

  const rejected = await compileDomain('export const element = document.body;');
  expect(rejected.status).toBe(2);
  expect(rejected.stdout).toContain("Cannot find name 'document'");
}, 10000);

it('rejects a dependency on application source outside packages', async () => {
  mkdirSync(join(root, 'apps/game/src'), { recursive: true });
  writeFileSync(join(root, 'apps/game/src/main.ts'), 'export const app = 1;');

  const result = await compileDomain("export { app } from '../../../apps/game/src/main';");
  expect(result.status).toBe(2);
  expect(result.stdout).toContain('is not under');
  expect(result.stdout).toContain('rootDir');
});
