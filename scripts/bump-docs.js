#!/usr/bin/env node
/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Read in the target release version
const docsInfo = require(path.join(__dirname, '../docs.json'));
const targetRelease = docsInfo.target_release

// Check _config file
const configFilePath = path.join(__dirname, '../_config.yml');
const _config = yaml.safeLoad(fs.readFileSync(configFilePath),'utf8');
if (_config.caliper.current_release.localeCompare(targetRelease) !== 0) {
	// Need to update config file
	_config.caliper[targetRelease.replace(/\./g, '_')] = targetRelease + '/';
	_config.caliper.current_release = targetRelease + '/';

	const newConfig = yaml.safeDump(_config);
    fs.writeFileSync(configFilePath, newConfig, 'utf8');

	// Need a new _layout (use template)
	const layout = fs.readFileSync(path.join(__dirname, '../_layouts/template.html')).toString();
	const newLayout = layout.replace('VERSION', targetRelease);
	fs.writeFileSync(path.join(__dirname, `../_layouts/${targetRelease}.html`), newLayout);

	// Need a new _include (base new one off vNext)
	const include = fs.readFileSync(path.join(__dirname, '../_includes/vNext.html')).toString();
	let replaceTarget = '<option value="/caliper/vNext/getting-started/" selected>vNext</option>';
	let replaceString = `<option value="/caliper/${targetRelease}/getting-started/" selected>${targetRelease}</option>\n    ` + '<option value="/caliper/vNext/getting-started/">vNext</option>';
	let newInclude = include.replace(replaceTarget, replaceString);
	newInclude = newInclude.replace(/next_release/g, `${targetRelease.replace(/\./g, '_')}`);
	fs.writeFileSync(path.join(__dirname, `../_includes/${targetRelease}.html`), newInclude);

	// Need to update other versions to indicate existence of new targetRelease
	const otherVersions = [];
	fs.readdirSync(path.join(__dirname, '../_includes/')).forEach(file => {
		if (file.startsWith('v') && !file.startsWith(targetRelease)) {
			otherVersions.push(path.join(__dirname, '../_includes/', file));
		}
	});
	
	replaceTarget = '<option value="/caliper/vNext/getting-started/"';
	replaceString = `<option value="/caliper/${targetRelease}/getting-started/">${targetRelease}</option>\n    ` + replaceTarget;
	otherVersions.forEach(file => {
		let content = fs.readFileSync(file).toString();
		content = content.replace(replaceTarget, replaceString);
		fs.writeFileSync(file, content);
	});

	// Need a new folder
	fs.mkdirSync(path.join(__dirname, `../docs/${targetRelease}`));
} else {
	console.log(`Target release ${targetRelease} matches existing version target. Contents for /docs/${targetRelease} will be updated with /docs/vNext`);
}

// Ensure target directory is empty
execSync(`rm -rf ${path.join(__dirname, '../docs/'+targetRelease+'/*')}`,
	(error, stdout, stderr) => {
		console.log(stdout);
		console.log(stderr);
		if (error !== null) {
			console.log(`exec error: ${error}`);
		}
	});

// Copy across
execSync(`cp -r ${path.join(__dirname, '../docs/vNext/*')} ${path.join(__dirname, '../docs/'+targetRelease+'/')}`,
	(error, stdout, stderr) => {
		console.log(stdout);
		console.log(stderr);
		if (error !== null) {
			console.log(`exec error: ${error}`);
		}
	});

// Update all headers in new files
const newFiles = [];
fs.readdirSync(path.join(__dirname, '../docs/'+targetRelease)).forEach(file => {
	newFiles.push(path.join(__dirname, '../docs/'+targetRelease, file));
});

newFiles.forEach(file => {
	let content = fs.readFileSync(file).toString();
	content = content.replace('layout: vNext', `layout: ${targetRelease}`);
	content = content.replace('permalink: /vNext/', `permalink: /${targetRelease}/`);
	fs.writeFileSync(file, content);
});