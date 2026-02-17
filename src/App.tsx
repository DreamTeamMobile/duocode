import { useCallback, useRef, useEffect } from 'react';
import ThemeProvider from './components/ThemeProvider';
import AppShell from './components/AppShell';
import TabBar from './components/TabBar';
import TabContent from './components/TabContent';
import MessagesFAB from './components/Messages/MessagesFAB';
import MessagesOverlay from './components/Messages/MessagesOverlay';
import NameEntryModal from './components/Modals/NameEntryModal';
import NewSessionModal from './components/Modals/NewSessionModal';
import ToastContainer from './components/Notifications/ToastContainer';
import RetryBanner from './components/Notifications/RetryBanner';
import { useWebRTC } from './hooks/useWebRTC';
import { useCodeSync } from './hooks/useCodeSync';
import { useCanvasSync } from './hooks/useCanvasSync';
import { useMessageSync } from './hooks/useMessageSync';
import { usePersistence } from './hooks/usePersistence';
import { useSessionInit } from './hooks/useSessionInit';
import { installDuoCodeDebug } from './services/debug-utility';
import type { DataChannelMessage } from './services/connection-manager';

function App() {
  // Install debug utility on mount
  useEffect(() => {
    installDuoCodeDebug();
  }, []);

  // Session initialisation: parse URL, create/join session, show name modal
  useSessionInit();

  // Persistence: restore state on mount, auto-save on changes
  usePersistence();

  // Shared send function reference — updated by useWebRTC when
  // the data channel is ready. All sync hooks read from this ref
  // so they always have the latest send capability.
  const sendRef = useRef<((data: DataChannelMessage | string) => boolean) | null>(null);

  const stableSend = useCallback((data: DataChannelMessage) => {
    if (sendRef.current) {
      return sendRef.current(data);
    }
    return false;
  }, []);

  // Initialize sync hooks with the stable send callback
  const { handleMessage: handleCodeMessage } = useCodeSync({ sendMessage: stableSend });
  const { handleMessage: handleCanvasMessage } = useCanvasSync({ sendMessage: stableSend });
  const { handleMessage: handleChatMessage } = useMessageSync({ sendMessage: stableSend });

  // Route incoming data-channel messages to the appropriate sync hook
  const onMessage = useCallback(
    (message: DataChannelMessage) => {
      if (!message || !message.type) return;

      switch (message.type) {
        case 'code-operation':
        case 'code':
        case 'cursor':
        case 'language':
          handleCodeMessage(message);
          break;

        case 'canvas':
        case 'canvas-view':
        case 'canvas-clear':
        case 'canvas-sync':
          handleCanvasMessage(message);
          break;

        case 'message':
        case 'message-ack':
          handleChatMessage(message);
          break;

        case 'state-request':
          handleCodeMessage(message);
          handleCanvasMessage(message);
          break;

        case 'state-sync':
          handleCodeMessage(message);
          break;

        default:
          break;
      }
    },
    [handleCodeMessage, handleCanvasMessage, handleChatMessage]
  );

  // WebRTC connection lifecycle — populates sendRef when the data channel opens
  const { sendMessage } = useWebRTC({ onMessage });
  sendRef.current = sendMessage;

  return (
    <ThemeProvider>
      <AppShell>
        <div id="tabGroup">
          <TabBar />
          <TabContent />
        </div>
        <MessagesFAB />
        <MessagesOverlay />
        <NameEntryModal />
        <NewSessionModal />
        <ToastContainer />
        <RetryBanner />
      </AppShell>
    </ThemeProvider>
  );
}

export default App;
