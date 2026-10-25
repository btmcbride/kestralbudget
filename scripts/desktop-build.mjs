import { createRequire } from 'node:module';
import { createDesktopBuildConfig } from './desktop-build-config.mjs';

const require = createRequire(import.meta.url);
const { Arch, Platform, build } = require('electron-builder');
const packageJson = require('../package.json');
const platform = process.argv[2];
const channel = process.argv[3];

if (platform !== 'windows' && platform !== 'mac') {
  throw new Error('Choose a desktop build platform: windows or mac.');
}

const targets = platform === 'windows'
  ? Platform.WINDOWS.createTarget('nsis', Arch.x64)
  : Platform.MAC.createTarget('dmg', Arch.arm64);

await build({
  targets,
  publish: 'never',
  config: createDesktopBuildConfig(packageJson.build, platform, channel),
});
