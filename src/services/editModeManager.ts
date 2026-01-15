import * as vscode from 'vscode';

/**
 * Manages Edit Mode state per database connection.
 * Edit Mode must be explicitly enabled to allow write operations.
 */
export class EditModeManager {
    private editModeState: Map<string, boolean> = new Map();
    private onStateChangedEmitter = new vscode.EventEmitter<{ dbPath: string; enabled: boolean }>();

    public readonly onStateChanged = this.onStateChangedEmitter.event;

    /**
     * Checks if Edit Mode is enabled for a specific database
     */
    public isEnabled(dbPath: string): boolean {
        return this.editModeState.get(dbPath) ?? false;
    }

    /**
     * Enables Edit Mode for a database with user confirmation
     */
    public async enable(dbPath: string): Promise<boolean> {
        const confirmation = await vscode.window.showWarningMessage(
            `Enable Edit Mode for ${this.getDbName(dbPath)}?`,
            {
                modal: true,
                detail: 'Edit Mode allows data modifications (INSERT, UPDATE, DELETE). Changes will be written to the database immediately.'
            },
            'Enable Edit Mode'
        );

        if (confirmation === 'Enable Edit Mode') {
            this.editModeState.set(dbPath, true);
            this.onStateChangedEmitter.fire({ dbPath, enabled: true });

            vscode.window.showInformationMessage(
                `Edit Mode enabled for ${this.getDbName(dbPath)}`
            );

            return true;
        }

        return false;
    }

    /**
     * Disables Edit Mode for a database
     */
    public disable(dbPath: string): void {
        this.editModeState.set(dbPath, false);
        this.onStateChangedEmitter.fire({ dbPath, enabled: false });

        vscode.window.showInformationMessage(
            `Edit Mode disabled for ${this.getDbName(dbPath)}`
        );
    }

    /**
     * Toggles Edit Mode for a database
     */
    public async toggle(dbPath: string): Promise<boolean> {
        const currentState = this.isEnabled(dbPath);

        if (currentState) {
            this.disable(dbPath);
            return false;
        } else {
            return await this.enable(dbPath);
        }
    }

    /**
     * Cleans up state when a database is closed
     */
    public cleanup(dbPath: string): void {
        this.editModeState.delete(dbPath);
    }

    /**
     * Extracts database name from path for display
     */
    private getDbName(dbPath: string): string {
        return dbPath.split('/').pop() || dbPath;
    }

    /**
     * Disposes resources
     */
    public dispose(): void {
        this.editModeState.clear();
        this.onStateChangedEmitter.dispose();
    }
}
