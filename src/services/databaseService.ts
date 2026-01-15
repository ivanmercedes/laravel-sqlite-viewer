import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { ConnectionMode, QueryResult } from '../types/database';
import { QueryGuard } from './queryGuard';

/**
 * Central service for all SQLite database operations using sql.js.
 * Opens databases in read-only mode by default for safety.
 */
export class DatabaseService {
    private SQL: any;
    private connections: Map<string, SqlJsDatabase> = new Map();
    private connectionModes: Map<string, ConnectionMode> = new Map();
    private databaseBuffers: Map<string, Uint8Array> = new Map();

    constructor() {
        this.initSql();
    }

    /**
     * Initialize sql.js
     */
    private async initSql() {
        if (!this.SQL) {
            const path = require('path');
            this.SQL = await initSqlJs({
                locateFile: (file: string) => {
                    return path.join(__dirname, '../node_modules/sql.js/dist', file);
                }
            });
        }
    }

    /**
     * Opens a database connection
     */
    public async open(dbPath: string, mode: ConnectionMode = ConnectionMode.READ_ONLY): Promise<void> {
        // Ensure SQL.js is initialized
        await this.initSql();

        // Close existing connection if any
        this.close(dbPath);

        try {
            // Read the database file
            const buffer = fs.readFileSync(dbPath);
            const dbBuffer = new Uint8Array(buffer);

            // Create database from buffer
            const db = new this.SQL.Database(dbBuffer);

            // Enable foreign keys
            db.run('PRAGMA foreign_keys = ON');

            this.connections.set(dbPath, db);
            this.connectionModes.set(dbPath, mode);
            this.databaseBuffers.set(dbPath, dbBuffer);

            console.log(`Database opened: ${dbPath} (${mode})`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to open database: ${message}`);
        }
    }

    /**
     * Gets an existing database connection
     */
    public getConnection(dbPath: string): SqlJsDatabase {
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
    public async reopen(dbPath: string, mode: ConnectionMode): Promise<void> {
        await this.open(dbPath, mode);
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
            console.warn('Executing destructive query:', sql);
        }

        try {
            const classifiedType = QueryGuard.classifyQuery(sql);

            // For SELECT queries, return rows
            if (classifiedType === 'READ') {
                const results = db.exec(sql);

                if (results.length === 0) {
                    return {
                        columns: [],
                        rows: [],
                        rowCount: 0
                    };
                }

                const result = results[0]; const rows = result.values.map((row: any) => {
                    const obj: Record<string, unknown> = {};
                    result.columns.forEach((col: string, idx: number) => {
                        obj[col] = row[idx];
                    });
                    return obj;
                });

                return {
                    columns: result.columns,
                    rows,
                    rowCount: rows.length
                };
            }
            // For write queries, execute and save if needed
            else {
                db.run(sql);
                const changes = db.getRowsModified();

                // Save changes back to file if in write mode
                const mode = this.getConnectionMode(dbPath);
                if (mode === ConnectionMode.READ_WRITE) {
                    this.saveDatabase(dbPath);
                }

                return {
                    columns: [],
                    rows: [],
                    rowCount: 0,
                    changes
                };
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Query execution failed: ${message}`);
        }
    }

    /**
     * Executes a paginated query
     */
    public executeQueryPaginated(
        dbPath: string,
        sql: string,
        page: number = 1,
        pageSize: number = 100
    ): QueryResult {
        const offset = (page - 1) * pageSize;
        const paginatedSql = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;

        return this.executeQuery(dbPath, paginatedSql, false);
    }

    /**
     * Gets the total row count for a table
     */
    public getTableRowCount(dbPath: string, tableName: string): number {
        const db = this.getConnection(dbPath);

        try {
            const results = db.exec(`SELECT COUNT(*) as count FROM ${tableName}`);
            if (results.length > 0 && results[0].values.length > 0) {
                return results[0].values[0][0] as number;
            }
            return 0;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to get row count: ${message}`);
        }
    }

    /**
     * Updates a single row in a table
     * @param dbPath Path to the database
     * @param tableName Name of the table
     * @param newValues Object with column names and new values
     * @param primaryKeyValues Object with primary key column names and values
     * @param editModeEnabled Whether edit mode is enabled
     * @returns Number of rows affected
     */
    public updateRow(
        dbPath: string,
        tableName: string,
        newValues: Record<string, unknown>,
        primaryKeyValues: Record<string, unknown>,
        editModeEnabled: boolean
    ): number {
        if (!editModeEnabled) {
            throw new Error('Edit Mode must be enabled to update rows');
        }

        const db = this.getConnection(dbPath);

        try {
            // Build SET clause
            const setColumns = Object.keys(newValues);
            const setClause = setColumns.map(col => `${col} = ?`).join(', ');

            // Build WHERE clause using primary key
            const pkColumns = Object.keys(primaryKeyValues);
            if (pkColumns.length === 0) {
                throw new Error('Primary key required for UPDATE operation');
            }
            const whereClause = pkColumns.map(col => `${col} = ?`).join(' AND ');

            // Build complete UPDATE query
            const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;

            // Prepare values array: SET values first, then WHERE values
            const values = [
                ...setColumns.map(col => newValues[col]),
                ...pkColumns.map(col => primaryKeyValues[col])
            ];

            // Validate with QueryGuard
            const guardResult = QueryGuard.canExecute(sql, editModeEnabled);
            if (!guardResult.allowed) {
                throw new Error(guardResult.reason);
            }

            // Execute the update
            db.run(sql, values as any[]);

            // Save changes to file
            this.saveDatabase(dbPath);

            // Return number of affected rows (sql.js doesn't provide this easily)
            // We'll assume 1 row was affected if no error occurred
            return 1;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to update row: ${message}`);
        }
    }

    /**
     * Saves the in-memory database back to file
     */
    private saveDatabase(dbPath: string): void {
        const db = this.getConnection(dbPath);
        const data = db.export();
        fs.writeFileSync(dbPath, Buffer.from(data));
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
            this.databaseBuffers.delete(dbPath);
            console.log(`Database closed: ${dbPath}`);
        }
    }

    /**
     * Closes all database connections
     */
    public closeAll(): void {
        for (const [dbPath] of this.connections) {
            this.close(dbPath);
        }
    }

    /**
     * Disposes resources (required by VS Code disposable pattern)
     */
    public dispose(): void {
        this.closeAll();
    }
}
