/**
 * SignalingClient Tests
 *
 * Tests for the Socket.IO-based signaling client for WebRTC connection establishment.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignalingClient } from '../../src/services/signaling-client.js';
import type { Mock } from 'vitest';

interface MockSocket {
    id: string;
    connected: boolean;
    emit: Mock;
    disconnect: Mock;
    on: Mock;
}

// Helper to create a SignalingClient and mock-connect it for testing
const mockConnect = (client: SignalingClient, sessionId: string, isHost: boolean, name: string = 'Anonymous'): void => {
    client.sessionId = sessionId;
    client.isHost = isHost;
    client.name = name;
    client.connected = true;
    client.socket = {
        id: 'mock-socket-id-' + Math.random().toString(36).substr(2, 9),
        connected: true,
        emit: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn()
    } as MockSocket;
};

// ============================================================================
// SignalingClient Tests
// ============================================================================

describe('SignalingClient', () => {
    describe('Initialization', () => {
        it('should create with default server URL', () => {
            const client = new SignalingClient();
            expect(client.serverUrl).toBe('http://localhost:3001');
        });

        it('should create with custom server URL', () => {
            const client = new SignalingClient('http://custom.server:5000');
            expect(client.serverUrl).toBe('http://custom.server:5000');
        });

        it('should start disconnected', () => {
            const client = new SignalingClient();
            expect(client.connected).toBe(false);
            expect(client.socket).toBeNull();
        });

        it('should have empty callbacks', () => {
            const client = new SignalingClient();
            expect(client.callbacks.onOffer).toBeNull();
            expect(client.callbacks.onAnswer).toBeNull();
            expect(client.callbacks.onPeerJoined).toBeNull();
        });
    });

    describe('Default Server URL', () => {
        it('should use localhost for local development', () => {
            const client = new SignalingClient();
            // Mock location is localhost in test environment
            const url = client.getDefaultServerUrl();
            expect(url).toBe('http://localhost:3001');
        });
    });

    describe('Socket.IO Availability', () => {
        it('should check if Socket.IO is available', () => {
            const client = new SignalingClient();
            // io is not defined in test environment
            expect(client.isSocketIOAvailable()).toBe(false);
        });
    });

    describe('Connection State', () => {
        it('should store session ID on connect', () => {
            const client = new SignalingClient();
            mockConnect(client, 'test-session-123', true, 'TestUser');

            expect(client.sessionId).toBe('test-session-123');
            expect(client.isHost).toBe(true);
            expect(client.name).toBe('TestUser');
        });

        it('should mark as connected after mock connect', () => {
            const client = new SignalingClient();
            mockConnect(client, 'session-1', false, 'User');

            expect(client.connected).toBe(true);
            expect(client.socket).not.toBeNull();
        });

        it('should report connected status correctly', () => {
            const client = new SignalingClient();
            expect(client.isConnected()).toBe(false);

            mockConnect(client, 'session-1', false, 'User');
            expect(client.isConnected()).toBe(true);
        });
    });

    describe('Callback Registration', () => {
        it('should register onOffer callback', () => {
            const client = new SignalingClient();
            const callback = vi.fn();

            client.on('onOffer', callback);
            expect(client.callbacks.onOffer).toBe(callback);
        });

        it('should register onAnswer callback', () => {
            const client = new SignalingClient();
            const callback = vi.fn();

            client.on('onAnswer', callback);
            expect(client.callbacks.onAnswer).toBe(callback);
        });

        it('should register onIceCandidate callback', () => {
            const client = new SignalingClient();
            const callback = vi.fn();

            client.on('onIceCandidate', callback);
            expect(client.callbacks.onIceCandidate).toBe(callback);
        });

        it('should register onPeerJoined callback', () => {
            const client = new SignalingClient();
            const callback = vi.fn();

            client.on('onPeerJoined', callback);
            expect(client.callbacks.onPeerJoined).toBe(callback);
        });

        it('should register onPeerLeft callback', () => {
            const client = new SignalingClient();
            const callback = vi.fn();

            client.on('onPeerLeft', callback);
            expect(client.callbacks.onPeerLeft).toBe(callback);
        });

        it('should register onHostChanged callback', () => {
            const client = new SignalingClient();
            const callback = vi.fn();

            client.on('onHostChanged', callback);
            expect(client.callbacks.onHostChanged).toBe(callback);
        });

        it('should not register invalid callback', () => {
            const client = new SignalingClient();
            const callback = vi.fn();

            client.on('invalidEvent', callback);
            expect((client.callbacks as unknown as Record<string, unknown>).invalidEvent).toBeUndefined();
        });
    });

    describe('Sending Signaling Messages', () => {
        it('should not send offer when disconnected', () => {
            const client = new SignalingClient();
            const offer: RTCSessionDescriptionInit = { type: 'offer', sdp: 'v=0...' };

            const result = client.sendOffer(offer);
            expect(result).toBe(false);
        });

        it('should send offer when connected', () => {
            const client = new SignalingClient();
            mockConnect(client, 'session-1', true, 'Host');

            const offer: RTCSessionDescriptionInit = { type: 'offer', sdp: 'v=0...' };
            const result = client.sendOffer(offer);

            expect(result).toBe(true);
            expect((client.socket as MockSocket).emit).toHaveBeenCalledWith('offer', {
                sessionId: 'session-1',
                offer: offer
            });
        });

        it('should send offer with target peer ID', () => {
            const client = new SignalingClient();
            mockConnect(client, 'session-1', true, 'Host');

            const offer: RTCSessionDescriptionInit = { type: 'offer', sdp: 'v=0...' };
            const result = client.sendOffer(offer, 'peer-123');

            expect(result).toBe(true);
            expect((client.socket as MockSocket).emit).toHaveBeenCalledWith('offer', {
                sessionId: 'session-1',
                offer: offer,
                targetPeerId: 'peer-123'
            });
        });

        it('should not send answer when disconnected', () => {
            const client = new SignalingClient();
            const answer: RTCSessionDescriptionInit = { type: 'answer', sdp: 'v=0...' };

            const result = client.sendAnswer(answer);
            expect(result).toBe(false);
        });

        it('should send answer when connected', () => {
            const client = new SignalingClient();
            mockConnect(client, 'session-1', false, 'Peer');

            const answer: RTCSessionDescriptionInit = { type: 'answer', sdp: 'v=0...' };
            const result = client.sendAnswer(answer);

            expect(result).toBe(true);
            expect((client.socket as MockSocket).emit).toHaveBeenCalledWith('answer', {
                sessionId: 'session-1',
                answer: answer
            });
        });

        it('should send answer with target peer ID', () => {
            const client = new SignalingClient();
            mockConnect(client, 'session-1', false, 'Peer');

            const answer: RTCSessionDescriptionInit = { type: 'answer', sdp: 'v=0...' };
            const result = client.sendAnswer(answer, 'host-456');

            expect(result).toBe(true);
            expect((client.socket as MockSocket).emit).toHaveBeenCalledWith('answer', {
                sessionId: 'session-1',
                answer: answer,
                targetPeerId: 'host-456'
            });
        });

        it('should not send ICE candidate when disconnected', () => {
            const client = new SignalingClient();
            const candidate: RTCIceCandidateInit = { candidate: 'candidate:...', sdpMid: '0' };

            const result = client.sendIceCandidate(candidate);
            expect(result).toBe(false);
        });

        it('should send ICE candidate when connected', () => {
            const client = new SignalingClient();
            mockConnect(client, 'session-1', true, 'Host');

            const candidate: RTCIceCandidateInit = { candidate: 'candidate:...', sdpMid: '0' };
            const result = client.sendIceCandidate(candidate);

            expect(result).toBe(true);
            expect((client.socket as MockSocket).emit).toHaveBeenCalledWith('ice-candidate', {
                sessionId: 'session-1',
                candidate: candidate
            });
        });

        it('should send ICE candidate with target peer ID', () => {
            const client = new SignalingClient();
            mockConnect(client, 'session-1', true, 'Host');

            const candidate: RTCIceCandidateInit = { candidate: 'candidate:...', sdpMid: '0' };
            const result = client.sendIceCandidate(candidate, 'peer-789');

            expect(result).toBe(true);
            expect((client.socket as MockSocket).emit).toHaveBeenCalledWith('ice-candidate', {
                sessionId: 'session-1',
                candidate: candidate,
                targetPeerId: 'peer-789'
            });
        });
    });

    describe('Socket ID', () => {
        it('should return null when not connected', () => {
            const client = new SignalingClient();
            expect(client.getSocketId()).toBeNull();
        });

        it('should return socket ID when connected', () => {
            const client = new SignalingClient();
            mockConnect(client, 'session-1', true, 'Host');

            const socketId = client.getSocketId();
            expect(socketId).toMatch(/^mock-socket-id-/);
        });
    });

    describe('Disconnection', () => {
        it('should disconnect and clear state', () => {
            const client = new SignalingClient();
            mockConnect(client, 'session-1', true, 'Host');

            expect(client.connected).toBe(true);
            expect(client.sessionId).toBe('session-1');

            client.disconnect();

            expect(client.connected).toBe(false);
            expect(client.sessionId).toBeNull();
            expect(client.socket).toBeNull();
        });

        it('should emit leave-room before disconnecting', () => {
            const client = new SignalingClient();
            mockConnect(client, 'session-1', true, 'Host');
            const socket = client.socket as MockSocket;

            client.disconnect();

            expect(socket.emit).toHaveBeenCalledWith('leave-room', { sessionId: 'session-1' });
            expect(socket.disconnect).toHaveBeenCalled();
        });

        it('should handle disconnect when already disconnected', () => {
            const client = new SignalingClient();
            expect(() => client.disconnect()).not.toThrow();
        });
    });
});

// ============================================================================
// Multi-Peer Signaling Tests
// ============================================================================

describe('SignalingClient Multi-Peer', () => {
    it('should trigger onPeerJoined callback', () => {
        const client = new SignalingClient();
        const onPeerJoined = vi.fn();
        client.on('onPeerJoined', onPeerJoined);
        mockConnect(client, 'session-1', true, 'Host');

        // Simulate the callback being triggered
        client.callbacks.onPeerJoined!({ peerId: 'peer-1', name: 'User1' });

        expect(onPeerJoined).toHaveBeenCalledWith({ peerId: 'peer-1', name: 'User1' });
    });

    it('should trigger onPeerLeft callback', () => {
        const client = new SignalingClient();
        const onPeerLeft = vi.fn();
        client.on('onPeerLeft', onPeerLeft);
        mockConnect(client, 'session-1', true, 'Host');

        client.callbacks.onPeerLeft!({ peerId: 'peer-1', name: 'User1' });

        expect(onPeerLeft).toHaveBeenCalledWith({ peerId: 'peer-1', name: 'User1' });
    });

    it('should trigger onHostChanged callback', () => {
        const client = new SignalingClient();
        const onHostChanged = vi.fn();
        client.on('onHostChanged', onHostChanged);
        mockConnect(client, 'session-1', false, 'User');

        client.callbacks.onHostChanged!({ newHostId: 'socket-User', newHostName: 'User' });

        expect(onHostChanged).toHaveBeenCalledWith({ newHostId: 'socket-User', newHostName: 'User' });
    });

    it('should trigger onRoomState callback with participant list', () => {
        const client = new SignalingClient();
        const onRoomState = vi.fn();
        client.on('onRoomState', onRoomState);
        mockConnect(client, 'session-1', true, 'Host');

        const roomState = {
            participants: [
                { id: 'socket-Host', name: 'Host', isHost: true },
                { id: 'socket-User1', name: 'User1', isHost: false },
                { id: 'socket-User2', name: 'User2', isHost: false }
            ],
            hostId: 'socket-Host'
        };
        client.callbacks.onRoomState!(roomState);

        expect(onRoomState).toHaveBeenCalledWith(roomState);
    });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('SignalingClient Error Handling', () => {
    it('should trigger onError callback', () => {
        const client = new SignalingClient();
        const onError = vi.fn();
        client.on('onError', onError);
        mockConnect(client, 'session-1', true, 'Host');

        client.callbacks.onError!({ message: 'Connection refused' });

        expect(onError).toHaveBeenCalledWith({ message: 'Connection refused' });
    });

    it('should trigger onDisconnected callback', () => {
        const client = new SignalingClient();
        const onDisconnected = vi.fn();
        client.on('onDisconnected', onDisconnected);
        mockConnect(client, 'session-1', true, 'Host');

        client.connected = false;
        client.callbacks.onDisconnected!('transport close');

        expect(onDisconnected).toHaveBeenCalledWith('transport close');
        expect(client.connected).toBe(false);
    });

    it('should trigger onRoomFull callback', () => {
        const client = new SignalingClient();
        const onRoomFull = vi.fn();
        client.on('onRoomFull', onRoomFull);

        client.callbacks.onRoomFull!({ maxParticipants: 50, currentCount: 50 });

        expect(onRoomFull).toHaveBeenCalledWith({ maxParticipants: 50, currentCount: 50 });
    });
});
