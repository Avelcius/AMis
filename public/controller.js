document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // Nickname elements
    const nicknameSection = document.getElementById('nickname-section');
    const nicknameInput = document.getElementById('nickname-input');
    const nicknameSubmitBtn = document.getElementById('nickname-submit');

    // Search elements
    const searchSection = document.getElementById('search-section');
    const nicknameDisplay = document.getElementById('nickname-display');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results');

    // Now Playing Bar elements
    const nowPlayingBar = document.getElementById('now-playing-bar');
    const barCoverArt = document.getElementById('bar-cover-art');
    const barTitle = document.getElementById('bar-title');
    const barArtist = document.getElementById('bar-artist');

    let nickname = localStorage.getItem('nickname');
    let searchTimeout;

    // --- Nickname Logic ---
    if (nickname) {
        showSearch();
    } else {
        showNicknameInput();
    }

    function showNicknameInput() {
        nicknameSection.classList.remove('hidden');
        searchSection.classList.add('hidden');
    }

    function showSearch() {
        nicknameDisplay.textContent = nickname;
        nicknameSection.classList.add('hidden');
        searchSection.classList.remove('hidden');
    }

    nicknameSubmitBtn.addEventListener('click', () => {
        const name = nicknameInput.value.trim();
        if (name) {
            nickname = name;
            localStorage.setItem('nickname', name);
            showSearch();
        }
    });

    nicknameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            nicknameSubmitBtn.click();
        }
    });

    // --- Search Logic ---
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = searchInput.value.trim();
        if (query.length > 2) {
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300); // Debounce search
        } else {
            searchResultsContainer.innerHTML = '';
        }
    });

    async function performSearch(query) {
        try {
            const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
            const tracks = await response.json();
            renderResults(tracks);
        } catch (error) {
            console.error('Search failed:', error);
            searchResultsContainer.innerHTML = '<p>Ошибка поиска.</p>';
        }
    }

    function renderResults(tracks) {
        searchResultsContainer.innerHTML = '';
        if (!tracks || tracks.length === 0) {
            searchResultsContainer.innerHTML = '<p>Ничего не найдено.</p>';
            return;
        }

        tracks.forEach(track => {
            const trackEl = document.createElement('div');
            trackEl.className = 'search-result-item';
            trackEl.innerHTML = `
                <img src="${track.coverArt || 'https://via.placeholder.com/50/191414/FFFFFF?text=?'}" alt="Album Art">
                <div class="info">
                    <div class="title">${track.title}</div>
                    <div class="artist">${track.artist}</div>
                </div>
            `;
            trackEl.addEventListener('click', () => {
                const songToAdd = { ...track, addedBy: nickname };
                socket.emit('add-song', songToAdd);
                searchResultsContainer.innerHTML = `<p><b>${track.title}</b> добавлена в очередь!</p>`;
                searchInput.value = '';
                setTimeout(() => {
                    searchResultsContainer.innerHTML = '';
                }, 2000);
            });
            searchResultsContainer.appendChild(trackEl);
        });
    }

    // --- Socket Logic for Now Playing Bar ---
    socket.on('queue-updated', ({ currentlyPlaying }) => {
        if (currentlyPlaying) {
            barCoverArt.src = currentlyPlaying.coverArt || placeholderCover;
            barTitle.textContent = currentlyPlaying.title;
            barArtist.textContent = currentlyPlaying.artist;
            nowPlayingBar.classList.remove('hidden');
        } else {
            nowPlayingBar.classList.add('hidden');
        }
    });
});
