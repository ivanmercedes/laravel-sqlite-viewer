import { useState, useEffect, useRef } from 'react';
import { useExtension, useExtensionMessages } from '../vscode';
import type { TableData, ExtensionMessage } from '../types';

interface DataViewerProps {
    tableData: TableData | null;
    selectedTable: string | null;
    editModeEnabled: boolean;
    onPageChange: (page: number) => void;
}

interface EditingCell {
    rowIndex: number;
    columnName: string;
    value: string;
}

export function DataViewer({ tableData, selectedTable, editModeEnabled, onPageChange }: DataViewerProps) {
    const { postMessage } = useExtension();
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [primaryKeyColumns, setPrimaryKeyColumns] = useState<string[]>([]);
    const requestedTableRef = useRef<string | null>(null);

    // Listen for primary key response
    useExtensionMessages((message: ExtensionMessage) => {
        if (message.type === 'primaryKey' && message.tableName === selectedTable) {
            console.log('Received primary key:', message.columns);
            setPrimaryKeyColumns(message.columns);
        } else if (message.type === 'updateSuccess') {
            console.log('Update successful, rows affected:', message.rowsAffected);
        }
    });

    // Request primary key columns when table changes (only once per table)
    useEffect(() => {
        if (selectedTable && selectedTable !== requestedTableRef.current) {
            console.log('Requesting primary key for:', selectedTable);
            requestedTableRef.current = selectedTable;
            postMessage({ type: 'getPrimaryKey', tableName: selectedTable });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTable]);

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

    const handleCellDoubleClick = (rowIndex: number, columnName: string, value: unknown) => {
        console.log('Double click:', { rowIndex, columnName, editModeEnabled, primaryKeyColumns });

        // Only allow editing if:
        // 1. Edit mode is enabled
        // 2. Table has primary key
        // 3. Column is not a primary key column
        if (!editModeEnabled) {
            console.log('Edit mode not enabled');
            return;
        }

        if (primaryKeyColumns.length === 0) {
            console.log('No primary key columns found');
            return; // Cannot edit without primary key
        }

        if (primaryKeyColumns.includes(columnName)) {
            console.log('Cannot edit primary key column');
            return; // Cannot edit primary key columns
        }

        console.log('Setting editing cell');
        setEditingCell({
            rowIndex,
            columnName,
            value: formatCellValue(value)
        });
    };

    const handleCellEdit = (newValue: string) => {
        if (editingCell) {
            setEditingCell({ ...editingCell, value: newValue });
        }
    };

    const handleCellSave = () => {
        if (!editingCell || !tableData) {
            return;
        }

        const row = rows[editingCell.rowIndex];
        const originalValue = formatCellValue(row[editingCell.columnName]);

        // Only save if value changed
        if (editingCell.value === originalValue) {
            setEditingCell(null);
            return;
        }

        // Build primary key object
        const primaryKey: Record<string, unknown> = {};
        primaryKeyColumns.forEach(col => {
            primaryKey[col] = row[col];
        });

        // Build row data with new value
        const rowData: Record<string, unknown> = {
            [editingCell.columnName]: editingCell.value === 'NULL' ? null : editingCell.value
        };

        // Send update message
        postMessage({
            type: 'updateRow',
            tableName: selectedTable,
            rowData,
            primaryKey
        });

        setEditingCell(null);

        // Request fresh data after a short delay
        setTimeout(() => {
            postMessage({
                type: 'getTableData',
                tableName: selectedTable,
                page,
                pageSize
            });
        }, 100);
    };

    const handleCellCancel = () => {
        setEditingCell(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCellSave();
        } else if (e.key === 'Escape') {
            handleCellCancel();
        }
    };

    const isPrimaryKeyColumn = (columnName: string) => {
        return primaryKeyColumns.includes(columnName);
    };

    const canEditTable = editModeEnabled && primaryKeyColumns.length > 0;

    return (
        <div className="flex flex-col h-full">
            {/* Table Header Info */}
            <div className="px-4 py-2 border-b border-[var(--vscode-panel-border)] flex items-center justify-between">
                <div className="text-sm">
                    <span className="font-semibold">{selectedTable}</span>
                    <span className="text-[var(--vscode-descriptionForeground)] ml-2">
                        • {totalRows.toLocaleString()} total rows
                    </span>
                    {!canEditTable && editModeEnabled && (
                        <span className="text-yellow-500 ml-2" title="Table requires a primary key for editing">
                            ⚠️ Read-only (no PK)
                        </span>
                    )}
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
                                    <span className="flex items-center">
                                        {column}
                                        {isPrimaryKeyColumn(column) && (
                                            <span className="ml-1" title="Primary Key">🔑</span>
                                        )}
                                    </span>
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

                                    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnName === column;
                                    const isEditable = canEditTable && !isPrimaryKeyColumn(column);

                                    return (
                                        <td
                                            key={column}
                                            className={`px-3 py-2 max-w-md overflow-hidden text-ellipsis whitespace-nowrap ${isEditable ? 'cursor-pointer hover:bg-[var(--vscode-input-background)]' : ''} ${isPrimaryKeyColumn(column) ? 'opacity-60' : ''}`}
                                            title={isTruncated ? stringValue : (isEditable ? 'Double-click to edit' : undefined)}
                                            onDoubleClick={() => handleCellDoubleClick(rowIndex, column, row[column])}
                                        >
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editingCell.value}
                                                    onChange={(e) => handleCellEdit(e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    onBlur={handleCellSave}
                                                    autoFocus
                                                    className="w-full bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-focusBorder)] px-1 rounded"
                                                />
                                            ) : (
                                                displayValue
                                            )}
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
