const WebSocket = require('ws');
const net = require('net');
const fs = require('fs');
const path = require('path');

// Configuration
const WS_PORT = 3001;          // WebSocket server port
const TCP_HOST = 'localhost';   // Your C++ server host
const TCP_PORT = 8080;         // Your C++ server port
const USERS_FILE = path.join(__dirname, 'users.json');

// Global state
const userToWs = new Map();
const wsToUser = new Map();
const roomToUsers = new Map();

// Persistent User Store
let usersDb = {}; // { username: { password, id } }
let idToUser = {}; // { id: username }

function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            usersDb = JSON.parse(data);
            // Rebuild ID index
            idToUser = {};
            for (const [user, val] of Object.entries(usersDb)) {
                if (val.id) idToUser[val.id] = user;
            }
            console.log(`Loaded ${Object.keys(usersDb).length} users.`);
        }
    } catch (e) {
        console.error('Failed to load users:', e);
    }
}

function saveUsers() {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(usersDb, null, 2));
    } catch (e) {
        console.error('Failed to save users:', e);
    }
}

function generateId() {
    let id;
    do {
        id = Math.floor(100000 + Math.random() * 900000).toString();
    } while (idToUser[id]);
    return id;
}

loadUsers();

// Helper to remove user from all maps
function cleanupUser(ws) {
    const username = wsToUser.get(ws);
    if (!username) return;

    wsToUser.delete(ws);
    userToWs.delete(username);

    for (const [room, users] of roomToUsers.entries()) {
        if (users.has(username)) {
            users.delete(username);
        }
    }
}

// Create WebSocket server
const wss = new WebSocket.Server({ port: WS_PORT });

console.log(`WebSocket server running on ws://localhost:${WS_PORT}`);

wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');

    // Create a connection to the C++ server
    const tcpClient = new net.Socket();
    let tcpBuffer = '';

    tcpClient.connect(TCP_PORT, TCP_HOST, () => {
        console.log('Connected to C++ server');
    });

    // Forward WebSocket messages to TCP server
    ws.on('message', (message) => {
        const text = message.toString();
        // console.log('Received from WebSocket client:', text); // Verbose logging

        // --- SNOOPING & INTERCEPTION START ---

        // 0. AUTHENTICATION COMMANDS
        if (text.startsWith('SIGNUP|')) {
            const parts = text.split('|');
            const user = parts[1];
            const pass = parts[2];
            if (!user || !pass) {
                ws.send('ERROR||Username and password required');
            } else if (usersDb[user]) {
                ws.send('ERROR||Username already taken');
            } else {
                const id = generateId();
                usersDb[user] = { password: pass, id };
                idToUser[id] = user;
                saveUsers();
                ws.send(`SIGNUP_SUCCESS|${user}|${id}`);
            }
            return;
        }

        if (text.startsWith('LOGIN|')) {
            const parts = text.split('|');
            const user = parts[1];
            const pass = parts[2];

            if (!usersDb[user] || usersDb[user].password !== pass) {
                ws.send('ERROR||Invalid username or password');
            } else {
                const id = usersDb[user].id;
                // Pre-map user
                userToWs.set(user, ws);
                wsToUser.set(ws, user);

                // Establish C++ session
                tcpClient.write(`HELLO|${user}\n`);

                ws.send(`LOGIN_SUCCESS|${user}|${id}`);
            }
            return;
        }

        if (text.startsWith('FIND_USER|')) {
            const parts = text.split('|');
            const searchId = parts[1];
            const foundUser = idToUser[searchId];
            if (foundUser) {
                ws.send(`USER_FOUND|${searchId}|${foundUser}`);
            } else {
                ws.send(`ERROR||User with ID ${searchId} not found`);
            }
            return;
        }

        // 1. Check for FILE commands (intercept and handle locally)
        // Format: FILE|type|target|filename|base64
        // type: 'dm' or 'room'
        if (text.startsWith('FILE|')) {
            const parts = text.split('|');
            if (parts.length >= 5) {
                const type = parts[1];
                const target = parts[2];
                const filename = parts[3];
                // Rejoin the rest as data (in case base64 has pipes, though unlikely)
                const data = parts.slice(4).join('|');
                const sender = wsToUser.get(ws);

                if (!sender) {
                    ws.send('ERROR||You must be logged in to share files');
                    return;
                }

                if (type === 'dm') {
                    const targetWs = userToWs.get(target);
                    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                        // Protocol: FILE_FROM|sender|filename|base64
                        targetWs.send(`FILE_FROM|${sender}|${filename}|${data}`);
                    } else {
                        ws.send(`ERROR||User ${target} not found or offline`);
                    }
                } else if (type === 'room') {
                    const users = roomToUsers.get(target);
                    if (users) {
                        // Protocol: ROOM_FILE_FROM|room|sender|filename|base64
                        const payload = `ROOM_FILE_FROM|${target}|${sender}|${filename}|${data}`;
                        for (const u of users) {
                            // Don't send back to sender (optional, but usually good to avoid echo if UI handles it)
                            if (u === sender) continue;

                            const targetWs = userToWs.get(u);
                            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                                targetWs.send(payload);
                            }
                        }
                    } else {
                        ws.send(`ERROR||Room ${target} not found`);
                    }
                }
            }
            // DO NOT forward FILE commands to C++ server
            return;
        }


        // 2. Snoop HELLO to track user
        if (text.startsWith('HELLO|')) {
            const parts = text.split('|');
            const username = parts[1];
            if (username) {
                // If user already exists, we might want to handle kick or error, 
                // but let's just update the socket mapping for now or let C++ handle the error response.
                // We'll trust C++ to validate. IF C++ accepts, we map.
                // Actually, we should map conservatively.
                // Let's optimistic map, if C++ errors, we'll get 'ERROR' back (but we don't snoop responses easily for logic).
                // Simplest: Just map it.
                userToWs.set(username, ws);
                wsToUser.set(ws, username);
            }
        }

        // 3. Snoop JOIN to track rooms
        if (text.startsWith('JOIN|')) {
            const parts = text.split('|');
            const room = parts[1];
            const username = wsToUser.get(ws);
            if (room && username) {
                if (!roomToUsers.has(room)) {
                    roomToUsers.set(room, new Set());
                }
                roomToUsers.get(room).add(username);
            }
        }

        // 4. Snoop LEAVE
        if (text.startsWith('LEAVE|')) {
            const parts = text.split('|');
            const room = parts[1];
            const username = wsToUser.get(ws);
            if (room && username && roomToUsers.has(room)) {
                roomToUsers.get(room).delete(username);
            }
        }

        // --- SNOOPING END ---

        const out = text.endsWith('\n') ? text : (text + '\n');
        tcpClient.write(out);
    });

    // Forward TCP server responses to WebSocket client
    tcpClient.on('data', (data) => {
        const chunk = data.toString();
        // console.log('Received from TCP server:', chunk);
        tcpBuffer += chunk;

        while (true) {
            const idx = tcpBuffer.indexOf('\n');
            if (idx === -1) break;
            const line = tcpBuffer.slice(0, idx).replace(/\r$/, '');
            tcpBuffer = tcpBuffer.slice(idx + 1);

            if (line.length > 0) {
                ws.send(line);

                // Optional: Snoop disconnects/errors if needed, but client handling is cleaner.
            }
        }
    });

    // Handle disconnections
    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        cleanupUser(ws);
        tcpClient.end();
    });

    tcpClient.on('close', () => {
        console.log('Disconnected from C++ server');
        ws.close();
    });

    tcpClient.on('error', (err) => {
        console.error('TCP Client Error:', err);
        ws.close();
    });

    ws.on('error', (err) => {
        console.error('WebSocket Error:', err);
        tcpClient.end();
    });
});

console.log(`Forwarding WebSocket traffic to TCP ${TCP_HOST}:${TCP_PORT}`);
