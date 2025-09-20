document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- DOM Elements ---
    const nicknameSection = document.getElementById('nickname-section');
    const searchSection = document.getElementById('search-section');
    const nicknameInput = document.getElementById('nickname-input');
    const nicknameSubmitBtn = document.getElementById('nickname-submit');
    const nicknameDisplay = document.getElementById('nickname-display');
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const lyricsDisplay = document.getElementById('lyrics-display');
    const lyricsTitle = document.getElementById('lyrics-title');
    const lyricsText = document.getElementById('lyrics-text');
    const nowPlayingBar = document.getElementById('now-playing-bar');
    const barCoverArt = document.getElementById('bar-cover-art');
    const barTitle = document.getElementById('bar-title');
    const barArtist = document.getElementById('bar-artist');

    let nickname = localStorage.getItem('nickname');
    let searchCache = {};

    const setupSearchPage = (name) => {
        nickname = name;
        localStorage.setItem('nickname', name);
        nicknameDisplay.textContent = name;
        nicknameSection.classList.add('hidden');
        searchSection.classList.remove('hidden');
    };

    if (nickname) {
        setupSearchPage(nickname);
    }

    nicknameSubmitBtn.addEventListener('click', () => {
        const name = nicknameInput.value.trim();
        if (name) {
            setupSearchPage(name);
        }
    });

    const fetchAndDisplayLyrics = async (track) => {
        // Hide search results and clear input
        searchResultsContainer.innerHTML = `<p><b>${track.title}</b> добавлена в очередь!</p>`;
        searchInput.value = '';
        lyricsDisplay.classList.add('hidden'); // Hide until we have lyrics

        try {
            const response = await fetch(`/lyrics?track_name=${encodeURIComponent(track.title)}&artist_name=${encodeURIComponent(track.artist)}`);

            lyricsTitle.textContent = `Текст песни: ${track.title}`;
            if (!response.ok) {
                lyricsText.textContent = '(Текст не найден)';
            } else {
                const data = await response.json();
                if (data.type === 'synced' && data.lyrics) {
                    // Join synced lyrics into a single block of text
                    lyricsText.textContent = data.lyrics.map(line => line.text).join('\\n');
                } else if (data.type === 'unsynced' && data.lyrics) {
                    lyricsText.textContent = data.lyrics;
                } else {
                    lyricsText.textContent = '(Текст не найден)';
                }
            }
        } catch (error) {
            console.error('Error fetching lyrics:', error);
            lyricsText.textContent = '(Ошибка при загрузке текста)';
        }
        lyricsDisplay.classList.remove('hidden');
    };

    const renderResults = (tracks) => {
        searchResultsContainer.innerHTML = '';
        if (!tracks || tracks.length === 0) {
            searchResultsContainer.innerHTML = '<p>Ничего не найдено.</p>';
            return;
        }

        tracks.forEach(track => {
            const trackEl = document.createElement('div');
            trackEl.className = 'search-result-item';
            const explicitTag = track.explicit ? '<span class="explicit-tag">E</span>' : '';
            trackEl.innerHTML = `
                <img src="${track.coverArt || 'https://via.placeholder.com/50'}" alt="Album Art">
                <div class="info">
                    <div class="title">${explicitTag}${track.title}</div>
                    <div class="artist">${track.artist}</div>
                </div>
            `;
            trackEl.addEventListener('click', () => {
                const songToAdd = { ...track, addedBy: nickname };
                socket.emit('add-song', songToAdd);
                fetchAndDisplayLyrics(track);
            });
            searchResultsContainer.appendChild(trackEl);
        });
    };

    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    };

    const search = async (query) => {
        lyricsDisplay.classList.add('hidden'); // Hide lyrics when starting a new search
        if (!query) {
            searchResultsContainer.innerHTML = '';
            return;
        }

        if (searchCache[query]) {
            renderResults(searchCache[query]);
            return;
        }

        try {
            const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Search request failed');
            }
            const tracks = await response.json();
            searchCache[query] = tracks;
            renderResults(tracks);
        } catch (error) {
            console.error('Error searching:', error);
            searchResultsContainer.innerHTML = '<p>Ошибка при поиске. Попробуйте еще раз.</p>';
        }
    };

    searchInput.addEventListener('input', debounce((e) => {
        search(e.target.value.trim());
    }, 300));

    // --- Now Playing Bar Logic ---
    socket.on('queue-updated', ({ currentlyPlaying }) => {
        if (currentlyPlaying) {
            barCoverArt.src = currentlyPlaying.coverArt || 'https://via.placeholder.com/50';
            barTitle.textContent = currentlyPlaying.title;
            barArtist.textContent = currentlyPlaying.artist;
            nowPlayingBar.classList.remove('hidden');
        } else {
            nowPlayingBar.classList.add('hidden');
        }
    });
});
