import type { TableData } from '../types';

interface DataViewerProps {
    tableData: TableData | null;
    selectedTable: string | null;
    onPageChange: (page: number) => void;
}

export function DataViewer({ tableData, selectedTable, onPageChange }: DataViewerProps) {
    if (!selectedTable) {
        return (
            <div className="flex items-center justify-center h-full text-[var(--vscode-descriptionForeground)]">
                Select a table to view data
            </div>
        );
    }

    if (!tableData) {
        return (
            <div className="flex items-center justify-center h-full text-[var(--vscode-descriptionForeground)]">
                Loading...
            </div>
        );
    }

    const { columns, rows, page, pageSize, totalRows, hasMore } = tableData;

    const currentStart = (page - 1) * pageSize + 1;
    const currentEnd = Math.min(page * pageSize, totalRows);

    return (
        <div className="flex flex-col h-full">
            {/* Table Header Info */}
            <div className="px-4 py-2 border-b border-[var(--vscode-panel-border)] flex items-center justify-between">
                <div className="text-sm">
                    <span className="font-semibold">{selectedTable}</span>
                    <span className="text-[var(--vscode-descriptionForeground)] ml-2">
                        • {totalRows.toLocaleString()} total rows
                    </span>
                </div>
                <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                    Showing {currentStart}-{currentEnd} of {totalRows.toLocaleString()}
                </div>
            </div>

            {/* Data Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-[var(--vscode-editor-background)] border-b border-[var(--vscode-panel-border)]">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column}
                                    className="px-3 py-2 text-left font-semibold text-xs uppercase text-[var(--vscode-descriptionForeground)]"
                                >
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className="border-b border-[var(--vscode-panel-border)] hover:bg-[var(--vscode-list-hoverBackground)]"
                            >
                                {columns.map((column) => {
                                    const value = formatCellValue(row[column]);
                                    const stringValue = String(value);
                                    const isTruncated = stringValue.length > 200;
                                    const displayValue = isTruncated
                                        ? stringValue.substring(0, 200) + '...'
                                        : stringValue;

                                    return (
                                        <td
                                            key={column}
                                            className="px-3 py-2 max-w-md overflow-hidden text-ellipsis whitespace-nowrap"
                                            title={isTruncated ? stringValue : undefined}
                                        >
                                            {displayValue}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {rows.length === 0 && (
                    <div className="flex items-center justify-center py-12 text-[var(--vscode-descriptionForeground)]">
                        No data in this table
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalRows > pageSize && (
                <div className="px-4 py-2 border-t border-[var(--vscode-panel-border)] flex items-center justify-between">
                    <button
                        onClick={() => onPageChange(page - 1)}
                        disabled={page === 1}
                        className="px-3 py-1 text-xs bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ← Previous
                    </button>

                    <span className="text-xs text-[var(--vscode-descriptionForeground)]">
                        Page {page} of {Math.ceil(totalRows / pageSize)}
                    </span>

                    <button
                        onClick={() => onPageChange(page + 1)}
                        disabled={!hasMore}
                        className="px-3 py-1 text-xs bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next →
                    </button>
                </div>
            )}
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
