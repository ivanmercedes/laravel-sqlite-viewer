/**
 * Message types for extension ↔ webview communication
 */

// Extension → Webview Messages
export type ExtensionMessage =
    | { type: 'init'; dbPath: string; editModeEnabled: boolean }
    | { type: 'schemaData'; tables: unknown[] }
    | { type: 'tableData'; data: unknown }
    | { type: 'queryResult'; result: unknown }
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
