# DuoCode API Documentation

This document describes the internal APIs, message protocols, and extensibility points.

## Table of Contents

1. [WebRTC Data Channel Protocol](#webrtc-data-channel-protocol)
2. [Signaling Server API](#signaling-server-api)
3. [JavaScript API Reference](#javascript-api-reference)
4. [Event System](#event-system)
5. [Storage API](#storage-api)

---

## WebRTC Data Channel Protocol

All peer-to-peer communication uses a JSON-based message protocol over WebRTC DataChannel.

### Message Format

```typescript
interface Message {
  type: string;      // Message type identifier
  content: any;      // Type-specific payload
  timestamp?: number; // Optional timestamp
}
```

### Message Types

#### Code Synchronization

**code-operation** - Incremental text change (OT)
```json
{
  "type": "code-operation",
  "content": {
    "operation": {
      "ops": [5, "hello", -3]  // retain 5, insert "hello", delete 3
    },
    "operationCount": 42,
    "baseOperationCount": 41
  }
}
```

**code** - Full text sync (fallback)
```json
{
  "type": "code",
  "content": "function hello() {\n  console.log('world');\n}"
}
```

**cursor** - Cursor position update
```json
{
  "type": "cursor",
  "content": {
    "position": 156,
    "selectionEnd": 200
  }
}
```

**language** - Language selection change
```json
{
  "type": "language",
  "content": {
    "language": "python"
  }
}
```

#### Drawing Canvas

**drawing-action** - Canvas drawing event
```json
{
  "type": "drawing-action",
  "content": {
    "action": "move",      // "start", "move", "end", "clear"
    "x": 150,
    "y": 200,
    "tool": "pen",         // "pen", "line", "rect", "circle"
    "color": "#ff0000",
    "size": 3
  }
}
```

**canvas-data** - Full canvas image (fallback)
```json
{
  "type": "canvas-data",
  "content": {
    "imageData": "data:image/png;base64,..."
  }
}
```

#### Messaging

**chat** - Chat message
```json
{
  "type": "chat",
  "content": {
    "id": "msg_1705123456789",
    "text": "Hello, can you explain this function?",
    "role": "interviewer",
    "seq": 15,
    "timestamp": 1705123456789
  }
}
```

**chat-ack** - Message acknowledgment
```json
{
  "type": "chat-ack",
  "content": {
    "messageId": "msg_1705123456789",
    "acknowledged": true
  }
}
```

#### Session Management

**role** - Role change notification
```json
{
  "type": "role",
  "content": {
    "role": "candidate"
  }
}
```

**host-transfer** - Host privilege transfer
```json
{
  "type": "host-transfer",
  "content": {
    "newHost": true
  }
}
```

**sync-request** - Request full state sync
```json
{
  "type": "sync-request",
  "content": {
    "components": ["code", "canvas", "messages"]
  }
}
```

**sync-response** - Full state sync response
```json
{
  "type": "sync-response",
  "content": {
    "code": "...",
    "language": "javascript",
    "messages": [...],
    "canvasData": "data:image/png;base64,..."
  }
}
```

---

## Signaling Server API

The signaling server facilitates WebRTC connection establishment.

### HTTP Endpoints

#### GET /
Server information.

**Response:**
```json
{
  "name": "DuoCode Signaling Server",
  "version": "1.0.0",
  "status": "running"
}
```

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "rooms": 5,
  "connections": 10,
  "memoryUsage": {
    "heapUsed": 15000000,
    "heapTotal": 30000000
  }
}
```

### Socket.IO Events

#### Client → Server

**join-room** - Join a session room
```javascript
socket.emit('join-room', {
  sessionId: 'ABC123xyz456',
  isHost: true
});
```

**offer** - Send WebRTC offer
```javascript
socket.emit('offer', {
  sessionId: 'ABC123xyz456',
  offer: {
    type: 'offer',
    sdp: '...'
  }
});
```

**answer** - Send WebRTC answer
```javascript
socket.emit('answer', {
  sessionId: 'ABC123xyz456',
  answer: {
    type: 'answer',
    sdp: '...'
  }
});
```

**ice-candidate** - Send ICE candidate
```javascript
socket.emit('ice-candidate', {
  sessionId: 'ABC123xyz456',
  candidate: {
    candidate: '...',
    sdpMid: '0',
    sdpMLineIndex: 0
  }
});
```

**leave-room** - Leave session room
```javascript
socket.emit('leave-room', {
  sessionId: 'ABC123xyz456'
});
```

#### Server → Client

**room-state** - Room state update
```javascript
socket.on('room-state', (data) => {
  // data: { sessionId, participantCount, participants, isHost }
});
```

**offer** - Receive WebRTC offer
```javascript
socket.on('offer', (data) => {
  // data: { offer, from }
});
```

**answer** - Receive WebRTC answer
```javascript
socket.on('answer', (data) => {
  // data: { answer, from }
});
```

**ice-candidate** - Receive ICE candidate
```javascript
socket.on('ice-candidate', (data) => {
  // data: { candidate, from }
});
```

**peer-joined** - Peer joined room
```javascript
socket.on('peer-joined', (data) => {
  // data: { peerId, isHost }
});
```

**peer-left** - Peer left room
```javascript
socket.on('peer-left', (data) => {
  // data: { peerId }
});
```

**error** - Error notification
```javascript
socket.on('error', (data) => {
  // data: { code, message }
});
```

---

## JavaScript API Reference

### ConnectionManager

Handles WebRTC connection lifecycle.

```javascript
const manager = new ConnectionManager({
  stunServers: [...],
  turnServers: [...],
  directConnectionTimeout: 10000,
  relayConnectionTimeout: 15000,
  qualityCheckInterval: 2000,
  maxReconnectAttempts: 5
});
```

#### Methods

| Method | Description |
|--------|-------------|
| `initializePeerConnection(includeRelay)` | Create RTCPeerConnection |
| `createOffer()` | Generate SDP offer |
| `createAnswer(offer)` | Generate SDP answer |
| `handleOffer(offer)` | Process received offer |
| `handleAnswer(answer)` | Process received answer |
| `addIceCandidate(candidate)` | Add ICE candidate |
| `connectWithFallback()` | Attempt connection with fallback |
| `send(data)` | Send data via DataChannel |
| `close()` | Close connection |
| `getConnectionMetrics()` | Get current metrics |
| `detectNetworkTopology()` | Analyze NAT type |

#### Events

```javascript
manager.on('onStateChange', (state) => { /* 'connecting', 'connected', 'disconnected', 'failed' */ });
manager.on('onConnectionTypeChange', (type) => { /* 'direct', 'relay' */ });
manager.on('onQualityChange', (quality) => { /* 'excellent', 'good', 'fair', 'poor' */ });
manager.on('onDataChannel', (channel) => { /* RTCDataChannel instance */ });
manager.on('onIceCandidate', (candidate) => { /* ICE candidate to send */ });
manager.on('onOffer', (offer) => { /* SDP offer to send */ });
manager.on('onAnswer', (answer) => { /* SDP answer to send */ });
manager.on('onError', (error) => { /* Error object */ });
manager.on('onReconnecting', (attempt) => { /* Reconnection attempt number */ });
manager.on('onMetricsUpdate', (metrics) => { /* Connection metrics */ });
```

### SignalingClient

Socket.IO-based signaling client.

```javascript
const client = new SignalingClient('https://signaling.example.com');
```

#### Methods

| Method | Description |
|--------|-------------|
| `connect()` | Connect to signaling server |
| `joinRoom(sessionId, isHost)` | Join session room |
| `sendOffer(sessionId, offer)` | Send WebRTC offer |
| `sendAnswer(sessionId, answer)` | Send WebRTC answer |
| `sendIceCandidate(sessionId, candidate)` | Send ICE candidate |
| `leaveRoom(sessionId)` | Leave session room |
| `disconnect()` | Disconnect from server |

#### Events

```javascript
client.on('connected', () => {});
client.on('disconnected', () => {});
client.on('room-state', (state) => {});
client.on('offer', (data) => {});
client.on('answer', (data) => {});
client.on('ice-candidate', (data) => {});
client.on('peer-joined', (data) => {});
client.on('peer-left', (data) => {});
client.on('error', (error) => {});
```

### PersistenceManager

Handles localStorage and IndexedDB storage.

```javascript
const persistence = new PersistenceManager();
```

#### Methods

| Method | Description |
|--------|-------------|
| `saveSession(sessionId, data)` | Save session metadata |
| `loadSession(sessionId)` | Load session metadata |
| `saveCode(sessionId, code)` | Save code content |
| `loadCode(sessionId)` | Load code content |
| `saveMessages(sessionId, messages)` | Save message history |
| `loadMessages(sessionId)` | Load message history |
| `saveCanvas(sessionId, imageData)` | Save canvas to IndexedDB |
| `loadCanvas(sessionId)` | Load canvas from IndexedDB |
| `clearSession(sessionId)` | Clear all session data |

### TextOperation

Operational transformation for concurrent editing.

```javascript
const op = new TextOperation();
op.retain(5).insert('hello').delete(3);
const result = op.apply('some text here');
```

#### Methods

| Method | Description |
|--------|-------------|
| `retain(n)` | Keep n characters unchanged |
| `insert(text)` | Insert text at current position |
| `delete(n)` | Delete n characters |
| `apply(text)` | Apply operation to text |
| `compose(op2)` | Compose with another operation |
| `transform(op1, op2)` | Transform concurrent operations |

### ErrorFeedback

UI notification system.

```javascript
const feedback = new ErrorFeedback();
feedback.showSuccess('Operation completed');
feedback.showError('Something went wrong');
feedback.showWarning('Connection unstable');
feedback.showInfo('Peer joined session');
```

#### Methods

| Method | Description |
|--------|-------------|
| `showSuccess(message, options)` | Show success toast |
| `showError(message, options)` | Show error toast |
| `showWarning(message, options)` | Show warning toast |
| `showInfo(message, options)` | Show info toast |
| `dismiss(id)` | Dismiss specific toast |
| `dismissAll()` | Dismiss all toasts |

---

## Event System

### Global Events

The application emits custom events on `window`:

```javascript
window.addEventListener('duocode:connected', (e) => {
  console.log('Connected to peer:', e.detail);
});

window.addEventListener('duocode:disconnected', (e) => {
  console.log('Disconnected');
});

window.addEventListener('duocode:sync-complete', (e) => {
  console.log('Sync completed for:', e.detail.component);
});

window.addEventListener('duocode:error', (e) => {
  console.error('Error:', e.detail);
});
```

### Extending the Protocol

To add custom message types:

```javascript
// Send custom message
function sendCustomMessage(data) {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({
      type: 'custom-type',
      content: data
    }));
  }
}

// Handle custom message
function handleDataChannelMessage(event) {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'custom-type':
      handleCustomType(message.content);
      break;
    // ... existing handlers
  }
}
```

---

## Storage API

### localStorage Keys

| Key Pattern | Description |
|-------------|-------------|
| `duocode_session_{sessionId}` | Session metadata |
| `duocode_code_{sessionId}` | Code content |
| `duocode_messages_{sessionId}` | Message history |
| `duocode_ot_state_{sessionId}` | OT operation counters |
| `duocode_preferences` | User preferences |

### IndexedDB Structure

**Database:** `DuoCodeDB`

**Object Stores:**

1. `canvas`
   - Key: `sessionId`
   - Value: `{ imageData: string, timestamp: number }`

2. `sessions`
   - Key: `sessionId`
   - Value: Session metadata object

### Data Schemas

**Session Metadata:**
```typescript
interface SessionData {
  role: 'interviewer' | 'candidate';
  language: string;
  isHost: boolean;
  createdAt: number;
  lastUpdated: number;
}
```

**Message:**
```typescript
interface ChatMessage {
  id: string;
  text: string;
  role: 'interviewer' | 'candidate';
  seq: number;
  timestamp: number;
  acknowledged?: boolean;
}
```

**OT State:**
```typescript
interface OTState {
  localOperationCount: number;
  remoteOperationCount: number;
  pendingOps: TextOperation[];
}
```
