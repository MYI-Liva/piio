const {clipboard} = require('electron');
const dialog = remote.dialog;
const path = require('path');
const fs = require('fs');

const APPROOT = remote.getGlobal("APPROOT");
const APPRES = remote.getGlobal("APPRES");

var _maxPerPage = 20;
var _currentPage = 1;

var _directory = [];
var _rel;
var _relation = {
	character:["game", "character", null, "character.skins"],
	player:[null, "player"],
	country:["country"],
	game:["game"],
	team:["team"]
};
var _folderTemplate = {
	character:["{game:id}/{character:id}/stock","{game:id}/{character:id}/portrait"],
	player:["photo","avatar"]
}

class List {
	constructor(){
		this.element;
		this.searchInput;
		this.searchInputTimeout = 0;

		this.loadInitTime = 0;
	}

	init(){
		this.element = document.getElementById("list-grid");
		this.searchInput = document.getElementById("search-txb");


		this.searchInput.oninput = () => {
			clearTimeout(this.searchInputTimeout);
			this.searchInputTimeout = setTimeout(() => this.load(), 300);
		}
		
	}

	async load(){
		let initTime = new Date().getTime();
		this.loadInitTime = initTime;

		this.element.innerHTML = "";

		let directories = getFilteredCategories();
		let filteredIds = null;
		let searchValue = this.searchInput.value.trim();
		if(searchValue.length > 0){
			// use search terms of filtering
			let promises = [
				new Promise((r) => db.get("character", { name: { $regex: new RegExp(searchValue, 'i') } }).then(entries => r(entries.map(x => x._id)))),
				new Promise((r) => db.get("game", { name: { $regex: new RegExp(searchValue, 'i') } }).then(entries => r(entries.map(x => x._id)))),
				new Promise((r) => db.get("player", { name: { $regex: new RegExp(searchValue, 'i') } }).then(entries => r(entries.map(x => x._id)))),
				new Promise((r) => db.get("team", {$or:[{ name: { $regex: new RegExp(searchValue, 'i') } },{ shorten: { $regex: new RegExp(searchValue, 'i') } }]}).then(entries => r(entries.map(x => x._id))))
			];
			// INFO: could be optimized by checking if specific databases (character etc) have any result and if not, exclude these directories beforehand
			filteredIds = await Promise.all(promises).then(x => x.flat());
		}


		if(initTime != this.loadInitTime){return} // abort if init time doesnt match anymore (new request has been made)


		let fileList = [];
		for(let directory of directories){
			let result = await readAssetsFolder(directory);
			fileList = fileList.concat(result);

			if(initTime != this.loadInitTime){return} // abort if init time doesnt match anymore (new request has been made)
		}

		// apply search filter
		if(filteredIds != null){
			fileList = fileList.filter(x => x.components.some(x => filteredIds.includes(x) || filteredIds.includes(x.split(".")[0])));
		}

		for(let idx in fileList){
			let itemEl = createElement({type: "div", className: "item"});
			itemEl.onmouseover = () => fillAssetQuickInfo(fileList[idx]);
			itemEl.onmousemove = (e) => moveAssetQuickInfo(e, itemEl);
			itemEl.onmouseout = hideAssetQuickInfo;
	
			let previewEl = generateAssetPreview(`${APPRES}/assets/${fileList[idx].path}`);
			itemEl.appendChild(previewEl);
	
			this.element.appendChild(itemEl);
		}
	}
}

let assetsList = new List();

window.onload = async () => {
	assetsList.init();

	await buildCategorieFilterArea();

	assetsList.load();
};




/*
async buildCategorieFilterArea() : void
reads all subdirectories in assets folder and build filter checkboxes
its recommended to await this function
*/
async function buildCategorieFilterArea(){
	// get all categories (such as players, games, characters, etc)
	let directories = await getSubDirectories(`${APPRES}/assets`);

	let el = document.getElementById('filter-categorie-select-area');
	el.innerHTML = "";

	for(let idx in directories){
		// create checkbox for each folder/categorie
		let itemEl = createElement({type: "div", "className": "item"});

		// build checkbox
		let checkboxEl = createElement({type: "input"});
		checkboxEl.categorieName = directories[idx];
		checkboxEl.type = "checkbox";
		checkboxEl.checked = directories[idx] == "character"; // DEBUG
		checkboxEl.onchange = () => assetsList.load();
		itemEl.appendChild(checkboxEl);

		// build label
		let labelEl = createElement({type: "label", "text": directories[idx]});
		itemEl.appendChild(labelEl);

		// add to area
		el.appendChild(itemEl);
	}
}

/*
async getSubDirectories(path) : Array<String>
path = directory to look for subfolders
returns Array<String> containing all sub folder names
*/
async function getSubDirectories(dirPath){
	return await new Promise((resolve) => {
		fs.readdir(dirPath, {withFileTypes:true}, (err, folders) => {
			if(err){
				console.error(err);
				return resolve([]);
			}

			// filter out files
			folders = folders.filter(x => x.isDirectory());

			// convert Dirent into String
			folders = folders.map(x => x.name);
			resolve(folders);
		});
	});
}



function showAssetsList(arg){
	_directory = [{"path":path.join(APPRES, "assets"),"name":"Assets"}];
	if(arg){
		_rel = _relation[arg.path];
		_directory.push({"path":arg.path, "name":arg.name});
	}else{
		_rel = null;
	}
	assetsList.load();
}

async function getList(){
	let listEl = document.getElementById("list-grid").truncate();

	let directories = getFilteredCategories();

	let fileList = [];
	for(let category of directories){
		let files = await readAssetsFolder(`${category}`);
		fileList = fileList.concat(files)
	}

	// console.log(fileList);

	for(let idx in fileList){
		let itemEl = createElement({type: "div", className: "item"});
		itemEl.onmouseover = () => fillAssetQuickInfo(fileList[idx]);
		itemEl.onmousemove = (e) => moveAssetQuickInfo(e, itemEl);
		itemEl.onmouseout = hideAssetQuickInfo;


		let previewEl = generateAssetPreview(`${APPRES}/assets/${fileList[idx].path}`);
		itemEl.appendChild(previewEl);

		listEl.appendChild(itemEl);
	}


}

async function fillAssetQuickInfo(asset){
	let el = document.getElementById('asset-quick-info');
	let filenameEl = document.getElementById('asset-quick-info-filename');
	let filepathEl = document.getElementById('asset-quick-info-filepath');
	let sizeEl = document.getElementById('asset-quick-info-size');

	// calculate image size
	sizeEl.innerText = "";
	let testImage = new Image();
	testImage.onload = () => sizeEl.innerText = `${testImage.width}x${testImage.height}`;
	testImage.src = `${APPRES}/assets/${asset.path}`;



	let translations = [];
	// check if this file is a character asset - add to translation if so
	if(asset.components[0] == "character"){
		// check if character asset has a valid characterId
		let character = await db.getSingle("character", {"_id": asset.components[1]});
		let game = await db.getSingle("game", {"_id": character?.game});
		translations[1] = character?.name ? `${character.name} (${game.shorten})` : undefined;
	}

	if(asset.components[0] == "team"){
		let team = await db.getSingle("team", {"_id": asset.name.split(".")[0]});
		translations[1] = team?.name ?? null;
	}

	filenameEl.innerText = asset.name;
	filepathEl.innerHTML = asset.components.map((value, idx) => `<span class="component">${(translations[idx] ? `${value} <span class="path-id">${translations[idx]}</span>` : value)}</span>`).join(" / ");

	el.classList.add("visible");
}

function moveAssetQuickInfo(event, element){
	let el = document.getElementById('asset-quick-info');
	let listEl = document.getElementById('list');
	let arrowEl = el.querySelector(".arrow");

	let elementBounds = element.getBoundingClientRect();

	let maxX = listEl.getBoundingClientRect().width - el.getBoundingClientRect().width;
	let posX = Math.min(elementBounds.x, maxX);

	el.style.left = `${posX}px`;
	el.style.top = `${elementBounds.y + elementBounds.height + 15}px`;

	arrowEl.style.left = `${elementBounds.x - posX  + elementBounds.width/2 - 10}px`;
}

function hideAssetQuickInfo(){
	let el = document.getElementById('asset-quick-info');
	el.classList.remove("visible");
}

function generateAssetPreview(filePath){
	// create preview image
	let imageScale = parseInt(document.getElementById('preview-image-scale').value) / 100;
	let previewEl = document.createElement("canvas");
	previewEl.width = 90 * imageScale;
	previewEl.height = 70 * imageScale;
	let ctx = previewEl.getContext("2d");
	ctx.fillStyle = "#222";
	ctx.fillRect(0, 0, previewEl.width, previewEl.height);
	ctx.fillStyle = "#fff";
	ctx.font = "10px Arial";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText("LOADING", previewEl.width/2, previewEl.height/2);
	let preLoadImg = new Image();
	preLoadImg.onload = () => {
		ctx.clearRect(0, 0, previewEl.width, previewEl.height);
		let hRatio = previewEl.width / preLoadImg.width;
		let vRatio =  previewEl.height / preLoadImg.height;
		let ratio  = Math.min ( hRatio, vRatio );

		if(ratio > 1){ // make scaling a little big cleaner for smaller images (pixel scaling)
			ratio = Math.round(ratio*2) / 2;
			ctx.imageSmoothingEnabled = false;// disable smoothing for smaller images
		}

		let centerShift_x = ( previewEl.width - preLoadImg.width*ratio ) / 2;
		let centerShift_y = ( previewEl.height - preLoadImg.height*ratio ) / 2;


		ctx.drawImage(preLoadImg, 0, 0, preLoadImg.width, preLoadImg.height, centerShift_x, centerShift_y, preLoadImg.width*ratio, preLoadImg.height*ratio);
	}
	preLoadImg.src = filePath;
	return previewEl;
}

function changePreviewScaling(value){
	assetsList.load();
}

/*
return all asset categories which are enabled by filters
*/
function getFilteredCategories(){
	let el = document.getElementById('filter-categorie-select-area');
	return Array.from(Array.from(el.children).map(x => x.querySelector('input[type="checkbox"]:checked'))).filter(x => x != null).map(x => x.categorieName);
}

async function readAssetsFolder(dirPath){
	return await new Promise( (resolve) => {
		fs.readdir(`${APPRES}/assets/${dirPath}`, {withFileTypes:true}, async (err, entries) => {
			if(err){
				console.error(err);
				return resolve([]);
			}
			let list = [];
			for(let idx in entries){
				let entryPath = `${dirPath}/${entries[idx].name}`;
				if(entries[idx].isDirectory()){
					list = list.concat(await readAssetsFolder(entryPath));
					continue;
				}
				let pathComponents = entryPath.split("/");
				let item = {
					"name": entries[idx].name,
					"path": entryPath,
					"components": pathComponents
				};
				list.push(item);
			}
			resolve(list);
		});
	});
}


function getList_OLD(dir){
	var pathEl = document.getElementById('path').truncate();
	var listEl = document.getElementById("list-grid").truncate();
	_directory = dir || _directory;
	
	_directory.forEach((folder, index) => {
		let childEl = document.createElement('div');
		childEl.innerText = folder.name;
		
		if(index >= 2 && _rel[index-2]){
			db.getSingle(_rel[index-2], folder.path).then(entry => {
				childEl.innerText = entry[Object.keys(entry)[0]];
			});
		}
		childEl.onclick = () => {
			if(index > 0){
				getList(_directory.slice(0, index+1));
			}
		};
		pathEl.appendChild(childEl);
	});
	
	var dirPath = path.join.apply(null, _directory.map(x => x.path));
	var rel = _directory.length >= 2 && _rel ? _rel[_directory.length - 2] : null;
	var relDb = null;
	
	if(_rel){
		for(let i = _directory.length - 3; i >= 0; i--){
			if(relDb == null && _rel[i] != null){
				relDb = _rel[i];
				break;
			}
		}
	}
	
	
	fs.readdir(dirPath, (err, files) => {
		var query = {};
		if(rel){
			var isFileList = (_rel.indexOf(rel)+1 == _rel.length);
			var relPath = rel.split(".");
			if(relPath.length >= 2){
				// get multiple entries of one dataset
				rel = relPath.shift();
				if(relDb != null && _directory && _directory[_directory.length-1]){
					query = _directory[_directory.length-1].path;
				}
				
				if(relDb != null){
					let index = _rel.indexOf(relDb) + 2;
					query = _directory[index].path;
				}
				
				db.getSingle(rel, query).then(dataset => {
					let entries = deep_value(dataset, relPath.join("."));
					entries.forEach(entry => {
						childEl = buildRelatedItem(isFileList, entry, dirPath, entry);
						listEl.appendChild(childEl);
					});
				}).catch(er => {
					console.log(er);
				});
			}else{
				// get multiple datasets from database
				if(relDb != null && _directory && _directory[_directory.length-1]){
					query[relDb] = _directory[_directory.length-1].path;
				}
				db.get(rel, query, null, {sort:{"name":1}}).then(entries => {
					entries.forEach(entry => {
						
						let fieldName = entry.hasOwnProperty("name") ? "name" : Object.keys(entry)[0];
						
						childEl = buildRelatedItem(isFileList, entry[fieldName], dirPath, entry._id);
						listEl.appendChild(childEl);
					});
				});
			}
			
		}else{
			let folderTpl = _folderTemplate[_directory[1].path];
			if(folderTpl){
				files = [];
				folderTpl.forEach(folder => {
					var folderParts = folder.split("/");
					var name = folderParts[_directory.length - 2];
					files.push(name);
				});
			}
			
			files.forEach(file => {
				let stat;
				let dir = path.join(dirPath, file);
				let childEl = createElement({className:"item"});
				try {
					stat = fs.statSync(dir);
				}catch(e){
					createFolders(dir);
					stat = fs.statSync(dir);
				}
				let fileInfo = path.parse(dir);
				if(stat.isDirectory()){
					childEl = buildFolderItem(fileInfo.name, file, rel);
				}else{
					childEl = buildFileItem(fileInfo.name, dirPath, file, rel);
				}
				listEl.appendChild(childEl);
			});
		}
	});
}

function createFolders(dir){
	var pathParts = dir.split("\\")
	for(let i = 2;i <= pathParts.length;i++){
		let path = pathParts.slice(0, i).join("\\");
		try {
			let stat = fs.statSync(path);
		}catch(e){
			fs.mkdirSync(path);
		}
	}
}

function buildRelatedItem(isFileList, name, dirPath, id, rel){
	if(isFileList){
		let childElm;
		if(fs.existsSync(path.join(dirPath, id+".png"))){
			childElm = buildFileItem(name, dirPath, id+".png");
		}else if(fs.existsSync(path.join(dirPath, id+".jpg"))){
			childElm = buildFileItem(name, dirPath, id+".jpg");
		}else if(fs.existsSync(path.join(dirPath, id+".svg"))){
			childElm = buildFileItem(name, dirPath, id+".svg");
		}else{
			childElm = createElement({className:"item file add"});
			let labelEl = document.createElement("div");
			let fileEl = createElement({"className":"file"});
			labelEl.innerText = name;
			childElm.appendChild(labelEl);
			childElm.appendChild(fileEl);
		}
		childElm.lastChild.onclick = () => {
			console.log("childElm.lastChild.onclick", dirPath, id);
			editAsset(name, path.join(dirPath, id+".png")).then(getList);
			
		}
		childElm.lastChild.ondragenter = e => {
			childElm.classList.add("dropfile");
			e.preventDefault();
		}
		childElm.lastChild.ondragleave  = e => {
			childElm.classList.remove("dropfile");
			console.log(e);
		}
		childElm.lastChild.ondragover  = e => {
			event.preventDefault();
		}
		childElm.lastChild.ondrop  = e => {
			childElm.classList.remove("dropfile");
			editAsset(name, path.join(dirPath, id+".png"), e.dataTransfer.files[0].path).then(getList);
			e.preventDefault();
		}
		return childElm;
	}else{
		return buildFolderItem(name, id);
	}
}

function buildFolderItem(name, id, rel){
	let childEl = createElement({className:"item dir"});
	childEl.innerText = name;
	if(rel){
		db.getSingle(rel, id).then(entry => {
			childEl.innerText = entry[Object.keys(entry)[0]];
		});
	}
	childEl.onclick = () => {
		_directory.push({"path":id,"name":id});
		getList();
	};
	return childEl;
}
function buildFileItem(name, dirPath, id, rel){
	let childEl = createElement({className:"item file"});
	let labelEl = document.createElement("div");
	let fileEl = createElement({"className":"file"});
	labelEl.innerText = name;
	if(rel){
		db.getSingle(rel, name).then(entry => {
			labelEl.innerText = entry[Object.keys(entry)[0]];
		}).catch(() => {
			labelEl.innerText = rel+ " not found";
		});
	}
	fileEl.style.backgroundImage = 'url("'+path.join(dirPath, id).split('\\').join('/')+'")';
	childEl.appendChild(labelEl);
	childEl.appendChild(fileEl);
	return childEl;
}

function editAsset(name, filePath, uploadFile){
	return new Promise((resolve, reject) => {
		
		var file;
		filePath = path.normalize(filePath);
		var dir = path.dirname(filePath);
		if(uploadFile){
			file = [uploadFile];
		}else{
			file = dialog.showOpenDialog({
				filters:[
					{name: 'Images', extensions: ['jpg', 'png', 'gif', 'svg']}
				],
			});
		}
		if(!file)
			return reject("file open abort");
		try {
			fs.statSync(dir);
		} catch(e) {
			fs.mkdirSync(dir, {recursive: true});
		}
	
		fs.copyFile(path.normalize(file[0]), filePath, (err) => {
			if (err) return reject(err);
			resolve();
		});
	
	});
}



async function openBatchUpload(){
	document.getElementById(`batch-upload`).classList.add("visible");
	buildBatchUploadUI();
}

function closeBatchUpload(){
	document.getElementById(`batch-upload`).classList.remove("visible");
}

async function buildBatchUploadUI(...args){
	let el = document.getElementById('batch-upload-select').truncate();

	let returnBtn = document.createElement("button");
	returnBtn.innerText = "Back";
	returnBtn.onclick = () => {
		if(args.length == 0){
			return closeBatchUpload();
		}
		buildBatchUploadUI(...args.slice(0, -1));
	};
	el.appendChild(returnBtn);

	let directory = args[0];
	if(!directory){
		let directories = await db.get("dbstruct").then(x => x.map(x => x.name)).then(x => [...new Set(x)]);

		let directorySelectEl = document.createElement("div");
		directorySelectEl.id = "batch-upload-select-directories";
		directorySelectEl.className = "button-grid";
		// build buttons
		for(let directory of directories){
			let buttonEl = document.createElement("button");
			buttonEl.innerText = directory;
			buttonEl.onclick = () => buildBatchUploadUI(...args, directory);
			directorySelectEl.appendChild(buttonEl);
		}

		el.appendChild(directorySelectEl);
		return;
	}

	let assetType = args[1];
	if(!assetType){

		let types = await readAssetsFolder(directory).then(x => [...new Set(x.map(x => (x.components?.[2] ?? null)))]);

		let typeSelectEl = document.createElement("div");
		typeSelectEl.id = "batch-upload-select-types";
		typeSelectEl.className = "button-grid";

		for(let type of types){
			let buttonEl = document.createElement("button");
			buttonEl.innerText = type;
			buttonEl.onclick = () => buildBatchUploadUI(...args, type);
			typeSelectEl.appendChild(buttonEl);
		}


		el.appendChild(typeSelectEl);

		let newTypeEl = document.createElement("div");
		
		let buttonEl = document.createElement("button");
		buttonEl.innerText = "new type";
		buttonEl.onclick = () => buildBatchUploadUI(...args, true);
		newTypeEl.appendChild(buttonEl);

		let inputEl = document.createElement("input");
		inputEl.type = "text";
		// inputEl.pattern = "[a-z]{3}";
		inputEl.setAttribute("pattern","[a-z]");
		// inputEl.onclick = () => buildBatchUploadUI(...args, true);
		newTypeEl.appendChild(inputEl);

		el.appendChild(newTypeEl);

		return;
	}


	// let entryId = args[1];
	// if(!entryId){
	// 	let entries = await db.get(directory);

	// 	let entrySelectEl = document.createElement("div");
	// 	entrySelectEl.id = "batch-upload-select-entry";
	// 	entrySelectEl.className = "button-grid";
	// 	// build buttons
	// 	for(let entry of entries){
	// 		let buttonEl = document.createElement("button");
	// 		buttonEl.innerText = entry.name;
	// 		buttonEl.onclick = () => buildBatchUploadUI(...args, entry._id);
	// 		entrySelectEl.appendChild(buttonEl);
	// 	}

	// 	el.appendChild(entrySelectEl);

	// 	console.log(options);
	// }


}