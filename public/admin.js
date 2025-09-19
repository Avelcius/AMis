document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- Views & Auth ---
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

    const showAdminView = () => {
        loginView.classList.add('hidden');
        adminView.classList.remove('hidden');
    };

    const checkAuth = () => {
        if (sessionStorage.getItem('isAdminAuthenticated')) {
            showAdminView();
        }
    };

    loginButton.addEventListener('click', async () => {
        const password = passwordInput.value;
        try {
            const response = await fetch('/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (response.ok) {
                sessionStorage.setItem('isAdminAuthenticated', 'true');
                showAdminView();
            } else {
                loginError.textContent = 'Неверный пароль.';
                loginError.classList.remove('hidden');
            }
        } catch (error) {
            loginError.textContent = 'Ошибка при входе.';
            loginError.classList.remove('hidden');
        }
    });

    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginButton.click();
        }
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
                <div class="info">
                    <div class="title">${song.title}</div>
                    <div class="artist">${song.artist} (добавил: ${song.addedBy || 'кто-то'})</div>
                </div>
                <button class="remove-btn">Удалить</button>
            `;
            item.querySelector('.remove-btn').addEventListener('click', () => {
                socket.emit('admin-remove-song', song.timestamp);
            });
            queueListEl.appendChild(item);
        });
    });

    const playerStateMap = {
        '-1': 'Не начато',
        '0': 'Завершено',
        '1': 'Воспроизведение',
        '2': 'Пауза',
        '3': 'Буферизация',
        '5': 'Видео загружено'
    };

    socket.on('admin-status-update', (stateCode) => {
        playerStatusEl.textContent = playerStateMap[stateCode] || 'Неизвестно';
    });

    // --- Admin Actions ---
    togglePauseBtn.addEventListener('click', () => socket.emit('admin-toggle-pause'));
    skipBtn.addEventListener('click', () => socket.emit('admin-skip-song'));
    volumeSlider.addEventListener('input', (e) => {
        socket.emit('admin-set-volume', e.target.value);
    });
    reloadDisplayBtn.addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите перезагрузить страницу дисплея?')) {
            socket.emit('admin-force-reload');
        }
    });

    // --- Initial Check ---
    checkAuth();
});
