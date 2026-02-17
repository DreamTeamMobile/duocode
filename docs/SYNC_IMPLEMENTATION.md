# Real-Time Code Editor Synchronization Implementation

## Overview
This implementation provides real-time synchronization for the code editor using Operational Transformation (OT) to handle concurrent editing and conflict resolution.

## Features Implemented

### 1. Operational Transformation (OT)
- **TextOperation class** (src/services/ot-engine.ts): Implements the core OT algorithm
  - `retain(n)`: Keep n characters unchanged
  - `insert(text)`: Insert text at current position
  - `delete(n)`: Delete n characters at current position
  - `apply(text)`: Apply operation to text
  - `transform(op1, op2)`: Transform two concurrent operations

### 2. Incremental Change Detection
- **calculateTextOperation** (src/services/ot-engine.ts): Calculates minimal diff between old and new text
- Only sends changes (not full text) to reduce bandwidth
- Detects insertions, deletions, and retains

### 3. Concurrent Edit Handling
- **Operation Counters**: Track local and remote operation counts to maintain causality
- **Pending Operations**: Queue local operations that haven't been acknowledged
- **Transform on Receive**: Transform incoming operations against pending local operations
- Prevents conflicts when both users type simultaneously

### 4. Cursor Position Synchronization
- **Local Cursor Tracking**: Monitors cursor position changes (src/hooks/useCodeSync.ts)
- **Remote Cursor Display**: Shows peer's cursor position with visual indicator
- **Debounced Updates**: Cursor position updates are debounced (100ms) to reduce traffic
- **Visual Indicator**: Red cursor line with peer role label
- **Auto-hide**: Remote cursor hides after 3 seconds of inactivity

### 5. State Management
- **Sync State Variables** (src/stores/editorStore.ts):
  - `lastCodeValue`: Previous code value for diff calculation
  - `localOperationCount`: Number of local operations sent
  - `remoteOperationCount`: Number of remote operations received
  - `isRemoteUpdate`: Flag to prevent feedback loops
  - `pendingLocalOps`: Queue of unacknowledged local operations
  - `localCursorPosition`: Current local cursor position
  - `remoteCursorPosition`: Current peer cursor position

## Message Types

### code-operation
Sends incremental changes as operations:
```json
{
  "type": "code-operation",
  "content": {
    "operation": [retain_count, "insert_text", -delete_count],
    "operationCount": 5,
    "baseOperationCount": 3
  }
}
```

### cursor
Sends cursor position updates:
```json
{
  "type": "cursor",
  "content": {
    "position": 42,
    "selectionEnd": 42
  }
}
```

### code (fallback)
Full text sync for backward compatibility and initial sync:
```json
{
  "type": "code",
  "content": "full code text"
}
```

## How Concurrent Editing Works

### Scenario: Both users type simultaneously

1. **User A types "hello"**
   - Operation: `retain(0), insert("hello")`
   - Sent with `operationCount: 1, baseOperationCount: 0`

2. **User B types "world" (before receiving A's change)**
   - Operation: `retain(0), insert("world")`
   - Sent with `operationCount: 1, baseOperationCount: 0`

3. **User A receives B's operation**
   - Transforms: `transform(B's op, A's pending op)`
   - Result: B's text is inserted, A's text position is adjusted
   - Final: "worldhello" or "helloworld" (depending on tie-breaking)

4. **User B receives A's operation**
   - Transforms: `transform(A's op, B's pending op)`
   - Result: A's text is inserted, B's text position is adjusted
   - Both users converge to same state

## Key Implementation Details

### Preventing Infinite Loops
- `isRemoteUpdate` flag prevents local input handler from firing during remote updates
- Operations are only sent when `isRemoteUpdate === false`

### Cursor Position Adjustment
- When remote operations are applied, local cursor position is adjusted
- Insertions before cursor: cursor moves forward
- Deletions before cursor: cursor moves backward
- Maintains natural editing experience

### Language Change Handling
- Language changes reset OT state (counters and pending ops)
- Full text sync is triggered on language change
- Prevents OT conflicts across different code contexts

### State Reset on Connection
- When data channel opens, sync state is reset
- Initial code is sent via full text sync
- Ensures both peers start with consistent state

## Testing Recommendations

### Manual Testing Scenarios

1. **Basic Typing**
   - Both users type in different parts of the document
   - Verify changes appear correctly on both sides

2. **Concurrent Edits**
   - Both users type at the same position simultaneously
   - Verify no text is lost and both changes are preserved

3. **Delete Operations**
   - One user types while another deletes
   - Verify operations are transformed correctly

4. **Cursor Position**
   - Move cursor around and verify peer sees the position
   - Type and verify cursor moves naturally

5. **Language Switch**
   - Change language and verify both sides sync correctly
   - Continue editing after language change

6. **Reconnection**
   - Disconnect and reconnect
   - Verify state syncs correctly after reconnection

## Performance Considerations

- **Incremental Sync**: Only changed text is transmitted
- **Debounced Cursor**: Cursor updates are debounced to 100ms
- **Ordered Delivery**: WebRTC data channel uses `ordered: true`
- **No Acknowledgments**: Simplified implementation without explicit ACKs

## Future Enhancements

1. **Selection Range Sync**: Currently only syncs cursor position, could sync selections
2. **Operation Compression**: Combine multiple rapid operations
3. **History/Undo**: Add collaborative undo/redo support
4. **Conflict Indicators**: Show visual indicators when conflicts are resolved
5. **Peer Awareness**: Show which lines peers are editing
6. **Operation ACKs**: Add acknowledgments to handle packet loss better

## Code Locations

- **OT Implementation**: src/services/ot-engine.ts
- **Code Editor Logic**: src/services/code-editor-logic.ts
- **Code Sync Hook**: src/hooks/useCodeSync.ts
- **Remote Cursor Display**: src/components/CodeEditor/RemoteCursors.tsx
- **Editor State**: src/stores/editorStore.ts
- **CSS Styles**: src/styles.css

