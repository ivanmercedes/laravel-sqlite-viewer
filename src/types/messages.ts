/**
 * Message types for extension ↔ webview communication
 */

// Extension → Webview Messages
export type ExtensionMessage =
    | { type: 'init'; dbPath: string; editModeEnabled: boolean }
    | { type: 'schemaData'; tables: unknown[] }
    | { type: 'tableData'; data: unknown; sortColumn?: string; sortDirection?: 'ASC' | 'DESC' }
    | { type: 'queryResult'; result: unknown }
    | { type: 'editModeChanged'; enabled: boolean }
    | { type: 'primaryKey'; tableName: string; columns: string[] }
    | { type: 'updateSuccess'; rowsAffected: number }
    | { type: 'autoRefreshChanged'; enabled: boolean }
    | { type: 'error'; message: string };

// Webview → Extension Messages
export type WebviewMessage =
    | { type: 'ready' }
    | { type: 'getTables' }
    | { type: 'getTableData'; tableName: string; page: number; pageSize: number; searchTerm?: string; sortColumn?: string; sortDirection?: 'ASC' | 'DESC' }
    | { type: 'getTableMetadata'; tableName: string }
    | { type: 'getPrimaryKey'; tableName: string }
    | { type: 'executeQuery'; sql: string }
    | { type: 'toggleEditMode' }
    | { type: 'toggleAutoRefresh' }
    | { type: 'updateRow'; tableName: string; rowData: Record<string, unknown>; primaryKey: Record<string, unknown> };
