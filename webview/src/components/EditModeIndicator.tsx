interface EditModeIndicatorProps {
    enabled: boolean;
    onToggle: () => void;
}

export function EditModeIndicator({ enabled, onToggle }: EditModeIndicatorProps) {
    if (!enabled) {
        return null;
    }

    return (
        <div className="px-4 py-2 bg-[var(--vscode-inputValidation-warningBackground)] border-b border-[var(--vscode-inputValidation-warningBorder)] flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--vscode-inputValidation-warningForeground)] animate-pulse" />
                <span className="text-sm font-semibold text-[var(--vscode-inputValidation-warningForeground)]">
                    Edit Mode Active
                </span>
                <span className="text-xs text-[var(--vscode-descriptionForeground)]">
                    • Write operations are enabled • Changes will be saved immediately
                </span>
            </div>
            <button
                onClick={onToggle}
                className="px-3 py-1 text-xs bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] rounded"
            >
                Disable Edit Mode
            </button>
        </div>
    );
}
