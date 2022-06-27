module.exports = {
  make_targets: {
    win32: ['squirrel', 'zip']
  },
  electronPackagerConfig: {
    packageManager: 'npm',
    asar: true,
    icon: './img/piio.ico'
  },
  electronWinstallerConfig: {
    name: 'piio',
    setupIcon: './img/piio.ico',
    loadingGif: './img/loading.gif'
  }
}