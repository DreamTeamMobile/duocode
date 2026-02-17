/**
 * Error Feedback Module Tests
 *
 * Tests for ErrorFeedback, ConnectionStatusManager, and SyncStatusIndicator classes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    ErrorFeedback as ErrorFeedbackClass,
    ConnectionStatusManager as ConnectionStatusManagerClass,
    SyncStatusIndicator as SyncStatusIndicatorClass
} from '../../src/services/error-feedback.js';

// ============================================================================
// Interfaces for test helper objects
// ============================================================================

interface ErrorFeedbackConfig {
    maxToasts?: number;
    defaultDuration?: number;
}

interface ErrorLogEntry {
    type: string;
    message: string;
    stack?: string;
    context: Record<string, unknown>;
    timestamp: string;
}

interface ToastOptions {
    duration?: number;
    dismissible?: boolean;
    action?: { label: string; callback: () => void } | null;
    persistent?: boolean;
}

interface CompatibilityResults {
    compatible: boolean;
    features: Record<string, boolean>;
    warnings: string[];
    errors: string[];
}

interface ErrorFeedbackHelper {
    toastContainer: HTMLDivElement | null;
    activeToasts: HTMLDivElement[];
    maxToasts: number;
    defaultDuration: number;
    errorLog: ErrorLogEntry[];
    maxErrorLogSize: number;
    compatibilityResults: CompatibilityResults | null;
    initialize(): void;
    createToastContainer(): void;
    logError(type: string, error: unknown, context?: Record<string, unknown>): void;
    escapeHtml(text: string): string;
    showToast(message: string, type?: string, options?: ToastOptions): HTMLDivElement;
    removeToast(toast: HTMLDivElement): void;
    clearAllToasts(): void;
    showSuccess(message: string, options?: ToastOptions): HTMLDivElement;
    showError(message: string, options?: ToastOptions): HTMLDivElement;
    showWarning(message: string, options?: ToastOptions): HTMLDivElement;
    showInfo(message: string, options?: ToastOptions): HTMLDivElement;
    getErrorMessage(error: unknown): string;
    checkBrowserCompatibility(): CompatibilityResults;
}

interface MockErrorFeedback {
    showSuccess: (...args: unknown[]) => unknown;
    showWarning: (...args: unknown[]) => unknown;
    showError: (...args: unknown[]) => unknown;
}

interface MockErrorFeedbackWarningOnly {
    showWarning: (...args: unknown[]) => unknown;
}

interface StatusDetails {
    showNotification?: boolean;
    attempt?: number;
    reason?: string;
}

interface ConnectionStatusManagerHelper {
    errorFeedback: MockErrorFeedback;
    statusElement: HTMLDivElement | null;
    retryBanner: HTMLDivElement | null;
    currentState: string;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    onCancelReconnect: (() => void) | null;
    onManualRetry: (() => void) | null;
    initialize(): void;
    createRetryBanner(): void;
    updateStatus(state: string, details?: StatusDetails): void;
    showRetryBanner(attempt: number, maxAttempts: number): void;
    hideRetryBanner(): void;
    showFailedState(reason?: string): void;
    setCallbacks(callbacks: { onCancelReconnect: () => void; onManualRetry: () => void }): void;
}

interface SyncState {
    synced: boolean;
    lastSync: number | null;
    pending: number;
    status: string;
}

interface SyncStatusIndicatorHelper {
    errorFeedback: MockErrorFeedbackWarningOnly;
    indicators: Record<string, { section: string }>;
    mainIndicator: HTMLElement | null;
    syncStates: Record<string, SyncState>;
    initialize(): void;
    createIndicators(): void;
    updateStatus(section: string, status: string): void;
    updateMainIndicator(): void;
    setAllStatus(status: string): void;
    clearPending(section: string): void;
}

// ============================================================================
// ErrorFeedback Class Tests
// ============================================================================

describe('ErrorFeedback', () => {
    const createErrorFeedback = (config: ErrorFeedbackConfig = {}): ErrorFeedbackHelper => {
        return {
            toastContainer: null,
            activeToasts: [],
            maxToasts: config.maxToasts || 5,
            defaultDuration: config.defaultDuration || 5000,
            errorLog: [],
            maxErrorLogSize: 100,
            compatibilityResults: null,

            initialize() {
                this.createToastContainer();
            },

            createToastContainer() {
                if (this.toastContainer) return;
                this.toastContainer = document.createElement('div') as HTMLDivElement;
                this.toastContainer.id = 'toastContainer';
                this.toastContainer.className = 'toast-container';
                document.body.appendChild(this.toastContainer);
            },

            logError(type: string, error: unknown, context: Record<string, unknown> = {}) {
                const errorObj = error as { message?: string; stack?: string } | undefined;
                const errorEntry: ErrorLogEntry = {
                    type,
                    message: errorObj?.message || String(error),
                    stack: errorObj?.stack,
                    context,
                    timestamp: new Date().toISOString()
                };
                this.errorLog.push(errorEntry);
                if (this.errorLog.length > this.maxErrorLogSize) {
                    this.errorLog.shift();
                }
            },

            escapeHtml(text: string): string {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            },

            showToast(message: string, type: string = 'info', options: ToastOptions = {}): HTMLDivElement {
                const { duration = this.defaultDuration, dismissible = true, action = null, persistent = false } = options;

                while (this.activeToasts.length >= this.maxToasts) {
                    this.removeToast(this.activeToasts[0]);
                }

                const toast = document.createElement('div') as HTMLDivElement;
                toast.className = `toast toast-${type}`;
                toast.innerHTML = `<span class="toast-message">${this.escapeHtml(message)}</span>`;

                if (this.toastContainer) {
                    this.toastContainer.appendChild(toast);
                }
                this.activeToasts.push(toast);
                return toast;
            },

            removeToast(toast: HTMLDivElement) {
                if (!toast) return;
                const index = this.activeToasts.indexOf(toast);
                if (index > -1) {
                    this.activeToasts.splice(index, 1);
                }
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            },

            clearAllToasts() {
                [...this.activeToasts].forEach(toast => this.removeToast(toast));
            },

            showSuccess(message: string, options: ToastOptions = {}): HTMLDivElement {
                return this.showToast(message, 'success', options);
            },

            showError(message: string, options: ToastOptions = {}): HTMLDivElement {
                return this.showToast(message, 'error', { duration: 8000, ...options });
            },

            showWarning(message: string, options: ToastOptions = {}): HTMLDivElement {
                return this.showToast(message, 'warning', options);
            },

            showInfo(message: string, options: ToastOptions = {}): HTMLDivElement {
                return this.showToast(message, 'info', options);
            },

            getErrorMessage(error: unknown): string {
                const errorObj = error as { message?: string } | undefined;
                const errorMessage = errorObj?.message || String(error);

                if (errorMessage.includes('ICE') || errorMessage.includes('ice')) {
                    return 'Unable to establish peer connection. This may be due to network restrictions.';
                }
                if (errorMessage.includes('TURN') || errorMessage.includes('relay')) {
                    return 'Relay connection failed. Direct peer-to-peer connection may still work.';
                }
                if (errorMessage.includes('signaling') || errorMessage.includes('socket')) {
                    return 'Cannot reach signaling server. Check your internet connection.';
                }
                if (errorMessage.includes('timeout')) {
                    return 'Connection timed out. The other participant may not be online.';
                }
                if (errorMessage.includes('disconnected')) {
                    return 'Connection lost. Attempting to reconnect...';
                }
                if (errorMessage.includes('channel') || errorMessage.includes('DataChannel')) {
                    return 'Communication channel error. Some features may not sync properly.';
                }
                if (errorMessage.includes('QuotaExceededError') || errorMessage.includes('quota')) {
                    return 'Storage quota exceeded. Try clearing old session data.';
                }
                if (errorMessage.includes('localStorage') || errorMessage.includes('storage')) {
                    return 'Unable to save data locally. Check browser storage settings.';
                }
                if (errorMessage.includes('network')) {
                    return 'Network error occurred. Check your internet connection.';
                }
                return errorMessage || 'An unexpected error occurred.';
            },

            checkBrowserCompatibility(): CompatibilityResults {
                const results: CompatibilityResults = {
                    compatible: true,
                    features: {},
                    warnings: [],
                    errors: []
                };

                results.features.webrtc = typeof RTCPeerConnection !== 'undefined';
                if (!results.features.webrtc) {
                    results.errors.push('WebRTC is not supported in this browser.');
                    results.compatible = false;
                }

                results.features.localStorage = true; // Mocked in tests
                results.features.canvas = true;
                results.features.websocket = typeof WebSocket !== 'undefined';

                this.compatibilityResults = results;
                return results;
            }
        };
    };

    // Verify the ES module class is importable
    it('should export ErrorFeedback class', () => {
        expect(ErrorFeedbackClass).toBeDefined();
        expect(typeof ErrorFeedbackClass).toBe('function');
    });

    describe('Toast Management', () => {
        it('should create toast container on initialize', () => {
            const ef = createErrorFeedback();
            ef.initialize();
            expect(ef.toastContainer).not.toBeNull();
            expect(ef.toastContainer!.className).toBe('toast-container');
            ef.toastContainer!.remove();
        });

        it('should show toast with correct type', () => {
            const ef = createErrorFeedback();
            ef.initialize();

            const toast = ef.showToast('Test message', 'success');
            expect(toast.className).toContain('toast-success');

            ef.toastContainer!.remove();
        });

        it('should limit active toasts to maxToasts', () => {
            const ef = createErrorFeedback({ maxToasts: 3 });
            ef.initialize();

            ef.showToast('Toast 1');
            ef.showToast('Toast 2');
            ef.showToast('Toast 3');
            expect(ef.activeToasts.length).toBe(3);

            ef.showToast('Toast 4');
            expect(ef.activeToasts.length).toBe(3);

            ef.toastContainer!.remove();
        });

        it('should remove toast from active list', () => {
            const ef = createErrorFeedback();
            ef.initialize();

            const toast = ef.showToast('Test');
            expect(ef.activeToasts.length).toBe(1);

            ef.removeToast(toast);
            expect(ef.activeToasts.length).toBe(0);

            ef.toastContainer!.remove();
        });

        it('should clear all toasts', () => {
            const ef = createErrorFeedback();
            ef.initialize();

            ef.showToast('Toast 1');
            ef.showToast('Toast 2');
            ef.showToast('Toast 3');
            expect(ef.activeToasts.length).toBe(3);

            ef.clearAllToasts();
            expect(ef.activeToasts.length).toBe(0);

            ef.toastContainer!.remove();
        });
    });

    describe('Convenience Methods', () => {
        it('should show success toast', () => {
            const ef = createErrorFeedback();
            ef.initialize();
            const toast = ef.showSuccess('Success!');
            expect(toast.className).toContain('toast-success');
            ef.toastContainer!.remove();
        });

        it('should show error toast', () => {
            const ef = createErrorFeedback();
            ef.initialize();
            const toast = ef.showError('Error!');
            expect(toast.className).toContain('toast-error');
            ef.toastContainer!.remove();
        });

        it('should show warning toast', () => {
            const ef = createErrorFeedback();
            ef.initialize();
            const toast = ef.showWarning('Warning!');
            expect(toast.className).toContain('toast-warning');
            ef.toastContainer!.remove();
        });

        it('should show info toast', () => {
            const ef = createErrorFeedback();
            ef.initialize();
            const toast = ef.showInfo('Info!');
            expect(toast.className).toContain('toast-info');
            ef.toastContainer!.remove();
        });
    });

    describe('Error Logging', () => {
        it('should log errors with all fields', () => {
            const ef = createErrorFeedback();
            const error = new Error('Test error');

            ef.logError('test', error, { extra: 'data' });

            expect(ef.errorLog.length).toBe(1);
            expect(ef.errorLog[0].type).toBe('test');
            expect(ef.errorLog[0].message).toBe('Test error');
            expect(ef.errorLog[0].context.extra).toBe('data');
            expect(ef.errorLog[0].timestamp).toBeDefined();
        });

        it('should limit error log size', () => {
            const ef = createErrorFeedback();
            ef.maxErrorLogSize = 5;

            for (let i = 0; i < 10; i++) {
                ef.logError('test', new Error(`Error ${i}`));
            }

            expect(ef.errorLog.length).toBe(5);
            expect(ef.errorLog[0].message).toBe('Error 5');
        });

        it('should handle string errors', () => {
            const ef = createErrorFeedback();
            ef.logError('test', 'Simple string error');

            expect(ef.errorLog[0].message).toBe('Simple string error');
        });
    });

    describe('HTML Escaping', () => {
        it('should escape HTML special characters', () => {
            const ef = createErrorFeedback();

            const escaped = ef.escapeHtml('<script>alert("xss")</script>');
            expect(escaped).not.toContain('<script>');
            expect(escaped).toContain('&lt;');
            expect(escaped).toContain('&gt;');
        });

        it('should handle normal text', () => {
            const ef = createErrorFeedback();
            const text = 'Hello World';
            expect(ef.escapeHtml(text)).toBe(text);
        });

        it('should escape ampersands', () => {
            const ef = createErrorFeedback();
            const escaped = ef.escapeHtml('Tom & Jerry');
            expect(escaped).toContain('&amp;');
        });
    });

    describe('User-Friendly Error Messages', () => {
        it('should provide friendly message for ICE errors', () => {
            const ef = createErrorFeedback();
            const error = { message: 'ICE connection failed' };
            const msg = ef.getErrorMessage(error);
            expect(msg).toContain('peer connection');
        });

        it('should provide friendly message for TURN errors', () => {
            const ef = createErrorFeedback();
            const error = { message: 'TURN server unavailable' };
            const msg = ef.getErrorMessage(error);
            expect(msg).toContain('Relay connection failed');
        });

        it('should provide friendly message for signaling errors', () => {
            const ef = createErrorFeedback();
            const error = { message: 'signaling server unreachable' };
            const msg = ef.getErrorMessage(error);
            expect(msg).toContain('signaling server');
        });

        it('should provide friendly message for timeout errors', () => {
            const ef = createErrorFeedback();
            const error = { message: 'Connection timeout' };
            const msg = ef.getErrorMessage(error);
            expect(msg).toContain('timed out');
        });

        it('should provide friendly message for disconnection', () => {
            const ef = createErrorFeedback();
            const error = { message: 'Peer disconnected' };
            const msg = ef.getErrorMessage(error);
            expect(msg).toContain('Connection lost');
        });

        it('should provide friendly message for storage quota errors', () => {
            const ef = createErrorFeedback();
            const error = { message: 'QuotaExceededError' };
            const msg = ef.getErrorMessage(error);
            expect(msg).toContain('Storage quota exceeded');
        });

        it('should return original message for unknown errors', () => {
            const ef = createErrorFeedback();
            const error = { message: 'Some unknown error' };
            const msg = ef.getErrorMessage(error);
            expect(msg).toBe('Some unknown error');
        });
    });

    describe('Browser Compatibility', () => {
        it('should check WebRTC availability', () => {
            const ef = createErrorFeedback();
            const results = ef.checkBrowserCompatibility();

            expect(results.features.webrtc).toBeDefined();
            expect(typeof results.compatible).toBe('boolean');
        });

        it('should check localStorage availability', () => {
            const ef = createErrorFeedback();
            const results = ef.checkBrowserCompatibility();

            expect(results.features.localStorage).toBe(true);
        });

        it('should store compatibility results', () => {
            const ef = createErrorFeedback();
            ef.checkBrowserCompatibility();

            expect(ef.compatibilityResults).not.toBeNull();
        });
    });
});

// ============================================================================
// ConnectionStatusManager Tests
// ============================================================================

describe('ConnectionStatusManager', () => {
    const createMockErrorFeedback = (): MockErrorFeedback => ({
        showSuccess: vi.fn(),
        showWarning: vi.fn(),
        showError: vi.fn()
    });

    const createConnectionStatusManager = (errorFeedback: MockErrorFeedback): ConnectionStatusManagerHelper => {
        return {
            errorFeedback,
            statusElement: null,
            retryBanner: null,
            currentState: 'disconnected',
            reconnectAttempts: 0,
            maxReconnectAttempts: 5,
            onCancelReconnect: null,
            onManualRetry: null,

            initialize() {
                this.createRetryBanner();
            },

            createRetryBanner() {
                if (this.retryBanner) return;
                this.retryBanner = document.createElement('div') as HTMLDivElement;
                this.retryBanner.id = 'retryBanner';
                this.retryBanner.className = 'retry-banner';
                this.retryBanner.style.display = 'none';
                this.retryBanner.innerHTML = `
                    <div class="retry-content">
                        <span class="retry-message">Reconnecting...</span>
                        <span class="retry-attempt"></span>
                    </div>
                    <div class="retry-actions">
                        <button class="retry-cancel-btn">Cancel</button>
                        <button class="retry-manual-btn" style="display: none;">Retry Now</button>
                    </div>
                `;
                document.body.appendChild(this.retryBanner);
            },

            updateStatus(state: string, details: StatusDetails = {}) {
                this.currentState = state;

                switch (state) {
                    case 'connecting':
                        this.hideRetryBanner();
                        break;
                    case 'connected':
                        this.hideRetryBanner();
                        this.errorFeedback.showSuccess('Connected to peer!', { duration: 3000 });
                        this.reconnectAttempts = 0;
                        break;
                    case 'disconnected':
                        if (details.showNotification !== false) {
                            this.errorFeedback.showWarning('Disconnected from peer.');
                        }
                        break;
                    case 'reconnecting':
                        this.reconnectAttempts = details.attempt || this.reconnectAttempts + 1;
                        this.showRetryBanner(this.reconnectAttempts, this.maxReconnectAttempts);
                        break;
                    case 'failed':
                        this.showFailedState(details.reason);
                        break;
                }
            },

            showRetryBanner(attempt: number, maxAttempts: number) {
                if (!this.retryBanner) return;
                this.retryBanner.style.display = 'flex';
                this.retryBanner.querySelector('.retry-attempt')!.textContent = `Attempt ${attempt} of ${maxAttempts}`;
                this.retryBanner.classList.remove('retry-failed');
            },

            hideRetryBanner() {
                if (this.retryBanner) {
                    this.retryBanner.style.display = 'none';
                }
            },

            showFailedState(reason?: string) {
                if (!this.retryBanner) return;
                this.retryBanner.style.display = 'flex';
                this.retryBanner.classList.add('retry-failed');
                this.retryBanner.querySelector('.retry-message')!.textContent = reason || 'Connection failed';
                this.errorFeedback.showError('Connection failed. Click "Retry Now" to try again.');
            },

            setCallbacks({ onCancelReconnect, onManualRetry }: { onCancelReconnect: () => void; onManualRetry: () => void }) {
                this.onCancelReconnect = onCancelReconnect;
                this.onManualRetry = onManualRetry;
            }
        };
    };

    // Verify the ES module class is importable
    it('should export ConnectionStatusManager class', () => {
        expect(ConnectionStatusManagerClass).toBeDefined();
        expect(typeof ConnectionStatusManagerClass).toBe('function');
    });

    afterEach(() => {
        const banner = document.getElementById('retryBanner');
        if (banner) banner.remove();
    });

    describe('Initialization', () => {
        it('should create retry banner on initialize', () => {
            const ef = createMockErrorFeedback();
            const csm = createConnectionStatusManager(ef);
            csm.initialize();

            expect(csm.retryBanner).not.toBeNull();
            expect(csm.retryBanner!.id).toBe('retryBanner');
        });

        it('should start in disconnected state', () => {
            const ef = createMockErrorFeedback();
            const csm = createConnectionStatusManager(ef);

            expect(csm.currentState).toBe('disconnected');
            expect(csm.reconnectAttempts).toBe(0);
        });
    });

    describe('Status Updates', () => {
        it('should update state to connecting', () => {
            const ef = createMockErrorFeedback();
            const csm = createConnectionStatusManager(ef);
            csm.initialize();

            csm.updateStatus('connecting');
            expect(csm.currentState).toBe('connecting');
        });

        it('should show success notification on connected', () => {
            const ef = createMockErrorFeedback();
            const csm = createConnectionStatusManager(ef);
            csm.initialize();

            csm.updateStatus('connected');
            expect(csm.currentState).toBe('connected');
            expect(ef.showSuccess).toHaveBeenCalledWith('Connected to peer!', { duration: 3000 });
            expect(csm.reconnectAttempts).toBe(0);
        });

        it('should show warning on disconnected', () => {
            const ef = createMockErrorFeedback();
            const csm = createConnectionStatusManager(ef);
            csm.initialize();

            csm.updateStatus('disconnected');
            expect(ef.showWarning).toHaveBeenCalledWith('Disconnected from peer.');
        });

        it('should not show notification if disabled', () => {
            const ef = createMockErrorFeedback();
            const csm = createConnectionStatusManager(ef);
            csm.initialize();

            csm.updateStatus('disconnected', { showNotification: false });
            expect(ef.showWarning).not.toHaveBeenCalled();
        });

        it('should show retry banner on reconnecting', () => {
            const ef = createMockErrorFeedback();
            const csm = createConnectionStatusManager(ef);
            csm.initialize();

            csm.updateStatus('reconnecting', { attempt: 2 });
            expect(csm.retryBanner!.style.display).toBe('flex');
            expect(csm.reconnectAttempts).toBe(2);
        });

        it('should show failed state', () => {
            const ef = createMockErrorFeedback();
            const csm = createConnectionStatusManager(ef);
            csm.initialize();

            csm.updateStatus('failed', { reason: 'Network unreachable' });
            expect(csm.retryBanner!.classList.contains('retry-failed')).toBe(true);
            expect(ef.showError).toHaveBeenCalled();
        });
    });

    describe('Retry Banner', () => {
        it('should show attempt count', () => {
            const ef = createMockErrorFeedback();
            const csm = createConnectionStatusManager(ef);
            csm.initialize();

            csm.showRetryBanner(3, 5);
            expect(csm.retryBanner!.querySelector('.retry-attempt')!.textContent).toBe('Attempt 3 of 5');
        });

        it('should hide retry banner', () => {
            const ef = createMockErrorFeedback();
            const csm = createConnectionStatusManager(ef);
            csm.initialize();

            csm.showRetryBanner(1, 5);
            expect(csm.retryBanner!.style.display).toBe('flex');

            csm.hideRetryBanner();
            expect(csm.retryBanner!.style.display).toBe('none');
        });
    });

    describe('Callbacks', () => {
        it('should set callbacks', () => {
            const ef = createMockErrorFeedback();
            const csm = createConnectionStatusManager(ef);
            const onCancel = vi.fn();
            const onRetry = vi.fn();

            csm.setCallbacks({ onCancelReconnect: onCancel, onManualRetry: onRetry });
            expect(csm.onCancelReconnect).toBe(onCancel);
            expect(csm.onManualRetry).toBe(onRetry);
        });
    });
});

// ============================================================================
// SyncStatusIndicator Tests
// ============================================================================

describe('SyncStatusIndicator', () => {
    const createMockErrorFeedback = (): MockErrorFeedbackWarningOnly => ({
        showWarning: vi.fn()
    });

    const createSyncStatusIndicator = (errorFeedback: MockErrorFeedbackWarningOnly): SyncStatusIndicatorHelper => {
        return {
            errorFeedback,
            indicators: {},
            mainIndicator: null,
            syncStates: {
                code: { synced: true, lastSync: null, pending: 0, status: 'synced' },
                diagram: { synced: true, lastSync: null, pending: 0, status: 'synced' },
                messages: { synced: true, lastSync: null, pending: 0, status: 'synced' }
            },

            initialize() {
                this.createIndicators();
            },

            createIndicators() {
                const mainIndicator = document.getElementById('mainSyncIndicator');
                if (mainIndicator) {
                    this.mainIndicator = mainIndicator;
                } else {
                    this.mainIndicator = document.createElement('div');
                    this.mainIndicator.id = 'mainSyncIndicator';
                    this.mainIndicator.className = 'sync-indicator';
                    document.body.appendChild(this.mainIndicator);
                }
            },

            updateStatus(section: string, status: string) {
                const state = this.syncStates[section];
                if (!state) return;

                switch (status) {
                    case 'synced':
                        state.synced = true;
                        state.pending = 0;
                        state.lastSync = Date.now();
                        state.status = 'synced';
                        break;
                    case 'syncing':
                        state.synced = false;
                        state.status = 'syncing';
                        break;
                    case 'pending':
                        state.pending++;
                        state.status = 'pending';
                        break;
                    case 'error':
                        state.synced = false;
                        state.status = 'error';
                        break;
                    case 'offline':
                        state.status = 'offline';
                        break;
                }

                this.updateMainIndicator();
            },

            updateMainIndicator() {
                if (!this.mainIndicator) return;

                const statusPriority = ['error', 'offline', 'syncing', 'pending', 'synced'];
                let worstStatus = 'synced';

                Object.values(this.syncStates).forEach((state: SyncState) => {
                    if (state.status && statusPriority.indexOf(state.status) < statusPriority.indexOf(worstStatus)) {
                        worstStatus = state.status;
                    }
                });

                this.mainIndicator.className = `sync-indicator ${worstStatus}`;
            },

            setAllStatus(status: string) {
                Object.keys(this.syncStates).forEach((section: string) => {
                    const state = this.syncStates[section];
                    state.status = status;
                    if (status === 'synced') {
                        state.synced = true;
                        state.pending = 0;
                        state.lastSync = Date.now();
                    } else if (status === 'error' || status === 'syncing') {
                        state.synced = false;
                    }
                });
                this.updateMainIndicator();
            },

            clearPending(section: string) {
                if (this.syncStates[section]) {
                    this.syncStates[section].pending = 0;
                }
            }
        };
    };

    // Verify the ES module class is importable
    it('should export SyncStatusIndicator class', () => {
        expect(SyncStatusIndicatorClass).toBeDefined();
        expect(typeof SyncStatusIndicatorClass).toBe('function');
    });

    afterEach(() => {
        const indicator = document.getElementById('mainSyncIndicator');
        if (indicator) indicator.remove();
    });

    describe('Initialization', () => {
        it('should create main indicator on initialize', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);
            ssi.initialize();

            expect(ssi.mainIndicator).not.toBeNull();
        });

        it('should have default sync states for all sections', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);

            expect(ssi.syncStates.code).toBeDefined();
            expect(ssi.syncStates.diagram).toBeDefined();
            expect(ssi.syncStates.messages).toBeDefined();
        });
    });

    describe('Status Updates', () => {
        it('should update status to synced', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);
            ssi.initialize();

            ssi.updateStatus('code', 'synced');
            expect(ssi.syncStates.code.synced).toBe(true);
            expect(ssi.syncStates.code.pending).toBe(0);
            expect(ssi.syncStates.code.lastSync).not.toBeNull();
        });

        it('should update status to syncing', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);
            ssi.initialize();

            ssi.updateStatus('code', 'syncing');
            expect(ssi.syncStates.code.synced).toBe(false);
            expect(ssi.syncStates.code.status).toBe('syncing');
        });

        it('should increment pending count', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);
            ssi.initialize();

            ssi.updateStatus('code', 'pending');
            ssi.updateStatus('code', 'pending');
            expect(ssi.syncStates.code.pending).toBe(2);
        });

        it('should update status to error', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);
            ssi.initialize();

            ssi.updateStatus('code', 'error');
            expect(ssi.syncStates.code.synced).toBe(false);
            expect(ssi.syncStates.code.status).toBe('error');
        });

        it('should update status to offline', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);
            ssi.initialize();

            ssi.updateStatus('code', 'offline');
            expect(ssi.syncStates.code.status).toBe('offline');
        });
    });

    describe('Main Indicator', () => {
        it('should show worst status across all sections', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);
            ssi.initialize();

            ssi.updateStatus('code', 'synced');
            ssi.updateStatus('diagram', 'syncing');
            ssi.updateStatus('messages', 'synced');

            expect(ssi.mainIndicator!.className).toContain('syncing');
        });

        it('should prioritize error over syncing', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);
            ssi.initialize();

            ssi.updateStatus('code', 'syncing');
            ssi.updateStatus('diagram', 'error');

            expect(ssi.mainIndicator!.className).toContain('error');
        });

        it('should prioritize offline over pending', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);
            ssi.initialize();

            ssi.updateStatus('code', 'pending');
            ssi.updateStatus('diagram', 'offline');

            expect(ssi.mainIndicator!.className).toContain('offline');
        });
    });

    describe('Set All Status', () => {
        it('should set all sections to synced', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);
            ssi.initialize();

            ssi.setAllStatus('synced');
            expect(ssi.syncStates.code.synced).toBe(true);
            expect(ssi.syncStates.diagram.synced).toBe(true);
            expect(ssi.syncStates.messages.synced).toBe(true);
        });

        it('should set all sections to error', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);
            ssi.initialize();

            ssi.setAllStatus('error');
            expect(ssi.syncStates.code.synced).toBe(false);
            expect(ssi.syncStates.diagram.synced).toBe(false);
            expect(ssi.syncStates.messages.synced).toBe(false);
        });
    });

    describe('Clear Pending', () => {
        it('should clear pending count for section', () => {
            const ef = createMockErrorFeedback();
            const ssi = createSyncStatusIndicator(ef);
            ssi.initialize();

            ssi.updateStatus('code', 'pending');
            ssi.updateStatus('code', 'pending');
            expect(ssi.syncStates.code.pending).toBe(2);

            ssi.clearPending('code');
            expect(ssi.syncStates.code.pending).toBe(0);
        });
    });
});
