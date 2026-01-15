interface EditModeIndicatorProps {
    enabled: boolean;
}

export function EditModeIndicator({ enabled }: EditModeIndicatorProps) {
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
                <span className="text-xs text-[var(--vscode-inputValidation-warningForeground)]">
                    • Write operations are enabled • Changes will be saved immediately
                </span>
            </div>
        </div>
    );
}
