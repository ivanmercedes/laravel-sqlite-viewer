import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Detects Laravel projects and locates SQLite databases
 */
export class LaravelDetector {
    /**
     * Checks if a workspace is a Laravel project
     */
    public isLaravelProject(workspaceUri: vscode.Uri): boolean {
        const workspacePath = workspaceUri.fsPath;

        // Check for composer.json with laravel/framework
        const composerPath = path.join(workspacePath, 'composer.json');
        if (fs.existsSync(composerPath)) {
            try {
                const composerContent = fs.readFileSync(composerPath, 'utf-8');
                const composer = JSON.parse(composerContent);

                // Check require or require-dev for laravel/framework
                if (composer.require?.['laravel/framework'] ||
                    composer['require-dev']?.['laravel/framework']) {
                    return true;
                }
            } catch (error) {
                // Invalid JSON, continue checking
            }
        }

        // Check for artisan file
        const artisanPath = path.join(workspacePath, 'artisan');
        if (fs.existsSync(artisanPath)) {
            // Additional verification: check for Laravel directory structure
            const appPath = path.join(workspacePath, 'app');
            const bootstrapPath = path.join(workspacePath, 'bootstrap');

            if (fs.existsSync(appPath) && fs.existsSync(bootstrapPath)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Finds the SQLite database path in a Laravel project
     * Checks common locations: database/database.sqlite, storage/database/database.sqlite
     */
    public findDatabasePath(workspaceUri: vscode.Uri): string | null {
        const workspacePath = workspaceUri.fsPath;

        // Common Laravel SQLite locations
        const possiblePaths = [
            path.join(workspacePath, 'database', 'database.sqlite'),
            path.join(workspacePath, 'storage', 'database', 'database.sqlite'),
            path.join(workspacePath, 'database.sqlite')
        ];

        for (const dbPath of possiblePaths) {
            if (fs.existsSync(dbPath)) {
                return dbPath;
            }
        }

        return null;
    }

    /**
     * Gets a user-friendly display name for the database path
     */
    public getDatabaseDisplayName(dbPath: string, workspaceUri: vscode.Uri): string {
        const workspacePath = workspaceUri.fsPath;
        const relativePath = path.relative(workspacePath, dbPath);

        // If it's in a subdirectory, show the relative path
        if (relativePath && !relativePath.startsWith('..')) {
            return relativePath;
        }

        // Otherwise show just the filename
        return path.basename(dbPath);
    }

    /**
     * Scans all workspace folders for SQLite database files
     * @returns Array of found databases with their workspace info
     */
    public async scanWorkspaces(): Promise<Array<{ workspace: vscode.WorkspaceFolder; dbPath: string }>> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }

        const results: Array<{ workspace: vscode.WorkspaceFolder; dbPath: string }> = [];

        for (const workspace of workspaceFolders) {
            // Search for SQLite files with common extensions
            const pattern = new vscode.RelativePattern(workspace, '**/*.{sqlite,db,sqlite3}');
            const files = await vscode.workspace.findFiles(
                pattern,
                '**/node_modules/**', // Exclude node_modules
                100 // Max results per workspace
            );

            for (const file of files) {
                // Verify it's actually a SQLite file by checking header
                if (await this.isSQLiteFile(file.fsPath)) {
                    results.push({
                        workspace,
                        dbPath: file.fsPath
                    });
                }
            }
        }

        return results;
    }

    /**
     * Verifies if a file is a valid SQLite database by checking its header
     * @param filePath Absolute path to file
     * @returns True if file is a SQLite database
     */
    private async isSQLiteFile(filePath: string): Promise<boolean> {
        try {
            const buffer = Buffer.alloc(16);
            const fd = fs.openSync(filePath, 'r');
            fs.readSync(fd, buffer, 0, 16, 0);
            fs.closeSync(fd);

            // SQLite files start with "SQLite format 3\0"
            const header = buffer.toString('utf8', 0, 15);
            return header === 'SQLite format 3';
        } catch (error) {
            return false;
        }
    }
}
