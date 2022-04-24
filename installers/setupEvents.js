const electron = require('electron');
const nedb = require("nedb");
const app = electron.app;

module.exports = {
	handleSquirrelEvent: function() {
		if (process.argv.length === 1) {
			return false;
		}

		const ChildProcess = require('child_process');
		const path = require('path');
		const fs = require('fs');
		const fse = require('fs-extra');

		const appFolder = path.resolve(process.execPath, '..');
		const rootAtomFolder = path.resolve(appFolder, '..');
		const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
		const exeName = path.basename(process.execPath);
		const docDir = path.join(app.getPath("home"), 'Production Interface IO');
		const spawn = function(command, args) {
			let spawnedProcess, error;

			try {
				spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
			} catch (error) {}

			return spawnedProcess;
		};

		const spawnUpdate = function(args) {
			return spawn(updateDotExe, args);
		};

		const squirrelEvent = process.argv[1];
		switch (squirrelEvent) {
			case '--squirrel-install':
			case '--squirrel-updated':
				// Optionally do things such as:
				// - Add your .exe to the PATH
				// - Write to the registry for things like file associations and
				// explorer context menus

				// create piio folder in users Documents
				var clientSettings = new nedb({ filename: path.join(app.getPath("userData"), 'settings.db'), autoload:true});

				
				
				fse.ensureDirSync(docDir);
				fse.ensureDirSync(path.join(docDir, 'logs'));
				fse.ensureDirSync(path.join(docDir, 'themes'));
				fse.ensureDirSync(path.join(docDir, 'assets'));
				fse.ensureDirSync(path.join(docDir, 'assets', 'character'));
				fse.ensureDirSync(path.join(docDir, 'assets', 'country'));
				fse.ensureDirSync(path.join(docDir, 'assets', 'game'));
				fse.ensureDirSync(path.join(docDir, 'assets', 'player'));
				
				fse.copySync(path.join(app.getAppPath(), 'themes', 'default'), path.join(docDir, 'themes', 'default'), { overwrite: true });
				
				// create databases
				var dbstructDB = new nedb({ filename: path.join(docDir, 'db', 'dbstruct'), autoload:true});
				dbstructDB.remove({}, { multi: true }, () => {
					dbstructDB.insert([
						{"name":"team","field":"delimiter","type":"text","default":" | ","index":-4},
						{"name":"player","field":"pronoun","type":"text","listhide":true},
						{"name":"player","field":"birthday","type":"date","listhide":true},
						{"name":"player","field":"lastname","type":"text","index":-3},
						{"name":"character","field":"skins","type":"text","multi":true},
						{"name":"player","field":"team","type":"relation","relation":"team","multi":true},
						{"name":"team","field":"website","index":-4,"type":"text"},
						{"name":"player","field":"firstname","type":"text","index":-2},
						{"name":"team","field":"regex","type":"text","index":-4},
						{"name":"country","field":"continent","index":-2,"type":"text"},
						{"name":"game","field":"name","type":"text","index":-1},
						{"name":"character","field":"name","type":"text","relation":null,"multi":null},
						{"name":"player","field":"country","type":"relation","relation":"country","index":-4},
						{"name":"character","field":"game","type":"relation","relation":"game","multi":null},
						{"name":"country","field":"nation","type":"relation","relation":"country","multi":null,"index":-2},
						{"name":"country","field":"name","index":-1,"type":"text"},
						{"name":"player","field":"name","type":"text","index":-1},
						{"name":"game","field":"shorten","type":"text","index":-2},
						{"name":"character","field":"shorten","type":"text","relation":null,"multi":null},
						{"name":"player","field":"twitch","type":"text","index":-4},
						{"name":"player","field":"steam","type":"text","listhide":true},
						{"name":"team","field":"prefix","index":-3,"type":"text"},
						{"name":"team","field":"shorten","index":-2,"type":"text"},
						{"name":"player","field":"twitter","type":"text"},
						{"name":"player","field":"smashgg","type":"number"},
						{"name":"team","field":"name","index":-1,"type":"text"}
					]);
				});

				
			//	fse.copySync(path.join(app.getAppPath(), 'db', 'dbstruct'), path.join(rootAtomFolder, 'db', 'dbstruct'), { overwrite: true });
			//	fse.copySync(path.join(app.getAppPath(), 'db', 'country'), path.join(rootAtomFolder, 'db', 'country'), { overwrite: false });
			//	fse.copySync(path.join(app.getAppPath(), 'db', 'game'), path.join(rootAtomFolder, 'db', 'game'), { overwrite: false });
			//	fse.copySync(path.join(app.getAppPath(), 'db', 'character'), path.join(rootAtomFolder, 'db', 'character'), { overwrite: false });

				
				// Install desktop and start menu shortcuts
				spawnUpdate(['--createShortcut', exeName]);

				setTimeout(app.quit, 1000);
				return true;

			case '--squirrel-uninstall':
				// Undo anything you did in the --squirrel-install and
				// --squirrel-updated handlers

				// Remove desktop and start menu shortcuts
				spawnUpdate(['--removeShortcut', exeName]);

				setTimeout(app.quit, 1000);
				return true;

			case '--squirrel-obsolete':
				// This is called on the outgoing version of your app before
				// we update to the new version - it's the opposite of
				// --squirrel-updated

				app.quit();
				return true;
		}
	}
}