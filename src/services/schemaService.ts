import { Database as SqlJsDatabase } from 'sql.js';
import { TableInfo, ColumnInfo, IndexInfo, ForeignKeyInfo } from '../types/database';

/**
 * Manages database schema information with caching for performance.
 */
export class SchemaService {
    private tableCache: Map<string, TableInfo[]> = new Map();
    private columnCache: Map<string, Map<string, ColumnInfo[]>> = new Map();
    private indexCache: Map<string, Map<string, IndexInfo[]>> = new Map();
    private foreignKeyCache: Map<string, Map<string, ForeignKeyInfo[]>> = new Map();

    /**
     * Gets all tables in the database
     */
    public getTables(db: SqlJsDatabase, dbPath: string, useCache: boolean = true): TableInfo[] {
        if (useCache && this.tableCache.has(dbPath)) {
            return this.tableCache.get(dbPath)!;
        }

        try {
            const results = db.exec(`
                SELECT name, type, sql, rootpage 
                FROM sqlite_master 
                WHERE type IN ('table', 'view') 
                AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `);

            if (results.length === 0) {
                return [];
            }

            const result = results[0];
            const tables: TableInfo[] = result.values.map((row: any) => ({
                name: row[0] as string,
                type: row[1] as 'table' | 'view',
                sql: row[2] as string | null,
                rootpage: row[3] as number
            }));

            this.tableCache.set(dbPath, tables);
            return tables;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to fetch tables: ${message}`);
        }
    }

    /**
     * Gets columns for a specific table
     */
    public getColumns(
        db: SqlJsDatabase,
        dbPath: string,
        tableName: string,
        useCache: boolean = true
    ): ColumnInfo[] {
        const dbCache = this.columnCache.get(dbPath);
        if (useCache && dbCache?.has(tableName)) {
            return dbCache.get(tableName)!;
        }

        try {
            const results = db.exec(`PRAGMA table_info(${tableName})`);

            if (results.length === 0) {
                return [];
            }

            const result = results[0];
            const columns: ColumnInfo[] = result.values.map((row: any) => ({
                cid: row[0] as number,
                name: row[1] as string,
                type: row[2] as string,
                notnull: row[3] as number,
                dflt_value: row[4] !== null ? String(row[4]) : null,
                pk: row[5] as number
            }));

            if (!this.columnCache.has(dbPath)) {
                this.columnCache.set(dbPath, new Map());
            }
            this.columnCache.get(dbPath)!.set(tableName, columns);

            return columns;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to fetch columns for ${tableName}: ${message}`);
        }
    }

    /**
     * Gets indexes for a specific table
     */
    public getIndexes(
        db: SqlJsDatabase,
        dbPath: string,
        tableName: string,
        useCache: boolean = true
    ): IndexInfo[] {
        const dbCache = this.indexCache.get(dbPath);
        if (useCache && dbCache?.has(tableName)) {
            return dbCache.get(tableName)!;
        }

        try {
            const results = db.exec(`PRAGMA index_list(${tableName})`);

            if (results.length === 0) {
                return [];
            }

            const result = results[0];
            const indexes: IndexInfo[] = result.values.map((row: any) => ({
                seq: row[0] as number,
                name: row[1] as string,
                unique: row[2] as number,
                origin: row[3] as string,
                partial: row[4] as number
            }));

            if (!this.indexCache.has(dbPath)) {
                this.indexCache.set(dbPath, new Map());
            }
            this.indexCache.get(dbPath)!.set(tableName, indexes);

            return indexes;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to fetch indexes for ${tableName}: ${message}`);
        }
    }

    /**
     * Gets foreign keys for a specific table
     */
    public getForeignKeys(
        db: SqlJsDatabase,
        dbPath: string,
        tableName: string,
        useCache: boolean = true
    ): ForeignKeyInfo[] {
        const dbCache = this.foreignKeyCache.get(dbPath);
        if (useCache && dbCache?.has(tableName)) {
            return dbCache.get(tableName)!;
        }

        try {
            const results = db.exec(`PRAGMA foreign_key_list(${tableName})`);

            if (results.length === 0) {
                return [];
            }

            const result = results[0];
            const foreignKeys: ForeignKeyInfo[] = result.values.map((row: any) => ({
                id: row[0] as number,
                seq: row[1] as number,
                table: row[2] as string,
                from: row[3] as string,
                to: row[4] as string,
                on_update: row[5] as string,
                on_delete: row[6] as string,
                match: row[7] as string
            }));

            if (!this.foreignKeyCache.has(dbPath)) {
                this.foreignKeyCache.set(dbPath, new Map());
            }
            this.foreignKeyCache.get(dbPath)!.set(tableName, foreignKeys);

            return foreignKeys;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to fetch foreign keys for ${tableName}: ${message}`);
        }
    }

    /**
     * Gets complete metadata for a table
     */
    public getTableMetadata(
        db: SqlJsDatabase,
        dbPath: string,
        tableName: string
    ): {
        columns: ColumnInfo[];
        indexes: IndexInfo[];
        foreignKeys: ForeignKeyInfo[];
    } {
        return {
            columns: this.getColumns(db, dbPath, tableName),
            indexes: this.getIndexes(db, dbPath, tableName),
            foreignKeys: this.getForeignKeys(db, dbPath, tableName)
        };
    }

    /**
     * Invalidates all caches for a database
     */
    public invalidateCache(dbPath: string): void {
        this.tableCache.delete(dbPath);
        this.columnCache.delete(dbPath);
        this.indexCache.delete(dbPath);
        this.foreignKeyCache.delete(dbPath);
    }

    /**
     * Invalidates table-specific cache
     */
    public invalidateTableCache(dbPath: string, tableName: string): void {
        this.columnCache.get(dbPath)?.delete(tableName);
        this.indexCache.get(dbPath)?.delete(tableName);
        this.foreignKeyCache.get(dbPath)?.delete(tableName);
    }

    /**
     * Clears all caches
     */
    public clearAllCaches(): void {
        this.tableCache.clear();
        this.columnCache.clear();
        this.indexCache.clear();
        this.foreignKeyCache.clear();
    }

    /**
     * Disposes resources
     */
    public dispose(): void {
        this.clearAllCaches();
    }
}
