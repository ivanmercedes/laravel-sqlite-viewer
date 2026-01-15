import { QueryType } from '../types/database';

/**
 * Critical security layer for SQL query classification and validation.
 * Enforces read-only by default and controls access to write/schema operations.
 */
export class QueryGuard {
    private static readonly READ_KEYWORDS = ['SELECT', 'WITH'];
    private static readonly WRITE_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE'];
    private static readonly SCHEMA_KEYWORDS = ['CREATE', 'ALTER', 'DROP', 'TRUNCATE'];
    private static readonly DESTRUCTIVE_KEYWORDS = ['DELETE', 'DROP', 'TRUNCATE'];

    /**
     * Classifies a SQL query by its operation type
     */
    public static classifyQuery(sql: string): QueryType {
        const trimmed = sql.trim().toUpperCase();

        if (!trimmed) {
            return QueryType.UNKNOWN;
        }

        // Extract first keyword
        const firstKeyword = trimmed.split(/\s+/)[0];

        if (this.READ_KEYWORDS.includes(firstKeyword)) {
            return QueryType.READ;
        }

        if (this.WRITE_KEYWORDS.includes(firstKeyword)) {
            return QueryType.WRITE;
        }

        if (this.SCHEMA_KEYWORDS.includes(firstKeyword)) {
            return QueryType.SCHEMA;
        }

        return QueryType.UNKNOWN;
    }

    /**
     * Validates that SQL contains only a single statement
     */
    public static isSingleStatement(sql: string): boolean {
        // Remove comments and strings to avoid false positives
        const cleaned = this.removeCommentsAndStrings(sql);

        // Count semicolons (statement terminators)
        const semicolonCount = (cleaned.match(/;/g) || []).length;

        // Allow 0 or 1 semicolons (statement may or may not end with semicolon)
        return semicolonCount <= 1;
    }

    /**
     * Checks if query is destructive (requires confirmation)
     */
    public static isDestructive(sql: string): boolean {
        const trimmed = sql.trim().toUpperCase();
        const firstKeyword = trimmed.split(/\s+/)[0];
        return this.DESTRUCTIVE_KEYWORDS.includes(firstKeyword);
    }

    /**
     * Validates query can be executed in current mode
     */
    public static canExecute(
        sql: string,
        editModeEnabled: boolean,
        schemaOpsEnabled: boolean = false
    ): { allowed: boolean; reason?: string } {
        const queryType = this.classifyQuery(sql);

        // READ queries always allowed
        if (queryType === QueryType.READ) {
            return { allowed: true };
        }

        // WRITE queries require Edit Mode
        if (queryType === QueryType.WRITE) {
            if (!editModeEnabled) {
                return {
                    allowed: false,
                    reason: 'Write operations require Edit Mode to be enabled'
                };
            }
            return { allowed: true };
        }

        // SCHEMA queries require Edit Mode AND feature flag
        if (queryType === QueryType.SCHEMA) {
            if (!editModeEnabled) {
                return {
                    allowed: false,
                    reason: 'Schema operations require Edit Mode to be enabled'
                };
            }
            if (!schemaOpsEnabled) {
                return {
                    allowed: false,
                    reason: 'Schema operations are disabled (feature flag required)'
                };
            }
            return { allowed: true };
        }

        // UNKNOWN queries blocked by default
        return {
            allowed: false,
            reason: 'Query type could not be determined'
        };
    }

    /**
     * Removes SQL comments and string literals to avoid false positives in parsing
     */
    private static removeCommentsAndStrings(sql: string): string {
        // Remove single-line comments (-- comment)
        let cleaned = sql.replace(/--[^\n]*/g, '');

        // Remove multi-line comments (/* comment */)
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

        // Remove string literals ('string' or "string")
        cleaned = cleaned.replace(/'(?:[^'\\]|\\.)*'/g, '');
        cleaned = cleaned.replace(/"(?:[^"\\]|\\.)*"/g, '');

        return cleaned;
    }
}
