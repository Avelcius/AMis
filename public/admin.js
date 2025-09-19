document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- Views & Auth Elements ---
    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const passwordInput = document.getElementById('password-input');
    const loginButton = document.getElementById('login-button');
    const loginError = document.getElementById('login-error');

    // --- Admin Panel Elements ---
    const nowPlayingEl = document.getElementById('admin-current-song');
    const queueListEl = document.getElementById('admin-queue-list');
    const togglePauseBtn = document.getElementById('toggle-pause-button');
    const skipBtn = document.getElementById('skip-button');
    const volumeSlider = document.getElementById('volume-slider');
    const playerStatusEl = document.getElementById('player-status');
    const reloadDisplayBtn = document.getElementById('reload-display-button');

    const placeholderCover = 'https://via.placeholder.com/300/121212/808080?text=+';

    // --- Authentication ---
    loginButton.addEventListener('click', () => {
        const password = passwordInput.value;
        socket.emit('admin-login', password);
    });

    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginButton.click();
        }
    });

    socket.on('admin-auth-success', () => {
        loginView.classList.add('hidden');
        adminView.classList.remove('hidden');
        sessionStorage.setItem('isAdminAuthenticated', 'true');
    });

    socket.on('admin-auth-fail', () => {
        loginError.textContent = 'Неверный пароль.';
        loginError.classList.remove('hidden');
    });

    // --- Socket Logic ---
    socket.on('queue-updated', ({ queue, currentlyPlaying }) => {
        if (currentlyPlaying) {
            nowPlayingEl.textContent = `${currentlyPlaying.title} - ${currentlyPlaying.artist}`;
        } else {
            nowPlayingEl.textContent = 'Ничего не играет';
        }

        queueListEl.innerHTML = '';
        if (queue.length === 0) {
            queueListEl.innerHTML = '<p class="empty-queue-message">Очередь пуста</p>';
            return;
        }

        queue.forEach(song => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            item.innerHTML = `
                <img src="${song.coverArt || placeholderCover}" alt="Art" style="width: 40px; height: 40px; margin-right: 10px;">
                <div class="info">
                    <div class="title">${song.title}</div>
                    <div class="artist">${song.artist} (добавил: ${song.addedBy || 'кто-то'})</div>
                </div>
                <button class="remove-btn" data-timestamp="${song.timestamp}">Удалить</button>
            `;
            queueListEl.appendChild(item);
        });
    });

    const playerStateMap = {
        '-1': 'Не начато (Unstarted)',
        '0': 'Завершено (Ended)',
        '1': 'Воспроизведение (Playing)',
        '2': 'Пауза (Paused)',
        '3': 'Буферизация (Buffering)',
        '5': 'Видео загружено (Video Cued)'
    };

    socket.on('admin-status-update', (stateCode) => {
        playerStatusEl.textContent = playerStateMap[stateCode] || `Неизвестный код: ${stateCode}`;
    });

    // --- Admin Actions ---
    togglePauseBtn.addEventListener('click', () => socket.emit('admin-toggle-pause'));
    skipBtn.addEventListener('click', () => socket.emit('admin-skip-song'));

    volumeSlider.addEventListener('input', (e) => {
        socket.emit('admin-set-volume', e.target.value);
    });

    reloadDisplayBtn.addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите переинициализировать плеер на странице дисплея?')) {
            socket.emit('admin-force-reload');
        }
    });

    queueListEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) {
            const timestamp = e.target.dataset.timestamp;
            if (timestamp) {
                socket.emit('admin-remove-song', parseInt(timestamp, 10));
            }
        }
    });

    // --- Initial Check ---
    // A simple auth check. For a real app, a more secure token-based system would be better.
    // We'll re-request auth on each load if not in session storage.
});
