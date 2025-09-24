document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM Elements ---
    const coverArtEl = document.getElementById('cover-art');
    const titleEl = document.getElementById('song-title');
    const artistEl = document.getElementById('song-artist');
    const addedByEl = document.getElementById('song-added-by');
    const queueListEl = document.getElementById('queue-list');
    const qrCodeEl = document.getElementById('qrcode');
    const partyUrlEl = document.getElementById('party-url');
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');
    const visualizerCanvas = document.getElementById('visualizer-canvas');
    const karaokeContainerEl = document.getElementById('karaoke-lyrics');
    const currentLineEl = document.getElementById('karaoke-line-current');
    const nextLineEl = document.getElementById('karaoke-line-next');

    // --- State Variables ---
    const placeholderCover = 'https://via.placeholder.com/300/121212/808080?text=+';
    let player;
    let progressTimer;
    let syncedLyrics = [];
    let currentLyricIndex = -1;
    let currentVideoId = null;
    let isPlayerReady = false;
    let pendingData = null;
    let karaokeEnabled = true; // Karaoke is on by default
    let currentSong = null;
    const colorThief = new ColorThief();

    // --- Dynamic Background ---
    const updateBackgroundColor = () => {
        if (coverArtEl.src === placeholderCover || !coverArtEl.complete) {
            visualizerCanvas.style.backgroundColor = '#000';
            return;
        }
        try {
            const dominantColor = colorThief.getColor(coverArtEl);
            const bgColor = `rgb(${dominantColor[0] * 0.4}, ${dominantColor[1] * 0.4}, ${dominantColor[2] * 0.4})`;
            visualizerCanvas.style.backgroundColor = bgColor;
        } catch (e) {
            console.error("ColorThief error:", e);
            visualizerCanvas.style.backgroundColor = '#000';
        }
    };
    coverArtEl.addEventListener('load', updateBackgroundColor);

    // --- YouTube Player ---
    window.onYouTubeIframeAPIReady = () => {
        player = new YT.Player('player', {
            height: '195',
            width: '320',
            playerVars: { 'controls': 0, 'enablejsapi': 1 },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    };

    function onPlayerReady(event) {
        console.log("YouTube Player is ready.");
        isPlayerReady = true;
        if (pendingData) {
            console.log("Playing pending song from onPlayerReady.");
            updateNowPlaying(pendingData.currentlyPlaying);
            updateQueue(pendingData.queue);
            pendingData = null;
        }
    }

    function onPlayerStateChange(event) {
        socket.emit('player-state-change', event.data);
        if (event.data === YT.PlayerState.PLAYING) {
            startProgressTimer();
        } else {
            clearInterval(progressTimer);
        }
        if (event.data === YT.PlayerState.ENDED) {
            currentVideoId = null;
            socket.emit('song-ended');
        }
    }

    // --- Karaoke and Progress ---
    const formatTime = (seconds) => {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${min}:${sec}`;
    };

    const stopProgressTimer = () => {
        clearInterval(progressTimer);
        progressBar.style.width = '0%';
        currentTimeEl.textContent = '0:00';
        totalTimeEl.textContent = '0:00';
    };

    const updateKaraoke = (currentTime) => {
        if (!karaokeEnabled || !syncedLyrics || syncedLyrics.length === 0) return;

        const timeInMs = currentTime * 1000;
        const newLyricIndex = syncedLyrics.findIndex((line, index) => {
            const nextLine = syncedLyrics[index + 1];
            return timeInMs >= line.timestamp && (!nextLine || timeInMs < nextLine.timestamp);
        });

        if (newLyricIndex !== -1 && newLyricIndex !== currentLyricIndex) {
            currentLyricIndex = newLyricIndex;
            currentLineEl.textContent = syncedLyrics[currentLyricIndex]?.text || '';
            nextLineEl.textContent = syncedLyrics[currentLyricIndex + 1]?.text || '';
        }
    };

    const startProgressTimer = () => {
        stopProgressTimer();
        progressTimer = setInterval(() => {
            if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
                const currentTime = player.getCurrentTime();
                const duration = player.getDuration();
                if (duration > 0) {
                    progressBar.style.width = `${(currentTime / duration) * 100}%`;
                    currentTimeEl.textContent = formatTime(currentTime);
                    totalTimeEl.textContent = formatTime(duration);
                    updateKaraoke(currentTime);
                }
            }
        }, 250);
    };

    const fetchAndProcessLyrics = async (song) => {
        syncedLyrics = [];
        currentLyricIndex = -1;
        karaokeContainerEl.classList.add('hidden');
        currentLineEl.textContent = '';
        nextLineEl.textContent = '';

        if (!karaokeEnabled || !song) return;

        try {
            const response = await fetch(`/lyrics?track_name=${encodeURIComponent(song.title)}&artist_name=${encodeURIComponent(song.artist)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.type === 'synced' && data.lyrics && data.lyrics.length > 0) {
                    console.log("Synced lyrics found, preparing for karaoke.");
                    syncedLyrics = data.lyrics.map(line => ({ ...line, timestamp: parseFloat(line.timestamp) }));
                    karaokeContainerEl.classList.remove('hidden');
                } else {
                     console.log("No synced lyrics found for this track.");
                }
            }
        } catch (error) {
            console.error("Could not fetch lyrics for karaoke:", error);
        }
    };

    // --- Main UI Update Functions ---
    const updateNowPlaying = (song) => {
        currentSong = song; // Keep track of the current song object
        if (song && song.videoId) {
            addedByEl.textContent = `Добавил: ${song.addedBy || 'кто-то'}`;
            if (song.videoId !== currentVideoId) {
                currentVideoId = song.videoId;
                titleEl.textContent = song.title;
                artistEl.textContent = song.artist;
                coverArtEl.crossOrigin = "Anonymous";
                coverArtEl.src = song.coverArt || placeholderCover;

                player.loadVideoById(song.videoId);
                player.playVideo();

                fetchAndProcessLyrics(song);
            }
        } else {
            stopProgressTimer();
            currentVideoId = null;
            syncedLyrics = [];
            karaokeContainerEl.classList.add('hidden');
            titleEl.textContent = 'Музыка не играет';
            artistEl.textContent = 'Добавьте песню с вашего устройства';
            addedByEl.textContent = '';
            coverArtEl.src = placeholderCover;
            updateBackgroundColor();
            if (player && typeof player.stopVideo === 'function') {
                player.stopVideo();
            }
        }
    };

    const updateQueue = (queue) => {
        queueListEl.innerHTML = '';
        if (queue.length === 0) {
            queueListEl.innerHTML = '<p class="empty-queue-message">Очередь пуста</p>';
            return;
        }
        queue.forEach(s => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            item.innerHTML = `<img src="${s.coverArt || placeholderCover}" alt="Art"><div class="info"><div class="title">${s.title}</div><div class="artist">${s.artist} (добавил: ${s.addedBy || 'кто-то'})</div></div>`;
            queueListEl.appendChild(item);
        });
    };

    // --- Socket.IO Event Handlers ---
    socket.on('queue-updated', (data) => {
        if (!isPlayerReady) {
            console.log("Player not ready, queueing data.");
            pendingData = data;
            updateQueue(data.queue);
        } else {
            updateNowPlaying(data.currentlyPlaying);
            updateQueue(data.queue);
        }
    });

    socket.on('player-control', ({ action }) => {
        if (!player || !isPlayerReady) return;
        if (action === 'togglePause') {
            const state = player.getPlayerState();
            if (state === YT.PlayerState.PLAYING) player.pauseVideo();
            else player.playVideo();
        }
    });

    socket.on('player-toggle-karaoke', () => {
        karaokeEnabled = !karaokeEnabled;
        console.log(`Karaoke toggled: ${karaokeEnabled}`);
        // Re-process lyrics for current song to show/hide karaoke
        fetchAndProcessLyrics(currentSong);
    });

    socket.on('player-set-volume', (volume) => {
        if (player && isPlayerReady) {
            player.setVolume(volume);
        }
    });

    socket.on('player-force-reload', () => {
        console.log("Force re-initializing player...");
        if (player && typeof player.destroy === 'function') {
            try {
                player.destroy();
            } catch (e) {
                console.error("Error destroying player:", e);
            }
        }
        player = null;
        isPlayerReady = false;
        currentVideoId = null;
        onYouTubeIframeAPIReady();
    });

    // --- QR Code Generation ---
    const url = window.location.origin;
    partyUrlEl.textContent = url;
    try {
        const qr = qrcode(0, 'L');
        qr.addData(url);
        qr.make();
        qrCodeEl.innerHTML = qr.createImgTag(6, 8);
    } catch (e) {
        console.error(e);
        qrCodeEl.innerHTML = "Ошибка";
    }

    // --- Particle Visualizer ---
    const canvas = document.getElementById('visualizer-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let particles = [];
    for (let i = 0; i < 50; i++) particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, size: Math.random() * 2 + 1, color: `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.2})`});
    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        });
        requestAnimationFrame(animateParticles);
    }
    animateParticles();
    window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
});
