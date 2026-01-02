const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 10800;
const DATA_DIR = '/data';

// API Keys from environment variables
const OMDB_API_KEY = process.env.OMDB_API_KEY || 'YOUR_OMDB_API_KEY_HERE';
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'YOUR_TMDB_API_KEY_HERE';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

// OMDb API Routes
app.get('/api/search', async (req, res) => {
    try {
        const { query, type } = req.query;
        const url = `http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(query)}${type ? `&type=${type}` : ''}`;
        
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.get('/api/details/:imdbID', async (req, res) => {
    try {
        const { imdbID } = req.params;
        const url = `http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbID}&plot=full`;
        
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Details error:', error);
        res.status(500).json({ error: 'Failed to fetch details' });
    }
});

// TMDB API Routes
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

// TMDB Search endpoint
app.get('/api/tmdb/search', async (req, res) => {
    try {
        const { query, type } = req.query;
        const mediaType = type === 'series' ? 'tv' : 'movie';
        
        const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
        
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('TMDB search error:', error);
        res.status(500).json({ error: 'Failed to search TMDB' });
    }
});

app.get('/api/tmdb/details/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query;
        const mediaType = type === 'tv' ? 'tv' : 'movie';
        
        const url = `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos`;
        
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Details error:', error);
        res.status(500).json({ error: 'Failed to fetch details' });
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

app.get('/api/tmdb/recommendations', async (req, res) => {
    try {
        const { page } = req.query;
        const pageNum = page || 1;
        
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
        const movies = (movieData.results || []).map(item => ({ ...item, media_type: 'movie' }));
        const shows = (tvData.results || []).map(item => ({ ...item, media_type: 'tv' }));
        
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

app.post('/api/tmdb/custom-recommendations', async (req, res) => {
    try {
        const { title1, title2 } = req.body;
        
        // Search for both titles
        const search1 = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title1)}`);
        const data1 = await search1.json();
        
        const search2 = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title2)}`);
        const data2 = await search2.json();
        
        if (data1.results?.length > 0 && data2.results?.length > 0) {
            const item1 = data1.results[0];
            const item2 = data2.results[0];
            
            // Get genres from both
            const genreIds = [...new Set([...item1.genre_ids, ...item2.genre_ids])];
            
            // Find similar content (both movies and TV)
            const movieUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreIds.join(',')}&sort_by=popularity.desc`;
            const tvUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_genres=${genreIds.join(',')}&sort_by=popularity.desc`;
            
            const [movieRes, tvRes] = await Promise.all([
                fetch(movieUrl),
                fetch(tvUrl)
            ]);
            
            const movieData = await movieRes.json();
            const tvData = await tvRes.json();
            
            const movies = (movieData.results || []).map(item => ({ ...item, media_type: 'movie' }));
            const shows = (tvData.results || []).map(item => ({ ...item, media_type: 'tv' }));
            
            // Filter out searched items
            const filtered = [...movies, ...shows].filter(m => 
                m.id !== item1.id && m.id !== item2.id
            );
            
            res.json({ results: filtered });
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
        omdb: OMDB_API_KEY !== 'YOUR_OMDB_API_KEY_HERE',
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
        
        if (OMDB_API_KEY === 'YOUR_OMDB_API_KEY_HERE') {
            console.warn('⚠️  WARNING: OMDb API key not set!');
        }
        if (TMDB_API_KEY === 'YOUR_TMDB_API_KEY_HERE') {
            console.warn('⚠️  WARNING: TMDB API key not set!');
        }
    });
});
