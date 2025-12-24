import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { v4 as uuidv4 } from 'uuid';
import { ChatTarget, Message } from './types';
import Chat from './components/Chat';
import Auth from './components/Auth';

// Create a theme instance
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
    },
  },
});

const App: React.FC = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, Message[]>>({});
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [serverAddress, setServerAddress] = useState('localhost');
  const [serverPort, setServerPort] = useState('3001'); // Default to WebSocket server port

  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [users, setUsers] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [activeTarget, setActiveTarget] = useState<ChatTarget | null>(null);
  const usernameRef = useRef(username);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  const chatKeyForTarget = useCallback((target: ChatTarget | null) => {
    if (!target) return 'system';
    if (target.type === 'dm') {
      const a = usernameRef.current;
      const b = target.user;
      const first = a < b ? a : b;
      const second = a < b ? b : a;
      return `dm:${first}:${second}`;
    }
    return `room:${target.room}`;
  }, []);

  const pushMessage = useCallback((target: ChatTarget | null, msg: Omit<Message, 'id'>) => {
    const key = chatKeyForTarget(target);
    setMessagesByChat(prev => {
      const next = { ...prev };
      const arr = next[key] ? [...next[key]] : [];
      arr.push({ ...msg, id: uuidv4() });
      next[key] = arr;
      return next;
    });
  }, [chatKeyForTarget]);

  const parseLine = useCallback((line: string) => {
    const parts = line.split('|');
    const cmd = parts[0] || '';
    const a = parts[1] || '';
    const b = parts[2] || '';

    if (cmd === 'WELCOME') {
      // Handled by LOGIN_SUCCESS usually, but keep for legacy
      return;
    }

    if (cmd === 'LOGIN_SUCCESS') {
      // Redundant if we handle it in auth flow, but good for confirmation
      pushMessage(null, { text: `Logged in as ${a} (ID: ${b})`, sender: 'server', timestamp: new Date() });
      return;
    }

    if (cmd === 'USERS') {
      const list = a ? a.split(',').filter(Boolean) : [];
      setUsers(list);
      return;
    }

    if (cmd === 'ROOMS') {
      const list = a ? a.split(',').filter(Boolean) : [];
      setRooms(list);
      return;
    }

    if (cmd === 'FROM') {
      const from = a;
      const text = b;
      const target: ChatTarget = { type: 'dm', user: from };
      pushMessage(target, { text, sender: 'server', from, timestamp: new Date() });
      return;
    }

    if (cmd === 'ROOMFROM') {
      const room = a;
      const text = b;
      const target: ChatTarget = { type: 'room', room };
      pushMessage(target, { text, sender: 'server', room, timestamp: new Date() });
      return;
    }

    if (cmd === 'FILE_FROM') {
      const from = a;
      const filename = b;
      const fileData = parts.slice(3).join('|');
      const target: ChatTarget = { type: 'dm', user: from };
      pushMessage(target, { text: '', sender: 'server', from, filename, fileData, timestamp: new Date() });
      return;
    }

    if (cmd === 'ROOM_FILE_FROM') {
      const room = a;
      const from = b;
      const filename = parts[3];
      const fileData = parts.slice(4).join('|');
      const target: ChatTarget = { type: 'room', room };
      pushMessage(target, { text: '', sender: 'server', room, from, filename, fileData, timestamp: new Date() });
      return;
    }

    if (cmd === 'INFO') {
      pushMessage(null, { text: b || a, sender: 'server', timestamp: new Date() });
      return;
    }

    if (cmd === 'ERROR') {
      pushMessage(null, { text: b || a || 'Error', sender: 'server', timestamp: new Date() });
      return;
    }

    if (line.trim().length) {
      pushMessage(null, { text: line, sender: 'server', timestamp: new Date() });
    }
  }, [pushMessage]);

  // Function to connect to WebSocket server
  const connectToServer = useCallback((address: string, port: string, user: string) => {
    // Use WebSocket server (default to localhost:3001 if not specified)
    const wsUrl = `ws://${address || 'localhost'}:${port || '3001'}`;
    setServerAddress(address || 'localhost');
    setServerPort(port || '3001');
    setUsername(user);

    setIsConnecting(true);
    setConnectionError(null);

    if (socket) {
      try {
        socket.close();
      } catch {
        // ignore
      }
      setSocket(null);
    }

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Connected to WebSocket server');
        setSocket(ws);
        setIsConnected(true);
        setIsConnecting(false);

        setUsers([]);
        setRooms([]);
        setActiveTarget(null);
        setMessagesByChat({});

        pushMessage(null, { text: `Connected to ${wsUrl}`, sender: 'server', timestamp: new Date() });

        ws.send(`HELLO|${user}`);
        ws.send('LIST||');
      };

      ws.onmessage = (event: MessageEvent) => {
        const data = typeof event.data === 'string' ? event.data : '';
        parseLine(data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Failed to connect to the WebSocket server. Make sure the WebSocket server is running.');
        setIsConnecting(false);
      };

      ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
        const wasConnected = isConnected;
        setIsConnected(false);
        setSocket(null);

        // Only show disconnection message if we were previously connected
        if (wasConnected) {
          pushMessage(null, { text: 'Disconnected from server', sender: 'server', timestamp: new Date() });
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionError('Failed to create WebSocket connection. The server might be down.');
      setIsConnecting(false);
    }
  }, [isConnected, socket, parseLine, pushMessage]);

  // Function to send a message
  const sendMessage = useCallback((text: string) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    if (!activeTarget) {
      pushMessage(null, { text: 'Select a user or a group first', sender: 'server', timestamp: new Date() });
      return;
    }

    try {
      if (activeTarget.type === 'dm') {
        socket.send(`MSG|${activeTarget.user}|${text}`);
        pushMessage(activeTarget, { text, sender: 'user', to: activeTarget.user, timestamp: new Date() });
      } else {
        socket.send(`ROOMMSG|${activeTarget.room}|${text}`);
        pushMessage(activeTarget, { text, sender: 'user', room: activeTarget.room, timestamp: new Date() });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setConnectionError('Failed to send message. Please try again.');
    }
  }, [socket, activeTarget, pushMessage]);

  const activeTargetRef = useRef(activeTarget);
  useEffect(() => { activeTargetRef.current = activeTarget; }, [activeTarget]);

  const sendFile = useCallback((file: File) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const target = activeTargetRef.current; // Use ref to get current value in async callback if needed, though here we read activeTarget from closure if we add it to deps.

    // Better to use activeTarget from props if we add it to dependency, but file reading is async.
    // Let's use the current 'activeTarget' from the scope, and ensure it's in dependency.

    if (!target) {
      pushMessage(null, { text: 'Select a user or a group first', sender: 'server', timestamp: new Date() });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Protocol: FILE|type|target|filename|base64
      // type: 'dm' or 'room'
      // target: username or roomname
      try {
        if (target.type === 'dm') {
          socket.send(`FILE|dm|${target.user}|${file.name}|${result}`);
          // Show locally
          pushMessage(target, { text: '', sender: 'user', to: target.user, filename: file.name, fileData: result, timestamp: new Date() });
        } else {
          socket.send(`FILE|room|${target.room}|${file.name}|${result}`);
          pushMessage(target, { text: '', sender: 'user', room: target.room, filename: file.name, fileData: result, timestamp: new Date() });
        }
      } catch (error) {
        console.error('Error sending file:', error);
        setConnectionError('Failed to send file.');
      }
    };
    reader.readAsDataURL(file);
  }, [socket, activeTarget, pushMessage]);

  const selectUser = useCallback((user: string) => {
    setActiveTarget({ type: 'dm', user });
  }, []);

  const selectRoom = useCallback((room: string) => {
    setActiveTarget({ type: 'room', room });
  }, []);

  const joinRoom = useCallback((room: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(`JOIN|${room}|`);
      setActiveTarget({ type: 'room', room });
    }
  }, [socket]);

  // Function to disconnect from the server
  const disconnectFromServer = useCallback(() => {
    if (socket) {
      try {
        socket.send('EXIT||');
      } catch {
        // ignore
      }
      socket.close();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);

  // Show connection error if any
  useEffect(() => {
    if (connectionError) {
      console.error(connectionError);
      // You could show a toast notification here
    }
  }, [connectionError]);

  const handleLogin = (user: string, id: string) => {
    setUsername(user);
    setUserId(id);
    setIsLoggedIn(true);
    connectToServer(serverAddress, serverPort, user);
  };

  if (!isLoggedIn) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Auth
          onLogin={handleLogin}
          serverAddress={serverAddress}
          serverPort={serverPort}
          setServerConfig={(addr, port) => { setServerAddress(addr); setServerPort(port); }}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Chat
        onConnect={() => { }} // Disabled in chat view as we are already connected
        onDisconnect={disconnectFromServer}
        messages={messagesByChat[chatKeyForTarget(activeTarget)] || []}
        sendMessage={sendMessage}
        isConnected={isConnected}
        serverAddress={serverAddress}
        serverPort={serverPort}
        username={username}
        userId={userId}
        connectionError={connectionError || undefined}
        isConnecting={isConnecting}
        users={users}
        rooms={rooms}
        activeChatLabel={
          !activeTarget
            ? ''
            : (activeTarget.type === 'dm' ? `Chat with ${activeTarget.user}` : `Group: ${activeTarget.room}`)
        }
        onSelectUser={selectUser}
        onSelectRoom={selectRoom}
        onJoinRoom={joinRoom}
        onSendFile={sendFile}
        onFindUser={(id) => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(`FIND_USER|${id}`);
          }
        }}
      />
    </ThemeProvider>
  );
};

export default App;
