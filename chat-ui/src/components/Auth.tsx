import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Tabs,
    Tab,
    Alert,
    CircularProgress
} from '@mui/material';

interface AuthProps {
    onLogin: (username: string, id: string) => void;
    serverAddress: string;
    serverPort: string;
    setServerConfig: (addr: string, port: string) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, serverAddress, serverPort, setServerConfig }) => {
    const [tab, setTab] = useState(0); // 0 = Login, 1 = Signup
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // We need a temporary socket to perform auth
    // In a real app, this might be an HTTP request, but here we use the WebSocket
    const performAuth = (isSignup: boolean) => {
        setError(null);
        setLoading(true);

        const wsUrl = `ws://${serverAddress}:${serverPort}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            const cmd = isSignup ? 'SIGNUP' : 'LOGIN';
            ws.send(`${cmd}|${username}|${password}`);
        };

        ws.onmessage = (event) => {
            const text = event.data.toString();
            if (text.startsWith('ERROR|')) {
                setError(text.split('|')[2] || 'Unknown error');
                setLoading(false);
                ws.close();
            } else if (text.startsWith('LOGIN_SUCCESS|') || text.startsWith('SIGNUP_SUCCESS|')) {
                const parts = text.split('|');
                const user = parts[1];
                const id = parts[2];
                ws.close(); // Close temp socket, App.tsx will open the persistent one
                onLogin(user, id);
            }
        };

        ws.onerror = () => {
            setError('Failed to connect to authentication server');
            setLoading(false);
        };

        ws.onclose = () => {
            // If we didn't succeed and it closed unexpected
            if (loading) {
                // It might have succeeded and closed in onmessage, but if loading is still true here without success:
                // Actually onmessage close happens after success logic. 
                // Let's rely on state.
            }
        };
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) return;
        performAuth(tab === 1);
    };

    return (
        <Box
            sx={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
        >
            <Paper
                elevation={10}
                sx={{
                    p: 4,
                    width: '100%',
                    maxWidth: 400,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                }}
            >
                <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold', color: '#333' }}>
                    Welcome
                </Typography>
                <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
                    Connect with friends securely
                </Typography>

                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    variant="fullWidth"
                    sx={{ mb: 3 }}
                >
                    <Tab label="Login" />
                    <Tab label="Sign Up" />
                </Tabs>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <form onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        label="Username"
                        variant="outlined"
                        margin="normal"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                    />
                    <TextField
                        fullWidth
                        label="Password"
                        type="password"
                        variant="outlined"
                        margin="normal"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                    />

                    <Box sx={{ mt: 2, mb: 2 }}>
                        <Button
                            variant="text"
                            size="small"
                            onClick={() => setShowSettings(!showSettings)}
                            sx={{ textTransform: 'none', color: 'text.secondary', textDecoration: 'underline' }}
                        >
                            {showSettings ? 'Hide Server Settings' : `Server: ${serverAddress}:${serverPort}`}
                        </Button>

                        {showSettings && (
                            <Box sx={{ mt: 1, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                                <TextField
                                    fullWidth
                                    label="Server Address"
                                    variant="outlined"
                                    size="small"
                                    margin="dense"
                                    value={serverAddress}
                                    onChange={(e) => setServerConfig(e.target.value, serverPort)}
                                />
                                <TextField
                                    fullWidth
                                    label="Port"
                                    variant="outlined"
                                    size="small"
                                    margin="dense"
                                    value={serverPort}
                                    onChange={(e) => setServerConfig(serverAddress, e.target.value)}
                                />
                            </Box>
                        )}
                    </Box>

                    <Button
                        fullWidth
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={loading || !username || !password}
                        sx={{
                            mt: 2,
                            mb: 2,
                            background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                            boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                        }}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : (tab === 0 ? 'Login' : 'Sign Up')}
                    </Button>
                </form>
            </Paper>
        </Box>
    );
};

export default Auth;
