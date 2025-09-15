const YouTube = require('youtube-sr').default;

/**
 * Finds the best YouTube video match for a given song by comparing durations.
 * @param {string} songTitle The title of the song.
 * @param {string} songArtist The artist of the song.
 * @param {number} spotifyDurationMs The duration of the song from Spotify in milliseconds.
 * @returns {Promise<{id: string, title: string, duration: number}|null>} A promise that resolves to the best video match or null.
 */
const findVideo = async (songTitle, songArtist, spotifyDurationMs) => {
    try {
        const searchQuery = `${songTitle} ${songArtist}`;
        console.log(`Searching YouTube for: "${searchQuery}"`);
        // Fetch top 3 results to have a small pool for comparison
        const videos = await YouTube.search(searchQuery, { limit: 3, type: 'video' });

        if (!videos || videos.length === 0) {
            console.log(`No videos found for: "${searchQuery}"`);
            return null;
        }

        let bestMatch = null;
        let smallestDiff = Infinity;
        // Allow a 10-second difference between Spotify and YouTube durations
        const DURATION_TOLERANCE_MS = 10000;

        for (const video of videos) {
            // youtube-sr provides duration in milliseconds
            if (!video.duration) continue;

            const durationDiff = Math.abs(video.duration - spotifyDurationMs);

            if (durationDiff < smallestDiff) {
                smallestDiff = durationDiff;
                bestMatch = video;
            }
        }

        // If the best match we found is outside our tolerance, it's likely not the right song.
        // In this case, we'll fall back to the very first result as a last resort.
        if (bestMatch && smallestDiff > DURATION_TOLERANCE_MS) {
            console.warn(`Best match duration difference (${smallestDiff}ms) is outside tolerance. Falling back to first result.`);
            bestMatch = videos[0];
        }

        if (bestMatch) {
            console.log(`Best match found: ${bestMatch.title} (ID: ${bestMatch.id})`);
            return {
                id: bestMatch.id,
                title: bestMatch.title,
                duration: bestMatch.duration,
            };
        }

        return null;
    } catch (error) {
        console.error('Error searching YouTube:', error);
        return null;
    }
};

module.exports = { findVideo };
