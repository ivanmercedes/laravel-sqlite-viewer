import * as vscode from 'vscode';
import * as path from 'path';
import { DatabaseService } from './databaseService';
import { SchemaService } from './schemaService';
import { EditModeManager } from './editModeManager';
import { FileWatcher } from './fileWatcher';
import { ConnectionMode } from '../types/database';
import { WebviewMessage, ExtensionMessage } from '../types/messages';

/**
 * Manages the webview panel for database viewing
 */
export class WebviewPanelManager {
    private panel: vscode.WebviewPanel | undefined;
    private currentDbPath: string | undefined;
    private pendingDbPath: string | undefined;
    private fileWatcher: FileWatcher = new FileWatcher();
    private autoRefreshEnabled: boolean = false;
    private currentTable: string | undefined;
    private currentPage: number = 1;
    private currentPageSize: number = 100;

    // Persistent sort state per table
    private tableSortState: Map<string, { column: string; direction: 'ASC' | 'DESC' }> = new Map();

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

        // Store the pending database to load after webview is ready
        if (!this.currentDbPath) {
            this.pendingDbPath = dbPath;
        } else {
            // Webview already exists, load immediately
            await this.loadDatabase(dbPath);
        }
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
            await this.databaseService.open(dbPath, ConnectionMode.READ_ONLY);
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
        try {
            switch (message.type) {
                case 'ready':
                    // Webview is ready, load pending database if any
                    if (this.pendingDbPath) {
                        const dbPath = this.pendingDbPath;
                        this.pendingDbPath = undefined;
                        await this.loadDatabase(dbPath);
                    }
                    break;

                case 'getTables': {
                    if (!this.currentDbPath) {
                        this.sendMessage({ type: 'error', message: 'No database loaded' });
                        return;
                    }
                    const db = this.databaseService.getConnection(this.currentDbPath);
                    const tables = this.schemaService.getTables(db, this.currentDbPath);
                    this.sendMessage({ type: 'schemaData', tables });
                    break;
                }

                case 'getTableData': {
                    if (!this.currentDbPath) {
                        this.sendMessage({ type: 'error', message: 'No database loaded' });
                        return;
                    }
                    const { tableName, page, pageSize, searchTerm, sortColumn, sortDirection } = message;

                    // Store current view state for refresh
                    this.currentTable = tableName;
                    this.currentPage = page;
                    this.currentPageSize = pageSize;

                    // Update sort state if provided, otherwise use existing state
                    if (sortColumn !== undefined) {
                        if (sortColumn) {
                            this.tableSortState.set(tableName, {
                                column: sortColumn,
                                direction: sortDirection || 'ASC'
                            });
                        } else {
                            // Clear sort if sortColumn is explicitly null/empty
                            this.tableSortState.delete(tableName);
                        }
                    }

                    // Retrieve persisted sort state
                    const savedSort = this.tableSortState.get(tableName);
                    const finalSortColumn = sortColumn !== undefined ? sortColumn : savedSort?.column;
                    const finalSortDirection = sortDirection || savedSort?.direction || 'ASC';

                    // Get columns for search
                    const db = this.databaseService.getConnection(this.currentDbPath);
                    const columns = this.schemaService.getColumns(db, this.currentDbPath, tableName);

                    // Execute query with search and sort
                    const result = this.databaseService.executeTableQuery(
                        this.currentDbPath,
                        tableName,
                        columns.map((c: { name: string }) => c.name),
                        page,
                        pageSize,
                        searchTerm,
                        finalSortColumn,
                        finalSortDirection
                    );

                    const totalRows = this.databaseService.getTableRowCount(this.currentDbPath, tableName);

                    this.sendMessage({
                        type: 'tableData',
                        data: { ...result, totalRows, page, pageSize, hasMore: result.rowCount === pageSize },
                        sortColumn: finalSortColumn,
                        sortDirection: finalSortDirection
                    });
                    break;
                }

                case 'getTableMetadata': {
                    if (!this.currentDbPath) {
                        this.sendMessage({ type: 'error', message: 'No database loaded' });
                        return;
                    }
                    const db = this.databaseService.getConnection(this.currentDbPath);
                    const metadata = this.schemaService.getTableMetadata(
                        db,
                        this.currentDbPath,
                        message.tableName
                    );
                    this.sendMessage({ type: 'tableData', data: metadata });
                    break;
                }

                case 'executeQuery': {
                    if (!this.currentDbPath) {
                        this.sendMessage({ type: 'error', message: 'No database loaded' });
                        return;
                    }
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
                    if (!this.currentDbPath) {
                        this.sendMessage({ type: 'error', message: 'No database loaded' });
                        return;
                    }
                    await this.editModeManager.toggle(this.currentDbPath);
                    // Reopen connection in appropriate mode
                    const editModeEnabled = this.editModeManager.isEnabled(this.currentDbPath);
                    const mode = editModeEnabled ? ConnectionMode.READ_WRITE : ConnectionMode.READ_ONLY;
                    await this.databaseService.reopen(this.currentDbPath, mode);
                    break;
                }

                case 'getPrimaryKey': {
                    if (!this.currentDbPath) {
                        this.sendMessage({ type: 'error', message: 'No database loaded' });
                        return;
                    }
                    const { tableName } = message;
                    const db = this.databaseService.getConnection(this.currentDbPath);
                    const pkColumns = this.schemaService.getPrimaryKey(db, tableName);
                    this.sendMessage({ type: 'primaryKey', tableName, columns: pkColumns });
                    break;
                }

                case 'toggleAutoRefresh': {
                    this.autoRefreshEnabled = !this.autoRefreshEnabled;
                    console.log(`[Auto-Refresh] Toggled to: ${this.autoRefreshEnabled}`);
                    console.log(`[Auto-Refresh] Current DB path: ${this.currentDbPath}`);

                    if (this.autoRefreshEnabled && this.currentDbPath) {
                        // Start watching the database file
                        console.log('[Auto-Refresh] Starting file watcher...');
                        this.fileWatcher.watch(this.currentDbPath, () => {
                            console.log('[Auto-Refresh] Refresh callback triggered!');
                            this.refreshCurrentView();
                        });
                    } else {
                        // Stop watching
                        console.log('[Auto-Refresh] Stopping file watcher...');
                        this.fileWatcher.stop();
                    }

                    // Send state change to webview
                    this.sendMessage({ type: 'autoRefreshChanged', enabled: this.autoRefreshEnabled });
                    console.log('[Auto-Refresh] State change sent to webview');
                    break;
                }

                case 'updateRow': {
                    if (!this.currentDbPath) {
                        this.sendMessage({ type: 'error', message: 'No database loaded' });
                        return;
                    }

                    const { tableName, rowData, primaryKey } = message;
                    const editModeEnabled = this.editModeManager.isEnabled(this.currentDbPath);

                    if (!editModeEnabled) {
                        this.sendMessage({ type: 'error', message: 'Edit Mode must be enabled to update rows' });
                        return;
                    }

                    // Execute the update
                    const rowsAffected = this.databaseService.updateRow(
                        this.currentDbPath,
                        tableName,
                        rowData,
                        primaryKey,
                        editModeEnabled
                    );

                    // Send success message
                    this.sendMessage({ type: 'updateSuccess', rowsAffected });

                    // Refresh table data (send updated data back)
                    // Note: We could request the specific page, but for now we'll let the webview re-request
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
     * Refreshes the current view (called by file watcher)
     */
    private async refreshCurrentView(): Promise<void> {
        if (!this.currentDbPath || !this.currentTable) {
            console.log('[refreshCurrentView] Missing dbPath or table');
            return;
        }

        try {
            console.log(`[refreshCurrentView] Reloading database: ${this.currentDbPath}`);

            // CRITICAL: Reopen the database to get fresh data from disk
            // sql.js keeps data in memory, so we need to reload from file
            // open() automatically closes the existing connection first
            await this.databaseService.open(this.currentDbPath, ConnectionMode.READ_ONLY);

            console.log(`[refreshCurrentView] Querying table: ${this.currentTable}`);
            const sql = `SELECT * FROM ${this.currentTable}`;
            const result = this.databaseService.executeQueryPaginated(
                this.currentDbPath,
                sql,
                this.currentPage,
                this.currentPageSize
            );
            const totalRows = this.databaseService.getTableRowCount(this.currentDbPath, this.currentTable);

            console.log(`[refreshCurrentView] Sending ${result.rowCount} rows to webview`);
            this.sendMessage({
                type: 'tableData',
                data: { ...result, totalRows, page: this.currentPage, pageSize: this.currentPageSize, hasMore: result.rowCount === this.currentPageSize }
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[refreshCurrentView] Error:', message);
            this.sendMessage({ type: 'error', message: `Auto-refresh failed: ${message}` });
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
        // Check if we're in development mode (Vite dev server running on port 5173)
        const isDev = false; // Disabled - too complex for VS Code webviews

        if (isDev) {
            // In development, load from Vite dev server for hot reload
            return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src http://localhost:5173 ws://localhost:5173; style-src ${webview.cspSource} 'unsafe-inline' http://localhost:5173; script-src 'unsafe-eval' 'unsafe-inline' http://localhost:5173;">
      <title>SQLite Viewer</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="http://localhost:5173/src/main.tsx"></script>
    </body>
    </html>`;
        }

        // Get built assets
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'assets', 'index.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'assets', 'index.css')
        );

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
        this.fileWatcher.dispose();
        this.panel?.dispose();
        if (this.currentDbPath) {
            this.databaseService.close(this.currentDbPath);
            this.editModeManager.cleanup(this.currentDbPath);
        }
    }
}
