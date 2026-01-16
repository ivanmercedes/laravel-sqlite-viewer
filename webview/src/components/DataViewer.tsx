import { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useExtension, useExtensionMessages } from '../vscode';
import type { TableData, ExtensionMessage } from '../types';

interface DataViewerProps {
    tableData: TableData | null;
    selectedTable: string | null;
    editModeEnabled: boolean;
    onPageChange: (page: number, searchTerm?: string, sortColumn?: string, sortDirection?: 'ASC' | 'DESC') => void;
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

    // Search and sort state
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');
    const searchDebounceTimer = useRef<number | null>(null);

    // Listen for messages including sort state from backend
    useExtensionMessages((message: ExtensionMessage) => {
        if (message.type === 'primaryKey' && message.tableName === selectedTable) {
            console.log('Received primary key:', message.columns);
            setPrimaryKeyColumns(message.columns);
        } else if (message.type === 'updateSuccess') {
            console.log('Update successful, rows affected:', message.rowsAffected);
        } else if (message.type === 'tableData' && message.sortColumn) {
            // Restore sort state from backend persistence
            setSortColumn(message.sortColumn);
            setSortDirection(message.sortDirection || 'ASC');
        }
    });

    // Request primary key columns when table changes
    useEffect(() => {
        if (selectedTable && selectedTable !== requestedTableRef.current) {
            console.log('Requesting primary key for:', selectedTable);
            requestedTableRef.current = selectedTable;
            postMessage({ type: 'getPrimaryKey', tableName: selectedTable });
            // Reset search when changing tables
            setSearchTerm('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTable]);

    // Debounced search effect
    useEffect(() => {
        if (searchDebounceTimer.current) {
            clearTimeout(searchDebounceTimer.current);
        }

        searchDebounceTimer.current = setTimeout(() => {
            if (selectedTable && tableData) {
                // Trigger new fetch with search term AND current sort state
                onPageChange(1, searchTerm, sortColumn || undefined, sortDirection);
            }
        }, 300);

        return () => {
            if (searchDebounceTimer.current) {
                clearTimeout(searchDebounceTimer.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

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

    // Sort handler
    const handleSort = (column: string) => {
        let newDirection: 'ASC' | 'DESC' = 'ASC';

        if (sortColumn === column) {
            // Toggle direction if same column
            newDirection = sortDirection === 'ASC' ? 'DESC' : 'ASC';
        }

        setSortColumn(column);
        setSortDirection(newDirection);

        // Trigger fetch with new sort
        onPageChange(1, searchTerm, column, newDirection);
    };

    // Search change handler
    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        // Debounce is handled by useEffect
    };

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
        searchTerm={searchTerm}
        handleSearchChange={handleSearchChange}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        handleSort={handleSort}
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
    onPageChange: (page: number, searchTerm?: string, sortColumn?: string, sortDirection?: 'ASC' | 'DESC') => void;
    searchTerm: string;
    handleSearchChange: (value: string) => void;
    sortColumn: string | null;
    sortDirection: 'ASC' | 'DESC';
    handleSort: (column: string) => void;
}

function VirtualizedTable(props: VirtualizedTableProps) {
    const {
        columns, rows, selectedTable, totalRows, currentStart, currentEnd,
        canEditTable, editModeEnabled, isPrimaryKeyColumn, editingCell,
        handleCellDoubleClick, handleCellEdit, handleKeyDown, handleCellSave,
        page, pageSize, hasMore, onPageChange,
        searchTerm, handleSearchChange, sortColumn, sortDirection, handleSort
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
            {/* Search Input */}
            <div className="px-4 py-2 border-b border-(--vscode-panel-border)">
                <input
                    type="text"
                    placeholder="Search in all columns..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-(--vscode-input-background) text-(--vscode-input-foreground) border border-(--vscode-input-border) rounded focus:outline-none focus:border-(--vscode-focusBorder)"
                />
                {searchTerm && (
                    <button
                        onClick={() => handleSearchChange('')}
                        className="absolute right-6 top-3 text-xs text-(--vscode-descriptionForeground) hover:text-(--vscode-foreground)"
                    >
                        Clear
                    </button>
                )}
            </div>

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
                                        onClick={() => handleSort(column)}
                                        className="px-3 py-2 text-left font-semibold text-xs uppercase text-(--vscode-descriptionForeground) cursor-pointer hover:bg-(--vscode-list-hoverBackground)"
                                        title={`Click to sort by ${column}`}
                                    >
                                        <span className="flex items-center gap-1">
                                            {column}
                                            {isPrimaryKeyColumn(column) && (
                                                <span className="ml-1" title="Primary Key">🔑</span>
                                            )}
                                            {sortColumn === column && (
                                                <span className="ml-auto">{sortDirection === 'ASC' ? '↑' : '↓'}</span>
                                            )}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="px-4 py-8 text-center text-(--vscode-descriptionForeground)">
                                        No data in this table
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {/* Spacer before visible items */}
                                    {rowVirtualizer.getVirtualItems().length > 0 && (
                                        <tr>
                                            <td style={{ height: rowVirtualizer.getVirtualItems()[0].start }} />
                                        </tr>
                                    )}

                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const rowIndex = virtualRow.index;
                                        const row = rows[rowIndex];

                                        return (
                                            <tr
                                                key={virtualRow.key}
                                                data-index={virtualRow.index}
                                                ref={rowVirtualizer.measureElement}
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

                                    {/* Spacer after visible items */}
                                    {rowVirtualizer.getVirtualItems().length > 0 && (
                                        <tr>
                                            <td style={{
                                                height: rowVirtualizer.getTotalSize() -
                                                    rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end
                                            }} />
                                        </tr>
                                    )}
                                </>
                            )}
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
