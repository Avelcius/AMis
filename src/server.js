require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const { searchTracks } = require('./spotify');
const { findVideo } = require('./youtube');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'supersecret';

// In-memory data store
let currentlyPlaying = null;
let queue = [];
let adminSocketId = null;

// --- Core Functions ---

const broadcastQueueUpdate = () => {
    io.emit('queue-updated', { queue, currentlyPlaying });
};

const playNextSong = async () => {
    if (queue.length > 0) {
        currentlyPlaying = queue.shift();
        try {
            const video = await findVideo(currentlyPlaying.title, currentlyPlaying.artist, currentlyPlaying.duration_ms);
            if (video && video.id) {
                currentlyPlaying.videoId = video.id;
                currentlyPlaying.youtubeTitle = video.title;
                console.log(`Now playing: ${currentlyPlaying.title} - ${currentlyPlaying.artist} (YT: ${video.title})`);
            } else {
                console.log(`No YouTube video found for ${currentlyPlaying.title}, skipping.`);
                playNextSong(); // Skip to the next song
                return;
            }
        } catch (error) {
            console.error(`Error finding video for ${currentlyPlaying.title}:`, error);
            playNextSong(); // Skip to the next song
            return;
        }
    } else {
        currentlyPlaying = null;
        console.log('Queue is empty. Music stopped.');
    }
    broadcastQueueUpdate();
};

// --- Middleware & Routes ---
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'controller.html'));
});

app.get('/display', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'display.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.post('/admin/auth', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

app.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required.' });
    }
    try {
        const results = await searchTracks(q);
        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search tracks' });
    }
});

// --- Socket.IO Logic ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send initial state to the new client
    socket.emit('queue-updated', { queue, currentlyPlaying });

    socket.on('add-song', async (song) => {
        const newSong = { ...song, timestamp: Date.now() };
        console.log(`Song added by ${newSong.addedBy}: ${newSong.title}`);
        queue.push(newSong);

        if (!currentlyPlaying) {
            await playNextSong();
        } else {
            broadcastQueueUpdate();
        }
    });

    socket.on('song-ended', () => {
        console.log('Song ended, playing next.');
        playNextSong();
    });

    socket.on('admin-login', (password) => {
        if (password === ADMIN_PASSWORD) {
            adminSocketId = socket.id;
            socket.emit('admin-auth-success');
            console.log('Admin connected:', socket.id);
        } else {
            socket.emit('admin-auth-fail');
        }
    });

    socket.on('admin-skip-song', () => {
        if (socket.id === adminSocketId) {
            console.log('Admin skipped song');
            playNextSong();
        }
    });

    socket.on('admin-remove-song', (songTimestamp) => {
        if (socket.id === adminSocketId) {
            console.log('Admin removed song with timestamp:', songTimestamp);
            queue = queue.filter(s => s.timestamp !== songTimestamp);
            broadcastQueueUpdate();
        }
    });

    socket.on('admin-toggle-pause', () => {
        if (socket.id === adminSocketId) {
            io.emit('player-control', { action: 'togglePause' });
        }
    });

    socket.on('admin-set-volume', (volume) => {
        if (socket.id === adminSocketId) {
            io.emit('player-set-volume', volume);
        }
    });

    socket.on('admin-force-reload', () => {
        if (socket.id === adminSocketId) {
            console.log('Admin forced reload of display client');
            io.emit('player-force-reload');
        }
    });

    socket.on('player-state-change', (state) => {
        // Relay player state to admin
        if(adminSocketId) {
            io.to(adminSocketId).emit('admin-status-update', state);
        }
    });


    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.id === adminSocketId) {
            adminSocketId = null;
            console.log('Admin disconnected');
        }
    });
});

// --- Server Startup ---
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
