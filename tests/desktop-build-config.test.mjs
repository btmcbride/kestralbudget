import test from 'node:test';
import assert from 'node:assert/strict';

import { createDesktopBuildConfig } from '../scripts/desktop-build-config.mjs';

const baseConfig = {
  appId: 'com.kestralbudget.desktop',
  productName: 'Kestral Budget',
  directories: { output: 'release/windows' },
  win: { artifactName: 'KestralBudget-Setup-${version}.${ext}' },
  nsis: { shortcutName: 'Kestral Budget' },
};

test('stable builds keep the existing application identity and output path', () => {
  const config = createDesktopBuildConfig(baseConfig, 'windows', 'stable');

  assert.equal(config.appId, 'com.kestralbudget.desktop');
  assert.equal(config.productName, 'Kestral Budget');
  assert.equal(config.directories.output, 'release/windows');
  assert.equal(config.extraMetadata.kestralBuildChannel, 'stable');
});

test('dev builds use distinct app identities, artifacts, and output paths', () => {
  const windowsConfig = createDesktopBuildConfig(baseConfig, 'windows', 'dev');
  const macConfig = createDesktopBuildConfig(baseConfig, 'mac', 'dev');

  assert.equal(windowsConfig.appId, 'com.kestralbudget.desktop.dev');
  assert.equal(windowsConfig.productName, 'Kestral Budget Dev');
  assert.equal(windowsConfig.directories.output, 'release/windows-dev');
  assert.equal(windowsConfig.win.artifactName, 'KestralBudget-Dev-Setup-${version}.${ext}');
  assert.equal(windowsConfig.nsis.shortcutName, 'Kestral Budget Dev');
  assert.equal(macConfig.directories.output, 'release/mac-dev');
  assert.equal(macConfig.artifactName, 'KestralBudget-Dev-${version}-${arch}.${ext}');
  assert.equal(macConfig.extraMetadata.kestralBuildChannel, 'dev');
});

test('build config rejects unknown platforms and channels', () => {
  assert.throws(() => createDesktopBuildConfig(baseConfig, 'linux', 'stable'));
  assert.throws(() => createDesktopBuildConfig(baseConfig, 'windows', 'preview'));
});
