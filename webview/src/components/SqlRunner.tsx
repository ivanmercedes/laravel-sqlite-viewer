import { useState } from 'react';
import type { QueryResult } from '../types';

interface SqlRunnerProps {
    queryResult: QueryResult | null;
    editModeEnabled: boolean;
    onExecute: (sql: string) => void;
}

export function SqlRunner({ queryResult, editModeEnabled, onExecute }: SqlRunnerProps) {
    const [sql, setSql] = useState('');

    const handleExecute = () => {
        if (sql.trim()) {
            onExecute(sql.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Execute on Cmd/Ctrl + Enter
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleExecute();
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* SQL Editor */}
            <div className="p-4 border-b border-[var(--vscode-panel-border)]">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold">SQL Query</label>
                    <div className="flex items-center gap-2">
                        {!editModeEnabled && (
                            <span className="text-xs text-[var(--vscode-descriptionForeground)]">
                                Read-only mode (SELECT queries only)
                            </span>
                        )}
                        <button
                            onClick={handleExecute}
                            disabled={!sql.trim()}
                            className="px-3 py-1.5 text-sm bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Execute (⌘↵)
                        </button>
                    </div>
                </div>
                <textarea
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="SELECT * FROM table_name LIMIT 100"
                    className="w-full h-32 p-3 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded font-mono text-sm resize-none focus:outline-none focus:border-[var(--vscode-focusBorder)]"
                />
            </div>

            {/* Results */}
            <div className="flex-1 overflow-auto p-4">
                {!queryResult && (
                    <div className="flex items-center justify-center h-full text-[var(--vscode-descriptionForeground)]">
                        Enter a SQL query and click Execute to see results
                    </div>
                )}

                {queryResult && queryResult.rows.length > 0 && (
                    <div>
                        <div className="mb-2 text-sm text-[var(--vscode-descriptionForeground)]">
                            {queryResult.rowCount} row{queryResult.rowCount !== 1 ? 's' : ''} returned
                        </div>
                        <div className="overflow-auto">
                            <table className="w-full text-sm border-collapse border border-[var(--vscode-panel-border)]">
                                <thead className="bg-[var(--vscode-editor-background)]">
                                    <tr>
                                        {queryResult.columns.map((column) => (
                                            <th
                                                key={column}
                                                className="px-3 py-2 text-left font-semibold text-xs uppercase text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-panel-border)]"
                                            >
                                                {column}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {queryResult.rows.map((row, rowIndex) => (
                                        <tr
                                            key={rowIndex}
                                            className="border-b border-[var(--vscode-panel-border)] hover:bg-[var(--vscode-list-hoverBackground)]"
                                        >
                                            {queryResult.columns.map((column) => (
                                                <td key={column} className="px-3 py-2">
                                                    {formatCellValue(row[column])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {queryResult && queryResult.rows.length === 0 && queryResult.changes !== undefined && (
                    <div className="p-4 bg-[var(--vscode-inputValidation-infoBackground)] border border-[var(--vscode-inputValidation-infoBorder)] rounded">
                        <div className="text-sm text-[var(--vscode-inputValidation-infoForeground)]">
                            Query executed successfully. {queryResult.changes} row{queryResult.changes !== 1 ? 's' : ''} affected.
                        </div>
                    </div>
                )}

                {queryResult && queryResult.rows.length === 0 && queryResult.changes === undefined && (
                    <div className="flex items-center justify-center h-full text-[var(--vscode-descriptionForeground)]">
                        Query returned no results
                    </div>
                )}
            </div>
        </div>
    );
}

function formatCellValue(value: unknown): string {
    if (value === null) {
        return 'NULL';
    }
    if (value === undefined) {
        return '';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}
