/**
 * DuoCode Error Handling and User Feedback Module
 *
 * Provides centralized error handling, toast notifications,
 * browser compatibility checks, and user feedback mechanisms.
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
    label: string;
    callback: () => void;
}

export interface ToastOptions {
    duration?: number;
    dismissible?: boolean;
    action?: ToastAction | null;
    persistent?: boolean;
}

interface ErrorLogEntry {
    type: string;
    message: string;
    stack?: string;
    context: Record<string, unknown>;
    timestamp: string;
}

export interface CompatibilityResults {
    compatible: boolean;
    features: Record<string, boolean>;
    warnings: string[];
    errors: string[];
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed';

export interface StatusDetails {
    showNotification?: boolean;
    attempt?: number;
    reason?: string;
}

interface ReconnectCallbacks {
    onCancelReconnect?: () => void;
    onManualRetry?: () => void;
}

type SyncSection = 'code' | 'diagram' | 'messages';
type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error' | 'offline';

interface SyncState {
    synced: boolean;
    lastSync: number | null;
    pending: number;
    status?: SyncStatus;
}

export class ErrorFeedback {
    toastContainer: HTMLDivElement | null;
    activeToasts: HTMLDivElement[];
    maxToasts: number;
    defaultDuration: number;
    errorLog: ErrorLogEntry[];
    maxErrorLogSize: number;
    compatibilityResults: CompatibilityResults | null;

    constructor() {
        this.toastContainer = null;
        this.activeToasts = [];
        this.maxToasts = 5;
        this.defaultDuration = 5000;

        // Error tracking
        this.errorLog = [];
        this.maxErrorLogSize = 100;

        // Browser compatibility results
        this.compatibilityResults = null;

        // Initialize on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize(): void {
        this.createToastContainer();
        this.setupGlobalErrorHandlers();
    }

    createToastContainer(): void {
        if (this.toastContainer) return;

        this.toastContainer = document.createElement('div') as HTMLDivElement;
        this.toastContainer.id = 'toastContainer';
        this.toastContainer.className = 'toast-container';
        document.body.appendChild(this.toastContainer);
    }

    setupGlobalErrorHandlers(): void {
        // Handle uncaught errors
        window.addEventListener('error', (event: ErrorEvent) => {
            this.logError('uncaught', event.error || event.message, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
            this.logError('unhandledrejection', event.reason);

            // Show user-friendly message for connection-related errors
            if (event.reason?.message?.includes('connection') ||
                event.reason?.message?.includes('WebRTC') ||
                event.reason?.message?.includes('signaling')) {
                this.showError('Connection error occurred. Please try reconnecting.');
            }
        });
    }

    logError(type: string, error: unknown, context: Record<string, unknown> = {}): void {
        const errorObj = error as { message?: string; stack?: string } | undefined;
        this.errorLog.push({
            type,
            message: errorObj?.message || String(error),
            stack: errorObj?.stack,
            context,
            timestamp: new Date().toISOString()
        });

        if (this.errorLog.length > this.maxErrorLogSize) {
            this.errorLog.shift();
        }

        console.error('[ErrorFeedback]', type, error, context);
    }

    showToast(message: string, type: ToastType = 'info', options: ToastOptions = {}): HTMLDivElement {
        const {
            duration = this.defaultDuration,
            dismissible = true,
            action = null,
            persistent = false
        } = options;

        // Remove old toasts if we have too many
        while (this.activeToasts.length >= this.maxToasts) {
            this.removeToast(this.activeToasts[0]);
        }

        const toast = document.createElement('div') as HTMLDivElement;
        toast.className = `toast toast-${type}`;

        // Icon based on type
        const icons: Record<ToastType, string> = {
            success: '&#10003;', // checkmark
            error: '&#10007;', // X
            warning: '&#9888;', // warning triangle
            info: '&#8505;' // info
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${this.escapeHtml(message)}</span>
            ${action ? `<button class="toast-action">${this.escapeHtml(action.label)}</button>` : ''}
            ${dismissible ? '<button class="toast-close">&times;</button>' : ''}
        `;

        // Add event listeners
        if (dismissible) {
            toast.querySelector('.toast-close')!.addEventListener('click', () => {
                this.removeToast(toast);
            });
        }

        if (action?.callback) {
            toast.querySelector('.toast-action')!.addEventListener('click', () => {
                action.callback();
                this.removeToast(toast);
            });
        }

        this.toastContainer!.appendChild(toast);
        this.activeToasts.push(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });

        // Auto-remove after duration (unless persistent)
        if (!persistent && duration > 0) {
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
        }

        return toast;
    }

    removeToast(toast: HTMLDivElement): void {
        if (!toast || !toast.parentNode) return;

        toast.classList.remove('toast-visible');
        toast.classList.add('toast-hiding');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            const index = this.activeToasts.indexOf(toast);
            if (index > -1) {
                this.activeToasts.splice(index, 1);
            }
        }, 300); // Match CSS animation duration
    }

    clearAllToasts(): void {
        [...this.activeToasts].forEach(toast => this.removeToast(toast));
    }

    // Convenience methods
    showSuccess(message: string, options: ToastOptions = {}): HTMLDivElement {
        return this.showToast(message, 'success', options);
    }

    showError(message: string, options: ToastOptions = {}): HTMLDivElement {
        return this.showToast(message, 'error', { duration: 8000, ...options });
    }

    showWarning(message: string, options: ToastOptions = {}): HTMLDivElement {
        return this.showToast(message, 'warning', options);
    }

    showInfo(message: string, options: ToastOptions = {}): HTMLDivElement {
        return this.showToast(message, 'info', options);
    }

    escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    checkBrowserCompatibility(): CompatibilityResults {
        const results: CompatibilityResults = {
            compatible: true,
            features: {},
            warnings: [],
            errors: []
        };

        // Check WebRTC support
        results.features.webrtc = !!window.RTCPeerConnection;
        if (!results.features.webrtc) {
            results.errors.push('WebRTC is not supported in this browser. Real-time collaboration will not work.');
            results.compatible = false;
        }

        // Check DataChannel support
        if (results.features.webrtc) {
            try {
                const pc = new RTCPeerConnection();
                results.features.datachannel = typeof pc.createDataChannel === 'function';
                pc.close();
            } catch {
                results.features.datachannel = false;
            }
            if (!results.features.datachannel) {
                results.errors.push('DataChannel is not supported. Real-time sync will not work.');
                results.compatible = false;
            }
        }

        // Check localStorage support
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            results.features.localStorage = true;
        } catch {
            results.features.localStorage = false;
            results.warnings.push('Local storage is not available. Session data will not persist.');
        }

        // Check IndexedDB support
        results.features.indexedDB = !!window.indexedDB;
        if (!results.features.indexedDB) {
            results.warnings.push('IndexedDB is not available. Canvas data storage may be limited.');
        }

        // Check Canvas support
        results.features.canvas = !!document.createElement('canvas').getContext;
        if (!results.features.canvas) {
            results.errors.push('Canvas is not supported. Diagram functionality will not work.');
            results.compatible = false;
        }

        // Check Clipboard API
        results.features.clipboard = !!(navigator.clipboard && navigator.clipboard.writeText);
        if (!results.features.clipboard) {
            results.warnings.push('Clipboard API not available. Copy functions may have limited support.');
        }

        // Check WebSocket support (for signaling server)
        results.features.websocket = 'WebSocket' in window;
        if (!results.features.websocket) {
            results.warnings.push('WebSocket not supported. Connection may use fallback methods.');
        }

        // Check if running in secure context (required for some features)
        results.features.secureContext = window.isSecureContext;
        if (!results.features.secureContext && window.location.hostname !== 'localhost') {
            results.warnings.push('Not running in a secure context (HTTPS). Some features may be restricted.');
        }

        this.compatibilityResults = results;
        return results;
    }

    showCompatibilityMessages(): boolean {
        const results = this.compatibilityResults || this.checkBrowserCompatibility();

        // Show errors first (these are blocking)
        results.errors.forEach(error => {
            this.showError(error, { duration: 0, persistent: true, dismissible: true });
        });

        // Show warnings (non-blocking)
        results.warnings.forEach(warning => {
            this.showWarning(warning, { duration: 10000 });
        });

        return results.compatible;
    }

    getErrorMessage(error: unknown): string {
        const errorObj = error as { name?: string; message?: string } | undefined;
        const errorType = errorObj?.name || '';
        const msg = errorObj?.message || String(error);

        if (msg.includes('ICE') || msg.includes('ice')) {
            return 'Unable to establish peer connection. This may be due to network restrictions.';
        }
        if (msg.includes('TURN') || msg.includes('relay')) {
            return 'Relay connection failed. Direct peer-to-peer connection may still work.';
        }
        if (msg.includes('signaling') || msg.includes('socket')) {
            return 'Cannot reach signaling server. Check your internet connection.';
        }
        if (msg.includes('timeout')) {
            return 'Connection timed out. The other participant may not be online.';
        }
        if (msg.includes('disconnected')) {
            return 'Connection lost. Attempting to reconnect...';
        }
        if (msg.includes('channel') || msg.includes('DataChannel')) {
            return 'Communication channel error. Some features may not sync properly.';
        }
        if (msg.includes('QuotaExceededError') || msg.includes('quota')) {
            return 'Storage quota exceeded. Try clearing old session data.';
        }
        if (msg.includes('localStorage') || msg.includes('storage')) {
            return 'Unable to save data locally. Check browser storage settings.';
        }
        if (errorType === 'NetworkError' || msg.includes('network')) {
            return 'Network error occurred. Check your internet connection.';
        }

        return msg || 'An unexpected error occurred.';
    }
}

/**
 * Connection Status Manager
 * Manages the connection status indicator in the UI
 */
export class ConnectionStatusManager {
    errorFeedback: ErrorFeedback;
    statusElement: HTMLElement | null;
    retryBanner: HTMLDivElement | null;
    currentState: ConnectionState;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    onCancelReconnect?: () => void;
    onManualRetry?: () => void;

    constructor(errorFeedback: ErrorFeedback) {
        this.errorFeedback = errorFeedback;
        this.statusElement = null;
        this.retryBanner = null;
        this.currentState = 'disconnected';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        // Bind methods
        this.updateStatus = this.updateStatus.bind(this);
    }

    initialize(): void {
        this.createRetryBanner();
    }

    createRetryBanner(): void {
        if (this.retryBanner) return;

        this.retryBanner = document.createElement('div') as HTMLDivElement;
        this.retryBanner.id = 'retryBanner';
        this.retryBanner.className = 'retry-banner';
        this.retryBanner.innerHTML = `
            <div class="retry-content">
                <span class="retry-spinner"></span>
                <span class="retry-message">Reconnecting...</span>
                <span class="retry-attempt"></span>
            </div>
            <div class="retry-actions">
                <button class="retry-cancel-btn">Cancel</button>
                <button class="retry-manual-btn" style="display: none;">Retry Now</button>
            </div>
        `;

        this.retryBanner.style.display = 'none';

        // Insert at top of app
        const app = document.getElementById('app');
        if (app) {
            app.insertBefore(this.retryBanner, app.firstChild);
        } else {
            document.body.insertBefore(this.retryBanner, document.body.firstChild);
        }

        // Event listeners
        this.retryBanner.querySelector('.retry-cancel-btn')!.addEventListener('click', () => {
            this.hideRetryBanner();
            if (this.onCancelReconnect) {
                this.onCancelReconnect();
            }
        });

        this.retryBanner.querySelector('.retry-manual-btn')!.addEventListener('click', () => {
            if (this.onManualRetry) {
                this.onManualRetry();
            }
        });
    }

    updateStatus(state: ConnectionState, details: StatusDetails = {}): void {
        this.currentState = state;

        if (state === 'connecting') {
            this.hideRetryBanner();
        } else if (state === 'connected') {
            this.hideRetryBanner();
            this.errorFeedback.showSuccess('Connected to peer!', { duration: 3000 });
            this.reconnectAttempts = 0;
        } else if (state === 'disconnected') {
            if (details.showNotification !== false) {
                this.errorFeedback.showWarning('Disconnected from peer.');
            }
        } else if (state === 'reconnecting') {
            this.reconnectAttempts = details.attempt || this.reconnectAttempts + 1;
            this.showRetryBanner(this.reconnectAttempts, this.maxReconnectAttempts);
        } else if (state === 'failed') {
            this.showFailedState(details.reason);
        }
    }

    showRetryBanner(attempt: number, maxAttempts: number): void {
        if (!this.retryBanner) return;

        this.retryBanner.style.display = 'flex';
        this.retryBanner.querySelector('.retry-message')!.textContent = 'Reconnecting...';
        this.retryBanner.querySelector('.retry-attempt')!.textContent = `Attempt ${attempt} of ${maxAttempts}`;
        (this.retryBanner.querySelector('.retry-manual-btn') as HTMLElement).style.display = 'none';
        (this.retryBanner.querySelector('.retry-cancel-btn') as HTMLElement).style.display = 'inline-block';
        this.retryBanner.classList.remove('retry-failed');
    }

    hideRetryBanner(): void {
        if (this.retryBanner) {
            this.retryBanner.style.display = 'none';
        }
    }

    showFailedState(reason?: string): void {
        if (!this.retryBanner) return;

        this.retryBanner.style.display = 'flex';
        this.retryBanner.classList.add('retry-failed');
        this.retryBanner.querySelector('.retry-message')!.textContent =
            reason || 'Connection failed after multiple attempts.';
        this.retryBanner.querySelector('.retry-attempt')!.textContent = '';
        (this.retryBanner.querySelector('.retry-manual-btn') as HTMLElement).style.display = 'inline-block';
        (this.retryBanner.querySelector('.retry-cancel-btn') as HTMLElement).style.display = 'none';

        this.errorFeedback.showError('Connection failed. Click "Retry Now" to try again.', {
            action: {
                label: 'Retry',
                callback: () => {
                    if (this.onManualRetry) {
                        this.onManualRetry();
                    }
                }
            }
        });
    }

    setCallbacks({ onCancelReconnect, onManualRetry }: ReconnectCallbacks): void {
        this.onCancelReconnect = onCancelReconnect;
        this.onManualRetry = onManualRetry;
    }
}

/**
 * Sync Status Indicator
 * Shows sync status for code, diagram, and messages
 */
export class SyncStatusIndicator {
    errorFeedback: ErrorFeedback;
    indicators: Record<string, { section: string }>;
    syncStates: Record<SyncSection, SyncState>;
    mainIndicator: HTMLElement | null;

    constructor(errorFeedback: ErrorFeedback) {
        this.errorFeedback = errorFeedback;
        this.indicators = {};
        this.mainIndicator = null;
        this.syncStates = {
            code: { synced: true, lastSync: null, pending: 0 },
            diagram: { synced: true, lastSync: null, pending: 0 },
            messages: { synced: true, lastSync: null, pending: 0 }
        };
    }

    initialize(): void {
        this.createIndicators();
    }

    createIndicators(): void {
        // Use the main sync indicator in the header
        const mainIndicator = document.getElementById('mainSyncIndicator');
        if (mainIndicator) {
            this.mainIndicator = mainIndicator;
        }

        // Keep track of section states internally but update main indicator
        const sections: SyncSection[] = ['code', 'diagram', 'messages'];
        sections.forEach(section => {
            this.indicators[section] = { section };
        });
    }

    updateStatus(section: SyncSection, status: SyncStatus): void {
        const state = this.syncStates[section];
        if (!state) return;

        state.status = status;

        if (status === 'synced') {
            state.synced = true;
            state.pending = 0;
            state.lastSync = Date.now();
        } else if (status === 'syncing' || status === 'error') {
            state.synced = false;
        } else if (status === 'pending') {
            state.pending++;
        }

        this.updateMainIndicator();
    }

    updateMainIndicator(): void {
        if (!this.mainIndicator) return;

        // Priority: error > offline > syncing > pending > synced
        const statusPriority: SyncStatus[] = ['error', 'offline', 'syncing', 'pending', 'synced'];
        let worstStatus: SyncStatus = 'synced';

        Object.values(this.syncStates).forEach(state => {
            if (state.status && statusPriority.indexOf(state.status) < statusPriority.indexOf(worstStatus)) {
                worstStatus = state.status;
            }
        });

        // Update main indicator appearance
        this.mainIndicator.className = `sync-indicator ${worstStatus}`;

        const titles: Record<SyncStatus, string> = {
            synced: 'All data synced',
            syncing: 'Syncing...',
            pending: 'Changes pending',
            error: 'Sync error',
            offline: 'Offline'
        };
        this.mainIndicator.title = titles[worstStatus] || 'Sync status';
    }

    setAllStatus(status: SyncStatus): void {
        (Object.keys(this.syncStates) as SyncSection[]).forEach(section => {
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
    }

    clearPending(section: SyncSection): void {
        if (this.syncStates[section]) {
            this.syncStates[section].pending = 0;
        }
    }
}
