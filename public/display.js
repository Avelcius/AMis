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
    const playerContainer = document.getElementById('player-wrapper');

    // --- State Variables ---
    const placeholderCover = 'https://via.placeholder.com/300/121212/808080?text=+';
    let player;
    let progressTimer;
    let currentVideoId = null;
    let isPlayerReady = false;
    let pendingData = null;
    const colorThief = new ColorThief();

    // --- Dynamic Background ---
    const updateBackgroundColor = () => {
        if (!coverArtEl.complete || coverArtEl.naturalWidth === 0 || coverArtEl.src.includes('placeholder')) {
            visualizerCanvas.style.backgroundColor = '#121212';
            return;
        }
        try {
            const dominantColor = colorThief.getColor(coverArtEl);
            const bgColor = `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`;
            visualizerCanvas.style.background = `linear-gradient(to bottom, ${bgColor}, #121212 85%)`;
        } catch (e) {
            console.error("ColorThief error:", e);
            visualizerCanvas.style.backgroundColor = '#121212';
        }
    };
    coverArtEl.addEventListener('load', updateBackgroundColor);
    coverArtEl.crossOrigin = "Anonymous";

    // --- YouTube Player ---
    window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube IFrame API is ready.");
        if (!document.getElementById('player')) {
            const playerDiv = document.createElement('div');
            playerDiv.id = 'player';
            playerContainer.appendChild(playerDiv);
        }
        player = new YT.Player('player', {
            height: '1',
            width: '1',
            playerVars: {
                'autoplay': 1,
                'controls': 0,
                'enablejsapi': 1, // Crucial for JS control
                'origin': window.location.origin
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': (e) => console.error('YouTube Player Error:', e.data)
            }
        });
    };

    function onPlayerReady(event) {
        console.log("YouTube Player is ready and initialized.");
        isPlayerReady = true;
        player.setVolume(100);
        if (pendingData) {
            console.log("Processing pending data on ready.");
            updateNowPlaying(pendingData.currentlyPlaying);
            updateQueue(pendingData.queue);
            pendingData = null;
        }
    }

    function onPlayerStateChange(event) {
        socket.emit('player-state-change', event.data);
        if (event.data === YT.PlayerState.ENDED) {
            console.log("Song ended, emitting 'song-ended' to server.");
            currentVideoId = null;
            socket.emit('song-ended');
        }
    }

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
    };

    const startProgressTimer = () => {
        stopProgressTimer();
        progressTimer = setInterval(() => {
            if (player && typeof player.getCurrentTime === 'function' && isPlayerReady) {
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
        if (!isPlayerReady) {
            console.log("Player not ready, deferring updateNowPlaying.");
            return;
        }

        if (song && song.videoId) {
            if (song.videoId !== currentVideoId) {
                console.log(`Loading new video. Old: ${currentVideoId}, New: ${song.videoId}`);
                currentVideoId = song.videoId;
                player.loadVideoById(song.videoId);
                startProgressTimer();
            }
            titleEl.textContent = song.title;
            artistEl.textContent = song.artist;
            addedByEl.textContent = `Добавил: ${song.addedBy || 'кто-то'}`;
            coverArtEl.src = song.coverArt || placeholderCover;
        } else {
            stopProgressTimer();
            currentVideoId = null;
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
        if (!queue || queue.length === 0) {
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
            console.log("Player not ready, queuing data.");
            pendingData = data;
            // Pre-fill the info while waiting for the player
            updateQueue(data.queue || []);
            if (data.currentlyPlaying) {
                 titleEl.textContent = data.currentlyPlaying.title;
                 artistEl.textContent = data.currentlyPlaying.artist;
                 addedByEl.textContent = `Добавил: ${data.currentlyPlaying.addedBy || 'кто-то'}`;
                 coverArtEl.src = data.currentlyPlaying.coverArt || placeholderCover;
            } else {
                 titleEl.textContent = 'Музыка не играет';
                 artistEl.textContent = 'Добавьте песню с вашего устройства';
                 addedByEl.textContent = '';
                 coverArtEl.src = placeholderCover;
                 updateBackgroundColor();
            }
        } else {
            updateNowPlaying(data.currentlyPlaying);
            updateQueue(data.queue);
        }
    });

    socket.on('player-control', ({ action }) => {
        if (!player || !isPlayerReady) return;
        if (action === 'togglePause') {
            const state = player.getPlayerState();
            if (state === YT.PlayerState.PLAYING) {
                player.pauseVideo();
            } else {
                player.playVideo();
            }
        }
    });

    socket.on('player-set-volume', (volume) => {
        if (player && typeof player.setVolume === 'function' && isPlayerReady) {
            player.setVolume(Number(volume));
        }
    });

    socket.on('player-force-reload', () => {
        window.location.reload();
    });

    // --- QR Code Generation ---
    const url = window.location.origin;
    partyUrlEl.textContent = url;
    try {
        const qr = qrcode(0, 'L');
        qr.addData(url);
        qr.make();
        qrCodeEl.innerHTML = qr.createImgTag(4, 8);
    } catch (e) {
        console.error("QR Code generation failed:", e);
        qrCodeEl.innerHTML = "Ошибка при генерации QR-кода.";
    }

    // --- Particle Visualizer (Placeholder) ---
    const canvas = visualizerCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let particles = [];
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 1,
            color: `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.2})`
        });
    }
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
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
});
