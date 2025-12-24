import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  Button,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatMessage from './ChatMessage';
import ConnectionDialog from './ConnectionDialog';
import { Message } from '../types';

interface ChatProps {
  onConnect: (server: string, port: string, username: string) => void;
  onDisconnect: () => void;
  messages: Message[];
  sendMessage: (message: string) => void;
  isConnected: boolean;
  serverAddress: string;
  serverPort: string;
  username: string;
  connectionError?: string;
  isConnecting: boolean;
  users: string[];
  rooms: string[];
  activeChatLabel: string;
  onSelectUser: (user: string) => void;
  onSelectRoom: (room: string) => void;
  onJoinRoom: (room: string) => void;
  onSendFile: (file: File) => void;
  userId: string;
  onFindUser: (id: string) => void;
}

const Chat: React.FC<ChatProps> = ({
  onConnect,
  onDisconnect,
  messages,
  sendMessage,
  isConnected,
  serverAddress,
  serverPort,
  username,
  userId,
  connectionError,
  isConnecting,
  users,
  rooms,
  activeChatLabel,
  onSelectUser,
  onSelectRoom,
  onJoinRoom,
  onSendFile,
  onFindUser,
}) => {
  const [message, setMessage] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [roomName, setRoomName] = useState('');

  const handleSendMessage = () => {
    if (message.trim() && isConnected) {
      sendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show connection error if any
  useEffect(() => {
    if (connectionError) {
      console.error('Connection error:', connectionError);
    }
  }, [connectionError]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Chat App
          </Typography>
          <Typography variant="subtitle2" sx={{ mr: 2, opacity: 0.8 }}>
            {isConnected
              ? `Connected to ${serverAddress}:${serverPort} as ${username}`
              : 'Disconnected'}
          </Typography>
          {isConnected && (
            <Typography variant="subtitle2" sx={{ mr: 2, opacity: 0.9 }}>
              {activeChatLabel}
            </Typography>
          )}
          <IconButton
            color="inherit"
            onClick={() => setIsSettingsOpen(true)}
            size="large"
          >
            <SettingsIcon />
          </IconButton>
          {isConnected && (
            <Button
              color="inherit"
              onClick={onDisconnect}
              sx={{ ml: 1 }}
            >
              Disconnect
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
        <Box
          sx={{
            width: 280,
            borderRight: (theme) => `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
            p: 2,
            overflowY: 'auto',
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              My ID: <span style={{ fontWeight: 'bold', color: '#1976d2' }}>{userId}</span>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small"
              placeholder="Find by ID"
              id="find-user-input"
              fullWidth
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                const el = document.getElementById('find-user-input') as HTMLInputElement;
                if (el && el.value) onFindUser(el.value);
              }}
            >
              Add
            </Button>
          </Box>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Users
          </Typography>
          {users.filter(u => u !== username).map((u) => (
            <Button
              key={u}
              fullWidth
              variant="outlined"
              onClick={() => onSelectUser(u)}
              sx={{ mb: 1, justifyContent: 'flex-start' }}
              disabled={!isConnected}
            >
              {u}
            </Button>
          ))}

          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
            Groups
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small"
              placeholder="Room name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              fullWidth
              disabled={!isConnected}
            />
            <Button
              variant="contained"
              onClick={() => {
                if (roomName.trim()) {
                  onJoinRoom(roomName.trim());
                  setRoomName('');
                }
              }}
              disabled={!isConnected || !roomName.trim()}
            >
              Join
            </Button>
          </Box>

          {rooms.map((r) => (
            <Button
              key={r}
              fullWidth
              variant="outlined"
              onClick={() => onSelectRoom(r)}
              sx={{ mb: 1, justifyContent: 'flex-start' }}
              disabled={!isConnected}
            >
              {r}
            </Button>
          ))}
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            overflowY: 'auto',
            p: 2,
            bgcolor: 'background.paper',
          }}
        >
          {messages.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                color: 'text.secondary',
                p: 4,
              }}
            >
              <Typography variant="h6" gutterBottom>
                {isConnected
                  ? 'Select a user or join a group to start chatting'
                  : 'Connect to a server to start chatting'}
              </Typography>
              {!isConnected && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setIsSettingsOpen(true)}
                  sx={{ mt: 2 }}
                >
                  Connect to Server
                </Button>
              )}
            </Box>
          ) : (
            messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isCurrentUser={msg.sender === 'user'}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </Box>
      </Box>

      <Paper
        component="form"
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'background.paper',
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
        elevation={3}
      >
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={!isConnected || isConnecting}
          multiline
          maxRows={4}
          InputProps={{
            sx: { borderRadius: 4 },
            endAdornment: (
              <InputAdornment position="end">
                {isConnecting ? (
                  <CircularProgress size={24} />
                ) : (
                  <>
                    <input
                      type="file"
                      id="file-input"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          onSendFile(e.target.files[0]);
                          e.target.value = ''; // Reset
                        }
                      }}
                    />
                    <IconButton
                      color="primary"
                      onClick={() => document.getElementById('file-input')?.click()}
                      disabled={!isConnected}
                    >
                      <AttachFileIcon />
                    </IconButton>
                    <IconButton
                      color="primary"
                      onClick={handleSendMessage}
                      disabled={!message.trim() || !isConnected}
                    >
                      <SendIcon />
                    </IconButton>
                  </>
                )}
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <ConnectionDialog
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConnect={(server, port, username) => {
          onConnect(server, port, username);
          setIsSettingsOpen(false);
        }}
        initialServer={serverAddress}
        initialPort={serverPort}
        initialUsername={username}
      />
    </Box>
  );
};

export default Chat;
