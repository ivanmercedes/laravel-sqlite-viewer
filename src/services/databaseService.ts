import Database from 'better-sqlite3';
import * as vscode from 'vscode';
import { ConnectionMode, QueryResult } from '../types/database';
import { QueryGuard } from './queryGuard';

/**
 * Central service for all SQLite database operations.
 * Opens databases in read-only mode by default for safety.
 */
export class DatabaseService {
    private connections: Map<string, Database.Database> = new Map();
    private connectionModes: Map<string, ConnectionMode> = new Map();

    /**
     * Opens a database connection
     */
    public open(dbPath: string, mode: ConnectionMode = ConnectionMode.READ_ONLY): void {
        // Close existing connection if any
        this.close(dbPath);

        try {
            const db = new Database(dbPath, {
                readonly: mode === ConnectionMode.READ_ONLY,
                fileMustExist: true
            });

            // Enable foreign keys
            db.pragma('foreign_keys = ON');

            this.connections.set(dbPath, db);
            this.connectionModes.set(dbPath, mode);

            console.log(`Database opened: ${dbPath} (${mode})`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to open database: ${message}`);
        }
    }

    /**
     * Gets an existing database connection
     */
    private getConnection(dbPath: string): Database.Database {
        const connection = this.connections.get(dbPath);
        if (!connection) {
            throw new Error(`No connection found for: ${dbPath}`);
        }
        return connection;
    }

    /**
     * Gets the current connection mode
     */
    public getConnectionMode(dbPath: string): ConnectionMode | undefined {
        return this.connectionModes.get(dbPath);
    }

    /**
     * Reopens database in different mode
     */
    public reopen(dbPath: string, mode: ConnectionMode): void {
        this.open(dbPath, mode);
    }

    /**
     * Executes a SQL query with validation
     */
    public executeQuery(
        dbPath: string,
        sql: string,
        editModeEnabled: boolean,
        schemaOpsEnabled: boolean = false
    ): QueryResult {
        const db = this.getConnection(dbPath);

        // Validate single statement
        if (!QueryGuard.isSingleStatement(sql)) {
            throw new Error('Only single SQL statements are allowed');
        }

        // Check if query is allowed
        const validation = QueryGuard.canExecute(sql, editModeEnabled, schemaOpsEnabled);
        if (!validation.allowed) {
            throw new Error(validation.reason || 'Query execution not allowed');
        }

        // Check if destructive and get confirmation
        if (QueryGuard.isDestructive(sql)) {
            // This will be handled by the webview/extension UI
            // For now, we just log it
            console.warn('Executing destructive query:', sql);
        }

        try {
            const stmt = db.prepare(sql);

            // For SELECT queries, return rows
            if (stmt.reader) {
                const rows = stmt.all();
                const columns = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null
                    ? Object.keys(rows[0])
                    : [];

                return {
                    columns,
                    rows: rows as Record<string, unknown>[],
                    rowCount: rows.length
                };
            }
            // For write queries, return changes info
            else {
                const info = stmt.run();
                return {
                    columns: [],
                    rows: [],
                    rowCount: 0,
                    changes: info.changes
                };
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Query execution failed: ${message}`);
        }
    }

    /**
     * Executes a query with pagination
     */
    public executeQueryPaginated(
        dbPath: string,
        sql: string,
        page: number = 1,
        pageSize: number = 100
    ): QueryResult {
        const db = this.getConnection(dbPath);

        // Only allow SELECT queries for pagination
        const queryType = QueryGuard.classifyQuery(sql);
        if (queryType !== 'READ') {
            throw new Error('Only SELECT queries can be paginated');
        }

        const offset = (page - 1) * pageSize;
        const paginatedSql = `${sql.trim()} LIMIT ${pageSize} OFFSET ${offset}`;

        try {
            const stmt = db.prepare(paginatedSql);
            const rows = stmt.all();
            const columns = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null
                ? Object.keys(rows[0])
                : [];

            return {
                columns,
                rows: rows as Record<string, unknown>[],
                rowCount: rows.length
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Query execution failed: ${message}`);
        }
    }

    /**
     * Gets total row count for a table
     */
    public getTableRowCount(dbPath: string, tableName: string): number {
        const db = this.getConnection(dbPath);

        try {
            const stmt = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`);
            const result = stmt.get() as { count: number };
            return result.count;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to get row count: ${message}`);
        }
    }

    /**
     * Closes a database connection
     */
    public close(dbPath: string): void {
        const connection = this.connections.get(dbPath);
        if (connection) {
            connection.close();
            this.connections.delete(dbPath);
            this.connectionModes.delete(dbPath);
            console.log(`Database closed: ${dbPath}`);
        }
    }

    /**
     * Closes all connections
     */
    public closeAll(): void {
        for (const dbPath of this.connections.keys()) {
            this.close(dbPath);
        }
    }

    /**
     * Checks if database is open
     */
    public isOpen(dbPath: string): boolean {
        return this.connections.has(dbPath);
    }

    /**
     * Disposes resources
     */
    public dispose(): void {
        this.closeAll();
    }
}
