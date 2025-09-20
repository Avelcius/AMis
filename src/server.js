require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const { searchTracks } = require('./spotify');
const { findVideo } = require('./youtube');
const { Client } = require('lrclib-api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

// --- In-memory data store ---
let currentlyPlaying = null;
let queue = [];

// --- Core Functions ---
const broadcastQueueUpdate = () => {
  io.emit('queue-updated', { queue, currentlyPlaying });
};

const playNextSong = () => {
    if (queue.length > 0) {
        currentlyPlaying = queue.shift();
    } else {
        currentlyPlaying = null;
    }
    broadcastQueueUpdate();
};

// --- Middleware & Routes ---
app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'controller.html')));
app.get('/display', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'display.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

app.post('/admin/auth', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.status(200).json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).send({ error: 'Query "q" is required.' });
  try {
    const tracks = await searchTracks(query);
    res.json(tracks);
  } catch (error) {
    res.status(500).send({ error: 'Failed to search tracks.' });
  }
});

app.get('/lyrics', async (req, res) => {
  const { artist_name, track_name } = req.query;
  if (!artist_name || !track_name) {
    return res.status(400).send({ error: 'artist_name and track_name are required.' });
  }

  const client = new Client();
  try {
    // First, try to get synchronized lyrics
    const synced = await client.getSynced({ artist_name, track_name });
    if (synced && synced.length > 0) {
      console.log(`Found synced lyrics for ${track_name}`);
      return res.json({ type: 'synced', lyrics: synced });
    }

    // If not found, fall back to unsynchronized lyrics
    const unsynced = await client.getUnsynced({ artist_name, track_name });
    if (unsynced && unsynced.length > 0) {
      console.log(`Found unsynced lyrics for ${track_name}`);
      return res.json({ type: 'unsynced', lyrics: unsynced });
    }

    // If still nothing, return 404
    console.log(`No lyrics found for ${track_name}`);
    res.status(404).send({ error: 'Lyrics not found.' });

  } catch (error) {
    console.error('Error fetching lyrics:', error);
    res.status(500).send({ error: 'Failed to fetch lyrics.' });
  }
});

// --- Socket.IO Logic ---
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.emit('queue-updated', { queue, currentlyPlaying });

  socket.on('add-song', async (song) => {
    if (!song || !song.id || !song.title) return;

    // Pass duration to findVideo for more accurate matching
    const video = await findVideo(song.title, song.artist, song.duration_ms);

    const songWithVideo = { ...song, videoId: video ? video.id : null, timestamp: Date.now() };
    queue.push(songWithVideo);
    if (!currentlyPlaying) playNextSong();
    else broadcastQueueUpdate();
  });

  socket.on('song-ended', playNextSong);

  socket.on('player-state-change', (state) => {
    // Broadcast the raw state to any client that cares (e.g., admin panel)
    io.emit('admin-status-update', state);
  });

  // Admin controls
  socket.on('admin-skip-song', playNextSong);
  socket.on('admin-remove-song', (songTimestamp) => {
    queue = queue.filter(s => s.timestamp !== songTimestamp);
    broadcastQueueUpdate();
  });
  socket.on('admin-toggle-pause', () => {
    io.emit('player-control', { action: 'togglePause' });
  });
  socket.on('admin-set-volume', (volume) => {
    io.emit('player-set-volume', volume);
  });
  socket.on('admin-force-reload', () => {
    io.emit('player-force-reload');
  });

  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// --- Server Startup ---
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  searchTracks('initial call to get token');
});
