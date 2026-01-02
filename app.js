const app = {
    token: null,
    username: null,
    vault: { movies: [], shows: [] },
    filters: {
        movies: { search: '', watched: 'all', rating: 'all', genre: 'all', sort: 'recent' },
        shows: { search: '', watched: 'all', rating: 'all', genre: 'all', sort: 'recent' }
    },

    async init() {
        try {
            const token = sessionStorage.getItem('flickvault_token');
            const username = sessionStorage.getItem('flickvault_username');
            
            if (token && username) {
                this.token = token;
                this.username = username;
                await this.loadVault();
                this.showApp();
                this.renderVault();
                this.updateStats();
            }
        } catch (err) {
            console.log('No existing session');
        }

        document.getElementById('authForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAuth();
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.search();
        });

        this.initAutoHideHeader();
    },

    initAutoHideHeader() {
        let lastScrollTop = 0;
        const header = document.querySelector('header');
        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    
                    if (scrollTop <= 0) {
                        header.classList.remove('header-hidden');
                    } else if (scrollTop > lastScrollTop && scrollTop > 100) {
                        header.classList.add('header-hidden');
                    }
                    
                    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
                    ticking = false;
                });
                ticking = true;
            }
        });
    },

    showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    },

    showLogin() {
        document.getElementById('modalTitle').textContent = 'Login';
        document.getElementById('email').classList.add('hidden');
        document.getElementById('email').required = false;
        document.getElementById('authSwitch').innerHTML = `Don't have an account? <a onclick="app.showRegister()" style="color:#e50914;cursor:pointer;">Register</a>`;
        document.getElementById('authModal').classList.add('active');
    },

    showRegister() {
        document.getElementById('modalTitle').textContent = 'Register';
        document.getElementById('email').classList.remove('hidden');
        document.getElementById('email').required = true;
        document.getElementById('authSwitch').innerHTML = `Have an account? <a onclick="app.showLogin()" style="color:#e50914;cursor:pointer;">Login</a>`;
        document.getElementById('authModal').classList.add('active');
    },

    async handleAuth() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            this.showToast('⚠️ Please fill in all fields');
            return;
        }
        
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await res.json();
            
            if (data.token) {
                this.username = username;
                this.token = data.token;
                
                sessionStorage.setItem('flickvault_token', data.token);
                sessionStorage.setItem('flickvault_username', username);
                
                document.getElementById('authModal').classList.remove('active');
                await this.loadVault();
                this.showApp();
                this.renderVault();
                this.updateStats();
                this.showToast(`✨ Welcome, ${username}!`);
            } else {
                this.showToast('❌ Login failed');
            }
        } catch (err) {
            console.error('Auth error:', err);
            this.showToast('❌ Error logging in. Please try again.');
        }
    },

    async logout() {
        if (confirm('Logout? Your data is saved and will be available when you login again.')) {
            sessionStorage.removeItem('flickvault_token');
            sessionStorage.removeItem('flickvault_username');
            location.reload();
        }
    },

    showApp() {
        const username = this.username || 'User';
        document.getElementById('welcomeSection').style.display = 'none';
        document.getElementById('appContent').classList.remove('hidden');
        document.getElementById('loginBtn').classList.add('hidden');
        document.getElementById('registerBtn').classList.add('hidden');
        document.getElementById('browseBtn').classList.remove('hidden');
        document.getElementById('recommendBtn').classList.remove('hidden');
        document.getElementById('analyticsBtn').classList.remove('hidden');
        document.getElementById('settingsBtn').classList.remove('hidden');
        document.getElementById('logoutBtn').classList.remove('hidden');
        document.getElementById('userGreeting').classList.remove('hidden');
        document.getElementById('userGreeting').textContent = `${username}`;
    },

    async loadVault() {
        try {
            const res = await fetch(`/api/vault/${this.username}`);
            const data = await res.json();
            this.vault = data;
            
            this.vault.movies = this.vault.movies.map(m => ({ rating: 0, watched: false, ...m }));
            this.vault.shows = this.vault.shows.map(s => ({ rating: 0, watched: false, ...s }));
        } catch (err) {
            console.log('No vault data found, starting fresh');
            this.vault = { movies: [], shows: [] };
        }
    },

    async saveVault() {
        try {
            await fetch(`/api/vault/${this.username}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.vault)
            });
        } catch (err) {
            console.error('Error saving vault:', err);
            this.showToast('⚠️ Error saving data');
        }
    },

    updateStats() {
        const allItems = [...this.vault.movies, ...this.vault.shows];
        const watched = allItems.filter(i => i.watched).length;
        const rated = allItems.filter(i => i.rating > 0);
        const avgRating = rated.length > 0 
            ? (rated.reduce((sum, i) => sum + i.rating, 0) / rated.length).toFixed(1)
            : 0;

        document.getElementById('totalMovies').textContent = this.vault.movies.length;
        document.getElementById('totalShows').textContent = this.vault.shows.length;
        document.getElementById('totalWatched').textContent = watched;
        document.getElementById('avgRating').textContent = avgRating;
    },

    clearSearch() {
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    },

    async search() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) {
            this.showToast('⚠️ Enter a search term');
            return;
        }

        const div = document.getElementById('searchResults');
        div.innerHTML = '<div class="loading"><div class="spinner"></div><p>Searching...</p></div>';

        try {
            const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&type=`);
            const data = await res.json();

            if (data.Response === 'True') {
                const filtered = data.Search.filter(i => i.Poster !== 'N/A');
                if (filtered.length === 0) {
                    div.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;">No results with images found</p>';
                    return;
                }
                
                div.innerHTML = filtered.map(item => `
                    <div class="content-card" style="cursor:pointer;" onclick="app.showOMDbDetail('${item.imdbID}')">
                        <img src="${item.Poster}" alt="${item.Title}">
                        <div class="content-card-info">
                            <div class="content-card-title">${item.Title}</div>
                            <div class="content-card-year">${item.Year}</div>
                        </div>
                        <div class="card-actions">
                            <button onclick="event.stopPropagation(); app.quickAdd('${item.imdbID}')">+ Add to Vault</button>
                        </div>
                    </div>
                `).join('');
            } else {
                div.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;">No results found</p>';
            }
        } catch (err) {
            div.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;">Error searching</p>';
        }
    },

    async showOMDbDetail(imdbID) {
        const modal = document.getElementById('detailModal');
        modal.classList.add('active');
        
        const content = document.getElementById('detailModalContent');
        content.innerHTML = '<div class="loading" style="padding:100px;"><div class="spinner"></div><p>Loading details...</p></div>';
        
        try {
            const res = await fetch(`/api/details/${imdbID}`);
            const item = await res.json();
            
            if (item.Response === 'True') {
                const title = item.Title;
                const year = item.Year;
                const rating = item.imdbRating !== 'N/A' ? item.imdbRating : 'N/A';
                const runtime = item.Runtime;
                const type = item.Type === 'movie' ? 'movie' : 'series';
                
                let providersHTML = '';
                let tmdbId = null;
                try {
                    const searchRes = await fetch(`/api/tmdb/search?query=${encodeURIComponent(title)}&type=${type}`);
                    const searchData = await searchRes.json();
                    
                    if (searchData.results && searchData.results.length > 0) {
                        tmdbId = searchData.results[0].id;
                        const providersRes = await fetch(`/api/tmdb/providers/${tmdbId}?type=${type}`);
                        const providersData = await providersRes.json();
                        
                        if (providersData.results && providersData.results.US) {
                            providersHTML = this.renderProviders(providersData.results.US);
                        }
                    }
                } catch (err) {
                    console.log('Could not fetch streaming providers:', err);
                }
                
                content.innerHTML = `
                    <button class="detail-close-btn" onclick="app.closeDetailModal()">×</button>
                    <div class="detail-info">
                        <div class="detail-header">
                            <img class="detail-poster" src="${item.Poster !== 'N/A' ? item.Poster : 'https://via.placeholder.com/150x225?text=No+Image'}" alt="${title}">
                            <div class="detail-main">
                                <div class="detail-title">${title}</div>
                                <div class="detail-meta">
                                    <span class="media-badge ${type === 'series' ? 'tv' : ''}">${type === 'series' ? 'TV Show' : 'Movie'}</span>
                                    <span>📅 ${year}</span>
                                    ${runtime !== 'N/A' ? `<span>⏱️ ${runtime}</span>` : ''}
                                    <span class="detail-rating">⭐ ${rating}</span>
                                </div>
                                ${item.Genre && item.Genre !== 'N/A' ? `
                                    <div class="detail-genres">
                                        ${item.Genre.split(',').map(g => `<span class="genre-tag">${g.trim()}</span>`).join('')}
                                    </div>
                                ` : ''}
                                <div class="detail-actions">
                                    <button class="primary-btn" onclick="app.quickAdd('${imdbID}')">+ Add to Vault</button>
                                    ${tmdbId ? `<button class="trailer-btn" onclick="app.openTrailer(${tmdbId}, '${type}', '${title.replace(/'/g, "\\'")}')">🎬 Watch Trailer</button>` : ''}
                                    <button class="secondary-btn" onclick="app.closeDetailModal()">Close</button>
                                </div>
                            </div>
                        </div>
                        ${item.Plot && item.Plot !== 'N/A' ? `
                            <div class="detail-overview">
                                <h3 style="color:#e50914;margin-bottom:10px;">Overview</h3>
                                <p>${item.Plot}</p>
                            </div>
                        ` : ''}
                        ${item.Director && item.Director !== 'N/A' ? `
                            <div style="margin-top:15px;">
                                <strong style="color:#e50914;">Director:</strong> ${item.Director}
                            </div>
                        ` : ''}
                        ${item.Actors && item.Actors !== 'N/A' ? `
                            <div style="margin-top:10px;">
                                <strong style="color:#e50914;">Cast:</strong> ${item.Actors}
                            </div>
                        ` : ''}
                        ${providersHTML}
                    </div>
                `;
            }
        } catch (err) {
            console.error('Detail error:', err);
            content.innerHTML = '<div style="padding:100px;text-align:center;color:#aaa;">Error loading details</div>';
        }
    },

    async quickAdd(imdbID) {
        try {
            const res = await fetch(`/api/details/${imdbID}`);
            const item = await res.json();
            
            const type = item.Type === 'movie' ? 'movie' : 'series';
            const list = type === 'movie' ? this.vault.movies : this.vault.shows;
            
            if (list.find(i => i.imdbID === item.imdbID)) {
                this.showToast('⚠️ Already in your vault');
                return;
            }
            
            list.push({ ...item, addedAt: Date.now(), rating: 0, watched: false });
            await this.saveVault();
            this.renderVault();
            this.updateStats();
            this.closeDetailModal();
            this.showToast(`✅ Added "${item.Title}" to vault!`);
        } catch (err) {
            this.showToast('❌ Error adding item');
        }
    },

    async updateRating(imdbID, type, rating) {
        const list = type === 'movie' ? this.vault.movies : this.vault.shows;
        const item = list.find(i => i.imdbID === imdbID);
        if (item) {
            item.rating = rating;
            await this.saveVault();
            this.renderVault();
            this.updateStats();
            this.showToast(`⭐ Rated ${rating} stars`);
        }
    },

    async toggleWatched(imdbID, type) {
        const list = type === 'movie' ? this.vault.movies : this.vault.shows;
        const item = list.find(i => i.imdbID === imdbID);
        if (item) {
            item.watched = !item.watched;
            await this.saveVault();
            this.renderVault();
            this.updateStats();
            this.showToast(item.watched ? '✅ Marked as watched' : '⏳ Marked as unwatched');
        }
    },

    switchTab(tab) {
        document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');

        if (tab === 'movies') {
            document.getElementById('moviesVault').classList.remove('hidden');
            document.getElementById('showsVault').classList.add('hidden');
            document.getElementById('moviesFilters').classList.remove('hidden');
            document.getElementById('showsFilters').classList.add('hidden');
        } else {
            document.getElementById('moviesVault').classList.add('hidden');
            document.getElementById('showsVault').classList.remove('hidden');
            document.getElementById('moviesFilters').classList.add('hidden');
            document.getElementById('showsFilters').classList.remove('hidden');
        }
    },

    updateFilter(type, filterType, value) {
        this.filters[type][filterType] = value;
        this.renderVault();
    },

    clearFilters(type) {
        this.filters[type] = { search: '', watched: 'all', rating: 'all', genre: 'all', sort: 'recent' };
        
        const prefix = type === 'movies' ? 'movie' : 'show';
        document.getElementById(`${prefix}FilterSearch`).value = '';
        document.getElementById(`${prefix}FilterWatched`).value = 'all';
        document.getElementById(`${prefix}FilterRating`).value = 'all';
        document.getElementById(`${prefix}FilterGenre`).value = 'all';
        document.getElementById(`${prefix}FilterSort`).value = 'recent';
        
        this.renderVault();
    },
    
    toggleFilters(type) {
        const content = document.getElementById(`${type}FiltersContent`);
        const btn = event.target.closest('.toggle-filters-btn');
        const arrow = btn.querySelector('.filter-arrow');
        
        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            arrow.textContent = '▲';
        } else {
            content.classList.add('collapsed');
            arrow.textContent = '▼';
        }
    },

    getFilteredItems(items, type) {
        const filters = this.filters[type];
        let filtered = [...items];

        if (filters.search) {
            const search = filters.search.toLowerCase();
            filtered = filtered.filter(item => 
                item.Title.toLowerCase().includes(search) ||
                (item.Genre && item.Genre.toLowerCase().includes(search))
            );
        }

        if (filters.watched !== 'all') {
            filtered = filtered.filter(item => 
                filters.watched === 'watched' ? item.watched : !item.watched
            );
        }

        if (filters.rating !== 'all') {
            const ratingValue = parseInt(filters.rating);
            filtered = filtered.filter(item => item.rating === ratingValue);
        }

        if (filters.genre !== 'all') {
            filtered = filtered.filter(item => 
                item.Genre && item.Genre.toLowerCase().includes(filters.genre.toLowerCase())
            );
        }

        switch (filters.sort) {
            case 'recent':
                filtered.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
                break;
            case 'title':
                filtered.sort((a, b) => a.Title.localeCompare(b.Title));
                break;
            case 'year':
                filtered.sort((a, b) => {
                    const yearA = parseInt(a.Year) || 0;
                    const yearB = parseInt(b.Year) || 0;
                    return yearB - yearA;
                });
                break;
            case 'rating':
                filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
        }

        return filtered;
    },

    getAllGenres(items) {
        const genres = new Set();
        items.forEach(item => {
            if (item.Genre && item.Genre !== 'N/A') {
                item.Genre.split(',').forEach(g => genres.add(g.trim()));
            }
        });
        return Array.from(genres).sort();
    },

    renderVault() {
        const movieGenres = this.getAllGenres(this.vault.movies);
        const showGenres = this.getAllGenres(this.vault.shows);
        
        this.updateGenreDropdown('movieFilterGenre', movieGenres);
        this.updateGenreDropdown('showFilterGenre', showGenres);
        
        const filteredMovies = this.getFilteredItems(this.vault.movies, 'movies');
        const filteredShows = this.getFilteredItems(this.vault.shows, 'shows');
        
        this.renderList('moviesVault', filteredMovies, 'movie');
        this.renderList('showsVault', filteredShows, 'series');
    },

    updateGenreDropdown(id, genres) {
        const select = document.getElementById(id);
        const currentValue = select.value;
        
        const options = '<option value="all">All Genres</option>' + 
            genres.map(g => `<option value="${g}">${g}</option>`).join('');
        
        select.innerHTML = options;
        
        if (genres.includes(currentValue)) {
            select.value = currentValue;
        }
    },

    async showVaultItemDetail(imdbID, type) {
        const list = type === 'movie' ? this.vault.movies : this.vault.shows;
        const item = list.find(i => i.imdbID === imdbID);
        
        if (!item) return;

        const modal = document.getElementById('detailModal');
        modal.classList.add('active');
        
        const content = document.getElementById('detailModalContent');
        content.innerHTML = '<div class="loading" style="padding:100px;"><div class="spinner"></div><p>Loading details...</p></div>';
        
        try {
            let fullItem = item;
            
            if (!imdbID.startsWith('tmdb')) {
                const res = await fetch(`/api/details/${imdbID}`);
                fullItem = await res.json();
            }
            
            const title = fullItem.Title || fullItem.title || fullItem.name;
            const year = fullItem.Year || (fullItem.release_date || fullItem.first_air_date || '').split('-')[0];
            const rating = fullItem.imdbRating || (fullItem.vote_average ? fullItem.vote_average.toFixed(1) : 'N/A');
            const runtime = fullItem.Runtime || (fullItem.runtime ? `${fullItem.runtime} min` : '');
            const mediaType = type === 'series' ? 'tv' : 'movie';
            
            let providersHTML = '';
            let finalTmdbId = null;
            try {
                let tmdbId = null;
                
                if (imdbID.startsWith('tmdb')) {
                    tmdbId = imdbID.replace('tmdb', '');
                } else {
                    const searchRes = await fetch(`/api/tmdb/search?query=${encodeURIComponent(title)}&type=${mediaType}`);
                    const searchData = await searchRes.json();
                    if (searchData.results && searchData.results.length > 0) {
                        tmdbId = searchData.results[0].id;
                    }
                }
                
                finalTmdbId = tmdbId;
                
                if (tmdbId) {
                    const providersRes = await fetch(`/api/tmdb/providers/${tmdbId}?type=${mediaType}`);
                    const providersData = await providersRes.json();
                    
                    if (providersData.results && providersData.results.US) {
                        providersHTML = this.renderProviders(providersData.results.US);
                    }
                }
            } catch (err) {
                console.log('Could not fetch streaming providers:', err);
            }
            
            let backdropHTML = '';
            try {
                let tmdbId = null;
                if (imdbID.startsWith('tmdb')) {
                    tmdbId = imdbID.replace('tmdb', '');
                } else {
                    const searchRes = await fetch(`/api/tmdb/search?query=${encodeURIComponent(title)}&type=${mediaType}`);
                    const searchData = await searchRes.json();
                    if (searchData.results && searchData.results.length > 0) {
                        tmdbId = searchData.results[0].id;
                    }
                }
                
                if (tmdbId) {
                    const detailRes = await fetch(`/api/tmdb/details/${tmdbId}?type=${mediaType}`);
                    const detailData = await detailRes.json();
                    if (detailData.backdrop_path) {
                        backdropHTML = `<img class="detail-backdrop" src="https://image.tmdb.org/t/p/original${detailData.backdrop_path}" alt="${title}">`;
                    }
                }
            } catch (err) {
                console.log('Could not fetch backdrop:', err);
            }
            
            content.innerHTML = `
                <button class="detail-close-btn" onclick="app.closeDetailModal()">×</button>
                ${backdropHTML}
                <div class="detail-info">
                    <div class="detail-header">
                        <img class="detail-poster" src="${fullItem.Poster !== 'N/A' ? fullItem.Poster : 'https://via.placeholder.com/150x225?text=No+Image'}" alt="${title}">
                        <div class="detail-main">
                            <div class="detail-title">${title}</div>
                            <div class="detail-meta">
                                <span class="media-badge ${type === 'series' ? 'tv' : ''}">${type === 'series' ? 'TV Show' : 'Movie'}</span>
                                <span>📅 ${year}</span>
                                ${runtime ? `<span>⏱️ ${runtime}</span>` : ''}
                                <span class="detail-rating">⭐ ${rating}</span>
                            </div>
                            ${fullItem.Genre && fullItem.Genre !== 'N/A' ? `
                                <div class="detail-genres">
                                    ${fullItem.Genre.split(',').map(g => `<span class="genre-tag">${g.trim()}</span>`).join('')}
                                </div>
                            ` : ''}
                            <div class="detail-actions">
                                <button class="secondary-btn" onclick="app.closeDetailModal()">Close</button>
                                ${finalTmdbId ? `<button class="trailer-btn" onclick="app.openTrailer(${finalTmdbId}, '${type}', '${title.replace(/'/g, "\\'")}')">🎬 Watch Trailer</button>` : ''}
                            </div>
                        </div>
                    </div>
                    ${fullItem.Plot && fullItem.Plot !== 'N/A' ? `
                        <div class="detail-overview">
                            <h3 style="color:#e50914;margin-bottom:10px;">Overview</h3>
                            <p>${fullItem.Plot}</p>
                        </div>
                    ` : ''}
                    ${fullItem.Director && fullItem.Director !== 'N/A' ? `
                        <div style="margin-top:15px;">
                            <strong style="color:#e50914;">Director:</strong> ${fullItem.Director}
                        </div>
                    ` : ''}
                    ${fullItem.Actors && fullItem.Actors !== 'N/A' ? `
                        <div style="margin-top:10px;">
                            <strong style="color:#e50914;">Cast:</strong> ${fullItem.Actors}
                        </div>
                    ` : ''}
                    ${providersHTML}
                </div>
            `;
        } catch (err) {
            console.error('Detail error:', err);
            content.innerHTML = '<div style="padding:100px;text-align:center;color:#aaa;">Error loading details</div>';
        }
    },

    renderList(containerId, items, type) {
        const div = document.getElementById(containerId);
        
        if (items.length === 0) {
            div.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;grid-column:1/-1;">No items match your filters</p>';
            return;
        }

        div.innerHTML = items.map(item => `
            <div class="content-card" style="position:relative;cursor:pointer;" onclick="app.showVaultItemDetail('${item.imdbID}', '${type}')">
                ${item.watched ? '<div class="watched-badge">✓ Watched</div>' : ''}
                <img src="${item.Poster !== 'N/A' ? item.Poster : 'https://via.placeholder.com/200x300?text=No+Image'}" alt="${item.Title}">
                <div class="content-card-info">
                    <div class="content-card-title">${item.Title}</div>
                    <div class="content-card-year">${item.Year}</div>
                    <div class="rating-stars">
                        ${[1,2,3,4,5].map(star => `
                            <span class="star ${star <= (item.rating || 0) ? 'filled' : ''}" 
                                  onclick="event.stopPropagation(); app.updateRating('${item.imdbID}', '${type}', ${star})">★</span>
                        `).join('')}
                    </div>
                </div>
                <div class="card-actions" onclick="event.stopPropagation();">
                    <button onclick="app.toggleWatched('${item.imdbID}', '${type}')">${item.watched ? '↩ Unwatch' : '✓ Mark Watched'}</button>
                    <button class="remove-btn" onclick="app.removeItem('${item.imdbID}', '${type}')">🗑 Remove</button>
                </div>
            </div>
        `).join('');
    },

    async removeItem(imdbID, type) {
        if (!confirm('Remove this item from your vault?')) return;

        if (type === 'movie') {
            this.vault.movies = this.vault.movies.filter(i => i.imdbID !== imdbID);
        } else {
            this.vault.shows = this.vault.shows.filter(i => i.imdbID !== imdbID);
        }
        
        await this.saveVault();
        this.renderVault();
        this.updateStats();
        this.showToast('🗑️ Removed from vault');
    },

    showBrowse() {
        const modal = document.getElementById('browseModal');
        modal.classList.add('active');
        
        const content = document.getElementById('browseContent');
        if (!content.hasAttribute('data-loaded')) {
            this.loadInitialBrowse();
            content.setAttribute('data-loaded', 'true');
        }
    },

    closeBrowse() {
        document.getElementById('browseModal').classList.remove('active');
    },

    async loadInitialBrowse() {
        const content = document.getElementById('browseContent');
        content.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading popular content...</p></div>';
        
        this.browsePage = 1;
        this.browseGenre = 'all';
        this.browseLoading = false;
        
        await this.loadBrowseContent(1);
        
        const container = content.parentElement;
        container.onscroll = () => {
            if (container.scrollHeight - container.scrollTop <= container.clientHeight + 200) {
                if (!this.browseLoading && this.browsePage < 20) {
                    this.loadMoreBrowse();
                }
            }
        };
    },

    async filterBrowse(genre) {
        document.querySelectorAll('.genre-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        this.browsePage = 1;
        this.browseGenre = genre;
        this.browseLoading = false;
        
        const content = document.getElementById('browseContent');
        content.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
        
        await this.loadBrowseContent(1);
    },

    async loadBrowseContent(page) {
        const content = document.getElementById('browseContent');
        
        try {
            const url = `/api/tmdb/browse/${this.browseGenre === 'all' ? 'action' : this.browseGenre}?page=${page}`;
            
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
                const html = data.results.map(item => `
                    <div class="content-card" onclick="app.showDetailModal(${item.id}, '${item.media_type || 'movie'}')">
                        <span class="media-badge ${item.media_type === 'tv' ? 'tv' : ''}">${item.media_type === 'tv' ? 'TV' : 'Movie'}</span>
                        <img src="https://image.tmdb.org/t/p/w500${item.poster_path}" 
                             alt="${item.title || item.name}"
                             onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                        <div class="content-card-info">
                            <div class="content-card-title">${item.title || item.name}</div>
                            <div class="content-card-year">${(item.release_date || item.first_air_date || '').split('-')[0] || 'N/A'}</div>
                        </div>
                    </div>
                `).join('');
                
                if (page === 1) {
                    content.innerHTML = html;
                } else {
                    content.innerHTML += html;
                }
            } else if (page === 1) {
                content.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;grid-column:1/-1;">No results found</p>';
            }
        } catch (err) {
            console.error('Browse error:', err);
            if (page === 1) {
                content.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;grid-column:1/-1;">Error loading content</p>';
            }
        }
    },

    async loadMoreBrowse() {
        if (this.browseLoading) return;
        
        this.browseLoading = true;
        this.browsePage++;
        
        const content = document.getElementById('browseContent');
        content.innerHTML += '<div class="loading" style="grid-column: 1/-1;"><div class="spinner"></div><p>Loading more...</p></div>';
        
        await this.loadBrowseContent(this.browsePage);
        
        const loadingDivs = content.querySelectorAll('.loading');
        loadingDivs.forEach(el => el.remove());
        
        this.browseLoading = false;
    },

    async showDetailModal(tmdbId, mediaType) {
        const modal = document.getElementById('detailModal');
        modal.classList.add('active');
        
        const content = document.getElementById('detailModalContent');
        content.innerHTML = '<div class="loading" style="padding:100px;"><div class="spinner"></div><p>Loading details...</p></div>';
        
        try {
            const type = mediaType === 'tv' ? 'tv' : 'movie';
            const res = await fetch(`/api/tmdb/details/${tmdbId}?type=${type}`);
            const item = await res.json();
            
            if (item.id) {
                const title = item.title || item.name;
                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
                const runtime = item.runtime ? `${item.runtime} min` : (item.episode_run_time?.[0] ? `${item.episode_run_time[0]} min/ep` : '');
                
                let providersHTML = '';
                try {
                    const providersRes = await fetch(`/api/tmdb/providers/${tmdbId}?type=${type}`);
                    const providersData = await providersRes.json();
                    
                    if (providersData.results && providersData.results.US) {
                        providersHTML = this.renderProviders(providersData.results.US);
                    }
                } catch (err) {
                    console.log('Could not fetch streaming providers:', err);
                }
                
                content.innerHTML = `
                    <button class="detail-close-btn" onclick="app.closeDetailModal()">×</button>
                    ${item.backdrop_path ? `<img class="detail-backdrop" src="https://image.tmdb.org/t/p/original${item.backdrop_path}" alt="${title}">` : ''}
                    <div class="detail-info">
                        <div class="detail-header">
                            <img class="detail-poster" src="https://image.tmdb.org/t/p/w500${item.poster_path}" alt="${title}" onerror="this.src='https://via.placeholder.com/150x225?text=No+Image'">
                            <div class="detail-main">
                                <div class="detail-title">${title}</div>
                                <div class="detail-meta">
                                    <span class="media-badge ${type === 'tv' ? 'tv' : ''}">${type === 'tv' ? 'TV Show' : 'Movie'}</span>
                                    <span>📅 ${year}</span>
                                    ${runtime ? `<span>⏱️ ${runtime}</span>` : ''}
                                    <span class="detail-rating">⭐ ${rating}</span>
                                </div>
                                ${item.genres?.length ? `
                                    <div class="detail-genres">
                                        ${item.genres.map(g => `<span class="genre-tag">${g.name}</span>`).join('')}
                                    </div>
                                ` : ''}
                                <div class="detail-actions">
                                    <button class="primary-btn" onclick="app.addFromTMDB(${tmdbId}, '${type}')">+ Add to Vault</button>
                                    <button class="trailer-btn" onclick="app.openTrailer(${tmdbId}, '${type}', '${title.replace(/'/g, "\\'")}')">🎬 Watch Trailer</button>
                                    <button class="secondary-btn" onclick="app.closeDetailModal()">Close</button>
                                </div>
                            </div>
                        </div>
                        ${item.overview ? `
                            <div class="detail-overview">
                                <h3 style="color:#e50914;margin-bottom:10px;">Overview</h3>
                                <p>${item.overview}</p>
                            </div>
                        ` : ''}
                        ${providersHTML}
                    </div>
                `;
            }
        } catch (err) {
            console.error('Detail error:', err);
            content.innerHTML = '<div style="padding:100px;text-align:center;color:#aaa;">Error loading details</div>';
        }
    },

    async openTrailer(tmdbId, mediaType, title) {
        try {
            const type = mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
            const res = await fetch(`/api/tmdb/videos/${tmdbId}?type=${type}`);
            const data = await res.json();
            
            const trailer = data.results?.find(v => 
                v.site === 'YouTube' && 
                (v.type === 'Trailer' || v.type === 'Teaser')
            );
            
            if (trailer) {
                window.open(`https://www.youtube.com/watch?v=${trailer.key}`, '_blank');
            } else {
                const searchQuery = encodeURIComponent(`${title} official trailer`);
                window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
            }
        } catch (err) {
            console.error('Trailer error:', err);
            const searchQuery = encodeURIComponent(`${title} official trailer`);
            window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
        }
    },

    async addFromTMDB(tmdbId, mediaType) {
        try {
            const res = await fetch(`/api/tmdb/details/${tmdbId}?type=${mediaType}`);
            const tmdbData = await res.json();
            
            const title = tmdbData.title || tmdbData.name;
            const year = (tmdbData.release_date || tmdbData.first_air_date || '').split('-')[0];
            
            const omdbRes = await fetch(`/api/search?query=${encodeURIComponent(title)}&type=${mediaType === 'tv' ? 'series' : 'movie'}`);
            const omdbData = await omdbRes.json();
            
            let item = null;
            if (omdbData.Response === 'True' && omdbData.Search?.length > 0) {
                const match = omdbData.Search.find(s => s.Year.startsWith(year)) || omdbData.Search[0];
                const detailRes = await fetch(`/api/details/${match.imdbID}`);
                item = await detailRes.json();
            }
            
            if (!item || item.Response === 'False') {
                item = {
                    Title: title,
                    Year: year,
                    Type: mediaType === 'tv' ? 'series' : 'movie',
                    Poster: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : 'N/A',
                    Genre: tmdbData.genres?.map(g => g.name).join(', ') || 'N/A',
                    Plot: tmdbData.overview || 'N/A',
                    imdbID: `tmdb${tmdbId}`,
                    Runtime: tmdbData.runtime ? `${tmdbData.runtime} min` : 'N/A',
                    imdbRating: tmdbData.vote_average ? tmdbData.vote_average.toFixed(1) : 'N/A'
                };
            }
            
            const type = mediaType === 'tv' ? 'series' : 'movie';
            const list = type === 'movie' ? this.vault.movies : this.vault.shows;
            
            if (list.find(i => i.imdbID === item.imdbID)) {
                this.showToast('⚠️ Already in your vault');
                return;
            }
            
            list.push({ ...item, addedAt: Date.now(), rating: 0, watched: false });
            await this.saveVault();
            this.renderVault();
            this.updateStats();
            this.closeDetailModal();
            this.showToast(`✅ Added "${item.Title}" to vault!`);
        } catch (err) {
            console.error('Add error:', err);
            this.showToast('❌ Error adding item');
        }
    },

    switchRecommendTab(tab) {
        document.querySelectorAll('.recommend-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        
        if (tab === 'vault') {
            document.getElementById('vaultRecommendSection').classList.remove('hidden');
            document.getElementById('customRecommendSection').classList.add('hidden');
        } else {
            document.getElementById('vaultRecommendSection').classList.add('hidden');
            document.getElementById('customRecommendSection').classList.remove('hidden');
        }
    },

    async getVaultRecommendations() {
        const allItems = [...this.vault.movies, ...this.vault.shows];
        
        if (allItems.length === 0) {
            this.showToast('⚠️ Add items to your vault first!');
            return;
        }

        this.recommendPage = 1;
        this.recommendLoading = false;
        
        const div = document.getElementById('recommendResults');
        div.innerHTML = '<div class="loading"><div class="spinner"></div><p>Analyzing your vault...</p></div>';
        
        const container = div.parentElement;
        container.onscroll = () => {
            if (container.scrollHeight - container.scrollTop <= container.clientHeight + 200) {
                if (!this.recommendLoading && this.recommendPage < 10) {
                    this.loadMoreRecommendations();
                }
            }
        };
        
        await this.loadRecommendationContent(1);
    },

    async loadRecommendationContent(page) {
        const div = document.getElementById('recommendResults');
        
        try {
            const res = await fetch(`/api/tmdb/recommendations?page=${page}`);
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
                const html = data.results.map(item => `
                    <div class="content-card" onclick="app.showDetailModal(${item.id}, '${item.media_type || 'movie'}')">
                        <span class="media-badge ${item.media_type === 'tv' ? 'tv' : ''}">${item.media_type === 'tv' ? 'TV' : 'Movie'}</span>
                        <img src="https://image.tmdb.org/t/p/w500${item.poster_path}" 
                             alt="${item.title || item.name}"
                             onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                        <div class="content-card-info">
                            <div class="content-card-title">${item.title || item.name}</div>
                            <div class="content-card-year">${(item.release_date || item.first_air_date || '')?.split('-')[0] || 'N/A'}</div>
                        </div>
                    </div>
                `).join('');
                
                if (page === 1) {
                    div.innerHTML = html;
                } else {
                    div.innerHTML += html;
                }
            } else if (page === 1) {
                div.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;">No recommendations found. Try adding more items with different genres!</p>';
            }
        } catch (err) {
            console.error('Recommendation error:', err);
            if (page === 1) {
                div.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;">Error loading recommendations. Make sure TMDB API key is set.</p>';
            }
        }
    },

    async loadMoreRecommendations() {
        if (this.recommendLoading) return;
        
        this.recommendLoading = true;
        this.recommendPage++;
        
        const div = document.getElementById('recommendResults');
        div.innerHTML += '<div class="loading" style="grid-column: 1/-1;"><div class="spinner"></div><p>Loading more...</p></div>';
        
        await this.loadRecommendationContent(this.recommendPage);
        
        const loadingDivs = div.querySelectorAll('.loading');
        loadingDivs.forEach(el => el.remove());
        
        this.recommendLoading = false;
    },

    async getCustomRecommendations() {
        const title1 = document.getElementById('recommend1').value.trim();
        const title2 = document.getElementById('recommend2').value.trim();
        
        if (!title1 || !title2) {
            this.showToast('⚠️ Enter both titles');
            return;
        }

        const div = document.getElementById('recommendResults');
        div.innerHTML = '<div class="loading"><div class="spinner"></div><p>Finding matches...</p></div>';
        
        try {
            const res = await fetch('/api/tmdb/custom-recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title1, title2 })
            });
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
                div.innerHTML = data.results.slice(0, 20).map(item => `
                    <div class="content-card" onclick="app.showDetailModal(${item.id}, '${item.media_type || 'movie'}')">
                        <span class="media-badge ${item.media_type === 'tv' ? 'tv' : ''}">${item.media_type === 'tv' ? 'TV' : 'Movie'}</span>
                        <img src="https://image.tmdb.org/t/p/w500${item.poster_path}" 
                             alt="${item.title || item.name}"
                             onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                        <div class="content-card-info">
                            <div class="content-card-title">${item.title || item.name}</div>
                            <div class="content-card-year">${(item.release_date || item.first_air_date || '').split('-')[0] || 'N/A'}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                div.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;">No matches found. Try different titles!</p>';
            }
        } catch (err) {
            console.error('Custom recommendation error:', err);
            div.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;">Error finding matches. Check that both titles exist.</p>';
        }
    },

    renderProviders(providers) {
        let html = '<div class="providers-section" style="margin-top:25px; padding-top:20px; border-top:2px solid rgba(255,255,255,0.1);">';
        html += '<h3 style="color:#e50914;margin-bottom:15px;">🎬 Where to Watch</h3>';
        
        const categories = [
            { key: 'flatrate', label: 'Stream', icon: '▶️' },
            { key: 'buy', label: 'Buy', icon: '💰' },
            { key: 'rent', label: 'Rent', icon: '🎫' }
        ];
        
        let hasProviders = false;
        
        categories.forEach(cat => {
            if (providers[cat.key] && providers[cat.key].length > 0) {
                hasProviders = true;
                html += `
                    <div style="margin-bottom:15px;">
                        <div style="color:rgba(255,255,255,0.7);font-size:14px;margin-bottom:8px;font-weight:bold;">
                            ${cat.icon} ${cat.label}
                        </div>
                        <div class="providers-list">
                            ${providers[cat.key].map(p => `
                                <div class="provider-item" title="${p.provider_name}">
                                    <img src="https://image.tmdb.org/t/p/original${p.logo_path}" 
                                         alt="${p.provider_name}"
                                         onerror="this.parentElement.style.display='none'">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        });
        
        if (!hasProviders) {
            html += '<p style="color:rgba(255,255,255,0.5);font-style:italic;">Streaming information not available</p>';
        }
        
        html += '</div>';
        return html;
    },

    closeDetailModal() {
        document.getElementById('detailModal').classList.remove('active');
    },

    showRecommendations() {
        document.getElementById('recommendResults').innerHTML = '';
        document.getElementById('recommendModal').classList.add('active');
    },

    closeRecommendations() {
        document.getElementById('recommendModal').classList.remove('active');
    },

    showAnalytics() {
        const movies = this.vault.movies;
        const shows = this.vault.shows;
        const allItems = [...movies, ...shows];
        
        if (allItems.length === 0) {
            this.showToast('⚠️ Add items to see analytics');
            return;
        }

        document.getElementById('analyticsModal').classList.add('active');
        
        const totalItems = allItems.length;
        const watchedItems = allItems.filter(i => i.watched).length;
        const watchRate = ((watchedItems / totalItems) * 100).toFixed(1);
        
        const ratedItems = allItems.filter(i => i.rating > 0);
        const avgRating = ratedItems.length > 0 
            ? (ratedItems.reduce((sum, i) => sum + i.rating, 0) / ratedItems.length).toFixed(1)
            : 0;
        const fiveStarCount = allItems.filter(i => i.rating === 5).length;
        
        let totalRuntime = 0;
        movies.forEach(m => {
            if (m.Runtime && m.Runtime !== 'N/A') {
                const minutes = parseInt(m.Runtime.replace(/\D/g, ''));
                if (!isNaN(minutes)) totalRuntime += minutes;
            }
        });
        const runtimeHours = Math.floor(totalRuntime / 60);
        const runtimeMinutes = totalRuntime % 60;
        
        const genreCount = {};
        allItems.forEach(item => {
            if (item.Genre && item.Genre !== 'N/A') {
                item.Genre.split(',').forEach(g => {
                    const genre = g.trim();
                    genreCount[genre] = (genreCount[genre] || 0) + 1;
                });
            }
        });
        
        const topGenres = Object.entries(genreCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        const maxGenreCount = topGenres[0] ? topGenres[0][1] : 1;
        
        const yearCount = {};
        allItems.forEach(item => {
            if (item.Year && item.Year !== 'N/A') {
                const year = item.Year.split('–')[0];
                yearCount[year] = (yearCount[year] || 0) + 1;
            }
        });
        
        const topYears = Object.entries(yearCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        const decadeCount = {};
        allItems.forEach(item => {
            if (item.Year && item.Year !== 'N/A') {
                const year = parseInt(item.Year.split('–')[0]);
                if (!isNaN(year)) {
                    const decade = Math.floor(year / 10) * 10;
                    decadeCount[`${decade}s`] = (decadeCount[`${decade}s`] || 0) + 1;
                }
            }
        });
        
        const topDecades = Object.entries(decadeCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        const movieRatings = [0, 0, 0, 0, 0];
        const showRatings = [0, 0, 0, 0, 0];
        
        movies.forEach(m => {
            if (m.rating > 0) movieRatings[m.rating - 1]++;
        });
        
        shows.forEach(s => {
            if (s.rating > 0) showRatings[s.rating - 1]++;
        });
        
        document.getElementById('analyticsContent').innerHTML = `
            <div class="analytics-card full-width">
                <h3>📊 Collection Overview</h3>
                <div class="overview-stats">
                    <div class="overview-item">
                        <div class="overview-number">${totalItems}</div>
                        <div class="overview-label">Total Items</div>
                    </div>
                    <div class="overview-item">
                        <div class="overview-number">${movies.length}</div>
                        <div class="overview-label">Movies</div>
                    </div>
                    <div class="overview-item">
                        <div class="overview-number">${shows.length}</div>
                        <div class="overview-label">TV Shows</div>
                    </div>
                    <div class="overview-item">
                        <div class="overview-number">${watchRate}%</div>
                        <div class="overview-label">Watch Rate</div>
                    </div>
                    <div class="overview-item">
                        <div class="overview-number">${avgRating}</div>
                        <div class="overview-label">Avg Rating</div>
                    </div>
                    <div class="overview-item">
                        <div class="overview-number">${fiveStarCount}</div>
                        <div class="overview-label">5-Star Items</div>
                    </div>
                    ${totalRuntime > 0 ? `
                        <div class="overview-item">
                            <div class="overview-number">${runtimeHours}h ${runtimeMinutes}m</div>
                            <div class="overview-label">Total Runtime</div>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="analytics-grid">
                <div class="analytics-card">
                    <h3>🎭 Top Genres</h3>
                    ${topGenres.length > 0 ? topGenres.map(([genre, count]) => `
                        <div style="margin-bottom: 15px;">
                            <div class="analytics-item">
                                <span class="analytics-label">${genre}</span>
                                <span class="analytics-value">${count}</span>
                            </div>
                            <div class="genre-bar">
                                <div class="genre-bar-fill" style="width: ${(count / maxGenreCount) * 100}%"></div>
                            </div>
                        </div>
                    `).join('') : '<p style="color:rgba(255,255,255,0.5);">No genre data available</p>'}
                </div>
                
                <div class="analytics-card">
                    <h3>📅 Top Years</h3>
                    ${topYears.length > 0 ? topYears.map(([year, count]) => `
                        <div class="analytics-item">
                            <span class="analytics-label">${year}</span>
                            <span class="analytics-value">${count} items</span>
                        </div>
                    `).join('') : '<p style="color:rgba(255,255,255,0.5);">No year data available</p>'}
                </div>
                
                <div class="analytics-card">
                    <h3>📆 Top Decades</h3>
                    ${topDecades.length > 0 ? topDecades.map(([decade, count]) => `
                        <div class="analytics-item">
                            <span class="analytics-label">${decade}</span>
                            <span class="analytics-value">${count} items</span>
                        </div>
                    `).join('') : '<p style="color:rgba(255,255,255,0.5);">No decade data available</p>'}
                </div>
                
                <div class="analytics-card">
                    <h3>⭐ Movie Rating Distribution</h3>
                    ${movieRatings.some(r => r > 0) ? movieRatings.map((count, index) => `
                        <div class="analytics-item">
                            <span class="analytics-label">${'★'.repeat(index + 1)}${'☆'.repeat(4 - index)}</span>
                            <span class="analytics-value">${count}</span>
                        </div>
                    `).join('') : '<p style="color:rgba(255,255,255,0.5);">No movie ratings yet</p>'}
                </div>
                
                <div class="analytics-card">
                    <h3>⭐ TV Show Rating Distribution</h3>
                    ${showRatings.some(r => r > 0) ? showRatings.map((count, index) => `
                        <div class="analytics-item">
                            <span class="analytics-label">${'★'.repeat(index + 1)}${'☆'.repeat(4 - index)}</span>
                            <span class="analytics-value">${count}</span>
                        </div>
                    `).join('') : '<p style="color:rgba(255,255,255,0.5);">No TV show ratings yet</p>'}
                </div>
                
                <div class="analytics-card">
                    <h3>✅ Watch Status</h3>
                    <div class="analytics-item">
                        <span class="analytics-label">Watched</span>
                        <span class="analytics-value">${watchedItems} (${watchRate}%)</span>
                    </div>
                    <div class="analytics-item">
                        <span class="analytics-label">Unwatched</span>
                        <span class="analytics-value">${totalItems - watchedItems} (${(100 - watchRate).toFixed(1)}%)</span>
                    </div>
                    <div class="analytics-item">
                        <span class="analytics-label">Watched Movies</span>
                        <span class="analytics-value">${movies.filter(m => m.watched).length}</span>
                    </div>
                    <div class="analytics-item">
                        <span class="analytics-label">Watched Shows</span>
                        <span class="analytics-value">${shows.filter(s => s.watched).length}</span>
                    </div>
                </div>
            </div>
        `;
    },

    closeAnalytics() {
        document.getElementById('analyticsModal').classList.remove('active');
    },

    showSettings() {
        document.getElementById('settingsModal').classList.add('active');
    },

    closeSettings() {
        document.getElementById('settingsModal').classList.remove('active');
    },

    exportData() {
        const all = [...this.vault.movies, ...this.vault.shows];
        if (all.length === 0) {
            this.showToast('⚠️ No data to export');
            return;
        }

        const csv = [
            ['Type', 'Title', 'Year', 'IMDb ID', 'Rating', 'Watched', 'Genre'].join(','),
            ...all.map(i => [
                i.Type || 'movie',
                `"${i.Title}"`,
                i.Year,
                i.imdbID,
                i.rating || 0,
                i.watched || false,
                `"${i.Genre || ''}"`
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flickvault_${this.username}_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('📥 Data exported!');
    },

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const res = await fetch(`/api/vault/${this.username}/import`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: event.target.result })
                    });
                    
                    const result = await res.json();
                    
                    if (result.success) {
                        await this.loadVault();
                        this.renderVault();
                        this.updateStats();
                        this.closeSettings();
                        this.showToast(`📤 Imported ${result.imported} items!`);
                    } else {
                        this.showToast('❌ Import failed');
                    }
                } catch (err) {
                    console.error('Import error:', err);
                    this.showToast('❌ Error importing data');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },

    async clearAllData() {
        if (confirm('⚠️ Delete ALL data? This cannot be undone!')) {
            if (confirm('Are you absolutely sure? This will clear your entire vault!')) {
                this.vault = { movies: [], shows: [] };
                await this.saveVault();
                this.renderVault();
                this.updateStats();
                this.closeSettings();
                this.showToast('🗑️ All data cleared');
            }
        }
    }
};

window.addEventListener('DOMContentLoaded', () => app.init());
