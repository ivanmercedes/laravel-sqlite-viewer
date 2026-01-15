import type { TableInfo } from '../types';

interface SchemaExplorerProps {
    tables: TableInfo[];
    selectedTable: string | null;
    onTableSelect: (tableName: string) => void;
}

export function SchemaExplorer({ tables, selectedTable, onTableSelect }: SchemaExplorerProps) {
    const tablesList = tables.filter(t => t.type === 'table');
    const viewsList = tables.filter(t => t.type === 'view');

    return (
        <div className="p-3">
            <h2 className="text-xs font-semibold uppercase text-[var(--vscode-descriptionForeground)] mb-2">
                Tables ({tablesList.length})
            </h2>
            <ul className="space-y-1 mb-4">
                {tablesList.map((table) => (
                    <li key={table.name}>
                        <button
                            className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${selectedTable === table.name
                                    ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                                    : 'hover:bg-[var(--vscode-list-hoverBackground)]'
                                }`}
                            onClick={() => onTableSelect(table.name)}
                        >
                            <span className="inline-block w-4 text-[var(--vscode-symbolIcon-tableForeground)]">
                                ⬜
                            </span>
                            {table.name}
                        </button>
                    </li>
                ))}
            </ul>

            {viewsList.length > 0 && (
                <>
                    <h2 className="text-xs font-semibold uppercase text-[var(--vscode-descriptionForeground)] mb-2">
                        Views ({viewsList.length})
                    </h2>
                    <ul className="space-y-1">
                        {viewsList.map((view) => (
                            <li key={view.name}>
                                <button
                                    className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${selectedTable === view.name
                                            ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                                            : 'hover:bg-[var(--vscode-list-hoverBackground)]'
                                        }`}
                                    onClick={() => onTableSelect(view.name)}
                                >
                                    <span className="inline-block w-4 text-[var(--vscode-symbolIcon-interfaceForeground)]">
                                        ◇
                                    </span>
                                    {view.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {tables.length === 0 && (
                <div className="text-sm text-[var(--vscode-descriptionForeground)] py-4 text-center">
                    No tables found
                </div>
            )}
        </div>
    );
}
