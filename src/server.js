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

const MOCK_SEARCH_RESULTS = [
    { id: 'mock1', title: 'WAP', artist: 'Cardi B', album: 'WAP', coverArt: 'https://i.scdn.co/image/ab67616d0000b2734f49d8053744f4753088b941', duration_ms: 187000, explicit: true, videoId: 'hsm4poTWjMs' },
    { id: 'mock2', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', coverArt: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36', duration_ms: 200000, explicit: false, videoId: '4NRXx6U8ABQ' },
    { id: 'mock3', title: 'Shape of You', artist: 'Ed Sheeran', album: '÷', coverArt: 'https://i.scdn.co/image/ab67616d0000b273b707d7cf43a5def255745853', duration_ms: 233000, explicit: false, videoId: 'kJQP7kiw5Fk' },
    { id: 'mock4', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', coverArt: 'https://i.scdn.co/image/ab67616d0000b273e33362631759865744c85473', duration_ms: 355000, explicit: false, videoId: 'fJ9rUzIMcZQ' },
    { id: 'mock5', title: 'Hotel California', artist: 'Eagles', album: 'Hotel California', coverArt: 'https://i.scdn.co/image/ab67616d0000b2730656025894e65839012957a1', duration_ms: 390000, explicit: false, videoId: '098391Gim-A' },
    { id: 'mock6', title: 'Stairway to Heaven', artist: 'Led Zeppelin', album: 'Led Zeppelin IV', coverArt: 'https://i.scdn.co/image/ab67616d0000b273b5a536675a549454178553f7', duration_ms: 482000, explicit: false, videoId: 'QkF3oxziUI4' },
];

const MOCK_LYRICS = {
    "WAP": {
        synced: [
            { timestamp: 1000, text: "Whores in this house" },
            { timestamp: 3000, text: "There's some whores in this house" },
            { timestamp: 5000, text: "There's some whores in this house" },
            { timestamp: 7000, text: "There's some whores in this house" },
        ],
        unsynced: "Whores in this house\nThere's some whores in this house\nThere's some whores in this house\nThere's some whores in this house"
    }
};

app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).send({ error: 'Query "q" is required.' });
  try {
    const tracks = await searchTracks(query);
    res.json(tracks);
  } catch (error) {
    console.error("Spotify API failed, returning mock data. Error:", error.message);
    const filteredTracks = MOCK_SEARCH_RESULTS.filter(t =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.artist.toLowerCase().includes(query.toLowerCase())
    );
    res.json(filteredTracks);
  }
});

app.get('/lyrics', async (req, res) => {
  const { artist_name, track_name } = req.query;
  if (!artist_name || !track_name) {
    return res.status(400).send({ error: 'artist_name and track_name are required.' });
  }

  // --- MOCK DATA FOR VERIFICATION ---
  if (MOCK_LYRICS[track_name]) {
      console.log(`Returning mock lyrics for ${track_name}`);
      return res.json({ type: 'synced', lyrics: MOCK_LYRICS[track_name].synced });
  }
  // --- END MOCK DATA ---

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

  socket.on('admin-reorder-queue', (newOrder) => {
    // Create a map for quick lookups
    const queueMap = new Map(queue.map(song => [song.timestamp, song]));
    // Re-create the queue array based on the new order of timestamps
    const reorderedQueue = newOrder.map(timestamp => queueMap.get(timestamp)).filter(Boolean);

    if (reorderedQueue.length === queue.length) {
        queue = reorderedQueue;
        broadcastQueueUpdate();
        console.log('Queue reordered.');
    } else {
        console.error('Queue reorder failed: Mismatch in items.');
    }
  });

  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// --- Server Startup ---
server.listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  // Initial call to get a token, but don't let it crash the server if it fails
  try {
      await searchTracks('initial call to get token');
  } catch (error) {
      console.error("Initial Spotify auth failed, server will run with mock data fallback:", error.message);
  }
});
