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
const yaml = require('js-yaml');
const path = require('path');
const semver = require('semver');

// Script to update the docs
// - Move vNext content to a folder that is named for the target release specified in docs.json
// - Ensure _includes, _layouts and index page is updated

// Read in the target release version
const docsInfo = require(path.join(__dirname, '../docs.json'));
const targetRelease = docsInfo.target_release

// Check _config file
const configFilePath = path.join(__dirname, '../_config.yml');
const _config = yaml.safeLoad(fs.readFileSync(configFilePath),'utf8');
if (_config.caliper.current_release.localeCompare(targetRelease) !== 0) {

    // Use Semver to see if we are incrementing a minor version, or adding an entire versioned docs option
    const targetVersion = semver.coerce(targetRelease);
    const currentVersion = semver.coerce(_config.caliper.current_release);

    if (semver.diff(targetVersion, currentVersion) && semver.diff(targetVersion, currentVersion).localeCompare('patch') == 0) {
        console.log(`Patch release detected, will replace ${currentVersion} docs with ${targetVersion}`);
        // ##########################
        // REMOVE CURRENT VERSION
        // ##########################

        const currentReleaseTag = 'v' + currentVersion.version.replace(/\//g, '')
        // Remove from _config
        delete _config.caliper[currentReleaseTag.replace(/\./g, '_')];

        // Remove layout
        execSync(`rm -f ${path.join(__dirname, `../_layouts/${currentReleaseTag}.html`)}`,
            (error, stdout, stderr) => {
                console.log(stdout);
                console.log(stderr);
                if (error !== null) {
                    console.log(`exec error: ${error}`);
                }
            });

        // Remove include
        execSync(`rm -f ${path.join(__dirname, `../_includes/${currentReleaseTag}.html`)}`,
            (error, stdout, stderr) => {
                console.log(stdout);
                console.log(stderr);
                if (error !== null) {
                    console.log(`exec error: ${error}`);
                }
            });

        // Remove docs folder
        execSync(`rm -rf ${path.join(__dirname, `../docs/${currentReleaseTag}`)}`,
            (error, stdout, stderr) => {
                console.log(stdout);
                console.log(stderr);
                if (error !== null) {
                    console.log(`exec error: ${error}`);
                }
            });

        // Remove existence of currentVersion from any includes
        const otherVersions = [];
        fs.readdirSync(path.join(__dirname, '../_includes/')).forEach(file => {
            if (file.startsWith('v')) {
                otherVersions.push(path.join(__dirname, '../_includes/', file));
            }
        });

        let replaceTarget = `<option value="/caliper/${currentReleaseTag}/getting-started/">${currentReleaseTag}</option>\n`;
        otherVersions.forEach(file => {
            let content = fs.readFileSync(file).toString();
            content = content.replace(replaceTarget, '');
            fs.writeFileSync(file, content);
        });
    }

    // ##########################
    // NOW ADD NEW VERSION ENTRY
    // ##########################
    
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

console.log(`Generation of docs for ${targetRelease} now complete`);