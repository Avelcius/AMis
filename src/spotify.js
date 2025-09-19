const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

let tokenExpirationTime = 0;

async function getAccessToken() {
    if (Date.now() < tokenExpirationTime) {
        return spotifyApi.getAccessToken();
    }

    try {
        const data = await spotifyApi.clientCredentialsGrant();
        console.log('The access token has been refreshed!');
        const expiresIn = data.body['expires_in'];
        spotifyApi.setAccessToken(data.body['access_token']);
        tokenExpirationTime = Date.now() + expiresIn * 1000;
        return data.body['access_token'];
    } catch (err) {
        console.error('Something went wrong when retrieving an access token', err);
        throw err;
    }
}

async function searchTracks(query) {
    await getAccessToken();
    try {
        const data = await spotifyApi.searchTracks(query, { limit: 5 });
        return data.body.tracks.items.map(track => ({
            id: track.id,
            title: track.name,
            artist: track.artists[0].name,
            album: track.album.name,
            coverArt: track.album.images[0]?.url,
            duration_ms: track.duration_ms,
        }));
    } catch (err) {
        console.error('Error searching tracks on Spotify', err);
        return [];
    }
}

module.exports = { searchTracks };
