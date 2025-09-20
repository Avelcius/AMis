const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Function to get an access token and refresh it periodically
const refreshAccessToken = async () => {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    console.log('The access token has been refreshed!');
    spotifyApi.setAccessToken(data.body['access_token']);

    // Schedule the next refresh half way through the token's validity period
    const expiresIn = data.body['expires_in'];
    setTimeout(refreshAccessToken, (expiresIn / 2) * 1000);

  } catch (err) {
    console.error('Could not refresh access token', err);
    // Retry after a delay if it fails
    setTimeout(refreshAccessToken, 60 * 1000);
  }
};

const searchTracks = async (query) => {
  if (!spotifyApi.getAccessToken()) {
    console.log('Access token not available, trying to refresh...');
    await refreshAccessToken();
    if (!spotifyApi.getAccessToken()) {
        console.error('Failed to get access token. Search aborted.');
        return [];
    }
  }

  try {
    const data = await spotifyApi.searchTracks(query, { limit: 10 });
    // We only need specific fields, so let's map the results
    return data.body.tracks.items.map((track) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(', '),
      album: track.album.name,
      coverArt: track.album.images[0]?.url, // Get the largest image if available
      duration_ms: track.duration_ms,
      explicit: track.explicit,
    }));
  } catch (err) {
    console.error('Something went wrong when searching tracks', err);
    // If the error is an auth error, it might be an expired token
    if (err.statusCode === 401) {
      console.log('Access token might be expired, forcing refresh.');
      await refreshAccessToken();
      // Retry the search once after refreshing
      return await searchTracks(query);
    }
    return [];
  }
};

// We don't need to export refreshAccessToken as it will self-manage.
// The searchTracks function will trigger it if needed.
module.exports = { searchTracks };
