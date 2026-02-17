import { useEffect, useRef, useCallback } from 'react';
import { ConnectionManager } from '../services/connection-manager';
import { SignalingClient } from '../services/signaling-client';
import { useConnectionStore } from '../stores/connectionStore';
import { useSessionStore } from '../stores/sessionStore';
import type { DataChannelMessage } from '../services/connection-manager';

interface UseWebRTCOptions {
  onMessage?: (message: DataChannelMessage) => void;
}

interface UseWebRTCReturn {
  sendMessage: (data: DataChannelMessage | string) => boolean;
  dataChannelRef: React.RefObject<RTCDataChannel | null>;
}

interface PeerEntry {
  cm: ConnectionManager;
  channel: RTCDataChannel | null;
}

/**
 * useWebRTC — bridges ConnectionManager + SignalingClient with React state.
 *
 * Supports multiple peer connections (for 3+ user sessions).
 * Each peer gets its own ConnectionManager and DataChannel.
 * Messages received from one peer are relayed to all other peers.
 */
export function useWebRTC({ onMessage }: UseWebRTCOptions = {}): UseWebRTCReturn {
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const signalingClientRef = useRef<SignalingClient | null>(null);
  const onMessageRef = useRef(onMessage);

  // Legacy: dataChannelRef for backward compatibility (points to first open channel)
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  // Keep onMessage ref current to avoid stale closures
  onMessageRef.current = onMessage;

  const sessionId = useSessionStore((s) => s.sessionId);
  const isHost = useSessionStore((s) => s.isHost);
  const peerName = useSessionStore((s) => s.peerName);

  const updateConnectionState = useConnectionStore((s) => s.updateConnectionState);
  const updateMetrics = useConnectionStore((s) => s.updateMetrics);
  const addPeer = useConnectionStore((s) => s.addPeer);
  const removePeer = useConnectionStore((s) => s.removePeer);
  const resetConnection = useConnectionStore((s) => s.reset);

  const updateParticipant = useSessionStore((s) => s.updateParticipant);
  const removeParticipant = useSessionStore((s) => s.removeParticipant);
  const transferHost = useSessionStore((s) => s.transferHost);

  /**
   * Send a message to ALL connected peers.
   */
  const sendMessage = useCallback((data: DataChannelMessage | string): boolean => {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    let sent = false;
    peersRef.current.forEach(({ channel }) => {
      if (channel && channel.readyState === 'open') {
        channel.send(jsonStr);
        sent = true;
      }
    });
    return sent;
  }, []);

  /**
   * Update the legacy dataChannelRef to point to any open channel.
   */
  const updateDataChannelRef = useCallback(() => {
    let found: RTCDataChannel | null = null;
    peersRef.current.forEach(({ channel }) => {
      if (!found && channel && channel.readyState === 'open') {
        found = channel;
      }
    });
    dataChannelRef.current = found;
  }, []);

  /**
   * Setup data channel listeners for a specific peer.
   */
  const setupDataChannel = useCallback((channel: RTCDataChannel, peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.channel = channel;
    }

    channel.onopen = () => {
      updateDataChannelRef();
      updateConnectionState('connected');
    };

    channel.onclose = () => {
      const p = peersRef.current.get(peerId);
      if (p) p.channel = null;
      updateDataChannelRef();
    };

    channel.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as DataChannelMessage;
        if (onMessageRef.current) {
          onMessageRef.current(message);
        }
        // Relay the message to all other connected peers
        peersRef.current.forEach(({ channel: ch }, pid) => {
          if (pid !== peerId && ch && ch.readyState === 'open') {
            ch.send(event.data);
          }
        });
      } catch {
        // Non-JSON message — ignore
      }
    };
  }, [updateConnectionState, updateDataChannelRef]);

  useEffect(() => {
    if (!sessionId || !peerName) return;

    const sc = new SignalingClient();
    signalingClientRef.current = sc;

    /**
     * Wire standard ConnectionManager callbacks for a peer.
     */
    function wireConnectionCallbacks(cm: ConnectionManager, peerId: string) {
      cm.on('onStateChange', (state: string) => {
        updateConnectionState(state as Parameters<typeof updateConnectionState>[0]);
      });

      cm.on('onConnectionTypeChange', (type: string) => {
        updateMetrics({ connectionType: type as 'direct' | 'relay' });
      });

      cm.on('onQualityChange', (quality: string) => {
        updateMetrics({ quality: quality as 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' });
      });

      cm.on('onMetricsUpdate', (metrics: Record<string, unknown>) => {
        updateMetrics({
          latency: metrics.latency as number | undefined,
          connectionType: (metrics.connectionType as 'direct' | 'relay') || undefined,
          quality: (metrics.connectionQuality as 'excellent' | 'good' | 'fair' | 'poor' | 'unknown') || undefined,
        });
      });

      cm.on('onDataChannel', (channel: RTCDataChannel) => {
        setupDataChannel(channel, peerId);
      });

      cm.on('onError', (error: Error) => {
        console.error(`[useWebRTC] Connection error with ${peerId}:`, error);
      });

      cm.on('onReconnecting', () => {
        updateConnectionState('connecting');
      });
    }

    /**
     * Create a new ConnectionManager for a specific peer and initiate connection (host-side).
     */
    function initiateConnectionToPeer(targetPeerId: string) {
      const cm = new ConnectionManager();
      peersRef.current.set(targetPeerId, { cm, channel: null });
      wireConnectionCallbacks(cm, targetPeerId);

      (async () => {
        try {
          await cm.initializePeerConnection(false);

          cm.on('onIceCandidate', (candidate: RTCIceCandidate) => {
            sc.sendIceCandidate(candidate, targetPeerId);
          });

          const channel = cm.createDataChannel();
          if (channel) {
            cm.dataChannel = channel;
            if (cm.callbacks.onDataChannel) {
              cm.callbacks.onDataChannel(channel);
            }
          }

          const offer = await cm.createOffer();
          sc.sendOffer(offer, targetPeerId);
        } catch (error) {
          console.error(`[useWebRTC] Error initiating connection to ${targetPeerId}:`, error);
        }
      })();
    }

    /**
     * Handle an incoming offer from a peer (non-host side).
     */
    async function handleIncomingOffer(offer: RTCSessionDescriptionInit, fromPeerId: string) {
      let peer = peersRef.current.get(fromPeerId);
      if (!peer) {
        const cm = new ConnectionManager();
        peer = { cm, channel: null };
        peersRef.current.set(fromPeerId, peer);
        wireConnectionCallbacks(cm, fromPeerId);
      }

      const { cm } = peer;

      try {
        await cm.initializePeerConnection(false);

        // Re-wire callbacks after re-init
        cm.on('onDataChannel', (channel: RTCDataChannel) => {
          setupDataChannel(channel, fromPeerId);
        });
        cm.on('onIceCandidate', (candidate: RTCIceCandidate) => {
          sc.sendIceCandidate(candidate, fromPeerId);
        });

        const answer = await cm.handleOffer(offer);
        sc.sendAnswer(answer, fromPeerId);
      } catch (error) {
        console.error('[useWebRTC] Error handling offer:', error);
      }
    }

    // Wire SignalingClient callbacks
    sc.on('onConnected', (data: Record<string, unknown>) => {
      if (data.isHost) {
        useSessionStore.setState({ isHost: true });
      }
    });

    sc.on('onPeerJoined', (data: Record<string, unknown>) => {
      const peerId = (data.peerId || data.socketId) as string;
      addPeer(peerId, 'connecting');
      updateParticipant(peerId, {
        name: (data.name as string) || 'Anonymous',
        isHost: (data.isHost as boolean) || false,
        joinedAt: Date.now(),
      });

      // Host initiates WebRTC connection to each new peer
      if (useSessionStore.getState().isHost) {
        initiateConnectionToPeer(peerId);
      }
    });

    sc.on('onPeerLeft', (data: Record<string, unknown>) => {
      const peerId = (data.peerId || data.socketId) as string;
      // Clean up peer's connection manager
      const peer = peersRef.current.get(peerId);
      if (peer) {
        peer.cm.disconnect();
        peersRef.current.delete(peerId);
        updateDataChannelRef();
      }
      removePeer(peerId);
      removeParticipant(peerId);
    });

    sc.on('onOffer', async (offer: RTCSessionDescriptionInit, fromPeerId: string) => {
      await handleIncomingOffer(offer, fromPeerId);
    });

    sc.on('onAnswer', async (answer: RTCSessionDescriptionInit, fromPeerId: string) => {
      const peer = peersRef.current.get(fromPeerId);
      if (peer) {
        try {
          await peer.cm.handleAnswer(answer);
        } catch (error) {
          console.error('[useWebRTC] Error handling answer:', error);
        }
      }
    });

    sc.on('onIceCandidate', async (candidate: RTCIceCandidateInit, fromPeerId: string) => {
      const peer = peersRef.current.get(fromPeerId);
      if (peer) {
        try {
          await peer.cm.addIceCandidate(candidate);
        } catch (error) {
          console.error('[useWebRTC] Error adding ICE candidate:', error);
        }
      }
    });

    sc.on('onHostChanged', (data: Record<string, unknown>) => {
      const newHostId = (data.newHostId || data.hostId) as string;
      const mySocketId = sc.getSocketId();
      if (newHostId === mySocketId) {
        transferHost(null);
      } else {
        transferHost(newHostId);
      }
    });

    sc.on('onRoomState', (data: Record<string, unknown>) => {
      if (data.participants) {
        (data.participants as Array<Record<string, unknown>>).forEach((p) => {
          const pid = (p.peerId || p.socketId) as string;
          if (pid !== sc.getSocketId()) {
            updateParticipant(pid, {
              name: (p.name as string) || 'Anonymous',
              isHost: (p.isHost as boolean) || false,
            });
            addPeer(pid, 'connected');
          }
        });
      }
    });

    // Connect to signaling server
    updateConnectionState('connecting');
    sc.connect(sessionId, isHost, peerName).catch((error) => {
      console.error('[useWebRTC] Signaling connection failed:', error);
      updateConnectionState('disconnected');
    });

    return () => {
      // Clean up all peer connections
      peersRef.current.forEach(({ cm }) => {
        cm.disconnect();
      });
      peersRef.current.clear();
      sc.disconnect();
      signalingClientRef.current = null;
      dataChannelRef.current = null;
      resetConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, peerName]);

  return { sendMessage, dataChannelRef };
}
