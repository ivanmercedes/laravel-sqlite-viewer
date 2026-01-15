import * as vscode from 'vscode';
import { DatabaseService } from './services/databaseService';
import { SchemaService } from './services/schemaService';
import { EditModeManager } from './services/editModeManager';
import { WebviewPanelManager } from './services/webviewPanelManager';

let databaseService: DatabaseService;
let schemaService: SchemaService;
let editModeManager: EditModeManager;
let webviewPanelManager: WebviewPanelManager;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('Laravel SQLite Viewer extension is now active');

	// Initialize services
	databaseService = new DatabaseService();
	schemaService = new SchemaService();
	editModeManager = new EditModeManager();
	webviewPanelManager = new WebviewPanelManager(
		context.extensionUri,
		databaseService,
		schemaService,
		editModeManager
	);

	// Register command: Open database
	const openDatabaseCommand = vscode.commands.registerCommand(
		'laravel-sqlite-viewer.openDatabase',
		async (uri?: vscode.Uri) => {
			let dbPath: string;

			if (uri) {
				// Opened from context menu
				dbPath = uri.fsPath;
			} else {
				// Opened from command palette
				const fileUri = await vscode.window.showOpenDialog({
					canSelectMany: false,
					filters: {
						'SQLite Database': ['sqlite', 'db', 'sqlite3']
					},
					openLabel: 'Open Database'
				});

				if (!fileUri || fileUri.length === 0) {
					return;
				}

				dbPath = fileUri[0].fsPath;
			}

			// Verify file is a SQLite database
			if (!dbPath.match(/\.(sqlite|db|sqlite3)$/i)) {
				vscode.window.showErrorMessage('Please select a valid SQLite database file');
				return;
			}

			await webviewPanelManager.openDatabase(dbPath);
		}
	);

	// Register command: Toggle Edit Mode
	const toggleEditModeCommand = vscode.commands.registerCommand(
		'laravel-sqlite-viewer.toggleEditMode',
		async () => {
			// This will be called from the webview UI
			vscode.window.showInformationMessage('Toggle Edit Mode from the database viewer panel');
		}
	);

	// Register command: Run SQL query (for command palette)
	const runQueryCommand = vscode.commands.registerCommand(
		'laravel-sqlite-viewer.runQuery',
		async () => {
			vscode.window.showInformationMessage('Use the SQL Runner in the database viewer panel');
		}
	);

	// Register disposables
	context.subscriptions.push(
		openDatabaseCommand,
		toggleEditModeCommand,
		runQueryCommand,
		databaseService,
		schemaService,
		editModeManager,
		webviewPanelManager
	);
}

/**
 * Extension deactivation
 */
export function deactivate() {
	// Services are disposed via subscriptions
}

