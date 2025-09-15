const YouTube = require('youtube-sr').default;

/**
 * Finds a YouTube video for a given song.
 * @param {string} songTitle The title of the song.
 * @param {string} songArtist The artist of the song.
 * @returns {Promise<{id: string, title: string, duration: number}|null>} A promise that resolves to the video details or null.
 */
const findVideo = async (songTitle, songArtist) => {
    try {
        // A more specific query often yields better results (e.g., official audio, lyric video)
        const searchQuery = `${songTitle} ${songArtist} official audio`;
        console.log(`Searching YouTube for: "${searchQuery}"`);
        const video = await YouTube.searchOne(searchQuery, 'video');

        if (video && video.id) {
            console.log(`Found video: ${video.title} (ID: ${video.id})`);
            return {
                id: video.id,
                title: video.title,
                duration: video.duration, // Duration in milliseconds
            };
        }
        console.log(`No video found for: "${searchQuery}"`);
        return null;
    } catch (error) {
        console.error('Error searching YouTube:', error);
        return null;
    }
};

module.exports = { findVideo };
