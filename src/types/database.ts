/**
 * Database connection mode
 */
export enum ConnectionMode {
    READ_ONLY = 'readonly',
    READ_WRITE = 'readwrite'
}

/**
 * Query type classification
 */
export enum QueryType {
    READ = 'READ',
    WRITE = 'WRITE',
    SCHEMA = 'SCHEMA',
    UNKNOWN = 'UNKNOWN'
}

/**
 * Table metadata
 */
export interface TableInfo {
    name: string;
    type: 'table' | 'view';
    sql: string | null;
    rootpage: number;
}

/**
 * Column metadata
 */
export interface ColumnInfo {
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
}

/**
 * Index metadata
 */
export interface IndexInfo {
    seq: number;
    name: string;
    unique: number;
    origin: string;
    partial: number;
}

/**
 * Foreign key metadata
 */
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

/**
 * Query execution result
 */
export interface QueryResult {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    changes?: number;
}

/**
 * Paginated query result
 */
export interface PaginatedResult extends QueryResult {
    page: number;
    pageSize: number;
    totalRows: number;
    hasMore: boolean;
}
