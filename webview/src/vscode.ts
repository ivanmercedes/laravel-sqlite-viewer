import { useEffect, useRef } from 'react';
import type { VSCodeAPI, ExtensionMessage, WebviewMessage } from './types';

// Get VS Code API singleton
let vscodeApi: VSCodeAPI | undefined;

export function getVSCodeAPI(): VSCodeAPI {
    if (!vscodeApi) {
        vscodeApi = window.acquireVsCodeApi();
    }
    return vscodeApi;
}

/**
 * Hook to send messages to the extension
 */
export function useExtension() {
    const api = getVSCodeAPI();

    const postMessage = (message: WebviewMessage) => {
        api.postMessage(message);
    };

    return { postMessage };
}

/**
 * Hook to listen for messages from the extension
 */
export function useExtensionMessages(
    handler: (message: ExtensionMessage) => void
) {
    const handlerRef = useRef(handler);

    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);

    useEffect(() => {
        const messageHandler = (event: MessageEvent<ExtensionMessage>) => {
            handlerRef.current(event.data);
        };

        window.addEventListener('message', messageHandler);

        return () => {
            window.removeEventListener('message', messageHandler);
        };
    }, []);
}
