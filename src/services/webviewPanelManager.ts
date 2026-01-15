import * as vscode from 'vscode';
import * as path from 'path';
import { DatabaseService } from './databaseService';
import { SchemaService } from './schemaService';
import { EditModeManager } from './editModeManager';
import { ConnectionMode } from '../types/database';
import { WebviewMessage, ExtensionMessage } from '../types/messages';

/**
 * Manages the webview panel for database viewing
 */
export class WebviewPanelManager {
    private panel: vscode.WebviewPanel | undefined;
    private currentDbPath: string | undefined;

    constructor(
        private extensionUri: vscode.Uri,
        private databaseService: DatabaseService,
        private schemaService: SchemaService,
        private editModeManager: EditModeManager
    ) {
        // Listen to edit mode changes
        this.editModeManager.onStateChanged((event) => {
            if (event.dbPath === this.currentDbPath) {
                this.sendMessage({
                    type: 'editModeChanged',
                    enabled: event.enabled
                });
            }
        });
    }

    /**
     * Opens or reveals the webview panel for a database
     */
    public async openDatabase(dbPath: string): Promise<void> {
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If panel exists, reveal it
        if (this.panel) {
            this.panel.reveal(columnToShowIn);
            await this.loadDatabase(dbPath);
            return;
        }

        // Create new panel
        this.panel = vscode.window.createWebviewPanel(
            'sqliteViewer',
            `SQLite: ${path.basename(dbPath)}`,
            columnToShowIn || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.extensionUri, 'dist'),
                    vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist')
                ]
            }
        );

        // Set HTML content
        this.panel.webview.html = this.getWebviewContent(this.panel.webview);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            (message: WebviewMessage) => this.handleWebviewMessage(message),
            undefined
        );

        // Handle panel disposal
        this.panel.onDidDispose(() => {
            if (this.currentDbPath) {
                this.databaseService.close(this.currentDbPath);
                this.editModeManager.cleanup(this.currentDbPath);
            }
            this.panel = undefined;
            this.currentDbPath = undefined;
        });

        // Load the database
        await this.loadDatabase(dbPath);
    }

    /**
     * Loads a database and initializes the webview
     */
    private async loadDatabase(dbPath: string): Promise<void> {
        try {
            // Close previous database if any
            if (this.currentDbPath && this.currentDbPath !== dbPath) {
                this.databaseService.close(this.currentDbPath);
                this.editModeManager.cleanup(this.currentDbPath);
            }

            // Open new database
            this.databaseService.open(dbPath, ConnectionMode.READ_ONLY);
            this.currentDbPath = dbPath;

            // Send init message to webview
            this.sendMessage({
                type: 'init',
                dbPath,
                editModeEnabled: this.editModeManager.isEnabled(dbPath)
            });

            // Update panel title
            if (this.panel) {
                this.panel.title = `SQLite: ${path.basename(dbPath)}`;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to open database: ${message}`);
            this.sendMessage({ type: 'error', message });
        }
    }

    /**
     * Handles messages from the webview
     */
    private async handleWebviewMessage(message: WebviewMessage): Promise<void> {
        if (!this.currentDbPath) {
            this.sendMessage({ type: 'error', message: 'No database loaded' });
            return;
        }

        try {
            switch (message.type) {
                case 'ready':
                    // Webview is ready, can send initial data if needed
                    break;

                case 'getTables': {
                    const db = (this.databaseService as any).getConnection(this.currentDbPath);
                    const tables = this.schemaService.getTables(db, this.currentDbPath);
                    this.sendMessage({ type: 'schemaData', tables });
                    break;
                }

                case 'getTableData': {
                    const { tableName, page, pageSize } = message;
                    const sql = `SELECT * FROM ${tableName}`;
                    const result = this.databaseService.executeQueryPaginated(
                        this.currentDbPath,
                        sql,
                        page,
                        pageSize
                    );
                    const totalRows = this.databaseService.getTableRowCount(this.currentDbPath, tableName);
                    this.sendMessage({
                        type: 'tableData',
                        data: { ...result, totalRows, page, pageSize, hasMore: result.rowCount === pageSize }
                    });
                    break;
                }

                case 'getTableMetadata': {
                    const db = (this.databaseService as any).getConnection(this.currentDbPath);
                    const metadata = this.schemaService.getTableMetadata(
                        db,
                        this.currentDbPath,
                        message.tableName
                    );
                    this.sendMessage({ type: 'tableData', data: metadata });
                    break;
                }

                case 'executeQuery': {
                    const editModeEnabled = this.editModeManager.isEnabled(this.currentDbPath);
                    const result = this.databaseService.executeQuery(
                        this.currentDbPath,
                        message.sql,
                        editModeEnabled
                    );
                    this.sendMessage({ type: 'queryResult', result });
                    break;
                }

                case 'toggleEditMode': {
                    await this.editModeManager.toggle(this.currentDbPath);
                    // Reopen connection in appropriate mode
                    const editModeEnabled = this.editModeManager.isEnabled(this.currentDbPath);
                    const mode = editModeEnabled ? ConnectionMode.READ_WRITE : ConnectionMode.READ_ONLY;
                    this.databaseService.reopen(this.currentDbPath, mode);
                    break;
                }

                case 'updateRow': {
                    // TODO: Implement inline row update
                    const editModeEnabled = this.editModeManager.isEnabled(this.currentDbPath);
                    if (!editModeEnabled) {
                        throw new Error('Edit Mode must be enabled to update rows');
                    }
                    // Generate UPDATE query based on rowData and primaryKey
                    // Execute update
                    break;
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(message);
            this.sendMessage({ type: 'error', message });
        }
    }

    /**
     * Sends a message to the webview
     */
    private sendMessage(message: ExtensionMessage): void {
        this.panel?.webview.postMessage(message);
    }

    /**
     * Generates the HTML content for the webview
     */
    private getWebviewContent(webview: vscode.Webview): string {
        // Get the webview build output
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'assets', 'index.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'assets', 'index.css')
        );

        // For now, return a simple placeholder
        // We'll build the actual React app in the next phase
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
      <link href="${styleUri}" rel="stylesheet">
      <title>SQLite Viewer</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="${scriptUri}"></script>
    </body>
    </html>`;
    }

    /**
     * Disposes the panel
     */
    public dispose(): void {
        this.panel?.dispose();
        if (this.currentDbPath) {
            this.databaseService.close(this.currentDbPath);
            this.editModeManager.cleanup(this.currentDbPath);
        }
    }
}
