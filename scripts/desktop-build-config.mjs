export function createDesktopBuildConfig(baseConfig, platform, channel) {
  if (platform !== 'windows' && platform !== 'mac') {
    throw new Error(`Unsupported desktop build platform: ${platform}`);
  }
  if (channel !== 'stable' && channel !== 'dev') {
    throw new Error(`Unsupported desktop build channel: ${channel}`);
  }

  const isDev = channel === 'dev';
  const productName = isDev ? `${baseConfig.productName} Dev` : baseConfig.productName;
  const output = `release/${platform}${isDev ? '-dev' : ''}`;
  const config = {
    ...baseConfig,
    appId: isDev ? `${baseConfig.appId}.dev` : baseConfig.appId,
    productName,
    directories: { ...baseConfig.directories, output },
    extraMetadata: {
      ...baseConfig.extraMetadata,
      kestralBuildChannel: channel,
    },
  };

  if (platform === 'windows') {
    config.win = {
      ...baseConfig.win,
      ...(isDev ? { artifactName: 'KestralBudget-Dev-Setup-${version}.${ext}' } : {}),
    };
    config.nsis = { ...baseConfig.nsis, shortcutName: productName };
  } else if (isDev) {
    config.artifactName = 'KestralBudget-Dev-${version}-${arch}.${ext}';
  }

  return config;
}
