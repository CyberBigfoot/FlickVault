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
            const token = localStorage.getItem('flickvault_token');
            const username = localStorage.getItem('flickvault_username');

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

        // Universal Escape handler for modals and browse page
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Priority 1: Detail Modal
                if (document.getElementById('detailModal').classList.contains('active')) {
                    this.closeDetailModal();
                    return;
                }

                // Priority 2: Recommendations Page
                if (document.getElementById('recommendationsPage').classList.contains('active')) {
                    this.closeRecommendationsPage();
                    return;
                }

                // Priority 3: Show All Panel
                if (document.getElementById('showAllPanel').classList.contains('active')) {
                    this.closeShowAll();
                    return;
                }

                // Priority 4: Stats Page
                if (document.getElementById('statsPage').classList.contains('active')) {
                    this.closeAnalyticsPage();
                    return;
                }

                // Priority 5: Other Modals
                const otherModals = ['settingsModal', 'authModal'];
                for (const m of otherModals) {
                    if (el && el.classList.contains('active')) {
                        const closer = `close${m.replace('Modal', '').charAt(0).toUpperCase() + m.replace('Modal', '').slice(1)}`;
                        if (this[closer]) this[closer]();
                        else el.classList.remove('active');
                        return;
                    }
                }

                // Priority 5: Browse Page
                if (document.getElementById('browsePage').classList.contains('active')) {
                    this.closeBrowse();
                }
            }
        });
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

                localStorage.setItem('flickvault_token', data.token);
                localStorage.setItem('flickvault_username', username);

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
            localStorage.removeItem('flickvault_token');
            localStorage.removeItem('flickvault_username');
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

    // TMDB-only search
    async search() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) {
            this.showToast('⚠️ Enter a search term');
            return;
        }

        const div = document.getElementById('searchResults');
        div.innerHTML = '<div class="loading"><div class="spinner"></div><p>Searching...</p></div>';

        try {
            const res = await fetch(`/api/tmdb/search/multi?query=${encodeURIComponent(query)}`);
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                div.innerHTML = data.results.map(item => `
                    <div class="content-card" onclick="app.showDetailModal(${item.id}, '${item.media_type}')">
                        <div class="content-card-image">
                            <img src="https://image.tmdb.org/t/p/w500${item.poster_path}" alt="${item.title || item.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                            <div class="content-card-overlay">
                                <button class="quick-add-btn" onclick="event.stopPropagation(); app.addFromTMDB(${item.id}, '${item.media_type}')">+ Add</button>
                            </div>
                        </div>
                        <div class="content-card-info">
                            <div class="content-card-title">${item.title || item.name}</div>
                            <div class="content-card-meta">
                                <span class="content-card-year">${(item.release_date || item.first_air_date || '').split('-')[0] || 'N/A'}</span>
                                <span class="content-card-rating">⭐ ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
                            </div>
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
        // Data Parity: Redirect to the extensive details modal
        // This ensures vault items see the exact same rich data as browse items (Cast, X-Ray, etc.)
        if (imdbID.startsWith('tmdb')) {
            const tmdbId = imdbID.replace('tmdb', '');
            const mediaType = type === 'series' ? 'tv' : 'movie';
            // Open the standard detail modal with current vault status knowledge
            this.showDetailModal(tmdbId, mediaType);
        } else {
            // Fallback for old items or manual entries (legacy support)
            // We can try to search for them or just show what we have, 
            // but the user mostly has TMDB items now.
            // Let's try to update it on the fly if it has a title.
            // For now, simple fallback.
            alert('This is a legacy item. Please remove and re-add from browse to get rich data.');
        }
    },

    renderList(containerId, items, type) {
        const div = document.getElementById(containerId);

        if (items.length === 0) {
            div.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;grid-column:1/-1;">No items match your filters</p>';
            return;
        }

        div.innerHTML = items.map(item => `
            <div class="browse-card vault-card" data-id="${item.imdbID}" data-type="${type}" onclick="app.showVaultItemDetail('${item.imdbID}', '${type}')">
                <div class="browse-card-image">
                    <img src="${item.Poster !== 'N/A' ? item.Poster : 'https://via.placeholder.com/200x300?text=No+Image'}" alt="${item.Title}" loading="lazy">
                    ${item.watched ? '<div class="watched-overlay">✓</div>' : ''}
                </div>
                <div class="browse-card-info">
                    <div class="browse-card-title">${item.Title}</div>
                    <div class="browse-card-meta">
                        <span class="browse-card-year">${item.Year}</span>
                        <div class="vault-rating-container">
                            <span class="browse-card-rating">⭐ ${item.rating > 0 ? item.rating : 'Rate'}</span>
                            <div class="rating-popover" onclick="event.stopPropagation()">
                                ${[1, 2, 3, 4, 5].map(star => `
                                    <span class="star ${star <= (item.rating || 0) ? 'filled' : ''}" 
                                          onclick="app.updateRating('${item.imdbID}', '${type}', ${star})">★</span>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="vault-card-actions">
                    <button class="quick-watched-btn" onclick="event.stopPropagation(); app.toggleWatched('${item.imdbID}', '${type}')">
                        ${item.watched ? 'UNWATCH' : 'WATCHED'}
                    </button>
                    <button class="quick-remove-btn" onclick="event.stopPropagation(); app.removeItem('${item.imdbID}', '${type}')">
                        REMOVE
                    </button>
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

    // Full-screen browse page
    showBrowse() {
        const browsePage = document.getElementById('browsePage');
        browsePage.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (!browsePage.hasAttribute('data-loaded')) {
            this.loadBrowsePage();
            browsePage.setAttribute('data-loaded', 'true');
        }
    },

    closeBrowse() {
        document.getElementById('browsePage').classList.remove('active');
        document.body.style.overflow = '';
        if (this.heroInterval) {
            clearInterval(this.heroInterval);
            this.heroInterval = null;
        }
    },

    async loadBrowsePage() {
        // Load hero content
        this.loadBrowseHero();

        // Load content rows
        this.loadBrowseRow('trending-row', '/api/tmdb/trending', '🔥 Trending Now');
        this.loadBrowseRow('popular-movies-row', '/api/tmdb/popular/movies', '🎬 Popular Movies');
        this.loadBrowseRow('popular-tv-row', '/api/tmdb/popular/tv', '📺 Popular TV Shows');
        this.loadBrowseRow('top-movies-row', '/api/tmdb/top-rated/movies', '⭐ Top Rated Movies');
        this.loadBrowseRow('top-tv-row', '/api/tmdb/top-rated/tv', '⭐ Top Rated TV Shows');
    },

    async loadBrowseHero() {
        try {
            const res = await fetch('/api/tmdb/trending?timeWindow=day');
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                // Store hero items for rotation
                this.heroItems = data.results.slice(0, 5);
                this.heroIndex = 0;

                this.renderHeroItem(this.heroItems[0]);

                // Auto-rotate every 8 seconds
                if (this.heroInterval) clearInterval(this.heroInterval);
                this.heroInterval = setInterval(() => {
                    this.heroIndex = (this.heroIndex + 1) % this.heroItems.length;
                    this.renderHeroItem(this.heroItems[this.heroIndex]);
                }, 8000);
            }
        } catch (err) {
            console.error('Hero load error:', err);
        }
    },

    renderHeroItem(featured) {
        const heroSection = document.getElementById('browse-hero');
        const backdrop = featured.backdrop_path ? `https://image.tmdb.org/t/p/original${featured.backdrop_path}` : '';
        const title = featured.title || featured.name;
        const overview = featured.overview || '';
        const mediaType = featured.media_type || 'movie';

        heroSection.innerHTML = `
            <div class="hero-backdrop" style="background-image: url('${backdrop}')"></div>
            <div class="hero-gradient"></div>
            <div class="hero-content">
                <span class="hero-badge">${mediaType === 'tv' ? '📺 TV Show' : '🎬 Movie'}</span>
                <h1 class="hero-title">${title}</h1>
                <p class="hero-overview">${overview.substring(0, 200)}${overview.length > 200 ? '...' : ''}</p>
                <div class="hero-actions">
                    <button class="hero-btn primary" id="heroInfoBtn">ℹ️ More Info</button>
                    <button class="hero-btn secondary" id="heroAddBtn">+ Add to Vault</button>
                </div>
                <div class="hero-dots">
                    ${this.heroItems.map((_, i) => `<span class="hero-dot ${i === this.heroIndex ? 'active' : ''}" data-index="${i}"></span>`).join('')}
                </div>
            </div>
        `;

        // Attach event listeners directly (avoids inline onclick issues)
        document.getElementById('heroInfoBtn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showDetailModal(featured.id, mediaType);
        });

        document.getElementById('heroAddBtn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.addFromTMDB(featured.id, mediaType);
        });

        // Dot navigation
        heroSection.querySelectorAll('.hero-dot').forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(e.target.dataset.index);
                this.heroIndex = index;
                this.renderHeroItem(this.heroItems[index]);
                // Reset interval
                if (this.heroInterval) clearInterval(this.heroInterval);
                this.heroInterval = setInterval(() => {
                    this.heroIndex = (this.heroIndex + 1) % this.heroItems.length;
                    this.renderHeroItem(this.heroItems[this.heroIndex]);
                }, 8000);
            });
        });
    },

    async loadBrowseRow(containerId, apiUrl, title) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="row-header">
                <h3 class="row-title">${title}</h3>
                <button class="row-show-all-btn" data-url="${apiUrl}" data-title="${title}">Show All →</button>
            </div>
            <div class="row-content">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        `;

        // Attach show all button event
        container.querySelector('.row-show-all-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showAllCategory(e.target.dataset.url, e.target.dataset.title);
        });

        try {
            const res = await fetch(apiUrl);
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                const rowContent = container.querySelector('.row-content');
                rowContent.innerHTML = data.results.map(item => `
                    <div class="browse-card" data-id="${item.id}" data-type="${item.media_type || 'movie'}">
                        <div class="browse-card-image">
                            <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${item.title || item.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                            <div class="browse-card-overlay">
                                <button class="quick-add-btn" data-id="${item.id}" data-type="${item.media_type || 'movie'}">+ Add</button>
                            </div>
                        </div>
                        <div class="browse-card-info">
                            <div class="browse-card-title">${item.title || item.name}</div>
                            <div class="browse-card-meta">
                                <span class="browse-card-year">${(item.release_date || item.first_air_date || '').split('-')[0] || ''}</span>
                                <span class="browse-card-rating">⭐ ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                `).join('');

                // Attach card click events
                rowContent.querySelectorAll('.browse-card').forEach(card => {
                    card.addEventListener('click', (e) => {
                        if (!e.target.classList.contains('quick-add-btn')) {
                            e.preventDefault();
                            e.stopPropagation();
                            this.showDetailModal(parseInt(card.dataset.id), card.dataset.type);
                        }
                    });
                });

                // Attach quick add button events
                rowContent.querySelectorAll('.quick-add-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.addFromTMDB(parseInt(btn.dataset.id), btn.dataset.type);
                    });
                });
            }
        } catch (err) {
            console.error(`Error loading ${title}:`, err);
        }
    },

    // Show All Category - Full screen with infinite scroll
    showAllCategory(apiUrl, title) {
        this.showAllApiUrl = apiUrl;
        this.showAllPage = 1;
        this.showAllLoading = false;
        this.showAllHasMore = true;

        const panel = document.getElementById('showAllPanel');
        const titleEl = document.getElementById('showAllTitle');
        const grid = document.getElementById('showAllGrid');

        titleEl.textContent = title;
        grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';

        panel.classList.add('active');

        // Setup infinite scroll
        panel.onscroll = () => {
            if (panel.scrollHeight - panel.scrollTop <= panel.clientHeight + 300) {
                if (!this.showAllLoading && this.showAllHasMore) {
                    this.loadMoreShowAll();
                }
            }
        };

        this.loadShowAllContent(1);
    },

    async loadShowAllContent(page) {
        const grid = document.getElementById('showAllGrid');
        const loading = document.getElementById('showAllLoading');

        try {
            const url = this.showAllApiUrl + (this.showAllApiUrl.includes('?') ? '&' : '?') + `page=${page}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                const html = data.results.map(item => `
                    <div class="browse-card" data-id="${item.id}" data-type="${item.media_type || 'movie'}">
                        <div class="browse-card-image">
                            <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${item.title || item.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                            <div class="browse-card-overlay">
                                <button class="quick-add-btn" data-id="${item.id}" data-type="${item.media_type || 'movie'}">+ Add</button>
                            </div>
                        </div>
                        <div class="browse-card-info">
                            <div class="browse-card-title">${item.title || item.name}</div>
                            <div class="browse-card-meta">
                                <span class="browse-card-year">${(item.release_date || item.first_air_date || '').split('-')[0] || ''}</span>
                                <span class="browse-card-rating">⭐ ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                `).join('');

                if (page === 1) {
                    grid.innerHTML = html;
                } else {
                    grid.insertAdjacentHTML('beforeend', html);
                }

                // Attach event listeners to new cards
                this.attachShowAllCardEvents(grid);

                this.showAllHasMore = data.results.length >= 20;
            } else {
                this.showAllHasMore = false;
                if (page === 1) {
                    grid.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;grid-column:1/-1;">No content found</p>';
                }
            }
        } catch (err) {
            console.error('Show All load error:', err);
            if (page === 1) {
                grid.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;grid-column:1/-1;">Error loading content</p>';
            }
        }
    },

    attachShowAllCardEvents(grid) {
        // Remove existing listeners by cloning (prevents duplicates on pagination)
        grid.querySelectorAll('.browse-card:not([data-bound])').forEach(card => {
            card.setAttribute('data-bound', 'true');
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('quick-add-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showDetailModal(parseInt(card.dataset.id), card.dataset.type);
                }
            });
        });

        grid.querySelectorAll('.quick-add-btn:not([data-bound])').forEach(btn => {
            btn.setAttribute('data-bound', 'true');
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.addFromTMDB(parseInt(btn.dataset.id), btn.dataset.type);
            });
        });
    },

    async loadMoreShowAll() {
        if (this.showAllLoading || !this.showAllHasMore) return;

        this.showAllLoading = true;
        this.showAllPage++;

        const loading = document.getElementById('showAllLoading');
        loading.classList.remove('hidden');

        await this.loadShowAllContent(this.showAllPage);

        loading.classList.add('hidden');
        this.showAllLoading = false;
    },

    closeShowAll() {
        document.getElementById('showAllPanel').classList.remove('active');
    },

    filterBrowseByGenre(genre) {
        // Update active state
        document.querySelectorAll('.browse-genre-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        // Load genre content
        const container = document.getElementById('genre-results-row');
        if (genre === 'all') {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        this.loadBrowseRow('genre-results-row', `/api/tmdb/browse/${genre}`, `${genre.charAt(0).toUpperCase() + genre.slice(1)} Content`);
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
                const releaseDate = item.release_date || item.first_air_date || '';
                const year = releaseDate.split('-')[0];
                const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
                const voteCount = item.vote_count || 0;
                const runtime = item.runtime ? `${item.runtime} min` : (item.episode_run_time?.[0] ? `${item.episode_run_time[0]} min/ep` : '');

                // Determine release status for movies
                let releaseStatus = '';
                let releaseStatusClass = '';
                if (type === 'movie' && releaseDate) {
                    const releaseDateObj = new Date(releaseDate);
                    const today = new Date();
                    const thirtyDaysAgo = new Date(today);
                    thirtyDaysAgo.setDate(today.getDate() - 30);

                    if (releaseDateObj > today) {
                        releaseStatus = '🎬 Coming Soon';
                        releaseStatusClass = 'coming-soon';
                    } else if (releaseDateObj > thirtyDaysAgo && !item.status?.includes('Released')) {
                        releaseStatus = '🎭 In Theaters';
                        releaseStatusClass = 'in-theaters';
                    }
                }

                // Get additional info
                const director = item.credits?.crew?.find(c => c.job === 'Director')?.name || '';
                const cast = item.credits?.cast?.slice(0, 5).map(c => c.name).join(', ') || '';
                const budget = item.budget ? `$${(item.budget / 1000000).toFixed(1)}M` : '';
                const revenue = item.revenue ? `$${(item.revenue / 1000000).toFixed(1)}M` : '';
                const seasons = item.number_of_seasons;
                const episodes = item.number_of_episodes;
                const status = item.status || '';
                const tagline = item.tagline || '';
                const language = item.original_language?.toUpperCase() || '';
                const productionCompanies = item.production_companies?.slice(0, 3).map(c => c.name).join(', ') || '';

                // Get streaming providers
                let availabilityHTML = '';
                try {
                    const providersRes = await fetch(`/api/tmdb/providers/${tmdbId}?type=${type}`);
                    const providersData = await providersRes.json();

                    if (providersData.results && providersData.results.US) {
                        availabilityHTML = this.renderAvailability(providersData.results.US, releaseStatus);
                    } else if (releaseStatus) {
                        availabilityHTML = this.renderAvailability(null, releaseStatus);
                    }
                } catch (err) {
                    console.log('Could not fetch streaming providers:', err);
                    if (releaseStatus) {
                        availabilityHTML = this.renderAvailability(null, releaseStatus);
                    }
                }

                content.innerHTML = `
                    <button class="detail-close-btn" onclick="app.closeDetailModal()">×</button>
                    ${item.backdrop_path ? `<img class="detail-backdrop" src="https://image.tmdb.org/t/p/original${item.backdrop_path}" alt="${title}">` : ''}
                    <div class="detail-info">
                        <div class="detail-header">
                            <img class="detail-poster" src="https://image.tmdb.org/t/p/w500${item.poster_path}" alt="${title}" onerror="this.src='https://via.placeholder.com/150x225?text=No+Image'">
                            <div class="detail-main">
                                <div class="detail-title">${title}</div>
                                ${tagline ? `<div class="detail-tagline">"${tagline}"</div>` : ''}
                                <div class="detail-meta">
                                    <span class="media-badge ${type === 'tv' ? 'tv' : ''}">${type === 'tv' ? 'TV Show' : 'Movie'}</span>
                                    ${releaseStatus ? `<span class="release-status ${releaseStatusClass}">${releaseStatus}</span>` : ''}
                                    <span>📅 ${releaseDate || 'TBA'}</span>
                                    ${runtime ? `<span>⏱️ ${runtime}</span>` : ''}
                                    <span class="detail-rating">⭐ ${rating} <small>(${voteCount.toLocaleString()} votes)</small></span>
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

                        <!-- X-RAY CAST SECTION -->
                        ${item.credits?.cast?.length > 0 ? `
                        <div class="detail-cast-section">
                            <h3 style="color:#e50914;margin-bottom:15px;">👤 Cast & Crew (X-Ray)</h3>
                            <div class="cast-scroller">
                                ${item.credits.cast.slice(0, 15).map(c => `
                                    <div class="cast-card is-interactive" onclick="app.showPersonDetail(${c.id})">
                                        <div class="cast-img-container">
                                            <img src="${c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : 'https://via.placeholder.com/100x150?text=?'}" 
                                                alt="${c.name}" loading="lazy">
                                        </div>
                                        <div class="cast-info">
                                            <div class="cast-name">${c.name}</div>
                                            <div class="cast-role">${c.character}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                        
                        <!-- Additional Details Section -->
                        <div class="detail-extra">
                            ${director ? `<div class="detail-row"><strong>Director:</strong> ${director}</div>` : ''}
                            ${type === 'tv' && seasons ? `<div class="detail-row"><strong>Seasons:</strong> ${seasons} (${episodes} episodes)</div>` : ''}
                            ${status ? `<div class="detail-row"><strong>Status:</strong> ${status}</div>` : ''}
                            ${budget ? `<div class="detail-row"><strong>Budget:</strong> ${budget}</div>` : ''}
                            ${revenue ? `<div class="detail-row"><strong>Box Office:</strong> ${revenue}</div>` : ''}
                            ${productionCompanies ? `<div class="detail-row"><strong>Production:</strong> ${productionCompanies}</div>` : ''}
                        </div>
                        
                        ${availabilityHTML}
                    </div>
                `;
            }
        } catch (err) {
            console.error('Detail error:', err);
            content.innerHTML = '<div style="padding:100px;text-align:center;color:#aaa;">Error loading details</div>';
        }
    },

    // Render availability with release status
    renderAvailability(providers, releaseStatus) {
        let html = '<div class="availability-section">';
        html += '<h3 style="color:#e50914;margin-bottom:15px;">🎬 Where to Watch</h3>';

        // Show release status prominently if movie isn't streaming yet
        if (releaseStatus) {
            const statusClass = releaseStatus.includes('Coming Soon') ? 'coming-soon' : 'in-theaters';
            html += `
                <div class="availability-status ${statusClass}">
                    <div class="status-icon">${releaseStatus.includes('Coming Soon') ? '📅' : '🎭'}</div>
                    <div class="status-text">
                        <strong>${releaseStatus.includes('Coming Soon') ? 'Coming Soon' : 'Currently In Theaters'}</strong>
                        <p>${releaseStatus.includes('Coming Soon') ? 'This movie has not been released yet.' : 'Check your local theater for showtimes.'}</p>
                    </div>
                </div>
            `;
        }

        if (providers) {
            const categories = [
                { key: 'flatrate', label: 'Stream', icon: '▶️', description: 'Included with subscription' },
                { key: 'free', label: 'Free', icon: '🆓', description: 'Watch for free with ads' },
                { key: 'rent', label: 'Rent', icon: '🎫', description: 'Rent for limited time' },
                { key: 'buy', label: 'Buy', icon: '💰', description: 'Purchase to own' }
            ];

            let hasProviders = false;

            categories.forEach(cat => {
                if (providers[cat.key] && providers[cat.key].length > 0) {
                    hasProviders = true;
                    html += `
                        <div class="provider-category">
                            <div class="provider-category-header">
                                <span class="provider-cat-icon">${cat.icon}</span>
                                <span class="provider-cat-label">${cat.label}</span>
                                <span class="provider-cat-desc">${cat.description}</span>
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

            if (!hasProviders && !releaseStatus) {
                html += '<p style="color:rgba(255,255,255,0.5);font-style:italic;">No streaming information available for your region.</p>';
            }
        } else if (!releaseStatus) {
            html += '<p style="color:rgba(255,255,255,0.5);font-style:italic;">Streaming information not available.</p>';
        }

        html += '</div>';
        return html;
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
            const type = mediaType === 'tv' ? 'tv' : 'movie';
            const res = await fetch(`/api/tmdb/details/${tmdbId}?type=${type}`);
            const tmdbData = await res.json();

            const title = tmdbData.title || tmdbData.name;
            const year = (tmdbData.release_date || tmdbData.first_air_date || '').split('-')[0];

            const item = {
                Title: title,
                Year: year,
                Type: type === 'tv' ? 'series' : 'movie',
                Poster: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : 'N/A',
                Genre: tmdbData.genres?.map(g => g.name).join(', ') || 'N/A',
                Plot: tmdbData.overview || 'N/A',
                imdbID: `tmdb${tmdbId}`,
                Runtime: tmdbData.runtime || tmdbData.episode_run_time?.[0] || 'N/A',
                Seasons: tmdbData.number_of_seasons || 0,
                Episodes: tmdbData.number_of_episodes || 0,
                imdbRating: tmdbData.vote_average ? tmdbData.vote_average.toFixed(1) : 'N/A',
                // Store additional rich data for Analytics
                Credits: tmdbData.credits ? {
                    cast: tmdbData.credits.cast?.map(c => ({ name: c.name, id: c.id })).slice(0, 10),
                    crew: tmdbData.credits.crew?.filter(c => c.job === 'Director').map(c => c.name)
                } : null,
                Production: tmdbData.production_companies?.map(c => c.name).join(', ')
            };

            const list = type === 'tv' ? this.vault.shows : this.vault.movies;

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

    // Get all vault IDs for filtering recommendations
    getVaultIds() {
        const ids = [];
        this.vault.movies.forEach(m => ids.push(m.imdbID));
        this.vault.shows.forEach(s => ids.push(s.imdbID));
        return ids;
    },

    switchRecommendTab(tab) {
        document.querySelectorAll('#recommendationsPage .recommend-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        const btn = Array.from(document.querySelectorAll('#recommendationsPage .recommend-tabs .tab-btn')).find(b => b.dataset.tab === tab);
        if (btn) btn.classList.add('active');

        if (tab === 'vault') {
            document.getElementById('vaultRecommendSection').classList.remove('hidden');
            document.getElementById('customRecommendSection').classList.add('hidden');
        } else {
            document.getElementById('vaultRecommendSection').classList.remove('hidden'); // Wait, both should be visible? No, switch logic.
            document.getElementById('vaultRecommendSection').classList.add('hidden');
            document.getElementById('customRecommendSection').classList.remove('hidden');
        }
        document.getElementById('recommendResultsGrid').innerHTML = '';
    },

    showRecommendationsPage() {
        const page = document.getElementById('recommendationsPage');
        page.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.switchRecommendTab('vault');
    },

    closeRecommendationsPage() {
        document.getElementById('recommendationsPage').classList.remove('active');
        document.body.style.overflow = '';
    },

    async getVaultRecommendations() {
        const allItems = [...this.vault.movies, ...this.vault.shows];

        if (allItems.length === 0) {
            this.showToast('⚠️ Add items to your vault first!');
            return;
        }

        this.recommendPage = 1;
        this.recommendLoading = false;
        this.recommendHasMore = true;

        const grid = document.getElementById('recommendResultsGrid');
        grid.innerHTML = '<div class="loading" style="grid-column: 1/-1;"><div class="spinner"></div><p>Analyzing your vault...</p></div>';

        const panel = document.getElementById('recommendationsPage');
        panel.onscroll = () => {
            if (panel.scrollHeight - panel.scrollTop <= panel.clientHeight + 400) {
                if (!this.recommendLoading && this.recommendHasMore) {
                    this.loadMoreRecommendations();
                }
            }
        };

        await this.loadRecommendationContent(1);
    },

    async loadRecommendationContent(page) {
        const grid = document.getElementById('recommendResultsGrid');
        const excludeIds = this.getVaultIds().join(',');

        try {
            const res = await fetch(`/api/tmdb/recommendations?page=${page}&excludeIds=${encodeURIComponent(excludeIds)}`);
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                const html = data.results.map(item => `
                    <div class="browse-card" data-id="${item.id}" data-type="${item.media_type || 'movie'}">
                        <div class="browse-card-image">
                            <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${item.title || item.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                            <div class="browse-card-overlay">
                                <button class="quick-add-btn" data-id="${item.id}" data-type="${item.media_type || 'movie'}">+ Add</button>
                            </div>
                        </div>
                        <div class="browse-card-info">
                            <div class="browse-card-title">${item.title || item.name}</div>
                            <div class="browse-card-meta">
                                <span class="browse-card-year">${(item.release_date || item.first_air_date || '').split('-')[0] || ''}</span>
                                <span class="browse-card-rating">⭐ ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                `).join('');

                if (page === 1) {
                    grid.innerHTML = html;
                } else {
                    grid.insertAdjacentHTML('beforeend', html);
                }

                this.attachShowAllCardEvents(grid); // Reuse event attacher
                this.recommendHasMore = data.results.length >= 20;
            } else if (page === 1) {
                grid.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;grid-column:1/-1;">No recommendations found. Try adding more items!</p>';
                this.recommendHasMore = false;
            } else {
                this.recommendHasMore = false;
            }
        } catch (err) {
            console.error('Recommendation error:', err);
            if (page === 1) {
                grid.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;grid-column:1/-1;">Error loading recommendations.</p>';
            }
        }
    },

    async loadMoreRecommendations() {
        if (this.recommendLoading || !this.recommendHasMore) return;

        this.recommendLoading = true;
        this.recommendPage++;

        const loading = document.getElementById('recommendLoading');
        loading.classList.remove('hidden');

        await this.loadRecommendationContent(this.recommendPage);

        loading.classList.add('hidden');
        this.recommendLoading = false;
    },

    async getCustomRecommendations() {
        const title1 = document.getElementById('recommend1').value.trim();
        const title2 = document.getElementById('recommend2').value.trim();

        if (!title1 || !title2) {
            this.showToast('⚠️ Enter both titles');
            return;
        }

        this.recommendHasMore = false; // Custom match is currently non-paginated in server

        const grid = document.getElementById('recommendResultsGrid');
        grid.innerHTML = '<div class="loading" style="grid-column: 1/-1;"><div class="spinner"></div><p>Finding matches...</p></div>';

        try {
            const excludeIds = this.getVaultIds();
            const res = await fetch('/api/tmdb/custom-recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title1, title2, excludeIds })
            });
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                grid.innerHTML = data.results.map(item => `
                    <div class="browse-card" data-id="${item.id}" data-type="${item.media_type || 'movie'}">
                        <div class="browse-card-image">
                            <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${item.title || item.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                            <div class="browse-card-overlay">
                                <button class="quick-add-btn" data-id="${item.id}" data-type="${item.media_type || 'movie'}">+ Add</button>
                            </div>
                        </div>
                        <div class="browse-card-info">
                            <div class="browse-card-title">${item.title || item.name}</div>
                            <div class="browse-card-meta">
                                <span class="browse-card-year">${(item.release_date || item.first_air_date || '').split('-')[0] || ''}</span>
                                <span class="browse-card-rating">⭐ ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                `).join('');

                this.attachShowAllCardEvents(grid);
            } else {
                grid.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;grid-column: 1/-1;">No matches found. Try different titles!</p>';
            }
        } catch (err) {
            console.error('Custom recommendation error:', err);
            grid.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;grid-column: 1/-1;">Error finding matches.</p>';
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
        this.showRecommendationsPage();
    },
    closeRecommendations() {
        this.closeRecommendationsPage();
    },

    async showPersonDetail(personId) {
        // Person Details Logic
        const content = document.getElementById('detailModalContent');
        // Save current content for "back" functionaluty? No, simple modal for now. 
        // Or render a new modal on top?
        // Let's use a simple overlay or replace content with a "back" button.

        content.innerHTML = '<div class="loading" style="padding:100px;"><div class="spinner"></div><p>Loading person details...</p></div>';

        try {
            const res = await fetch(`/api/tmdb/person/${personId}`);
            const data = await res.json();

            if (!data || data.error) throw new Error('Person not found');

            const knownFor = data.combined_credits?.cast
                ?.sort((a, b) => b.popularity - a.popularity)
                .slice(0, 10) || [];

            content.innerHTML = `
                <button class="detail-close-btn" onclick="app.closeDetailModal()">×</button>
                <div class="detail-info" style="margin-top:20px;">
                    <div class="detail-header">
                        <img class="detail-poster" src="${data.profile_path ? `https://image.tmdb.org/t/p/w500${data.profile_path}` : 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${data.name}" style="border-radius:12px;">
                        <div class="detail-main">
                            <div class="detail-title">${data.name}</div>
                             <div class="detail-meta">
                                <span>🎂 ${data.birthday || 'Unknown'}</span>
                                <span>📍 ${data.place_of_birth || 'Unknown'}</span>
                            </div>
                            ${data.biography ? `
                                <div class="detail-overview" style="margin-top:15px; max-height: 200px; overflow-y: auto; padding-right: 5px;">
                                    <h3 style="color:#e50914;margin-bottom:5px;font-size:16px;">Biography</h3>
                                    <p style="font-size:14px;color:rgba(255,255,255,0.8);">${data.biography}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="detail-cast-section">
                        <h3 style="color:#e50914;margin-bottom:15px;">⭐ Known For</h3>
                        <div class="cast-scroller">
                            ${knownFor.map(c => `
                                <div class="cast-card is-interactive" onclick="event.stopPropagation(); app.showDetailModal(${c.id}, '${c.media_type}')">
                                    <div class="cast-img-container">
                                        <img src="${c.poster_path ? `https://image.tmdb.org/t/p/w185${c.poster_path}` : 'https://via.placeholder.com/100x150?text=?'}" 
                                            alt="${c.title || c.name}" loading="lazy">
                                    </div>
                                    <div class="cast-info">
                                        <div class="cast-name">${c.title || c.name}</div>
                                        <div class="cast-role">${c.character || 'Cast'}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;

        } catch (err) {
            console.error(err);
            content.innerHTML = '<div style="padding:50px;text-align:center;">Error loading details</div>';
        }
    },

    showAnalytics() {
        const movies = this.vault.movies;
        const shows = this.vault.shows;
        const allItems = [...movies, ...shows];

        if (allItems.length === 0) {
            this.showToast('⚠️ Add items to see analytics');
            return;
        }

        const page = document.getElementById('statsPage');
        page.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.getElementById('statsUserTitle').textContent = `${this.username}'s Vault Insights`;

        // --- CALCULATION LOGIC ---

        // 1. Basic Stats
        const totalItems = allItems.length;
        const watchedItems = allItems.filter(i => i.watched).length;
        const watchRate = totalItems > 0 ? ((watchedItems / totalItems) * 100).toFixed(0) : 0;

        const ratedItems = allItems.filter(i => i.rating > 0);
        const avgRating = ratedItems.length > 0
            ? (ratedItems.reduce((sum, i) => sum + i.rating, 0) / ratedItems.length).toFixed(1)
            : '0.0';

        // 2. Precise Watch Time (Total hours & minutes)
        // Movie Time: sum of runtimes
        // Show Time: sum of (episode length * total episodes)
        let totalMinutesWatched = 0;

        movies.forEach(m => {
            if (m.watched && m.Runtime && m.Runtime !== 'N/A') {
                const minutes = parseInt(String(m.Runtime).replace(/\D/g, '')) || 0;
                totalMinutesWatched += minutes;
            }
        });

        shows.forEach(s => {
            if (s.watched) {
                const epRuntime = parseInt(String(s.Runtime).replace(/\D/g, '')) || 0;
                const epCount = parseInt(s.Episodes) || 0;
                totalMinutesWatched += (epRuntime * epCount);
            }
        });

        const totalHours = Math.floor(totalMinutesWatched / 60);
        const remainingMinutes = totalMinutesWatched % 60;
        const timeDisplay = `${totalHours.toLocaleString()}h ${remainingMinutes}m`;

        // 3. Genres
        const genreCount = {};
        allItems.forEach(item => {
            if (item.Genre && item.Genre !== 'N/A') {
                item.Genre.split(',').forEach(g => {
                    const genre = g.trim();
                    genreCount[genre] = (genreCount[genre] || 0) + 1;
                });
            }
        });
        const sortedGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const maxGenreVal = sortedGenres[0]?.[1] || 1;

        // 4. Decades
        const decadeCount = {};
        allItems.forEach(item => {
            if (item.Year) {
                const yearStr = String(item.Year).split('–')[0];
                const year = parseInt(yearStr);
                if (!isNaN(year)) {
                    const decade = Math.floor(year / 10) * 10;
                    decadeCount[`${decade}s`] = (decadeCount[`${decade}s`] || 0) + 1;
                }
            }
        });
        const sortedDecades = Object.entries(decadeCount).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

        // 5. Actors & Directors
        const actorCount = {};
        const directorCount = {};

        allItems.forEach(item => {
            if (item.Credits && item.Credits.cast) {
                item.Credits.cast.forEach(c => {
                    actorCount[c.name] = (actorCount[c.name] || 0) + 1;
                });
            }
            if (item.Credits && item.Credits.crew) {
                item.Credits.crew.forEach(d => {
                    directorCount[d] = (directorCount[d] || 0) + 1;
                });
            }
        });

        const topActors = Object.entries(actorCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const topDirectors = Object.entries(directorCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

        document.getElementById('analyticsContent').innerHTML = `
            <div class="analytics-header-stats">
                 <div class="stat-big">
                    <div class="value">${totalItems}</div>
                    <div class="label">Total Items</div>
                 </div>
                 <div class="stat-big">
                    <div class="value">${avgRating}</div>
                    <div class="label">Avg Rating</div>
                 </div>
                 <div class="stat-big">
                    <div class="value">${watchedItems}</div>
                    <div class="label">Watched</div>
                 </div>
                 <div class="stat-big highlight">
                    <div class="value">${timeDisplay}</div>
                    <div class="label">Total Watch Time</div>
                 </div>
            </div>

            <div class="analytics-grid-new">
                <div class="analytics-panel">
                    <h3>🎭 Content by Genre</h3>
                    <div class="chart-bars">
                        ${sortedGenres.map(([g, c]) => `
                            <div class="chart-row">
                                <span class="chart-label">${g}</span>
                                <div class="chart-bar-bg">
                                    <div class="chart-bar-fill" style="width: ${(c / maxGenreVal) * 100}%"></div>
                                </div>
                                <span class="chart-val">${c}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="analytics-panel">
                    <h3>📅 Eras in Collection</h3>
                     <div class="chart-columns">
                        ${sortedDecades.map(([d, c]) => `
                            <div class="col-item">
                                <div class="col-bar" style="height: ${Math.min(c * 15, 120)}px;"></div>
                                <span class="col-label">${d}</span>
                            </div>
                        `).join('')}
                     </div>
                </div>
                
                <div class="analytics-panel huge-span">
                     <h3>🌟 Most Collected Actors</h3>
                     <div class="person-chips">
                        ${topActors.map(([name, count]) => `
                            <div class="person-chip">
                                <span class="person-name">${name}</span>
                                <span class="person-count">${count}</span>
                            </div>
                        `).join('')}
                     </div>
                </div>

                <div class="analytics-panel huge-span">
                     <h3>🎬 Favorite Directors</h3>
                     <div class="person-chips">
                        ${topDirectors.map(([name, count]) => `
                            <div class="person-chip">
                                <span class="person-name">${name}</span>
                                <span class="person-count">${count}</span>
                            </div>
                        `).join('')}
                     </div>
                </div>
            </div>
        `;
    },

    closeAnalyticsPage() {
        document.getElementById('statsPage').classList.remove('active');
        document.body.style.overflow = '';
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
