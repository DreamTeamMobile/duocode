# DuoCode - Real-Time Collaborative Interview Platform

[![CI](https://github.com/DreamTeamMobile/duocode/actions/workflows/ci.yml/badge.svg)](https://github.com/DreamTeamMobile/duocode/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Proprietary-blue.svg)](LICENSE)

A lightweight, serverless-first web application for conducting technical interviews with real-time code collaboration, drawing canvas, and messaging.

## Features

- **Real-Time Code Editor** - Collaborative code editing with syntax highlighting for 15+ languages
- **Drawing Canvas** - Freehand drawing, shapes, diagrams with zoom/pan support (mouse wheel & touch gestures)
- **Messaging System** - Built-in chat with message history and participant list
- **Multi-Participant** - Support for up to 10 participants per session
- **Peer-to-Peer** - WebRTC-based communication, no data stored on servers
- **PDF Export** - Export session content (code, drawings, messages) to PDF
- **Session Sharing** - Simple URL-based session sharing with name entry
- **Host Management** - Automatic host transfer when the host leaves
- **Tab Sync** - Code/Diagram tab state synced between all participants
- **Offline Persistence** - Auto-saves to browser storage

## Quick Start

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Start both signaling server and frontend
npm run dev:all
```

Then open http://localhost:3000 in your browser.

## Usage Guide

### Starting a Session

1. **Enter your name** - A modal prompts for your display name (required)
2. **Join the session** - The first user becomes the host
3. **Share the URL** - Share the session URL with participants
4. **View participants** - Participant list shows all connected users with host indicator

### Code Editor

- **Select language** - Choose from JavaScript, TypeScript, Python, Java, Kotlin, C++, C, C#, Go, Rust, Ruby, Swift, Scala, PHP, SQL
- **Type code** - Changes sync automatically with operational transformation
- **Cursor tracking** - See your partner's cursor position in real-time
- **Tab sync** - Switching tabs (Code/Diagram) syncs to all participants

### Drawing Canvas

- **Drawing Tools** (emoji-based toolbar):
  - ✏️ **Pen** - Freehand drawing
  - ➖ **Line** - Straight lines
  - ⬜ **Rectangle** - Draw rectangles
  - ⭕ **Circle** - Draw circles/ellipses
  - 🎨 **Color picker** - Choose any color
  - ↕️ **Brush size** - Adjust line thickness (1-20px)
  - 🗑️ **Clear** - Wipe the canvas (synced to all)
  - **1:1** Reset zoom - Reset zoom and pan to default
- **Zoom/Pan**:
  - **Mouse wheel** - Zoom in/out centered on cursor
  - **Pinch gesture** - Two-finger zoom on touch devices
  - **Two-finger drag** - Pan around the canvas
  - Zoom range: 25% to 400%

### Messaging

- Type messages in the chat panel
- Messages are synced and persisted
- Each message shows sender role and timestamp

### Participants

- **Host** (👑) - Session creator with administrative privileges
- **Participants** - All other users in the session
- **Host Transfer** - When the host leaves, the longest-connected participant becomes the new host
- **Name Entry** - All participants must enter their name before joining
- **Participant List** - View all connected users in the collapsible panel

### PDF Export

Click "Export PDF" to download a document containing:
- All code with syntax highlighting preserved
- Canvas drawing as image
- Complete message history
- Session metadata

## Architecture

### Frontend Stack

- **TypeScript + React + Vite** - Type-safe component-based UI with fast build tooling
- **Zustand** - Lightweight state management
- **Prism.js** - Syntax highlighting
- **jsPDF** - PDF generation
- **WebRTC** - Peer-to-peer data channels

### Real-Time Sync

The application uses **Operational Transformation (OT)** for conflict-free concurrent editing:

1. Local changes are converted to operations (retain, insert, delete)
2. Operations are sent to peer via WebRTC DataChannel
3. Concurrent operations are transformed to maintain consistency
4. Both peers converge to identical state

### Connection Strategy

1. **Direct Connection** (10s timeout)
   - Uses STUN servers to discover public IP
   - Attempts direct P2P connection

2. **Relay Fallback** (15s timeout)
   - Uses TURN servers when direct connection fails
   - Works through symmetric NATs

3. **Signaling Server**
   - Optional Socket.IO server for WebRTC signaling
   - Falls back to localStorage signaling for same-browser testing

### Data Persistence

- **localStorage** - Session data, code, messages
- **IndexedDB** - Canvas images (large binary data)
- No server-side storage

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 80+ | Full Support |
| Firefox | 75+ | Full Support |
| Safari | 14+ | Full Support |
| Edge | 80+ | Full Support |
| Chrome Android | Latest | Full Support |
| iOS Safari | 14+ | Full Support |

### Required Browser APIs

- WebRTC (RTCPeerConnection, RTCDataChannel)
- localStorage & IndexedDB
- Canvas 2D API
- Clipboard API (for URL sharing)
- WebSocket (for signaling server)

## Project Structure

```
duocode/
├── index.html              # Vite entry HTML
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── src/
│   ├── main.tsx            # React entry point
│   ├── App.tsx             # Root component
│   ├── styles.css          # All styles (theme variables + layout)
│   ├── components/         # React components by feature
│   ├── hooks/              # Custom React hooks (sync, persistence)
│   ├── stores/             # Zustand state stores
│   └── services/           # Business logic (OT, WebRTC, persistence)
├── public/                 # Static files (privacy, terms, llms.txt)
├── tests/
│   ├── unit/               # Vitest unit tests
│   └── e2e/                # Playwright E2E tests
└── server/
    ├── server.js           # Signaling server
    ├── package.json        # Server dependencies
    └── Dockerfile          # Container configuration
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Signaling server port |
| `ALLOWED_ORIGINS` | * | CORS allowed origins (comma-separated) |
| `VITE_GA_ID` | *(none)* | Google Analytics measurement ID (build-time, optional) |

Set `VITE_GA_ID` before running `npm run build` to enable Google Analytics. If omitted, the GA script is not loaded. See `.env.example` for a template.

### CI/CD Secrets

The deploy job requires these GitHub Actions secrets (Settings > Secrets > Actions):

| Secret | Description |
|--------|-------------|
| `DEPLOY_SERVER_SSH_PRIVATE_KEY` | SSH private key for server access |
| `DEPLOY_SERVER_NAME_HOST` | SSH destination, e.g. `root@myserver.com` |

### Client Configuration

Edit `src/services/connection-manager.ts` to customize:

```javascript
const options = {
    stunServers: [...],           // Custom STUN servers
    turnServers: [...],           // TURN servers for relay
    directConnectionTimeout: 10000,
    relayConnectionTimeout: 15000,
    qualityCheckInterval: 2000,
    maxReconnectAttempts: 5
};
```

## Development

### Testing

DuoCode has comprehensive test coverage with **1063 unit tests** across 46 test files.

**Unit Tests (Vitest)**

```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

**E2E Tests (Playwright)**

```bash
npm run test:e2e
```

**Test Coverage Areas:**
- Operational transformation (OT) for code sync
- Session management and ID generation
- WebRTC connection handling
- Canvas undo/redo and zoom/pan sync
- Message queuing and persistence
- Device detection and responsive layout
- Error handling and user feedback
- Signaling client communication

### Development Server

```bash
# Frontend only
npm run dev

# Signaling server only
npm run server

# Both (parallel)
npm run dev:all
```

## Troubleshooting

### Connection Issues

1. **Both on same network** - Direct P2P should work
2. **Different networks** - May need signaling server + TURN relay
3. **Corporate firewall** - Configure TURN server with TCP fallback

### Sync Issues

1. **Refresh the page** - Resets local state
2. **Check console** - Look for WebRTC errors
3. **Verify connection status** - Should show "Connected"

### Canvas Not Syncing

1. Ensure both peers are connected
2. Check if canvas element is visible
3. Verify IndexedDB is not full

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and development workflow.

## Built With

This project was built with [mAIstro](https://www.npmjs.com/package/maistro) and [Claude Code](https://claude.ai/code). mAIstro is a small CLI for orchestrating Claude Code tasks when one-shot prompts and limited context aren't enough.

## License

Free to use for personal and commercial purposes. Modification, redistribution, and resale are not permitted. See [LICENSE](LICENSE) for details.

Copyright (c) 2026 [DreamTeam Mobile](https://dreamteam-mobile.com)
