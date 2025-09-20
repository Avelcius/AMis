document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- Views & Auth ---
    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const passwordInput = document.getElementById('password-input');
    const loginButton = document.getElementById('login-button');
    const loginError = document.getElementById('login-error');

    // --- Admin Panel Elements ---
    const adminCoverArt = document.getElementById('admin-cover-art');
    const adminSongTitle = document.getElementById('admin-song-title');
    const adminSongArtist = document.getElementById('admin-song-artist');
    const queueListEl = document.getElementById('admin-queue-list');
    const togglePauseBtn = document.getElementById('toggle-pause-button');
    const skipBtn = document.getElementById('skip-button');
    const volumeSlider = document.getElementById('volume-slider');
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

    // --- Admin Panel Elements (New) ---
    const queueWrapper = document.getElementById('admin-queue-wrapper');
    const showMoreBtn = document.getElementById('show-more-queue-btn');
    const fadeOverlay = document.getElementById('queue-fade-overlay');

    // --- SortableJS ---
    let sortable = null;

    // --- Socket Logic ---
    socket.on('queue-updated', ({ queue, currentlyPlaying }) => {
        if (currentlyPlaying) {
            adminSongTitle.textContent = currentlyPlaying.title;
            adminSongArtist.textContent = currentlyPlaying.artist;
            adminCoverArt.src = currentlyPlaying.coverArt || 'https://via.placeholder.com/100/121212/808080?text=+';
        } else {
            adminSongTitle.textContent = 'Ничего не играет';
            adminSongArtist.textContent = 'Добавьте песню';
            adminCoverArt.src = 'https://via.placeholder.com/100/121212/808080?text=+';
        }

        // Preserve scroll position
        const oldScrollTop = queueListEl.scrollTop;
        queueListEl.innerHTML = '';

        if (queue.length === 0) {
            queueListEl.innerHTML = '<p class="empty-queue-message">Очередь пуста</p>';
            showMoreBtn.classList.add('hidden');
            fadeOverlay.classList.add('hidden');
            return;
        }

        // Populate queue
        queue.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            item.dataset.timestamp = song.timestamp; // Store timestamp for reordering

            item.innerHTML = `
                <span class="queue-handle">${index + 1}</span>
                <img class="queue-art" src="${song.coverArt || 'https://via.placeholder.com/40'}" alt="Art">
                <div class="info">
                    <div class="title">${song.title}</div>
                    <div class="artist">${song.artist} (добавил: ${song.addedBy || 'кто-то'})</div>
                </div>
                <button class="remove-btn">🗑️</button>
            `;
            item.querySelector('.remove-btn').addEventListener('click', () => {
                if (confirm(`Вы уверены, что хотите удалить "${song.title}" из очереди?`)) {
                    socket.emit('admin-remove-song', song.timestamp);
                }
            });
            queueListEl.appendChild(item);
        });

        queueListEl.scrollTop = oldScrollTop;

        // "Show More" logic
        const needsShowMore = queueListEl.scrollHeight > queueWrapper.clientHeight;
        showMoreBtn.classList.toggle('hidden', !needsShowMore);
        fadeOverlay.classList.toggle('hidden', !needsShowMore || queueWrapper.classList.contains('expanded'));

        // Init SortableJS
        if (sortable) {
            sortable.destroy();
        }
        sortable = new Sortable(queueListEl, {
            animation: 150,
            handle: '.queue-handle',
            onEnd: (evt) => {
                const newOrder = Array.from(evt.to.children).map(item => parseInt(item.dataset.timestamp));
                socket.emit('admin-reorder-queue', newOrder);
            }
        });
    });


    // --- Admin Actions ---
    togglePauseBtn.addEventListener('click', () => socket.emit('admin-toggle-pause'));
    skipBtn.addEventListener('click', () => socket.emit('admin-skip-song'));
    volumeSlider.addEventListener('input', (e) => {
        socket.emit('admin-set-volume', e.target.value);
    });
    reloadDisplayBtn.addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите переинициализировать плеер? Это может прервать текущий трек.')) {
            socket.emit('admin-force-reload');
        }
    });

    // --- Initial Check ---
    checkAuth();

    showMoreBtn.addEventListener('click', () => {
        const isExpanded = queueWrapper.classList.toggle('expanded');
        showMoreBtn.textContent = isExpanded ? 'Скрыть' : 'Показать все';
        fadeOverlay.classList.toggle('hidden', isExpanded);
    });
});
