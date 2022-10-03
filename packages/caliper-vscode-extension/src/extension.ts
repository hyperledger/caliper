import * as vscode from 'vscode';
import { ConfigFileExplorer } from './ConfigFileExplorer';
export function activate(context: vscode.ExtensionContext) {

    new ConfigFileExplorer(context);
}
export function deactivate() {}
