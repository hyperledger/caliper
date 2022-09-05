import * as vscode from 'vscode';
// import { ConfigFileProvider, ConfigFile } from './ConfigListProvider';
import { ConfigFileExplorer } from './ConfigFileExplorer';
export function activate(context: vscode.ExtensionContext) {

    // const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
    // ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
    // const configScriptsProvider = new ConfigFileProvider(rootPath);
    // vscode.window.createTreeView('configScripts', {
    //     treeDataProvider: new ConfigFileProvider(rootPath)
    //   });
	// vscode.commands.registerCommand('configScripts.refreshEntry', () => configScriptsProvider.refresh());

    new ConfigFileExplorer(context);
}
export function deactivate() {}
