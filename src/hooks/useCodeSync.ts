import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useSessionStore } from '../stores/sessionStore';
import { TextOperation, calculateTextOperation } from '../services/ot-engine';
import type { DataChannelMessage } from '../services/connection-manager';
import type { RemoteCursor } from '../stores/editorStore';

interface UseCodeSyncOptions {
  sendMessage?: (data: DataChannelMessage) => boolean;
}

interface UseCodeSyncReturn {
  handleMessage: (message: DataChannelMessage) => void;
}

/**
 * useCodeSync — sends/receives OT operations over a data channel.
 *
 * - Watches editorStore.code for local changes, computes OT operations, and
 *   sends them as `code-operation` messages via sendMessage.
 * - Handles incoming `code-operation` messages, transforms if necessary,
 *   and applies to the editor store.
 * - Handles `code` messages for full-sync fallback (late joiners).
 * - Handles `state-request` / `state-sync` for initial state exchange.
 * - Sends cursor/selection position to peers when the user clicks or selects.
 */
export function useCodeSync({ sendMessage }: UseCodeSyncOptions = {}): UseCodeSyncReturn {
  const previousCodeRef = useRef('');
  const pendingOpsRef = useRef<TextOperation[]>([]);
  const isRemoteUpdateRef = useRef(false);
  const lastSentCursorRef = useRef(-1);

  const code = useEditorStore((s) => s.code);
  const applyLocalOperation = useEditorStore((s) => s.applyLocalOperation);
  const applyRemoteOperation = useEditorStore((s) => s.applyRemoteOperation);
  const localOperationCount = useEditorStore((s) => s.localOperationCount);
  const setLanguage = useEditorStore((s) => s.setLanguage);
  const updateRemoteCursor = useEditorStore((s) => s.updateRemoteCursor);

  // Send cursor/selection position to peers when user interacts with #codeInput
  useEffect(() => {
    const handleSelectionChange = () => {
      const el = document.activeElement as HTMLTextAreaElement | null;
      if (!el || el.id !== 'codeInput') return;
      if (!sendMessage) return;

      const pos = el.selectionStart;
      if (pos === lastSentCursorRef.current) return;
      lastSentCursorRef.current = pos;

      const peerName = useSessionStore.getState().peerName;
      sendMessage({
        type: 'cursor',
        peerId: peerName || 'Anonymous',
        position: pos,
        name: peerName || 'Anonymous',
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [sendMessage]);

  // Detect local code changes and send OT operations
  useEffect(() => {
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      previousCodeRef.current = code;
      return;
    }

    const oldText = previousCodeRef.current;
    const newText = code;

    if (oldText === newText) return;

    const operation = calculateTextOperation(oldText, newText);
    if (operation.ops.length === 0) return;

    applyLocalOperation();
    previousCodeRef.current = newText;

    if (sendMessage) {
      sendMessage({
        type: 'code-operation',
        operation: operation.ops,
        operationCount: localOperationCount + 1,
      });
    }
  }, [code, sendMessage, applyLocalOperation, localOperationCount]);

  // Handle incoming messages
  const handleMessage = useCallback((message: DataChannelMessage) => {
    switch (message.type) {
      case 'code-operation': {
        const remoteOp = new TextOperation();
        remoteOp.ops = message.operation;

        // Transform against any pending local operations
        let transformedOp = remoteOp;
        for (const pending of pendingOpsRef.current) {
          const [, newRemote] = TextOperation.transform(pending, transformedOp);
          transformedOp = newRemote;
        }

        const currentCode = useEditorStore.getState().code;
        try {
          const newCode = transformedOp.apply(currentCode);
          isRemoteUpdateRef.current = true;
          applyRemoteOperation(newCode);
          previousCodeRef.current = newCode;
        } catch {
          // Transformation failed — request full sync
          if (sendMessage) {
            sendMessage({ type: 'state-request' });
          }
        }
        break;
      }

      case 'code': {
        // Full code sync (fallback for late joiners)
        isRemoteUpdateRef.current = true;
        applyRemoteOperation(message.code);
        previousCodeRef.current = message.code;
        pendingOpsRef.current = [];
        if (message.language) {
          setLanguage(message.language);
        }
        break;
      }

      case 'cursor': {
        if (message.peerId) {
          updateRemoteCursor(message.peerId, {
            position: message.position,
            name: message.name,
          } as RemoteCursor);
        }
        break;
      }

      case 'state-request': {
        // Peer is requesting full state — send it
        const state = useEditorStore.getState();
        if (sendMessage) {
          sendMessage({
            type: 'state-sync',
            code: state.code,
            language: state.language,
          });
        }
        break;
      }

      case 'state-sync': {
        // Received full state from peer
        isRemoteUpdateRef.current = true;
        if (message.code != null) {
          applyRemoteOperation(message.code);
          previousCodeRef.current = message.code;
        }
        if (message.language) {
          setLanguage(message.language);
        }
        pendingOpsRef.current = [];
        break;
      }

      case 'language': {
        if (message.language) {
          setLanguage(message.language);
        }
        break;
      }

      default:
        break;
    }
  }, [applyRemoteOperation, sendMessage, setLanguage, updateRemoteCursor]);

  return { handleMessage };
}
