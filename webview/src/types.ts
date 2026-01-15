/**
 * Message types for webview communication
 * These should match the types defined in the extension
 */

// Extension → Webview Messages
export type ExtensionMessage =
    | { type: 'init'; dbPath: string; editModeEnabled: boolean }
    | { type: 'schemaData'; tables: TableInfo[] }
    | { type: 'tableData'; data: TableData }
    | { type: 'queryResult'; result: QueryResult }
    | { type: 'tableMetadata'; metadata: TableMetadata }
    | { type: 'editModeChanged'; enabled: boolean }
    | { type: 'error'; message: string };

// Webview → Extension Messages
export type WebviewMessage =
    | { type: 'ready' }
    | { type: 'getTables' }
    | { type: 'getTableData'; tableName: string; page: number; pageSize: number }
    | { type: 'getTableMetadata'; tableName: string }
    | { type: 'executeQuery'; sql: string }
    | { type: 'toggleEditMode' }
    | { type: 'updateRow'; tableName: string; rowData: Record<string, unknown>; primaryKey: Record<string, unknown> };

// Data types
export interface TableInfo {
    name: string;
    type: 'table' | 'view';
    sql: string | null;
    rootpage: number;
}

export interface ColumnInfo {
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
}

export interface IndexInfo {
    seq: number;
    name: string;
    unique: number;
    origin: string;
    partial: number;
}

export interface ForeignKeyInfo {
    id: number;
    seq: number;
    table: string;
    from: string;
    to: string;
    on_update: string;
    on_delete: string;
    match: string;
}

export interface QueryResult {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    changes?: number;
}

export interface TableData extends QueryResult {
    totalRows: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface TableMetadata {
    columns: ColumnInfo[];
    indexes: IndexInfo[];
    foreignKeys: ForeignKeyInfo[];
}

// VS Code API type
export interface VSCodeAPI {
    postMessage(message: WebviewMessage): void;
    getState(): unknown;
    setState(state: unknown): void;
}

declare global {
    interface Window {
        acquireVsCodeApi(): VSCodeAPI;
    }
}
