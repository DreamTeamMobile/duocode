/**
 * DuoCodeDebug — exposes diagnostic helpers on window for E2E tests
 * and browser-console inspection.
 *
 * Call `window.DuoCodeDebug.status()` from the console.
 */

import { useSessionStore } from '../stores/sessionStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useEditorStore } from '../stores/editorStore';
import { useCanvasStore } from '../stores/canvasStore';
import { useMessagesStore } from '../stores/messagesStore';
import type { Stroke } from './canvas-logic';

interface Participant {
  name: string;
  isHost: boolean;
}

interface DuoCodeDebugAPI {
  getDrawingStrokes(): Stroke[];
  status(): void;
}

declare global {
  interface Window {
    DuoCodeDebug: DuoCodeDebugAPI;
  }
}

export function installDuoCodeDebug(): void {
  window.DuoCodeDebug = {
    getDrawingStrokes() {
      return useCanvasStore.getState().drawingStrokes;
    },

    status() {
      const session = useSessionStore.getState();
      const connection = useConnectionStore.getState();
      const editor = useEditorStore.getState();
      const messages = useMessagesStore.getState();
      const canvas = useCanvasStore.getState();

      console.log('=== DuoCode Debug Status ===');
      console.log('Session ID:', session.sessionId);
      console.log('Local participant:', session.peerName);
      console.log('Is host:', session.isHost);
      console.log('Session start time:', session.sessionStartTime);
      console.log('');
      console.log('--- Connection ---');
      console.log('State:', connection.connectionState);
      console.log('Type:', connection.connectionType);
      console.log('Latency:', connection.latency);
      console.log('Quality:', connection.quality);
      console.log('Peer connections:', connection.peerConnections);
      console.log('');
      console.log('--- Participants ---');
      const participantEntries = Object.entries(session.participants);
      console.log('Total participants:', participantEntries.length);
      participantEntries.forEach(([peerId, p]) => {
        const participant = p as Participant;
        console.log(`  ${peerId}: name=${participant.name}, isHost=${participant.isHost}`);
      });
      console.log('');
      console.log('--- Editor ---');
      console.log('Language:', editor.language);
      console.log('Code length:', editor.code.length);
      console.log('Local ops:', editor.localOperationCount);
      console.log('Remote ops:', editor.remoteOperationCount);
      console.log('');
      console.log('--- Canvas ---');
      console.log('Strokes:', canvas.drawingStrokes.length);
      console.log('Tool:', canvas.currentTool);
      console.log('');
      console.log('--- Messages ---');
      console.log('Total messages:', messages.messages.length);
      console.log('Unread:', messages.unreadCount);
      console.log('=============================');
    },
  };
}
