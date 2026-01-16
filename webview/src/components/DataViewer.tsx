import { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
            <div className="flex items-center justify-center h-full text-(--vscode-descriptionForeground)">
                Select a table to view data
            </div>
        );
    }

    if (!tableData) {
        return (
            <div className="flex items-center justify-center h-full text-(--vscode-descriptionForeground)">
                Loading...
            </div>
        );
    }

    const { columns, rows, page, pageSize, totalRows, hasMore } = tableData;

    const currentStart = (page - 1) * pageSize + 1;
    const currentEnd = Math.min(page * pageSize, totalRows);

    const handleCellDoubleClick = (rowIndex: number, columnName: string, value: unknown) => {
        console.log('Double click:', { rowIndex, columnName, editModeEnabled, primaryKeyColumns });

        if (!editModeEnabled) {
            console.log('Edit mode not enabled');
            return;
        }

        if (primaryKeyColumns.length === 0) {
            console.log('No primary key columns found');
            return;
        }

        if (primaryKeyColumns.includes(columnName)) {
            console.log('Cannot edit primary key column');
            return;
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
        if (!editingCell || !selectedTable) {
            return;
        }

        const row = rows[editingCell.rowIndex];
        const oldValue = row[editingCell.columnName];

        if (formatCellValue(oldValue) === editingCell.value) {
            console.log('Value unchanged');
            setEditingCell(null);
            return;
        }

        console.log('Saving cell edit:', editingCell);

        const pkConditions: Record<string, unknown> = {};
        for (const pkCol of primaryKeyColumns) {
            pkConditions[pkCol] = row[pkCol];
        }

        // Build updated row data with the single changed column
        const updatedRowData = { [editingCell.columnName]: editingCell.value };

        postMessage({
            type: 'updateRow',
            tableName: selectedTable,
            rowData: updatedRowData,
            primaryKey: pkConditions
        });

        setEditingCell(null);
    };

    const handleCellCancel = () => {
        console.log('Canceling edit');
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

    // Render with or without virtual scrolling based on row count
    if (rows.length === 0) {
        return (
            <div className="flex flex-col h-full">
                <div className="px-4 py-2 border-b border-(--vscode-panel-border)">
                    <span className="font-semibold">{selectedTable}</span>
                </div>
                <div className="flex items-center justify-center flex-1 text-(--vscode-descriptionForeground)">
                    No data in this table
                </div>
            </div>
        );
    }

    return <VirtualizedTable
        columns={columns}
        rows={rows}
        selectedTable={selectedTable}
        totalRows={totalRows}
        currentStart={currentStart}
        currentEnd={currentEnd}
        canEditTable={canEditTable}
        editModeEnabled={editModeEnabled}
        isPrimaryKeyColumn={isPrimaryKeyColumn}
        editingCell={editingCell}
        handleCellDoubleClick={handleCellDoubleClick}
        handleCellEdit={handleCellEdit}
        handleKeyDown={handleKeyDown}
        handleCellSave={handleCellSave}
        page={page}
        pageSize={pageSize}
        hasMore={hasMore}
        onPageChange={onPageChange}
    />;
}

// Separate component to use virtual scrolling
interface VirtualizedTableProps {
    columns: string[];
    rows: any[];
    selectedTable: string;
    totalRows: number;
    currentStart: number;
    currentEnd: number;
    canEditTable: boolean;
    editModeEnabled: boolean;
    isPrimaryKeyColumn: (col: string) => boolean;
    editingCell: EditingCell | null;
    handleCellDoubleClick: (rowIndex: number, columnName: string, value: unknown) => void;
    handleCellEdit: (newValue: string) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    handleCellSave: () => void;
    page: number;
    pageSize: number;
    hasMore: boolean;
    onPageChange: (page: number) => void;
}

function VirtualizedTable(props: VirtualizedTableProps) {
    const {
        columns, rows, selectedTable, totalRows, currentStart, currentEnd,
        canEditTable, editModeEnabled, isPrimaryKeyColumn, editingCell,
        handleCellDoubleClick, handleCellEdit, handleKeyDown, handleCellSave,
        page, pageSize, hasMore, onPageChange
    } = props;

    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 35,
        overscan: 5,
    });

    return (
        <div className="flex flex-col h-full">
            {/* Table Header Info */}
            <div className="px-4 py-2 border-b border-(--vscode-panel-border) flex items-center justify-between">
                <div className="text-sm">
                    <span className="font-semibold">{selectedTable}</span>
                    <span className="text-(--vscode-descriptionForeground) ml-2">
                        • {totalRows.toLocaleString()} total rows
                    </span>
                    {!canEditTable && editModeEnabled && (
                        <span className="text-yellow-500 ml-2" title="Table requires a primary key for editing">
                            ⚠️ Read-only (no PK)
                        </span>
                    )}
                </div>
                <div className="text-xs text-(--vscode-descriptionForeground)">
                    Showing {currentStart}-{currentEnd} of {totalRows.toLocaleString()}
                </div>
            </div>

            {/* Virtual scrolled table */}
            <div ref={parentRef} className="flex-1 overflow-auto">
                <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                    <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 bg-(--vscode-editor-background) border-b border-(--vscode-panel-border) z-10">
                            <tr>
                                {columns.map((column) => (
                                    <th
                                        key={column}
                                        className="px-3 py-2 text-left font-semibold text-xs uppercase text-(--vscode-descriptionForeground)"
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
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const rowIndex = virtualRow.index;
                                const row = rows[rowIndex];

                                return (
                                    <tr
                                        key={virtualRow.key}
                                        data-index={virtualRow.index}
                                        ref={rowVirtualizer.measureElement}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                        className="border-b border-(--vscode-panel-border) hover:bg-(--vscode-list-hoverBackground)"
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
                                                    className={`px-3 py-2 max-w-md overflow-hidden text-ellipsis whitespace-nowrap ${isEditable ? 'cursor-pointer hover:bg-(--vscode-input-background)' : ''} ${isPrimaryKeyColumn(column) ? 'opacity-60' : ''}`}
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
                                                            className="w-full bg-(--vscode-input-background) text-(--vscode-input-foreground) border border-(--vscode-focusBorder) px-1 rounded"
                                                        />
                                                    ) : (
                                                        displayValue
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalRows > pageSize && (
                <div className="px-4 py-2 border-t border-(--vscode-panel-border) flex items-center justify-between">
                    <button
                        onClick={() => onPageChange(page - 1)}
                        disabled={page === 1}
                        className="px-3 py-1 text-xs bg-(--vscode-button-secondaryBackground) hover:bg-(--vscode-button-secondaryHoverBackground) text-(--vscode-button-secondaryForeground) rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ← Previous
                    </button>

                    <span className="text-xs text-(--vscode-descriptionForeground)">
                        Page {page} of {Math.ceil(totalRows / pageSize)}
                    </span>

                    <button
                        onClick={() => onPageChange(page + 1)}
                        disabled={!hasMore}
                        className="px-3 py-1 text-xs bg-(--vscode-button-secondaryBackground) hover:bg-(--vscode-button-secondaryHoverBackground) text-(--vscode-button-secondaryForeground) rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
