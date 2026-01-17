const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 10800;
const DATA_DIR = '/data';

// API Key - TMDB only
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'YOUR_TMDB_API_KEY_HERE';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log(`✅ Data directory ready: ${DATA_DIR}`);
    } catch (err) {
        console.error('Error creating data directory:', err);
    }
}

// Get user data file path
function getUserDataPath(username) {
    return path.join(DATA_DIR, `${username}.json`);
}

// Data persistence endpoints
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Missing credentials' });
        }

        const token = 'local_' + Date.now();
        const userDataPath = getUserDataPath(username);

        // Check if user exists, if not create new user data file
        try {
            await fs.access(userDataPath);
        } catch {
            // Create new user
            await fs.writeFile(userDataPath, JSON.stringify({ movies: [], shows: [] }));
        }

        res.json({ token, username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/vault/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const userDataPath = getUserDataPath(username);

        try {
            const data = await fs.readFile(userDataPath, 'utf8');
            res.json(JSON.parse(data));
        } catch {
            // Return empty vault if no data
            res.json({ movies: [], shows: [] });
        }
    } catch (error) {
        console.error('Get vault error:', error);
        res.status(500).json({ error: 'Failed to get vault' });
    }
});

app.post('/api/vault/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const vault = req.body;
        const userDataPath = getUserDataPath(username);

        await fs.writeFile(userDataPath, JSON.stringify(vault, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Save vault error:', error);
        res.status(500).json({ error: 'Failed to save vault' });
    }
});

app.post('/api/vault/:username/import', async (req, res) => {
    try {
        const { username } = req.params;
        const { data } = req.body;
        const userDataPath = getUserDataPath(username);

        // Parse CSV
        const lines = data.trim().split('\n');
        const headers = lines[0].split(',');

        const movies = [];
        const shows = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;

            // Parse CSV line (handle quoted fields)
            const values = [];
            let current = '';
            let inQuotes = false;

            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());

            const item = {
                Type: values[0],
                Title: values[1].replace(/^"|"$/g, ''),
                Year: values[2],
                imdbID: values[3],
                rating: parseInt(values[4]) || 0,
                watched: values[5] === 'true',
                Genre: values[6].replace(/^"|"$/g, ''),
                Poster: 'N/A',
                addedAt: Date.now()
            };

            if (item.Type === 'movie') {
                movies.push(item);
            } else {
                shows.push(item);
            }
        }

        const vault = { movies, shows };
        await fs.writeFile(userDataPath, JSON.stringify(vault, null, 2));

        res.json({ success: true, imported: movies.length + shows.length });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to import data' });
    }
});

// TMDB API Routes

// Multi-search (movies + TV shows)
app.get('/api/tmdb/search/multi', async (req, res) => {
    try {
        const { query, page } = req.query;
        const pageNum = page || 1;

        const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${pageNum}`;

        const response = await fetch(url);
        const data = await response.json();

        // Filter to only movies and TV shows with posters
        if (data.results) {
            data.results = data.results.filter(item =>
                (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path
            );
        }

        res.json(data);
    } catch (error) {
        console.error('Multi search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Search by type (movie or tv)
app.get('/api/tmdb/search', async (req, res) => {
    try {
        const { query, type } = req.query;
        const mediaType = type === 'series' || type === 'tv' ? 'tv' : 'movie';

        const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;

        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('TMDB search error:', error);
        res.status(500).json({ error: 'Failed to search TMDB' });
    }
});

// Get full details for a TMDB item
app.get('/api/tmdb/details/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query;
        const mediaType = type === 'tv' || type === 'series' ? 'tv' : 'movie';

        const url = `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,keywords,external_ids`;

        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Details error:', error);
        res.status(500).json({ error: 'Failed to fetch details' });
    }
});

// Browse by genre
app.get('/api/tmdb/browse/:genre', async (req, res) => {
    try {
        const { genre } = req.params;
        const { type, page } = req.query;

        // Map genre names to TMDB genre IDs
        const genreMap = {
            action: 28,
            comedy: 35,
            drama: 18,
            horror: 27,
            romance: 10749,
            thriller: 53,
            scifi: 878,
            fantasy: 14,
            animation: 16,
            crime: 80,
            documentary: 99,
            family: 10751,
            mystery: 9648,
            war: 10752,
            western: 37
        };

        const genreId = genreMap[genre.toLowerCase()] || 28;
        const pageNum = page || 1;

        // Fetch both movies and TV shows
        const movieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${pageNum}`;
        const tvUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${pageNum}`;

        const [movieRes, tvRes] = await Promise.all([
            fetch(movieUrl),
            fetch(tvUrl)
        ]);

        const movieData = await movieRes.json();
        const tvData = await tvRes.json();

        // Combine and tag with media type
        const movies = (movieData.results || []).map(item => ({ ...item, media_type: 'movie' }));
        const shows = (tvData.results || []).map(item => ({ ...item, media_type: 'tv' }));

        // Interleave movies and shows
        const combined = [];
        const maxLength = Math.max(movies.length, shows.length);
        for (let i = 0; i < maxLength; i++) {
            if (i < movies.length) combined.push(movies[i]);
            if (i < shows.length) combined.push(shows[i]);
        }

        res.json({ results: combined });
    } catch (error) {
        console.error('Browse error:', error);
        res.status(500).json({ error: 'Failed to browse content' });
    }
});

// Trending content for browse page
app.get('/api/tmdb/trending', async (req, res) => {
    try {
        const { timeWindow, page } = req.query;
        const window = timeWindow || 'week';
        const pageNum = page || 1;

        const url = `https://api.themoviedb.org/3/trending/all/${window}?api_key=${TMDB_API_KEY}&page=${pageNum}`;

        const response = await fetch(url);
        const data = await response.json();

        // Filter to only movies and TV with posters
        if (data.results) {
            data.results = data.results.filter(item =>
                (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path
            );
        }

        res.json(data);
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ error: 'Failed to fetch trending' });
    }
});

// Popular movies
app.get('/api/tmdb/popular/movies', async (req, res) => {
    try {
        const { page } = req.query;
        const pageNum = page || 1;

        const url = `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=${pageNum}`;

        const response = await fetch(url);
        const data = await response.json();

        // Add media_type
        if (data.results) {
            data.results = data.results.map(item => ({ ...item, media_type: 'movie' }));
        }

        res.json(data);
    } catch (error) {
        console.error('Popular movies error:', error);
        res.status(500).json({ error: 'Failed to fetch popular movies' });
    }
});

// Popular TV shows
app.get('/api/tmdb/popular/tv', async (req, res) => {
    try {
        const { page } = req.query;
        const pageNum = page || 1;

        const url = `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&page=${pageNum}`;

        const response = await fetch(url);
        const data = await response.json();

        // Add media_type
        if (data.results) {
            data.results = data.results.map(item => ({ ...item, media_type: 'tv' }));
        }

        res.json(data);
    } catch (error) {
        console.error('Popular TV error:', error);
        res.status(500).json({ error: 'Failed to fetch popular TV shows' });
    }
});

// Top rated movies
app.get('/api/tmdb/top-rated/movies', async (req, res) => {
    try {
        const { page } = req.query;
        const pageNum = page || 1;

        const url = `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&page=${pageNum}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.results) {
            data.results = data.results.map(item => ({ ...item, media_type: 'movie' }));
        }

        res.json(data);
    } catch (error) {
        console.error('Top rated movies error:', error);
        res.status(500).json({ error: 'Failed to fetch top rated movies' });
    }
});

// Top rated TV shows
app.get('/api/tmdb/top-rated/tv', async (req, res) => {
    try {
        const { page } = req.query;
        const pageNum = page || 1;

        const url = `https://api.themoviedb.org/3/tv/top_rated?api_key=${TMDB_API_KEY}&page=${pageNum}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.results) {
            data.results = data.results.map(item => ({ ...item, media_type: 'tv' }));
        }

        res.json(data);
    } catch (error) {
        console.error('Top rated TV error:', error);
        res.status(500).json({ error: 'Failed to fetch top rated TV shows' });
    }
});

// Get streaming providers
app.get('/api/tmdb/providers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query;
        const mediaType = type === 'tv' ? 'tv' : 'movie';

        const url = `https://api.themoviedb.org/3/${mediaType}/${id}/watch/providers?api_key=${TMDB_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Providers error:', error);
        res.status(500).json({ error: 'Failed to fetch providers' });
    }
});

// Get trailers/videos
app.get('/api/tmdb/videos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query;
        const mediaType = type === 'tv' ? 'tv' : 'movie';

        const url = `https://api.themoviedb.org/3/${mediaType}/${id}/videos?api_key=${TMDB_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Videos error:', error);
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
});

// Recommendations (vault-aware - filters out items already in vault)
app.get('/api/tmdb/recommendations', async (req, res) => {
    try {
        const { page, excludeIds } = req.query;
        const pageNum = page || 1;

        // Parse excluded IDs (format: "tmdb123,tmdb456,tt1234567")
        const excludeSet = new Set();
        if (excludeIds) {
            excludeIds.split(',').forEach(id => excludeSet.add(id.trim()));
        }

        // Get trending movies and TV shows
        const movieUrl = `https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}&page=${pageNum}`;
        const tvUrl = `https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}&page=${pageNum}`;

        const [movieRes, tvRes] = await Promise.all([
            fetch(movieUrl),
            fetch(tvUrl)
        ]);

        const movieData = await movieRes.json();
        const tvData = await tvRes.json();

        // Combine and tag
        let movies = (movieData.results || []).map(item => ({ ...item, media_type: 'movie' }));
        let shows = (tvData.results || []).map(item => ({ ...item, media_type: 'tv' }));

        // Filter out excluded items
        movies = movies.filter(m => !excludeSet.has(`tmdb${m.id}`));
        shows = shows.filter(s => !excludeSet.has(`tmdb${s.id}`));

        // Interleave
        const combined = [];
        const maxLength = Math.max(movies.length, shows.length);
        for (let i = 0; i < maxLength; i++) {
            if (i < movies.length) combined.push(movies[i]);
            if (i < shows.length) combined.push(shows[i]);
        }

        res.json({ results: combined });
    } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});

// Enhanced custom recommendations - finds content matching BOTH inputs
app.post('/api/tmdb/custom-recommendations', async (req, res) => {
    try {
        const { title1, title2, excludeIds } = req.body;

        // Parse excluded IDs
        const excludeSet = new Set();
        if (excludeIds) {
            excludeIds.forEach(id => excludeSet.add(id));
        }

        // Search for both titles
        const search1 = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title1)}`);
        const data1 = await search1.json();

        const search2 = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title2)}`);
        const data2 = await search2.json();

        if (data1.results?.length > 0 && data2.results?.length > 0) {
            const item1 = data1.results.find(r => r.media_type === 'movie' || r.media_type === 'tv') || data1.results[0];
            const item2 = data2.results.find(r => r.media_type === 'movie' || r.media_type === 'tv') || data2.results[0];

            // Determine if we should include both movies and TV based on input types
            const includeMovies = item1.media_type === 'movie' || item2.media_type === 'movie';
            const includeTV = item1.media_type === 'tv' || item2.media_type === 'tv';

            // Get recommendations and similar content for both items
            const type1 = item1.media_type || 'movie';
            const type2 = item2.media_type || 'movie';

            const [rec1, rec2, sim1, sim2] = await Promise.all([
                fetch(`https://api.themoviedb.org/3/${type1}/${item1.id}/recommendations?api_key=${TMDB_API_KEY}`).then(r => r.json()),
                fetch(`https://api.themoviedb.org/3/${type2}/${item2.id}/recommendations?api_key=${TMDB_API_KEY}`).then(r => r.json()),
                fetch(`https://api.themoviedb.org/3/${type1}/${item1.id}/similar?api_key=${TMDB_API_KEY}`).then(r => r.json()),
                fetch(`https://api.themoviedb.org/3/${type2}/${item2.id}/similar?api_key=${TMDB_API_KEY}`).then(r => r.json())
            ]);

            // Find overlapping genres
            const genres1 = new Set(item1.genre_ids || []);
            const genres2 = new Set(item2.genre_ids || []);
            const sharedGenres = [...genres1].filter(g => genres2.has(g));

            // Collect all recommendations
            const allRecs = new Map();

            const addToResults = (items, source, mediaType) => {
                (items || []).forEach(item => {
                    const id = item.id;
                    if (!allRecs.has(id) && !excludeSet.has(`tmdb${id}`)) {
                        // Calculate relevance score
                        const itemGenres = item.genre_ids || [];
                        const sharedCount = itemGenres.filter(g => sharedGenres.includes(g)).length;

                        allRecs.set(id, {
                            ...item,
                            media_type: mediaType || item.media_type || 'movie',
                            _score: sharedCount * 10 + (item.vote_count || 0) / 1000
                        });
                    } else if (allRecs.has(id)) {
                        // Boost score if item appears in multiple sources
                        const existing = allRecs.get(id);
                        existing._score += 5;
                    }
                });
            };

            // Add recommendations from all sources
            addToResults(rec1.results, 'rec1', type1);
            addToResults(rec2.results, 'rec2', type2);
            addToResults(sim1.results, 'sim1', type1);
            addToResults(sim2.results, 'sim2', type2);

            // Also search by shared genres to find mixed content
            if (sharedGenres.length > 0) {
                const genreStr = sharedGenres.join(',');

                const genrePromises = [];
                if (includeMovies) {
                    genrePromises.push(
                        fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreStr}&sort_by=vote_count.desc`).then(r => r.json())
                    );
                }
                if (includeTV) {
                    genrePromises.push(
                        fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_genres=${genreStr}&sort_by=vote_count.desc`).then(r => r.json())
                    );
                }

                const genreResults = await Promise.all(genrePromises);
                genreResults.forEach((data, idx) => {
                    const mediaType = (includeMovies && idx === 0) ? 'movie' : 'tv';
                    addToResults(data.results, 'genre', mediaType);
                });
            }

            // Sort by score and filter out the input items
            let results = [...allRecs.values()]
                .filter(m => m.id !== item1.id && m.id !== item2.id)
                .sort((a, b) => b._score - a._score);

            // Clean up internal score field
            results = results.map(({ _score, ...item }) => item);

            res.json({ results: results.slice(0, 40) });
        } else {
            res.json({ results: [] });
        }
    } catch (error) {
        console.error('Custom recommendations error:', error);
        res.status(500).json({ error: 'Failed to get custom recommendations' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        tmdb: TMDB_API_KEY !== 'YOUR_TMDB_API_KEY_HERE',
        dataDir: DATA_DIR
    });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
ensureDataDir().then(() => {
    app.listen(PORT, () => {
        console.log(`🎬 FlickVault server running on port ${PORT}`);
        console.log(`📡 Health check: http://localhost:${PORT}/health`);
        console.log(`💾 Data directory: ${DATA_DIR}`);

        if (TMDB_API_KEY === 'YOUR_TMDB_API_KEY_HERE') {
            console.warn('⚠️  WARNING: TMDB API key not set!');
        }
    });
});
