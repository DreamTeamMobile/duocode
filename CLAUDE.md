# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DuoCode is a real-time collaborative coding interview platform. React + Vite frontend written in TypeScript, with Zustand state management and WebRTC P2P data sync — no server-side storage. All state lives client-side (localStorage for code/messages, IndexedDB for canvas images).

## Development Commands

```bash
# Setup (two separate npm installs required)
npm install && cd server && npm install && cd ..

# Run frontend + signaling server together
npm run dev:all

# Run separately
npm run dev          # Vite dev server on port 3000
npm run server       # Signaling server on port 3001

# Build for production
npm run build        # Outputs to dist/

# Type checking
npm run typecheck    # tsc --noEmit (strict mode, no allowJs)

# Unit tests (Vitest, jsdom environment)
npm test             # Run all tests once
npm run test:watch   # Watch mode
npx vitest run tests/unit/ot.test.ts           # Run a single test file
npx vitest run -t "test name pattern"          # Run tests matching a name

# E2E tests (Playwright) — defaults to http://localhost:3000
npm run test:e2e
npm run test:e2e:headed                              # E2E with visible browser
TEST_URL=https://your-domain.com npx playwright test # Run against production

# Coverage
npm run test:coverage
```

## Architecture

**TypeScript + React + Vite with Zustand.** The frontend is a React SPA built by Vite with strict TypeScript checking. State management uses Zustand stores. The only server component is a stateless Socket.IO signaling server (plain JS) for WebRTC handshake.

### Project Structure

- **`src/`** — React application source (TypeScript)
  - **`main.tsx`** — Entry point, renders `<App />` and imports `styles.css`
  - **`App.tsx`** — Root component with providers and layout
  - **`components/`** — React components organized by feature:
    - `AppShell.tsx` — Main layout wrapper
    - `Header.tsx`, `Footer.tsx` — App chrome
    - `TabBar.tsx`, `TabContent.tsx` — Tab navigation system
    - `ThemeProvider.tsx` — Dark/light theme context
    - `CodeEditor/` — Code editor with syntax highlighting, remote cursors
    - `DiagramCanvas/` — Canvas with drawing tools, shapes, zoom/pan
    - `Messages/` — Chat panel, participant list, FAB overlay
    - `Modals/` — Name entry, new session dialogs
    - `Notifications/` — Toast container, retry banner
  - **`hooks/`** — Custom React hooks:
    - `useWebRTC.ts` — WebRTC connection lifecycle
    - `useCodeSync.ts` — OT-based code synchronization
    - `useCanvasSync.ts` — Canvas state sync
    - `useMessageSync.ts` — Chat message sync
    - `usePersistence.ts` — localStorage/IndexedDB persistence
    - `useSessionInit.ts` — Session initialization flow
  - **`stores/`** — Zustand state stores:
    - `sessionStore.ts`, `connectionStore.ts`, `editorStore.ts`, `canvasStore.ts`, `messagesStore.ts`, `uiStore.ts`, `toastStore.ts`
  - **`services/`** — Extracted business logic (framework-agnostic):
    - `ot-engine.ts` — Operational Transformation engine
    - `connection-manager.ts` — WebRTC peer connection lifecycle
    - `signaling-client.ts` — Socket.IO signaling client
    - `persistence.ts` — Client-side persistence (localStorage + IndexedDB)
    - `error-feedback.ts` — Toast notifications, error logging
    - `canvas-logic.ts`, `code-editor-logic.ts`, `messages-logic.ts`, `session-logic.ts` — Domain logic
    - `pdf-export.ts` — PDF generation
    - `debug-utility.ts` — Debug status utility
  - **`styles.css`** — All styles. Dark/light theme via CSS custom properties toggled by `data-theme` attribute on `<html>`
- **`index.html`** — Vite entry HTML (loads `src/main.tsx`)
- **`vite.config.ts`** — Vite config with React plugin, dev proxy for Socket.IO
- **`vitest.config.ts`** — Test config (jsdom environment)
- **`tsconfig.json`** — TypeScript config (strict mode, no allowJs, bundler module resolution)
- **`server/server.js`** — Stateless signaling server with room management and host transfer logic. In-memory only. (Plain JS — not part of the TypeScript build.)

### Data Sync Protocol

Peers exchange JSON messages over WebRTC DataChannel with type-based routing: `code-operation` (OT incremental), `code` (full sync fallback), `canvas`, `canvas-view`, `message`, `cursor`, `tab`, `host-transfer`, `state-request`/`state-sync`.

Code sync uses **Operational Transformation** — local changes become retain/insert/delete operations, concurrent operations are transformed via `composeOperations()`/`transformOperation()`, `operationCount` ensures ordering.

### Connection Strategy

`ConnectionManager` phases: Direct P2P via STUN (10s) → TURN relay fallback (15s) → auto-reconnect (5 attempts, exponential backoff).

## Testing

Unit tests are in `tests/unit/` and `src/__tests__/`. Tests use Vitest with jsdom. Setup file at `tests/unit/setup.ts` mocks localStorage, IndexedDB, RTCPeerConnection, clipboard, etc.

E2E tests are in `tests/e2e/` (4 spec files, Playwright, Chromium only, single worker for WebRTC coordination).

## Gotchas

- **Theme + canvas**: When toggling themes, canvas background must be updated via `requestAnimationFrame` to ensure CSS variables are applied first.
- **Canvas persistence**: Uses IndexedDB (not localStorage) due to size. Code and messages use localStorage.
- **Host transfer on disconnect**: Server picks participant with earliest `joinedAt` timestamp as new host (`server/server.js` → `transferHost()`).
- **E2E default target**: `playwright.config.ts` defaults to `http://localhost:3000` — set `TEST_URL` env var to test against a deployed instance.
- **Connection indicator**: Green = direct P2P, Blue = relay (TURN), shows latency in ms.
- **Debug utility**: `window.DuoCodeDebug.status()` in browser console shows session state, peer connections, and data channels.
- **No TURN in production by default**: Corporate firewalls may block connections; TURN config goes in `src/services/connection-manager.ts`.
- **Server is plain JS**: The signaling server (`server/server.js`) is intentionally not TypeScript — it's a simple stateless Node.js process separate from the frontend build.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`): pushes and PRs to `main` run unit tests and Vite build (Node 20).

## Deployment

See `docs/DEPLOYMENT.md` for full deployment instructions. The frontend builds to `dist/` and can be served by any static file server. The signaling server runs as a Node.js process. Services can be managed with systemd or PM2. Health check: `curl http://localhost:3001/health`.

## Environment Variables

- `PORT` (server, default 3001) — signaling server port
- `ALLOWED_ORIGINS` (server, default `localhost:3000`) — CORS origins, comma-separated
- `window.SIGNALING_SERVER_URL` (client, optional) — override signaling server URL
