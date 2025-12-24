const app = {
    token: null,
    username: null,
    vault: { movies: [], shows: [] },

    async init() {
        // Check for stored token
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

        // Auto-hide header on scroll
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
                        // At the top - always show header
                        header.classList.remove('header-hidden');
                    } else if (scrollTop > lastScrollTop && scrollTop > 100) {
                        // Scrolling down and past 100px - hide header
                        header.classList.add('header-hidden');
                    }
                    // Removed the "scrolling up" condition so header stays hidden
                    // until you reach the top
                    
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
            
            // Ensure ratings exist
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
        } else {
            document.getElementById('moviesVault').classList.add('hidden');
            document.getElementById('showsVault').classList.remove('hidden');
        }
    },

    renderVault() {
        this.renderList('moviesVault', this.vault.movies, 'movie');
        this.renderList('showsVault', this.vault.shows, 'series');
    },

    renderList(containerId, items, type) {
        const div = document.getElementById(containerId);
        
        if (items.length === 0) {
            div.innerHTML = '<p style="text-align:center;color:#aaa;padding:40px;">No items yet. Start searching!</p>';
            return;
        }

        div.innerHTML = items.map(item => `
            <div class="content-card" style="position:relative;">
                ${item.watched ? '<div class="watched-badge">✓ Watched</div>' : ''}
                <img src="${item.Poster !== 'N/A' ? item.Poster : 'https://via.placeholder.com/200x300?text=No+Image'}" alt="${item.Title}">
                <div class="content-card-info">
                    <div class="content-card-title">${item.Title}</div>
                    <div class="content-card-year">${item.Year}</div>
                    <div class="rating-stars">
                        ${[1,2,3,4,5].map(star => `
                            <span class="star ${star <= (item.rating || 0) ? 'filled' : ''}" 
                                  onclick="app.updateRating('${item.imdbID}', '${type}', ${star})">★</span>
                        `).join('')}
                    </div>
                </div>
                <div class="card-actions">
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
                    </div>
                `;
            }
        } catch (err) {
            console.error('Detail error:', err);
            content.innerHTML = '<div style="padding:100px;text-align:center;color:#aaa;">Error loading details</div>';
        }
    },

    closeDetailModal() {
        document.getElementById('detailModal').classList.remove('active');
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

    showRecommendations() {
        document.getElementById('recommendResults').innerHTML = '';
        document.getElementById('recommendModal').classList.add('active');
    },

    closeRecommendations() {
        document.getElementById('recommendModal').classList.remove('active');
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
                             alt="${item.title}"
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
                             alt="${item.title}"
                             onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                        <div class="content-card-info">
                            <div class="content-card-title">${item.title || item.name}</div>
                            <div class="content-card-year">${(item.release_date || item.first_air_date || '')?.split('-')[0] || 'N/A'}</div>
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

    showAnalytics() {
        const movies = this.vault.movies;
        const shows = this.vault.shows;
        const allItems = [...movies, ...shows];
        
        if (allItems.length === 0) {
            this.showToast('⚠️ Add items to see analytics');
            return;
        }

        const stats = this.calculateAnalytics(movies, shows, allItems);
        const content = this.generateAnalyticsHTML(stats);

        document.getElementById('analyticsContent').innerHTML = content;
        document.getElementById('analyticsModal').classList.add('active');
    },

    calculateAnalytics(movies, shows, allItems) {
        const genreCount = {};
        const movieGenres = {};
        const showGenres = {};
        const yearCount = {};
        const decadeCount = {};
        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const movieRatings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const showRatings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        let totalMovieRuntime = 0;
        let totalShowRuntime = 0;
        let movieRuntimeCount = 0;
        let showRuntimeCount = 0;

        allItems.forEach(item => {
            const isMovie = item.Type === 'movie';
            
            if (item.Genre && item.Genre !== 'N/A') {
                item.Genre.split(',').forEach(g => {
                    const genre = g.trim();
                    genreCount[genre] = (genreCount[genre] || 0) + 1;
                    if (isMovie) {
                        movieGenres[genre] = (movieGenres[genre] || 0) + 1;
                    } else {
                        showGenres[genre] = (showGenres[genre] || 0) + 1;
                    }
                });
            }
            
            if (item.Year && item.Year !== 'N/A') {
                const year = parseInt(item.Year.split('–')[0]);
                if (!isNaN(year)) {
                    yearCount[year] = (yearCount[year] || 0) + 1;
                    const decade = Math.floor(year / 10) * 10;
                    decadeCount[decade] = (decadeCount[decade] || 0) + 1;
                }
            }

            if (item.rating > 0) {
                ratingDistribution[item.rating]++;
                if (isMovie) {
                    movieRatings[item.rating]++;
                } else {
                    showRatings[item.rating]++;
                }
            }

            if (item.Runtime && item.Runtime !== 'N/A') {
                const mins = parseInt(item.Runtime);
                if (!isNaN(mins)) {
                    if (isMovie) {
                        totalMovieRuntime += mins;
                        movieRuntimeCount++;
                    } else {
                        totalShowRuntime += mins;
                        showRuntimeCount++;
                    }
                }
            }
        });

        const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const topMovieGenres = Object.entries(movieGenres).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topShowGenres = Object.entries(showGenres).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topYears = Object.entries(yearCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const topDecades = Object.entries(decadeCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
        
        const maxGenreCount = Math.max(...Object.values(genreCount), 1);
        const avgMovieRuntime = movieRuntimeCount > 0 ? Math.round(totalMovieRuntime / movieRuntimeCount) : 0;
        const avgShowRuntime = showRuntimeCount > 0 ? Math.round(totalShowRuntime / showRuntimeCount) : 0;
        const totalHours = Math.round((totalMovieRuntime + totalShowRuntime) / 60);
        
        const watchedMovies = movies.filter(m => m.watched).length;
        const watchedShows = shows.filter(s => s.watched).length;
        const ratedMovies = movies.filter(m => m.rating > 0);
        const ratedShows = shows.filter(s => s.rating > 0);
        
        const avgMovieRating = ratedMovies.length > 0 
            ? (ratedMovies.reduce((sum, m) => sum + m.rating, 0) / ratedMovies.length).toFixed(1)
            : 0;
        const avgShowRating = ratedShows.length > 0 
            ? (ratedShows.reduce((sum, s) => sum + s.rating, 0) / ratedShows.length).toFixed(1)
            : 0;

        return {
            topGenres, topMovieGenres, topShowGenres, topYears, topDecades,
            maxGenreCount, ratingDistribution, movieRatings, showRatings,
            totalHours, avgMovieRuntime, avgShowRuntime,
            watchedMovies, watchedShows,
            movies: movies.length, shows: shows.length, total: allItems.length,
            ratedMovies: ratedMovies.length, ratedShows: ratedShows.length,
            avgMovieRating, avgShowRating,
            fiveStarMovies: movies.filter(m => m.rating === 5).length,
            fiveStarShows: shows.filter(s => s.rating === 5).length,
            completionRate: allItems.length > 0 ? Math.round(((watchedMovies + watchedShows) / allItems.length) * 100) : 0,
            movieCompletionRate: movies.length > 0 ? Math.round((watchedMovies / movies.length) * 100) : 0,
            showCompletionRate: shows.length > 0 ? Math.round((watchedShows / shows.length) * 100) : 0
        };
    },

    generateAnalyticsHTML(s) {
        return `
            <div class="analytics-grid">
                <div class="analytics-card full-width">
                    <h3>📊 Collection Overview</h3>
                    <div class="overview-stats">
                        <div class="overview-item"><div class="overview-number">${s.total}</div><div class="overview-label">Total Items</div></div>
                        <div class="overview-item"><div class="overview-number">${s.movies}</div><div class="overview-label">Movies</div></div>
                        <div class="overview-item"><div class="overview-number">${s.shows}</div><div class="overview-label">TV Shows</div></div>
                        <div class="overview-item"><div class="overview-number">${s.completionRate}%</div><div class="overview-label">Watched</div></div>
                        <div class="overview-item"><div class="overview-number">${s.totalHours}h</div><div class="overview-label">Total Runtime</div></div>
                    </div>
                </div>
                <div class="analytics-card">
                    <h3>🎭 Top Genres (All)</h3>
                    ${s.topGenres.map(([genre, count]) => `
                        <div style="margin-bottom: 15px;">
                            <div class="analytics-item"><span class="analytics-label">${genre}</span><span class="analytics-value">${count}</span></div>
                            <div class="genre-bar"><div class="genre-bar-fill" style="width: ${(count / s.maxGenreCount) * 100}%"></div></div>
                        </div>
                    `).join('')}
                </div>
                <div class="analytics-card">
                    <h3>🎬 Movie Statistics</h3>
                    <div class="analytics-item"><span class="analytics-label">Total Movies</span><span class="analytics-value">${s.movies}</span></div>
                    <div class="analytics-item"><span class="analytics-label">Watched</span><span class="analytics-value">${s.watchedMovies} (${s.movieCompletionRate}%)</span></div>
                    <div class="analytics-item"><span class="analytics-label">Rated</span><span class="analytics-value">${s.ratedMovies}</span></div>
                    <div class="analytics-item"><span class="analytics-label">Avg Rating</span><span class="analytics-value">${s.avgMovieRating} ⭐</span></div>
                    <div class="analytics-item"><span class="analytics-label">5-Star Rated</span><span class="analytics-value">${s.fiveStarMovies}</span></div>
                    <div class="analytics-item"><span class="analytics-label">Avg Runtime</span><span class="analytics-value">${s.avgMovieRuntime} min</span></div>
                    <h4 style="color:#e50914;margin-top:20px;margin-bottom:10px;font-size:14px;">Top Movie Genres</h4>
                    ${s.topMovieGenres.map(([g, c]) => `<div class="analytics-item"><span class="analytics-label">${g}</span><span class="analytics-value">${c}</span></div>`).join('')}
                </div>
                <div class="analytics-card">
                    <h3>📺 TV Show Statistics</h3>
                    <div class="analytics-item"><span class="analytics-label">Total Shows</span><span class="analytics-value">${s.shows}</span></div>
                    <div class="analytics-item"><span class="analytics-label">Watched</span><span class="analytics-value">${s.watchedShows} (${s.showCompletionRate}%)</span></div>
                    <div class="analytics-item"><span class="analytics-label">Rated</span><span class="analytics-value">${s.ratedShows}</span></div>
                    <div class="analytics-item"><span class="analytics-label">Avg Rating</span><span class="analytics-value">${s.avgShowRating} ⭐</span></div>
                    <div class="analytics-item"><span class="analytics-label">5-Star Rated</span><span class="analytics-value">${s.fiveStarShows}</span></div>
                    <div class="analytics-item"><span class="analytics-label">Avg Runtime</span><span class="analytics-value">${s.avgShowRuntime} min</span></div>
                    <h4 style="color:#e50914;margin-top:20px;margin-bottom:10px;font-size:14px;">Top Show Genres</h4>
                    ${s.topShowGenres.map(([g, c]) => `<div class="analytics-item"><span class="analytics-label">${g}</span><span class="analytics-value">${c}</span></div>`).join('')}
                </div>
                <div class="analytics-card">
                    <h3>⭐ Rating Distribution</h3>
                    <h4 style="color:#e50914;margin-bottom:10px;font-size:14px;">All Items</h4>
                    ${[5,4,3,2,1].map(r => `<div class="analytics-item"><span class="analytics-label">${'★'.repeat(r)}</span><span class="analytics-value">${s.ratingDistribution[r]}</span></div>`).join('')}
                    <h4 style="color:#e50914;margin-top:20px;margin-bottom:10px;font-size:14px;">Movies</h4>
                    ${[5,4,3,2,1].map(r => `<div class="analytics-item"><span class="analytics-label">${'★'.repeat(r)}</span><span class="analytics-value">${s.movieRatings[r]}</span></div>`).join('')}
                    <h4 style="color:#e50914;margin-top:20px;margin-bottom:10px;font-size:14px;">TV Shows</h4>
                    ${[5,4,3,2,1].map(r => `<div class="analytics-item"><span class="analytics-label">${'★'.repeat(r)}</span><span class="analytics-value">${s.showRatings[r]}</span></div>`).join('')}
                </div>
                <div class="analytics-card">
                    <h3>📅 Top Years</h3>
                    ${s.topYears.map(([y, c]) => `<div class="analytics-item"><span class="analytics-label">${y}</span><span class="analytics-value">${c} items</span></div>`).join('')}
                    <h4 style="color:#e50914;margin-top:20px;margin-bottom:10px;font-size:14px;">Top Decades</h4>
                    ${s.topDecades.map(([d, c]) => `<div class="analytics-item"><span class="analytics-label">${d}s</span><span class="analytics-value">${c} items</span></div>`).join('')}
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
            
            try {
                const text = await file.text();
                
                const res = await fetch(`/api/vault/${this.username}/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: text })
                });
                
                const result = await res.json();
                
                if (result.success) {
                    await this.loadVault();
                    this.renderVault();
                    this.updateStats();
                    this.closeSettings();
                    this.showToast(`✅ Imported ${result.imported} items!`);
                } else {
                    this.showToast('❌ Import failed');
                }
            } catch (err) {
                console.error('Import error:', err);
                this.showToast('❌ Error importing CSV');
            }
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