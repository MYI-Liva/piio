const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller
const path = require('path')

getInstallerConfig()
  .then(createWindowsInstaller)
  .catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })

function getInstallerConfig () {
  console.log('creating windows installer')
  const rootPath = path.join('./')
  const outPath = path.join(rootPath, 'release-builds')

  return Promise.resolve({
    appDirectory: path.join(outPath, 'piio-win32-x64/'),
    authors: 'Philipp Bürkner',
    noMsi: true,
    loadingGif: 'img/loading.gif',
    outputDirectory: path.join(outPath, 'windows-installer'),
    exe: 'piio.exe',
    setupExe: 'setup.exe',
	debug :true
  })
}