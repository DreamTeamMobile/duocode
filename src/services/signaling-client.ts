/**
 * DuoCode Signaling Client
 *
 * Socket.IO-based signaling client for WebRTC connection establishment.
 * Works as a fallback when localStorage signaling is not available
 * (i.e., when peers are on different browsers/devices).
 */

// Socket.IO is loaded dynamically via script tag; declare minimal types for the global `io`
interface SocketIOSocket {
    id: string;
    connected: boolean;
    on(event: string, callback: (...args: unknown[]) => void): void;
    emit(event: string, data?: unknown): void;
    disconnect(): void;
}

type SocketIOConnectFn = (url: string, options: Record<string, unknown>) => SocketIOSocket;

declare const io: SocketIOConnectFn;

declare global {
    interface Window {
        SIGNALING_SERVER_URL?: string;
    }
}

export type SignalingEvent = keyof SignalingCallbacks;

export interface SignalingCallbacks {
    onOffer: ((offer: RTCSessionDescriptionInit, from: string) => void) | null;
    onAnswer: ((answer: RTCSessionDescriptionInit, from: string) => void) | null;
    onIceCandidate: ((candidate: RTCIceCandidateInit, from: string) => void) | null;
    onPeerJoined: ((data: unknown) => void) | null;
    onPeerLeft: ((data: unknown) => void) | null;
    onRoomFull: ((data: unknown) => void) | null;
    onHostChanged: ((data: unknown) => void) | null;
    onRoomState: ((data: unknown) => void) | null;
    onConnected: ((data: unknown) => void) | null;
    onDisconnected: ((reason: string) => void) | null;
    onError: ((data: unknown) => void) | null;
}

export class SignalingClient {
    socket: SocketIOSocket | null;
    serverUrl: string;
    sessionId: string | null;
    isHost: boolean;
    connected: boolean;
    reconnecting: boolean;
    name: string | null;
    callbacks: SignalingCallbacks;

    constructor(serverUrl: string | null = null) {
        this.socket = null;
        this.serverUrl = serverUrl || this.getDefaultServerUrl();
        this.sessionId = null;
        this.isHost = false;
        this.connected = false;
        this.reconnecting = false;
        this.name = null;
        this.callbacks = {
            onOffer: null,
            onAnswer: null,
            onIceCandidate: null,
            onPeerJoined: null,
            onPeerLeft: null,
            onRoomFull: null,
            onHostChanged: null,
            onRoomState: null,
            onConnected: null,
            onDisconnected: null,
            onError: null
        };
    }

    /**
     * Get default server URL based on environment
     */
    getDefaultServerUrl(): string {
        const isLocalhost = window.location.hostname === 'localhost' ||
                           window.location.hostname === '127.0.0.1';

        if (isLocalhost) {
            return 'http://localhost:3001';
        }

        return window.SIGNALING_SERVER_URL || window.location.origin;
    }

    /**
     * Check if Socket.IO is available
     */
    isSocketIOAvailable(): boolean {
        return typeof io !== 'undefined';
    }

    /**
     * Load Socket.IO client library dynamically
     */
    async loadSocketIO(): Promise<void> {
        if (this.isSocketIOAvailable()) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `${this.serverUrl}/socket.io/socket.io.js`;
            script.onload = () => {
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load Socket.IO client'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Connect to the signaling server
     */
    async connect(sessionId: string, isHost: boolean, name: string = 'Anonymous'): Promise<boolean> {
        this.sessionId = sessionId;
        this.isHost = isHost;
        this.name = name;

        try {
            await this.loadSocketIO();
        } catch (error) {
            console.warn('[SignalingClient] Could not load Socket.IO, server may be unavailable:', error);
            return false;
        }

        return new Promise((resolve, reject) => {
            try {
                this.socket = io(this.serverUrl, {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                    timeout: 10000
                });

                this.socket.on('connect', () => {
                    this.connected = true;
                    this.socket!.emit('join-room', {
                        sessionId: this.sessionId,
                        isHost: this.isHost,
                        name: this.name
                    });
                });

                this.socket.on('joined-room', (data: unknown) => {
                    if (this.callbacks.onConnected) {
                        this.callbacks.onConnected(data);
                    }
                    resolve(true);
                });

                this.socket.on('room-full', (data: unknown) => {
                    if (this.callbacks.onRoomFull) {
                        this.callbacks.onRoomFull(data);
                    }
                    reject(new Error('Room is full'));
                });

                this.socket.on('peer-joined', (data: unknown) => {
                    if (this.callbacks.onPeerJoined) {
                        this.callbacks.onPeerJoined(data);
                    }
                });

                this.socket.on('peer-left', (data: unknown) => {
                    if (this.callbacks.onPeerLeft) {
                        this.callbacks.onPeerLeft(data);
                    }
                });

                this.socket.on('offer', (data: unknown) => {
                    const d = data as { offer: RTCSessionDescriptionInit; from: string };
                    if (this.callbacks.onOffer) {
                        this.callbacks.onOffer(d.offer, d.from);
                    }
                });

                this.socket.on('answer', (data: unknown) => {
                    const d = data as { answer: RTCSessionDescriptionInit; from: string };
                    if (this.callbacks.onAnswer) {
                        this.callbacks.onAnswer(d.answer, d.from);
                    }
                });

                this.socket.on('ice-candidate', (data: unknown) => {
                    const d = data as { candidate: RTCIceCandidateInit; from: string };
                    if (this.callbacks.onIceCandidate) {
                        this.callbacks.onIceCandidate(d.candidate, d.from);
                    }
                });

                this.socket.on('room-state', (data: unknown) => {
                    if (this.callbacks.onRoomState) {
                        this.callbacks.onRoomState(data);
                    }
                });

                this.socket.on('host-changed', (data: unknown) => {
                    if (this.callbacks.onHostChanged) {
                        this.callbacks.onHostChanged(data);
                    }
                });

                this.socket.on('error', (data: unknown) => {
                    console.error('[SignalingClient] Error:', data);
                    if (this.callbacks.onError) {
                        this.callbacks.onError(data);
                    }
                });

                this.socket.on('disconnect', (reason: unknown) => {
                    this.connected = false;
                    if (this.callbacks.onDisconnected) {
                        this.callbacks.onDisconnected(reason as string);
                    }
                });

                this.socket.on('connect_error', (error: unknown) => {
                    console.error('[SignalingClient] Connection error:', error);
                    if (!this.connected) {
                        reject(new Error('Failed to connect to signaling server'));
                    }
                });

                this.socket.on('server-shutdown', () => {
                    this.disconnect();
                });

                // Set a timeout for initial connection
                setTimeout(() => {
                    if (!this.connected) {
                        this.disconnect();
                        reject(new Error('Connection timeout'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Send WebRTC offer to peer
     */
    sendOffer(offer: RTCSessionDescriptionInit, targetPeerId: string | null = null): boolean {
        if (!this.connected || !this.socket) return false;

        const data: Record<string, unknown> = { sessionId: this.sessionId, offer };
        if (targetPeerId) data.targetPeerId = targetPeerId;
        this.socket.emit('offer', data);
        return true;
    }

    /**
     * Send WebRTC answer to peer
     */
    sendAnswer(answer: RTCSessionDescriptionInit, targetPeerId: string | null = null): boolean {
        if (!this.connected || !this.socket) return false;

        const data: Record<string, unknown> = { sessionId: this.sessionId, answer };
        if (targetPeerId) data.targetPeerId = targetPeerId;
        this.socket.emit('answer', data);
        return true;
    }

    /**
     * Send ICE candidate to peer
     */
    sendIceCandidate(candidate: RTCIceCandidateInit, targetPeerId: string | null = null): boolean {
        if (!this.connected || !this.socket) return false;

        const data: Record<string, unknown> = { sessionId: this.sessionId, candidate };
        if (targetPeerId) data.targetPeerId = targetPeerId;
        this.socket.emit('ice-candidate', data);
        return true;
    }

    /**
     * Get the local socket ID
     */
    getSocketId(): string | null {
        return this.socket?.id || null;
    }

    /**
     * Set callback handlers
     */
    on(event: string, callback: (...args: never[]) => void): void {
        if (Object.prototype.hasOwnProperty.call(this.callbacks, event)) {
            this.callbacks[event as keyof SignalingCallbacks] = callback as never;
        }
    }

    /**
     * Disconnect from signaling server
     */
    disconnect(): void {
        if (this.socket) {
            if (this.sessionId) {
                this.socket.emit('leave-room', { sessionId: this.sessionId });
            }
            this.socket.disconnect();
            this.socket = null;
        }
        this.connected = false;
        this.sessionId = null;
    }

    /**
     * Check if connected to signaling server
     */
    isConnected(): boolean {
        return this.connected && this.socket !== null && this.socket.connected;
    }
}
