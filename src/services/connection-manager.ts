/**
 * DuoCode Connection Manager
 *
 * Handles WebRTC connection establishment with intelligent fallback logic,
 * NAT traversal, network topology detection, and connection quality monitoring.
 */

import type { Op } from './ot-engine';
import type { Stroke, Point } from './canvas-logic';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed' | 'closed' | 'reconnecting' | 'error';
export type ConnectionType = 'direct' | 'relay';
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
type CandidateType = 'host' | 'srflx' | 'relay';

// ── DataChannel Message Types ────────────────────────────────────────────────

/** Discriminated union of all messages sent/received over the WebRTC DataChannel. */
export type DataChannelMessage =
  | { type: 'code-operation'; operation: Op[]; operationCount: number }
  | { type: 'code'; code: string; language?: string }
  | { type: 'cursor'; peerId: string; position?: number; line?: number; column?: number; name: string }
  | { type: 'language'; language: string }
  | { type: 'state-request' }
  | { type: 'state-sync'; code?: string; language?: string }
  | { type: 'canvas'; action: 'stroke'; stroke: Stroke }
  | { type: 'canvas'; action: 'drawing'; peerId: string; data: unknown }
  | { type: 'canvas-view'; zoom: number; panOffset: Point }
  | { type: 'canvas-clear' }
  | { type: 'canvas-sync'; strokes: Stroke[]; zoom?: number; panOffset?: Point }
  | { type: 'message'; id: string; text: string; sender: string; timestamp: number }
  | { type: 'message-ack'; messageId: string }
  | { type: 'execution-start'; language: string; timestamp: number }
  | { type: 'execution-result'; stdout: string; stderr: string; exitCode: number; duration: number };

export interface ConnectionManagerOptions {
    stunServers?: RTCIceServer[];
    turnServers?: RTCIceServer[];
    directConnectionTimeout?: number;
    relayConnectionTimeout?: number;
    iceGatheringTimeout?: number;
    qualityCheckInterval?: number;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
}

interface ConnectionManagerConfig {
    stunServers: RTCIceServer[];
    turnServers: RTCIceServer[];
    directConnectionTimeout: number;
    relayConnectionTimeout: number;
    iceGatheringTimeout: number;
    qualityCheckInterval: number;
    maxReconnectAttempts: number;
    reconnectDelay: number;
}

export interface ConnectionMetrics {
    latency: number | null;
    packetsLost: number;
    packetsSent: number;
    bytesReceived: number;
    bytesSent: number;
    jitter: number | null;
    connectionQuality: ConnectionQuality;
}

export interface NetworkTopology {
    type: string;
    description: string;
    candidates: {
        host: number;
        srflx: number;
        relay: number;
    };
}

interface CandidateInfo {
    local: unknown;
    remote: unknown;
}

export interface ConnectionManagerCallbacks {
    onStateChange: ((newState: string, oldState: string) => void) | null;
    onConnectionTypeChange: ((type: ConnectionType, info: CandidateInfo) => void) | null;
    onQualityChange: ((quality: ConnectionQuality, metrics: ConnectionMetrics) => void) | null;
    onDataChannel: ((channel: RTCDataChannel) => void) | null;
    onIceCandidate: ((candidate: RTCIceCandidate) => void) | null;
    onOffer: ((offer: RTCSessionDescriptionInit) => void) | null;
    onAnswer: ((answer: RTCSessionDescriptionInit) => void) | null;
    onError: ((error: Error) => void) | null;
    onReconnecting: ((attempt: number) => void) | null;
    onMetricsUpdate: ((metrics: ConnectionMetrics) => void) | null;
}

export interface ConnectionInfo {
    state: string;
    type: ConnectionType | null;
    topology: NetworkTopology | null;
    metrics: ConnectionMetrics;
    reconnectAttempts: number;
    hasTurnServers: boolean;
}

export interface ConnectResult {
    success: boolean;
    type: ConnectionType | null;
}

interface IceCandidates {
    host: RTCIceCandidate[];
    srflx: RTCIceCandidate[];
    relay: RTCIceCandidate[];
}

export class ConnectionManager {
    config: ConnectionManagerConfig;
    peerConnection: RTCPeerConnection | null;
    dataChannel: RTCDataChannel | null;
    connectionState: string;
    connectionType: ConnectionType | null;
    networkTopology: NetworkTopology | null;
    reconnectAttempts: number;
    qualityMonitorInterval: ReturnType<typeof setInterval> | null;
    connectionMetrics: ConnectionMetrics;
    iceCandidates: IceCandidates;
    callbacks: ConnectionManagerCallbacks;

    constructor(options: ConnectionManagerOptions = {}) {
        this.config = {
            stunServers: options.stunServers || [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' }
            ],
            turnServers: options.turnServers || [],
            directConnectionTimeout: options.directConnectionTimeout || 10000,
            relayConnectionTimeout: options.relayConnectionTimeout || 15000,
            iceGatheringTimeout: options.iceGatheringTimeout || 5000,
            qualityCheckInterval: options.qualityCheckInterval || 2000,
            maxReconnectAttempts: options.maxReconnectAttempts || 5,
            reconnectDelay: options.reconnectDelay || 2000
        };

        this.peerConnection = null;
        this.dataChannel = null;
        this.connectionState = 'disconnected';
        this.connectionType = null;
        this.networkTopology = null;
        this.reconnectAttempts = 0;
        this.qualityMonitorInterval = null;
        this.connectionMetrics = {
            latency: null,
            packetsLost: 0,
            packetsSent: 0,
            bytesReceived: 0,
            bytesSent: 0,
            jitter: null,
            connectionQuality: 'unknown'
        };

        this.iceCandidates = {
            host: [],
            srflx: [],
            relay: []
        };

        this.callbacks = {
            onStateChange: null,
            onConnectionTypeChange: null,
            onQualityChange: null,
            onDataChannel: null,
            onIceCandidate: null,
            onOffer: null,
            onAnswer: null,
            onError: null,
            onReconnecting: null,
            onMetricsUpdate: null
        };

        this.handleIceCandidate = this.handleIceCandidate.bind(this);
        this.handleConnectionStateChange = this.handleConnectionStateChange.bind(this);
        this.handleIceConnectionStateChange = this.handleIceConnectionStateChange.bind(this);
        this.handleIceGatheringStateChange = this.handleIceGatheringStateChange.bind(this);
    }

    /**
     * Set callback handler
     */
    on(event: string, callback: (...args: never[]) => void): void {
        if (Object.prototype.hasOwnProperty.call(this.callbacks, event)) {
            this.callbacks[event as keyof ConnectionManagerCallbacks] = callback as never;
        }
    }

    /**
     * Get ICE server configuration based on connection strategy
     */
    getIceConfiguration(includeRelay: boolean = false): RTCConfiguration {
        const iceServers = [...this.config.stunServers];

        if (includeRelay && this.config.turnServers.length > 0) {
            iceServers.push(...this.config.turnServers);
        }

        return {
            iceServers,
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all'
        };
    }

    /**
     * Initialize peer connection with specified strategy
     */
    async initializePeerConnection(includeRelay: boolean = false): Promise<RTCPeerConnection> {
        this.cleanup();

        const configuration = this.getIceConfiguration(includeRelay);
        this.peerConnection = new RTCPeerConnection(configuration);

        this.peerConnection.onicecandidate = this.handleIceCandidate;
        this.peerConnection.onconnectionstatechange = this.handleConnectionStateChange;
        this.peerConnection.oniceconnectionstatechange = this.handleIceConnectionStateChange;
        this.peerConnection.onicegatheringstatechange = this.handleIceGatheringStateChange;

        this.peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
            this.dataChannel = event.channel;
            if (this.callbacks.onDataChannel) {
                this.callbacks.onDataChannel(event.channel);
            }
        };

        this.iceCandidates = { host: [], srflx: [], relay: [] };

        return this.peerConnection;
    }

    /**
     * Handle ICE candidate events
     */
    handleIceCandidate(event: RTCPeerConnectionIceEvent): void {
        if (!event.candidate) {
            this.detectNetworkTopology();
            return;
        }

        const candidate = event.candidate;
        const candidateType = this.parseCandidateType(candidate.candidate);

        if (candidateType && this.iceCandidates[candidateType]) {
            this.iceCandidates[candidateType].push(candidate);
        }

        if (this.callbacks.onIceCandidate) {
            this.callbacks.onIceCandidate(candidate);
        }
    }

    /**
     * Parse candidate type from SDP
     */
    parseCandidateType(candidateString: string): CandidateType | null {
        if (!candidateString) return null;

        if (candidateString.includes('typ host')) return 'host';
        if (candidateString.includes('typ srflx') || candidateString.includes('typ prflx')) return 'srflx';
        if (candidateString.includes('typ relay')) return 'relay';
        return null;
    }

    /**
     * Detect network topology based on gathered ICE candidates
     */
    detectNetworkTopology(): NetworkTopology {
        const hasHost = this.iceCandidates.host.length > 0;
        const hasSrflx = this.iceCandidates.srflx.length > 0;
        const hasRelay = this.iceCandidates.relay.length > 0;

        let topology = 'unknown';
        let description = '';

        if (hasHost && hasSrflx) {
            topology = 'nat';
            description = 'Behind NAT (direct connection possible)';
        } else if (hasHost && !hasSrflx && !hasRelay) {
            topology = 'public-or-blocked';
            description = 'Public IP or STUN blocked';
        } else if (!hasHost && hasSrflx) {
            topology = 'restricted-nat';
            description = 'Restricted NAT';
        } else if (hasRelay && !hasSrflx) {
            topology = 'symmetric-nat';
            description = 'Symmetric NAT (relay required)';
        } else if (hasHost || hasSrflx || hasRelay) {
            topology = 'mixed';
            description = 'Mixed network configuration';
        }

        this.networkTopology = {
            type: topology,
            description,
            candidates: {
                host: this.iceCandidates.host.length,
                srflx: this.iceCandidates.srflx.length,
                relay: this.iceCandidates.relay.length
            }
        };

        return this.networkTopology;
    }

    /**
     * Handle connection state changes
     */
    handleConnectionStateChange(): void {
        if (!this.peerConnection) return;

        const state = this.peerConnection.connectionState;
        this.updateConnectionState(state);

        if (state === 'connected') {
            this.reconnectAttempts = 0;
            this.detectConnectionType();
            this.startQualityMonitoring();
        } else if (state === 'disconnected' || state === 'failed') {
            this.stopQualityMonitoring();
            if (this.callbacks.onReconnecting) {
                this.callbacks.onReconnecting(this.reconnectAttempts);
            }
        } else if (state === 'closed') {
            this.stopQualityMonitoring();
        }
    }

    /**
     * Handle ICE connection state changes
     */
    handleIceConnectionStateChange(): void {
        if (!this.peerConnection) return;

        const state = this.peerConnection.iceConnectionState;
        if (state === 'connected' || state === 'completed') {
            this.detectConnectionType();
        }
    }

    /**
     * Handle ICE gathering state changes
     */
    handleIceGatheringStateChange(): void {
        if (!this.peerConnection) return;

        if (this.peerConnection.iceGatheringState === 'complete') {
            this.detectNetworkTopology();
        }
    }

    /**
     * Update connection state and notify
     */
    updateConnectionState(newState: string): void {
        const oldState = this.connectionState;
        this.connectionState = newState;

        if (oldState !== newState && this.callbacks.onStateChange) {
            this.callbacks.onStateChange(newState, oldState);
        }
    }

    /**
     * Detect the type of connection established (direct or relay)
     */
    async detectConnectionType(): Promise<void> {
        if (!this.peerConnection) return;

        try {
            const stats = await this.peerConnection.getStats();
            let selectedCandidatePair: Record<string, unknown> | null = null;
            let localCandidate: Record<string, unknown> | null = null;
            let remoteCandidate: Record<string, unknown> | null = null;

            stats.forEach((report) => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    selectedCandidatePair = report;
                }
            });

            if (!selectedCandidatePair) return;

            stats.forEach((report) => {
                if (report.id === (selectedCandidatePair as Record<string, unknown>).localCandidateId) {
                    localCandidate = report;
                } else if (report.id === (selectedCandidatePair as Record<string, unknown>).remoteCandidateId) {
                    remoteCandidate = report;
                }
            });

            const isRelay = (localCandidate as Record<string, unknown> | null)?.candidateType === 'relay' ||
                           (remoteCandidate as Record<string, unknown> | null)?.candidateType === 'relay';

            const oldType = this.connectionType;
            this.connectionType = isRelay ? 'relay' : 'direct';

            if (oldType !== this.connectionType && this.callbacks.onConnectionTypeChange) {
                this.callbacks.onConnectionTypeChange(this.connectionType, {
                    local: localCandidate,
                    remote: remoteCandidate
                });
            }
        } catch (error) {
            console.error('[ConnectionManager] Error detecting connection type:', error);
        }
    }

    /**
     * Start connection quality monitoring
     */
    startQualityMonitoring(): void {
        this.stopQualityMonitoring();

        this.qualityMonitorInterval = setInterval(async () => {
            await this.updateConnectionMetrics();
        }, this.config.qualityCheckInterval);

        this.updateConnectionMetrics();
    }

    /**
     * Stop connection quality monitoring
     */
    stopQualityMonitoring(): void {
        if (this.qualityMonitorInterval) {
            clearInterval(this.qualityMonitorInterval);
            this.qualityMonitorInterval = null;
        }
    }

    /**
     * Update connection metrics from WebRTC stats
     */
    async updateConnectionMetrics(): Promise<void> {
        if (!this.peerConnection || this.peerConnection.connectionState !== 'connected') {
            return;
        }

        try {
            const stats = await this.peerConnection.getStats();
            const metrics: ConnectionMetrics = { ...this.connectionMetrics };

            stats.forEach((report) => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    if (report.currentRoundTripTime !== undefined) {
                        metrics.latency = Math.round(report.currentRoundTripTime * 1000);
                    }
                    if (report.bytesReceived !== undefined) {
                        metrics.bytesReceived = report.bytesReceived;
                    }
                    if (report.bytesSent !== undefined) {
                        metrics.bytesSent = report.bytesSent;
                    }
                }

                if (report.type === 'data-channel') {
                    if (report.messagesSent !== undefined) {
                        metrics.packetsSent = report.messagesSent;
                    }
                }

                if (report.type === 'inbound-rtp' || report.type === 'remote-inbound-rtp') {
                    if (report.packetsLost !== undefined) {
                        metrics.packetsLost = report.packetsLost;
                    }
                    if (report.jitter !== undefined) {
                        metrics.jitter = Math.round(report.jitter * 1000);
                    }
                }
            });

            metrics.connectionQuality = this.calculateConnectionQuality(metrics);

            const oldQuality = this.connectionMetrics.connectionQuality;
            this.connectionMetrics = metrics;

            if (oldQuality !== metrics.connectionQuality && this.callbacks.onQualityChange) {
                this.callbacks.onQualityChange(metrics.connectionQuality, metrics);
            }

            if (this.callbacks.onMetricsUpdate) {
                this.callbacks.onMetricsUpdate(metrics);
            }

        } catch (error) {
            console.error('[ConnectionManager] Error updating metrics:', error);
        }
    }

    /**
     * Calculate connection quality based on metrics
     */
    calculateConnectionQuality(metrics: ConnectionMetrics): ConnectionQuality {
        const { latency, packetsLost, packetsSent, jitter } = metrics;

        if (latency === null) {
            return 'unknown';
        }

        const packetLossPercent = packetsSent > 0 ? (packetsLost / packetsSent) * 100 : 0;

        let score = 100;

        if (latency > 300) {
            score -= 40;
        } else if (latency > 150) {
            score -= 20;
        } else if (latency > 50) {
            score -= 10;
        }

        if (packetLossPercent > 5) {
            score -= 40;
        } else if (packetLossPercent > 2) {
            score -= 20;
        } else if (packetLossPercent > 1) {
            score -= 10;
        }

        if (jitter !== null) {
            if (jitter > 100) {
                score -= 20;
            } else if (jitter > 50) {
                score -= 10;
            } else if (jitter > 30) {
                score -= 5;
            }
        }

        if (score >= 80) {
            return 'excellent';
        } else if (score >= 60) {
            return 'good';
        } else if (score >= 40) {
            return 'fair';
        } else {
            return 'poor';
        }
    }

    /**
     * Create data channel
     */
    createDataChannel(label: string = 'collaboration', options: RTCDataChannelInit = {}): RTCDataChannel {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        this.dataChannel = this.peerConnection.createDataChannel(label, {
            ordered: true,
            ...options
        });

        return this.dataChannel;
    }

    /**
     * Create and return offer
     */
    async createOffer(): Promise<RTCSessionDescriptionInit> {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        return offer;
    }

    /**
     * Handle incoming offer and create answer
     */
    async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        return answer;
    }

    /**
     * Handle incoming answer
     */
    async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }

    /**
     * Add ICE candidate from remote peer
     */
    async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!this.peerConnection || !candidate) return;

        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }

    /**
     * Attempt connection with fallback strategy
     * 1. First try direct connection (STUN only)
     * 2. If fails, retry with TURN relay
     */
    async connectWithFallback(isHost: boolean, createDataChannel: boolean = true): Promise<ConnectResult> {
        this.updateConnectionState('connecting');

        try {
            await this.initializePeerConnection(false);

            if (isHost && createDataChannel) {
                this.createDataChannel();
            }

            const directSuccess = await this.waitForConnection(
                this.config.directConnectionTimeout,
                'direct'
            );

            if (directSuccess) {
                return { success: true, type: 'direct' };
            }
        } catch {
            // Direct connection failed, try relay
        }

        if (this.config.turnServers.length > 0) {
            try {
                await this.initializePeerConnection(true);

                if (isHost && createDataChannel) {
                    this.createDataChannel();
                }

                const relaySuccess = await this.waitForConnection(
                    this.config.relayConnectionTimeout,
                    'relay'
                );

                if (relaySuccess) {
                    return { success: true, type: 'relay' };
                }
            } catch {
                // Relay connection failed
            }
        }

        this.updateConnectionState('failed');
        if (this.callbacks.onError) {
            this.callbacks.onError(new Error('All connection attempts failed'));
        }

        return { success: false, type: null };
    }

    /**
     * Wait for connection to establish with timeout
     */
    waitForConnection(timeout: number, _phase: string): Promise<boolean> {
        return new Promise((resolve) => {
            const checkInterval = 100;
            let elapsed = 0;

            const check = () => {
                if (!this.peerConnection) {
                    resolve(false);
                    return;
                }

                const state = this.peerConnection.connectionState;
                const iceState = this.peerConnection.iceConnectionState;

                if (state === 'connected' || iceState === 'connected') {
                    resolve(true);
                    return;
                }

                if (state === 'failed' || iceState === 'failed') {
                    resolve(false);
                    return;
                }

                elapsed += checkInterval;
                if (elapsed >= timeout) {
                    resolve(false);
                    return;
                }

                setTimeout(check, checkInterval);
            };

            check();
        });
    }

    /**
     * Restart ICE connection (useful for handling network changes)
     */
    async restartIce(): Promise<RTCSessionDescriptionInit | null> {
        if (!this.peerConnection) return null;

        this.iceCandidates = { host: [], srflx: [], relay: [] };

        const offer = await this.peerConnection.createOffer({ iceRestart: true });
        await this.peerConnection.setLocalDescription(offer);

        return offer;
    }

    /**
     * Get current connection info
     */
    getConnectionInfo(): ConnectionInfo {
        return {
            state: this.connectionState,
            type: this.connectionType,
            topology: this.networkTopology,
            metrics: { ...this.connectionMetrics },
            reconnectAttempts: this.reconnectAttempts,
            hasTurnServers: this.config.turnServers.length > 0
        };
    }

    /**
     * Configure TURN servers (can be called dynamically)
     */
    setTurnServers(turnServers: RTCIceServer[]): void {
        this.config.turnServers = turnServers;
    }

    /**
     * Clean up resources
     */
    cleanup(): void {
        this.stopQualityMonitoring();

        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.connectionState = 'disconnected';
        this.connectionType = null;
        this.iceCandidates = { host: [], srflx: [], relay: [] };
    }

    /**
     * Full disconnect and cleanup
     */
    disconnect(): void {
        this.cleanup();
        this.updateConnectionState('disconnected');
    }
}
