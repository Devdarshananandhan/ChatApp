import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
} from '@mui/material';

interface ConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: (server: string, port: string, username: string) => void;
  initialServer?: string;
  initialPort?: string;
  initialUsername?: string;
}

const ConnectionDialog: React.FC<ConnectionDialogProps> = ({
  open,
  onClose,
  onConnect,
  initialServer = 'localhost',
  initialPort = '3001',
  initialUsername = `User${Math.floor(Math.random() * 1000)}`,
}) => {
  const [server, setServer] = useState(initialServer);
  const [port, setPort] = useState(initialPort);
  const [username, setUsername] = useState(initialUsername);

  const handleConnect = () => {
    onConnect(server, port, username);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Connect to Server</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2, mb: 3 }}>
          <TextField
            autoFocus
            margin="dense"
            id="username"
            label="Your Name"
            type="text"
            fullWidth
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            sx={{ mb: 2 }}
          />
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              margin="dense"
              id="server"
              label="Server"
              type="text"
              fullWidth
              variant="outlined"
              value={server}
              onChange={(e) => setServer(e.target.value)}
            />
            <TextField
              margin="dense"
              id="port"
              label="Port"
              type="number"
              variant="outlined"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              sx={{ width: '120px' }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleConnect} 
          variant="contained" 
          color="primary"
          disabled={!server || !port || !username}
        >
          Connect
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConnectionDialog;
