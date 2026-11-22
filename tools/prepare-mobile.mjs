/** Creates a missing local Capacitor project and syncs the built game into it. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const platform = process.argv[2];
if (platform !== 'android' && platform !== 'ios') {
  console.error('Usage: npm run prepare:mobile -- android|ios');
  process.exit(1);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/@capacitor/cli/bin/capacitor', import.meta.url));
const paths = {
  android: 'android/gradlew',
  ios: 'ios/App/App.xcodeproj/project.pbxproj',
};
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

function cap(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function addSwiftPackageProject() {
  // Capacitor 7.6.10 lowercases the SPM flag before checking for it, which still requires CocoaPods on macOS.
  const { loadConfig } = await import('@capacitor/cli/dist/config.js');
  const { addCommand } = await import('@capacitor/cli/dist/tasks/add.js');
  process.chdir(root);
  const config = await loadConfig();
  config.ios.packageManager = Promise.resolve('SPM');
  config.cli.assets.ios.platformTemplateArchive = 'ios-spm-template.tar.gz';
  config.cli.assets.ios.platformTemplateArchiveAbs = resolve(config.cli.assetsDirAbs, 'ios-spm-template.tar.gz');
  await addCommand(config, 'ios');
}

if (!exists(paths[platform])) {
  if (exists(platform)) {
    console.error(`Incomplete Capacitor project in ${platform}. Restore or move it before retrying.`);
    process.exit(1);
  }
  if (platform === 'ios') await addSwiftPackageProject();
  else process.exitCode = cap(['add', platform]);
} else {
  process.exitCode = cap(['sync', platform]);
}
