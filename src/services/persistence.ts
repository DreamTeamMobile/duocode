// Client-side Data Persistence using localStorage and IndexedDB
// Provides session data recovery on page reload

export interface SessionData {
    sessionId: string;
    role: string;
    language: string;
    isSessionHost: boolean;
    lastUpdated: number;
}

export interface OTState {
    localOperationCount: number;
    remoteOperationCount: number;
    messageSequenceNumber: number;
    lastReceivedMessageSeq: number;
    lastUpdated?: number;
}

export interface SavedSession {
    sessionId: string;
    role: string;
    language: string;
    lastUpdated: number;
}

interface CodeEntry {
    code: string;
    lastUpdated: number;
}

interface MessagesEntry {
    messages: unknown[];
    lastUpdated: number;
}

interface CanvasEntry {
    sessionId: string;
    dataUrl: string;
    lastUpdated: number;
}

interface CanvasLocalStorageEntry {
    dataUrl: string;
    lastUpdated: number;
}

export const StorageManager = {
    // Storage keys prefix
    PREFIX: 'duocode_',

    // Session expiry time (7 days)
    SESSION_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,

    // Debounce timers
    _debounceTimers: {} as Record<string, ReturnType<typeof setTimeout>>,

    // IndexedDB instance for large data (canvas)
    _db: null as IDBDatabase | null,
    _dbReady: false,

    // Initialize IndexedDB for canvas storage
    async initIndexedDB(): Promise<boolean> {
        return new Promise((resolve) => {
            const request = indexedDB.open('DuoCodeStorage', 1);

            request.onerror = () => {
                console.warn('IndexedDB not available, falling back to localStorage');
                resolve(false);
            };

            request.onsuccess = (event) => {
                this._db = (event.target as IDBOpenDBRequest).result;
                this._dbReady = true;
                // IndexedDB ready
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create object store for canvas data
                if (!db.objectStoreNames.contains('canvas')) {
                    db.createObjectStore('canvas', { keyPath: 'sessionId' });
                }

                // Create object store for session metadata
                if (!db.objectStoreNames.contains('sessions')) {
                    db.createObjectStore('sessions', { keyPath: 'sessionId' });
                }
            };
        });
    },

    // Get storage key with prefix
    _key(type: string, sessionId: string): string {
        return `${this.PREFIX}${type}_${sessionId}`;
    },

    // Debounce function for high-frequency saves
    _debounce(key: string, fn: () => void, delay: number): void {
        if (this._debounceTimers[key]) {
            clearTimeout(this._debounceTimers[key]);
        }
        this._debounceTimers[key] = setTimeout(fn, delay);
    },

    // Save session metadata
    saveSession(sessionId: string, data: { role?: string; language: string; isSessionHost: boolean }): void {
        try {
            const entry: SessionData = {
                sessionId,
                role: data.role || '',
                language: data.language,
                isSessionHost: data.isSessionHost,
                lastUpdated: Date.now()
            };
            localStorage.setItem(this._key('session', sessionId), JSON.stringify(entry));
        } catch (error) {
            console.error('Error saving session:', error);
        }
    },

    // Load session metadata
    loadSession(sessionId: string): SessionData | null {
        try {
            const data = localStorage.getItem(this._key('session', sessionId));
            if (!data) return null;

            const session: SessionData = JSON.parse(data);
            if (Date.now() - session.lastUpdated > this.SESSION_EXPIRY_MS) {
                this.clearSession(sessionId);
                return null;
            }
            return session;
        } catch (error) {
            console.error('Error loading session:', error);
            return null;
        }
    },

    // Save code content (debounced)
    saveCode(sessionId: string, code: string): void {
        this._debounce(`code_${sessionId}`, () => {
            try {
                const entry: CodeEntry = {
                    code,
                    lastUpdated: Date.now()
                };
                localStorage.setItem(this._key('code', sessionId), JSON.stringify(entry));
            } catch (error) {
                console.error('Error saving code:', error);
            }
        }, 500);
    },

    // Load code content
    loadCode(sessionId: string): string | null {
        try {
            const data = localStorage.getItem(this._key('code', sessionId));
            return data ? (JSON.parse(data) as CodeEntry).code : null;
        } catch (error) {
            console.error('Error loading code:', error);
            return null;
        }
    },

    // Save message history
    saveMessages(sessionId: string, messages: unknown[]): void {
        this._debounce(`messages_${sessionId}`, () => {
            try {
                const entry: MessagesEntry = {
                    messages,
                    lastUpdated: Date.now()
                };
                localStorage.setItem(this._key('messages', sessionId), JSON.stringify(entry));
            } catch (error) {
                console.error('Error saving messages:', error);
            }
        }, 300);
    },

    // Load message history
    loadMessages(sessionId: string): unknown[] {
        try {
            const data = localStorage.getItem(this._key('messages', sessionId));
            return data ? (JSON.parse(data) as MessagesEntry).messages : [];
        } catch (error) {
            console.error('Error loading messages:', error);
            return [];
        }
    },

    // Save canvas to IndexedDB (for large data)
    async saveCanvas(sessionId: string, canvasDataUrl: string): Promise<void> {
        this._debounce(`canvas_${sessionId}`, async () => {
            const data: CanvasEntry = {
                sessionId,
                dataUrl: canvasDataUrl,
                lastUpdated: Date.now()
            };

            if (this._dbReady && this._db) {
                try {
                    const transaction = this._db.transaction(['canvas'], 'readwrite');
                    const store = transaction.objectStore('canvas');
                    await new Promise<void>((resolve, reject) => {
                        const request = store.put(data);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                } catch (error) {
                    this._saveCanvasToLocalStorage(sessionId, canvasDataUrl);
                }
            } else {
                this._saveCanvasToLocalStorage(sessionId, canvasDataUrl);
            }
        }, 1000);
    },

    _saveCanvasToLocalStorage(sessionId: string, canvasDataUrl: string): void {
        try {
            const entry: CanvasLocalStorageEntry = {
                dataUrl: canvasDataUrl,
                lastUpdated: Date.now()
            };
            localStorage.setItem(this._key('canvas', sessionId), JSON.stringify(entry));
        } catch (error) {
            // Likely quota exceeded
        }
    },

    async loadCanvas(sessionId: string): Promise<string | null> {
        if (this._dbReady && this._db) {
            try {
                const transaction = this._db.transaction(['canvas'], 'readonly');
                const store = transaction.objectStore('canvas');
                const data = await new Promise<CanvasEntry | undefined>((resolve, reject) => {
                    const request = store.get(sessionId);
                    request.onsuccess = () => resolve(request.result as CanvasEntry | undefined);
                    request.onerror = () => reject(request.error);
                });
                if (data) return data.dataUrl;
            } catch (error) {
                // Fall through to localStorage
            }
        }

        return this._loadCanvasFromLocalStorage(sessionId);
    },

    _loadCanvasFromLocalStorage(sessionId: string): string | null {
        try {
            const data = localStorage.getItem(this._key('canvas', sessionId));
            return data ? (JSON.parse(data) as CanvasLocalStorageEntry).dataUrl : null;
        } catch (error) {
            return null;
        }
    },

    // Save OT synchronization state
    saveOTState(sessionId: string, otState: Partial<OTState>): void {
        this._debounce(`ot_${sessionId}`, () => {
            try {
                const data = {
                    localOperationCount: otState.localOperationCount ?? 0,
                    remoteOperationCount: otState.remoteOperationCount ?? 0,
                    messageSequenceNumber: otState.messageSequenceNumber ?? 0,
                    lastReceivedMessageSeq: otState.lastReceivedMessageSeq ?? 0,
                    lastUpdated: Date.now()
                };
                localStorage.setItem(this._key('ot', sessionId), JSON.stringify(data));
            } catch (error) {
                console.error('Error saving OT state:', error);
            }
        }, 500);
    },

    // Load OT synchronization state
    loadOTState(sessionId: string): OTState | null {
        try {
            const data = localStorage.getItem(this._key('ot', sessionId));
            if (data) {
                const parsed: OTState = JSON.parse(data);
                return parsed;
            }
        } catch (error) {
            console.error('Error loading OT state:', error);
        }
        return null;
    },

    // Clear all data for a session
    clearSession(sessionId: string): void {
        const keys = ['session', 'code', 'messages', 'canvas', 'ot'];
        keys.forEach(key => {
            localStorage.removeItem(this._key(key, sessionId));
        });

        // Clear from IndexedDB
        if (this._dbReady && this._db) {
            try {
                const transaction = this._db.transaction(['canvas'], 'readwrite');
                const store = transaction.objectStore('canvas');
                store.delete(sessionId);
            } catch (error) {
                console.error('Error clearing canvas from IndexedDB:', error);
            }
        }

    },

    // Clean up expired sessions
    cleanupExpiredSessions(): void {
        const now = Date.now();
        const keysToRemove: string[] = [];
        const sessionKeyPrefix = `${this.PREFIX}session_`;

        // Find all session metadata keys (skip name_ and start_ keys
        // which use the same prefix but store non-JSON values)
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (
                key &&
                key.startsWith(sessionKeyPrefix) &&
                !key.startsWith(`${this.PREFIX}session_name_`) &&
                !key.startsWith(`${this.PREFIX}session_start_`)
            ) {
                try {
                    const data: SessionData = JSON.parse(localStorage.getItem(key)!);
                    if (data && data.lastUpdated && (now - data.lastUpdated > this.SESSION_EXPIRY_MS)) {
                        const sessionId = key.replace(sessionKeyPrefix, '');
                        keysToRemove.push(sessionId);
                    }
                } catch (error) {
                    // Invalid data, mark for removal
                    keysToRemove.push(key.replace(sessionKeyPrefix, ''));
                }
            }
        }

        // Remove expired sessions
        keysToRemove.forEach(sessionId => {
            this.clearSession(sessionId);
        });

    },

    // Get all saved session IDs
    getSavedSessions(): SavedSession[] {
        const sessions: SavedSession[] = [];
        const sessionKeyPrefix = `${this.PREFIX}session_`;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (
                key &&
                key.startsWith(sessionKeyPrefix) &&
                !key.startsWith(`${this.PREFIX}session_name_`) &&
                !key.startsWith(`${this.PREFIX}session_start_`)
            ) {
                try {
                    const data: SessionData = JSON.parse(localStorage.getItem(key)!);
                    sessions.push({
                        sessionId: data.sessionId,
                        role: data.role,
                        language: data.language,
                        lastUpdated: data.lastUpdated
                    });
                } catch (error) {
                    // Skip invalid entries
                }
            }
        }
        return sessions.sort((a, b) => b.lastUpdated - a.lastUpdated);
    },

    // Check if session has persisted data
    hasPersistedData(sessionId: string): boolean {
        return localStorage.getItem(this._key('session', sessionId)) !== null ||
               localStorage.getItem(this._key('code', sessionId)) !== null ||
               localStorage.getItem(this._key('messages', sessionId)) !== null;
    }
};
