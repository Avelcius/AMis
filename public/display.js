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

    const placeholderCover = 'https://via.placeholder.com/300/121212/808080?text=+';

    // --- YouTube Player ---
    let player;
    window.onYouTubeIframeAPIReady = () => {
        player = new YT.Player('player', {
            height: '195',
            width: '320',
            playerVars: { 'autoplay': 1, 'controls': 0 },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    };

    const onPlayerReady = (event) => {
        // The player is ready.
    };

    const onPlayerStateChange = (event) => {
        if (event.data === YT.PlayerState.ENDED) {
            socket.emit('song-ended');
        }
    };

    // --- UI Update Functions ---
    const updateNowPlaying = (song) => {
        if (song && song.videoId) {
            titleEl.textContent = song.title;
            artistEl.textContent = song.artist;
            addedByEl.textContent = `Добавил: ${song.addedBy || 'кто-то'}`;
            coverArtEl.src = song.coverArt || placeholderCover;
            player.loadVideoById(song.videoId);
        } else {
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
        queue.forEach(song => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            item.innerHTML = `
                <img src="${song.coverArt || placeholderCover}" alt="Art">
                <div class="info">
                    <div class="title">${song.title}</div>
                    <div class="artist">${song.artist}</div>
                </div>
            `;
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
            const playerState = player.getPlayerState();
            if (playerState === YT.PlayerState.PLAYING) {
                player.pauseVideo();
            } else {
                player.playVideo();
            }
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
        qrCodeEl.innerHTML = "Ошибка генерации QR-кода";
        console.error(e);
    }

    // --- Particle Visualizer (Placeholder) ---
    const canvas = document.getElementById('visualizer-canvas');
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
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        requestAnimationFrame(animateParticles);
    }

    animateParticles();

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
});
