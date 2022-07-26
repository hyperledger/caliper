import * as vscode from 'vscode';

import { extractAsKeyValue, GeneralObject } from "./resources/util";
import { userSettings } from "./resources/userSettings";

const updateUserSettings = async (settings: GeneralObject[]) => {
  settings.forEach(async setting => {
    const { key, value } = extractAsKeyValue(setting);
    await vscode.workspace
      .getConfiguration()
      .update(key, value, vscode.ConfigurationTarget.Global);
  });
};
export function activate(context: vscode.ExtensionContext) {
	updateUserSettings(userSettings);
	console.log("User Settings updated!");
}
export function deactivate() {}
