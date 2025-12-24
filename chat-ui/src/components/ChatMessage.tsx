import React from 'react';
import { Message } from '../types';
import { Box, Typography, Paper, useTheme } from '@mui/material';
import { format } from 'date-fns';

interface ChatMessageProps {
  message: Message;
  isCurrentUser: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isCurrentUser }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
        mb: 2,
        width: '100%',
      }}
    >
      <Paper
        elevation={2}
        sx={{
          p: 2,
          maxWidth: '70%',
          backgroundColor: isCurrentUser
            ? theme.palette.primary.main
            : theme.palette.grey[200],
          color: isCurrentUser ? 'white' : 'text.primary',
          borderRadius: 2,
          borderTopLeftRadius: isCurrentUser ? 8 : 2,
          borderTopRightRadius: isCurrentUser ? 2 : 8,
          wordBreak: 'break-word',
        }}
      >
        <Typography variant="body2" color={isCurrentUser ? 'white' : 'text.secondary'} gutterBottom>
          {message.sender === 'user' ? 'You' : (message.from || 'Server')} • {format(new Date(message.timestamp), 'HH:mm')}
        </Typography>
        {message.text && (
          <Typography variant="body1">
            {message.text}
          </Typography>
        )}
        {message.filename && message.fileData && (
          <Box sx={{ mt: 1 }}>
            {message.fileData.startsWith('data:image') ? (
              <Box>
                <img
                  src={message.fileData}
                  alt={message.filename}
                  style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 200 }}
                />
                <Typography variant="caption" display="block">{message.filename}</Typography>
              </Box>
            ) : (
              <a
                href={message.fileData}
                download={message.filename}
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                Download {message.filename}
              </a>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ChatMessage;
