import { useState, useEffect } from 'react';
import { useExtension, useExtensionMessages } from './vscode';
import type { ExtensionMessage, TableInfo, QueryResult, TableData } from './types';
import { SchemaExplorer } from './components/SchemaExplorer';
import { DataViewer } from './components/DataViewer';
import { SqlRunner } from './components/SqlRunner';
import { EditModeIndicator } from './components/EditModeIndicator';

export function App() {
    const { postMessage } = useExtension();
    const [dbPath, setDbPath] = useState<string>('');
    const [editModeEnabled, setEditModeEnabled] = useState(false);
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'data' | 'sql'>('data');

    // Signal to extension that webview is ready
    useEffect(() => {
        postMessage({ type: 'ready' });
    }, [postMessage]);

    // Handle messages from extension
    useExtensionMessages((message: ExtensionMessage) => {
        switch (message.type) {
            case 'init':
                setDbPath(message.dbPath);
                setEditModeEnabled(message.editModeEnabled);
                // Request tables on init
                postMessage({ type: 'getTables' });
                break;

            case 'schemaData': {
                const tablesArray = message.tables as TableInfo[];
                setTables(tablesArray);
                // Auto-select first table if none selected
                if (tablesArray.length > 0 && !selectedTable) {
                    handleTableSelect(tablesArray[0].name);
                }
                break;
            }

            case 'tableData':
                setTableData(message.data as TableData);
                setError(null);
                break;

            case 'queryResult':
                setActiveTab('sql');
                setQueryResult(message.result as QueryResult);
                setError(null);
                break;

            case 'editModeChanged':
                setEditModeEnabled(message.enabled);
                break;

            case 'autoRefreshChanged':
                setAutoRefreshEnabled(message.enabled);
                break;

            case 'error':
                setError(message.message);
                break;
        }
    });

    // Notify extension that webview is ready
    useEffect(() => {
        postMessage({ type: 'ready' });
    }, [postMessage]);

    const handleTableSelect = (tableName: string) => {
        setSelectedTable(tableName);
        setActiveTab('data');
        postMessage({
            type: 'getTableData',
            tableName,
            page: 1,
            pageSize: 100
        });
    };

    const handlePageChange = (page: number, searchTerm?: string, sortColumn?: string, sortDirection?: 'ASC' | 'DESC') => {
        if (selectedTable) {
            postMessage({
                type: 'getTableData',
                tableName: selectedTable,
                page,
                pageSize: 100,
                searchTerm,
                sortColumn,
                sortDirection
            });
        }
    };

    const handleQueryExecute = (sql: string) => {
        setActiveTab('sql');
        postMessage({
            type: 'executeQuery',
            sql
        });
    };

    const handleToggleEditMode = () => {
        postMessage({ type: 'toggleEditMode' });
    };

    const handleToggleAutoRefresh = () => {
        postMessage({ type: 'toggleAutoRefresh' });
    };

    return (
        <div className="h-screen flex flex-col bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
            {/* Edit Mode Banner */}
            <EditModeIndicator enabled={editModeEnabled} />

            {/* Header */}
            <header className="px-4 py-2 border-b border-(--vscode-panel-border) flex items-center justify-between">
                <h1 className="text-sm font-semibold">
                    SQLite Viewer: {dbPath.split('/').pop() || 'Database'}
                </h1>

                {/* Toggle Buttons */}
                <div className="flex items-center gap-2">
                    {/* Auto-Refresh Toggle */}
                    <button
                        onClick={handleToggleAutoRefresh}
                        className={`px-3 py-1 text-xs rounded transition-colors ${autoRefreshEnabled
                            ? 'bg-(--vscode-button-background) text-(--vscode-button-foreground)'
                            : 'bg-(--vscode-button-secondaryBackground) hover:bg-(--vscode-button-secondaryHoverBackground) text-(--vscode-button-secondaryForeground)'
                            }`}
                        title={autoRefreshEnabled ? 'Auto-refresh is ON - Click to disable' : 'Enable auto-refresh to update on DB changes'}
                    >
                        {autoRefreshEnabled ? '🔄 Auto-Refresh: ON' : '🔄 Auto-Refresh'}
                    </button>

                    {/* Edit Mode Toggle */}
                    <button
                        onClick={handleToggleEditMode}
                        className={`px-3 py-1 text-xs rounded transition-colors ${editModeEnabled
                            ? 'bg-(--vscode-inputValidation-warningBackground) text-(--vscode-inputValidation-warningForeground) border border-(--vscode-inputValidation-warningBorder)'
                            : 'bg-(--vscode-button-secondaryBackground) hover:bg-(--vscode-button-secondaryHoverBackground) text-(--vscode-button-secondaryForeground)'
                            }`}
                        title={editModeEnabled ? 'Edit Mode is active - Click to disable' : 'Enable Edit Mode to modify data'}
                    >
                        {editModeEnabled ? 'Edit Mode: ON' : 'Read-Only Mode'}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Schema Explorer */}
                <aside className="w-64 border-r border-(--vscode-panel-border) overflow-y-auto">
                    <SchemaExplorer
                        tables={tables}
                        selectedTable={selectedTable}
                        onTableSelect={handleTableSelect}
                    />
                </aside>

                {/* Main Panel */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-(--vscode-panel-border)">
                        <button
                            className={`px-4 py-2 text-sm ${activeTab === 'data'
                                ? 'bg-(--vscode-tab-activeBackground) border-b-2 border-(--vscode-focusBorder)'
                                : 'bg-(--vscode-tab-inactiveBackground) hover:bg-(--vscode-tab-hoverBackground)'
                                }`}
                            onClick={() => setActiveTab('data')}
                        >
                            Data Viewer
                        </button>
                        <button
                            className={`px-4 py-2 text-sm ${activeTab === 'sql'
                                ? 'bg-(--vscode-tab-activeBackground) border-b-2 border-(--vscode-focusBorder)'
                                : 'bg-(--vscode-tab-inactiveBackground) hover:bg-(--vscode-tab-hoverBackground)'
                                }`}
                            onClick={() => setActiveTab('sql')}
                        >
                            SQL Runner
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-hidden">
                        {activeTab === 'data' && (
                            <DataViewer
                                tableData={tableData}
                                selectedTable={selectedTable}
                                editModeEnabled={editModeEnabled}
                                onPageChange={handlePageChange}
                            />
                        )}

                        {activeTab === 'sql' && (
                            <SqlRunner
                                queryResult={queryResult}
                                editModeEnabled={editModeEnabled}
                                onExecute={handleQueryExecute}
                            />
                        )}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="px-4 py-2 bg-(--vscode-inputValidation-errorBackground) border-t border-(--vscode-inputValidation-errorBorder) text-(--vscode-inputValidation-errorForeground)">
                            <strong>Error:</strong> {error}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
