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
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tableData, setTableData] = useState<TableData | null>(null);
    const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'data' | 'sql'>('data');

    // Handle messages from extension
    useExtensionMessages((message: ExtensionMessage) => {
        switch (message.type) {
            case 'init':
                setDbPath(message.dbPath);
                setEditModeEnabled(message.editModeEnabled);
                // Request tables on init
                postMessage({ type: 'getTables' });
                break;

            case 'schemaData':
                setTables(message.tables);
                // Auto-select first table if none selected
                if (message.tables.length > 0 && !selectedTable) {
                    handleTableSelect(message.tables[0].name);
                }
                break;

            case 'tableData':
                setTableData(message.data as TableData);
                setError(null);
                break;

            case 'queryResult':
                setQueryResult(message.result);
                setError(null);
                break;

            case 'editModeChanged':
                setEditModeEnabled(message.enabled);
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

    const handlePageChange = (page: number) => {
        if (selectedTable) {
            postMessage({
                type: 'getTableData',
                tableName: selectedTable,
                page,
                pageSize: 100
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

    return (
        <div className="h-screen flex flex-col bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)]">
            {/* Edit Mode Indicator */}
            <EditModeIndicator
                enabled={editModeEnabled}
                onToggle={handleToggleEditMode}
            />

            {/* Header */}
            <header className="px-4 py-2 border-b border-[var(--vscode-panel-border)] flex items-center justify-between">
                <h1 className="text-sm font-semibold">
                    SQLite Viewer: {dbPath.split('/').pop() || 'Database'}
                </h1>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Schema Explorer */}
                <aside className="w-64 border-r border-[var(--vscode-panel-border)] overflow-y-auto">
                    <SchemaExplorer
                        tables={tables}
                        selectedTable={selectedTable}
                        onTableSelect={handleTableSelect}
                    />
                </aside>

                {/* Main Panel */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-[var(--vscode-panel-border)]">
                        <button
                            className={`px-4 py-2 text-sm ${activeTab === 'data'
                                ? 'bg-[var(--vscode-tab-activeBackground)] border-b-2 border-[var(--vscode-focusBorder)]'
                                : 'bg-[var(--vscode-tab-inactiveBackground)] hover:bg-[var(--vscode-tab-hoverBackground)]'
                                }`}
                            onClick={() => setActiveTab('data')}
                        >
                            Data Viewer
                        </button>
                        <button
                            className={`px-4 py-2 text-sm ${activeTab === 'sql'
                                ? 'bg-[var(--vscode-tab-activeBackground)] border-b-2 border-[var(--vscode-focusBorder)]'
                                : 'bg-[var(--vscode-tab-inactiveBackground)] hover:bg-[var(--vscode-tab-hoverBackground)]'
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
                        <div className="px-4 py-2 bg-[var(--vscode-inputValidation-errorBackground)] border-t border-[var(--vscode-inputValidation-errorBorder)] text-[var(--vscode-inputValidation-errorForeground)]">
                            <strong>Error:</strong> {error}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
