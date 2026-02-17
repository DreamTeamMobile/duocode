/**
 * DuoCode Signaling Server
 *
 * Lightweight, stateless WebRTC signaling server using Socket.IO.
 * Handles session room management and ICE candidate relay.
 *
 * All data is kept in-memory only - no persistence.
 */

const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

// Create HTTP server
const server = http.createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            uptime: process.uptime(),
            rooms: rooms.size
        }));
        return;
    }

    // Basic info endpoint
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            name: 'DuoCode Signaling Server',
            version: '1.0.0'
        }));
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

// Socket.IO server with CORS configuration
const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true
    },
    // Ping timeout and interval for connection health
    pingTimeout: 60000,
    pingInterval: 25000
});

// Maximum participants per room
const MAX_PARTICIPANTS = 50;

// In-memory room storage (no persistence)
// Structure: Map<sessionId, { participants: Map<socketId, participantData>, hostId: socketId }>
// participantData: { socketId, name, isHost, joinedAt }
const rooms = new Map();

// Track socket to room mapping for cleanup
// Structure: Map<socketId, sessionId>
const socketRooms = new Map();

/**
 * Get room info for logging
 */
function getRoomInfo(sessionId) {
    const room = rooms.get(sessionId);
    return room ? { sessionId, participants: room.participants.size, hostId: room.hostId } : null;
}

/**
 * Get participant list for a room
 */
function getParticipantList(sessionId) {
    const room = rooms.get(sessionId);
    if (!room) return [];

    return Array.from(room.participants.values()).map(p => ({
        peerId: p.socketId,
        name: p.name,
        isHost: p.socketId === room.hostId,
        joinedAt: p.joinedAt
    }));
}

/**
 * Broadcast room state to all participants
 */
function broadcastRoomState(sessionId) {
    const room = rooms.get(sessionId);
    if (!room) return;

    const participantList = getParticipantList(sessionId);
    io.to(sessionId).emit('room-state', {
        sessionId,
        participantCount: room.participants.size,
        participants: participantList,
        hostId: room.hostId
    });
}

/**
 * Transfer host to next available participant
 */
function transferHost(sessionId, leavingHostId) {
    const room = rooms.get(sessionId);
    if (!room || room.participants.size === 0) return null;

    // Find the next oldest participant (by joinedAt)
    let newHost = null;
    let oldestJoinTime = Infinity;

    room.participants.forEach((participant, socketId) => {
        if (socketId !== leavingHostId && participant.joinedAt < oldestJoinTime) {
            oldestJoinTime = participant.joinedAt;
            newHost = socketId;
        }
    });

    if (newHost) {
        room.hostId = newHost;
        // Notify all participants about the host change
        io.to(sessionId).emit('host-changed', {
            newHostId: newHost,
            newHostName: room.participants.get(newHost)?.name
        });
        console.log(`[${new Date().toISOString()}] Host transferred to ${newHost} in room ${sessionId}`);
    }

    return newHost;
}

/**
 * Generate a unique name for a participant
 * If the name is already taken, append a number suffix (e.g., Alex2, Alex3)
 */
function generateUniqueName(room, baseName) {
    // Get all existing names in the room
    const existingNames = new Set();
    room.participants.forEach(p => existingNames.add(p.name.toLowerCase()));

    // If name is not taken, return as-is
    if (!existingNames.has(baseName.toLowerCase())) {
        return baseName;
    }

    // Extract base name without existing number suffix
    const match = baseName.match(/^(.+?)(\d+)?$/);
    const nameBase = match[1];

    // Find the next available number
    let counter = 2;
    while (existingNames.has(`${nameBase}${counter}`.toLowerCase())) {
        counter++;
    }

    return `${nameBase}${counter}`;
}

io.on('connection', (socket) => {

    /**
     * Join a session room
     * Client sends: { sessionId: string, isHost: boolean, name: string }
     */
    socket.on('join-room', (data) => {
        const { sessionId, isHost, name } = data || {};

        if (!sessionId || typeof sessionId !== 'string') {
            socket.emit('error', { message: 'Invalid session ID' });
            return;
        }

        const trimmedName = (name || '').trim();
        if (!trimmedName) {
            socket.emit('error', { message: 'Name is required to join a session' });
            return;
        }

        // Leave any existing room first
        const existingRoom = socketRooms.get(socket.id);
        if (existingRoom) {
            leaveRoom(socket, existingRoom);
        }

        // Create room if it doesn't exist
        if (!rooms.has(sessionId)) {
            rooms.set(sessionId, {
                participants: new Map(),
                hostId: null
            });
        }

        const room = rooms.get(sessionId);

        if (room.participants.size >= MAX_PARTICIPANTS) {
            socket.emit('room-full', { sessionId, maxParticipants: MAX_PARTICIPANTS });
            return;
        }

        const uniqueName = generateUniqueName(room, trimmedName);
        const participantData = {
            socketId: socket.id,
            name: uniqueName,
            isHost: isHost,
            joinedAt: Date.now()
        };

        room.participants.set(socket.id, participantData);
        socketRooms.set(socket.id, sessionId);
        socket.join(sessionId);

        if (!room.hostId || (isHost && room.participants.size === 1)) {
            room.hostId = socket.id;
        }

        const isActualHost = room.hostId === socket.id;

        socket.emit('joined-room', {
            sessionId,
            isHost: isActualHost,
            assignedName: uniqueName,
            participantCount: room.participants.size,
            participants: getParticipantList(sessionId),
            hostId: room.hostId
        });

        socket.to(sessionId).emit('peer-joined', {
            peerId: socket.id,
            name: uniqueName,
            isHost: isActualHost
        });

        broadcastRoomState(sessionId);
    });

    /**
     * Relay WebRTC offer to peer
     */
    socket.on('offer', (data) => {
        const { sessionId, offer, targetPeerId } = data;
        if (!sessionId || !offer) {
            socket.emit('error', { message: 'Invalid offer data' });
            return;
        }

        const target = targetPeerId ? io.to(targetPeerId) : socket.to(sessionId);
        target.emit('offer', { offer, from: socket.id });
    });

    /**
     * Relay WebRTC answer to peer
     */
    socket.on('answer', (data) => {
        const { sessionId, answer, targetPeerId } = data;
        if (!sessionId || !answer) {
            socket.emit('error', { message: 'Invalid answer data' });
            return;
        }

        const target = targetPeerId ? io.to(targetPeerId) : socket.to(sessionId);
        target.emit('answer', { answer, from: socket.id });
    });

    /**
     * Relay ICE candidates to peer
     */
    socket.on('ice-candidate', (data) => {
        const { sessionId, candidate, targetPeerId } = data;
        if (!sessionId || !candidate) return;

        const target = targetPeerId ? io.to(targetPeerId) : socket.to(sessionId);
        target.emit('ice-candidate', { candidate, from: socket.id });
    });

    /**
     * Handle explicit room leave
     */
    socket.on('leave-room', (data) => {
        const { sessionId } = data;
        if (sessionId) {
            leaveRoom(socket, sessionId);
        }
    });

    socket.on('disconnect', () => {
        const sessionId = socketRooms.get(socket.id);
        if (sessionId) {
            leaveRoom(socket, sessionId);
        }
    });
});

/**
 * Remove socket from room and clean up
 */
function leaveRoom(socket, sessionId) {
    const room = rooms.get(sessionId);

    if (room) {
        const leavingParticipant = room.participants.get(socket.id);
        const wasHost = room.hostId === socket.id;

        room.participants.delete(socket.id);

        socket.to(sessionId).emit('peer-left', {
            peerId: socket.id,
            name: leavingParticipant?.name
        });

        if (room.participants.size === 0) {
            rooms.delete(sessionId);
        } else {
            if (wasHost) {
                transferHost(sessionId, socket.id);
            }
            broadcastRoomState(sessionId);
        }
    }

    socketRooms.delete(socket.id);
    socket.leave(sessionId);
}

server.listen(PORT, () => {
    console.log(`DuoCode Signaling Server running on port ${PORT}`);
});

function gracefulShutdown() {
    io.emit('server-shutdown', { message: 'Server is shutting down' });
    server.close(() => process.exit(0));
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
