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

    const placeholderCover = 'https://via.placeholder.com/300/121212/808080?text=+';
    let player;
    let progressTimer;
    let currentVideoId = null; // State to track the current video

    // --- YouTube Player ---
    window.onYouTubeIframeAPIReady = () => {
        player = new YT.Player('player', {
            height: '195',
            width: '320',
            playerVars: { 'autoplay': 1, 'controls': 0, 'origin': window.location.origin },
            events: {
                'onStateChange': (event) => {
                    if (event.data === YT.PlayerState.ENDED) {
                        currentVideoId = null; // Reset when song ends
                        socket.emit('song-ended');
                    }
                }
            }
        });
    };

    // --- Progress Bar & Time Formatting ---
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

    const startProgressTimer = () => {
        stopProgressTimer();
        progressTimer = setInterval(() => {
            if (player && typeof player.getCurrentTime === 'function') {
                const currentTime = player.getCurrentTime();
                const duration = player.getDuration();
                if (duration > 0) {
                    progressBar.style.width = `${(currentTime / duration) * 100}%`;
                    currentTimeEl.textContent = formatTime(currentTime);
                    totalTimeEl.textContent = formatTime(duration);
                }
            }
        }, 1000);
    };

    // --- UI Update Functions ---
    const updateNowPlaying = (song) => {
        if (song && song.videoId) {
            // *** BUG FIX: Only load video if the ID is different ***
            if (song.videoId !== currentVideoId) {
                console.log(`Loading new video. Old: ${currentVideoId}, New: ${song.videoId}`);
                currentVideoId = song.videoId;
                titleEl.textContent = song.title;
                artistEl.textContent = song.artist;
                coverArtEl.src = song.coverArt || placeholderCover;
                player.loadVideoById(song.videoId);
                startProgressTimer(); // Start timer for the new song
            }
            // Always update who added the song, even if the song is the same
            addedByEl.textContent = `Добавил: ${song.addedBy || 'кто-то'}`;
        } else {
            // No song is playing
            stopProgressTimer();
            currentVideoId = null;
            titleEl.textContent = 'Музыка не играет';
            artistEl.textContent = 'Добавьте песню с вашего устройства';
            addedByEl.textContent = '';
            coverArtEl.src = placeholderCover;
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
            item.innerHTML = `<img src="${s.coverArt || placeholderCover}" alt="Art"><div class="info"><div class="title">${s.title}</div><div class="artist">${s.artist}</div></div>`;
            queueListEl.appendChild(item);
        });
    };

    // --- Socket.IO Event Handlers ---
    socket.on('queue-updated', ({ queue, currentlyPlaying }) => {
        updateNowPlaying(currentlyPlaying);
        updateQueue(queue);
    });

    socket.on('player-control', ({ action }) => {
        if (!player || typeof player.getPlayerState !== 'function') return;
        if (action === 'togglePause') {
            const state = player.getPlayerState();
            if (state === YT.PlayerState.PLAYING) player.pauseVideo();
            else player.playVideo();
        }
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

    // --- Particle Visualizer (Placeholder) ---
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
