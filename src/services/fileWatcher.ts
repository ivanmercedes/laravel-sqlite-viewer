import * as vscode from 'vscode';

/**
 * Watches a file for changes and triggers callbacks with debouncing
 */
export class FileWatcher implements vscode.Disposable {
    private watcher: vscode.FileSystemWatcher | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;
    private readonly debounceDelay: number = 500; // ms

    /**
     * Start watching a file
     * @param filePath Absolute path to the file to watch
     * @param onChangeCallback Function to call when file changes
     */
    public watch(filePath: string, onChangeCallback: () => void): void {
        // Stop previous watcher if exists
        this.stop();

        console.log(`[FileWatcher] Starting to watch: ${filePath}`);

        // Create new watcher for this specific file
        this.watcher = vscode.workspace.createFileSystemWatcher(
            filePath, // Watch the specific file path
            false, // don't ignore creates
            false, // don't ignore changes
            false  // don't ignore deletes
        );

        // Handle file changes with debouncing
        const debouncedCallback = (uri: vscode.Uri) => {
            console.log(`[FileWatcher] File changed: ${uri.fsPath}`);
            this.debounceChange(onChangeCallback);
        };

        this.watcher.onDidChange(debouncedCallback);
        this.watcher.onDidCreate(debouncedCallback);

        console.log('[FileWatcher] Watcher created successfully');
    }

    /**
     * Stop watching the file
     */
    public stop(): void {
        if (this.watcher) {
            console.log('[FileWatcher] Stopping watcher');
            this.watcher.dispose();
            this.watcher = null;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    /**
     * Debounce changes to avoid excessive callbacks
     */
    private debounceChange(callback: () => void): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        console.log(`[FileWatcher] Debouncing change (${this.debounceDelay}ms)`);
        this.debounceTimer = setTimeout(() => {
            console.log('[FileWatcher] Executing callback');
            callback();
            this.debounceTimer = null;
        }, this.debounceDelay);
    }

    /**
     * Dispose the watcher
     */
    public dispose(): void {
        this.stop();
    }
}
