# 🎬 FlickVault

A modern, Netflix-inspired personal movie and TV show collection manager with user authentication, ratings, recommendations, and analytics.

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Donate](https://img.shields.io/badge/Donate-orange.svg)](https://buymeacoffee.com/onlycyber)

## ✨ Features

- 🔐 **User Authentication** - Secure personal vaults with file-based storage
- 🔍 **Smart Search** - Search movies and TV shows using TMDB APIs
- ⭐ **Rating System** - Rate content from 1-5 stars
- 📊 **Analytics Dashboard** - Detailed insights into your collection
  - Genre preferences and trends
  - Watch completion rates
  - Rating distributions
  - Total watch time calculation
- 🎭 **Browse by Genre** - Explore popular content by genre with infinite scroll
- 🎯 **Smart Recommendations** - AI-powered suggestions based on your vault
- 📺 **Separate Lists** - Dedicated sections for Movies and TV Shows
- ✅ **Watch Tracking** - Mark content as watched/unwatched
- 📥 **Import/Export** - Backup and restore your vault via CSV
- 🎨 **Premium UI** - Dark theme with smooth animations, glassmorphism, and optimized grid layouts
- 📱 **PWA Support** - Add to Home Screen on iOS and Android with a custom optimized logo

## 🚀 Recent Enhancements

- **Wider Vault Tiles**: Optimized grid layout for movies and TV shows. Tiles are now wider horizontally, allowing for better visibility of titles and ratings.
- **Mobile Home Screen Optimization**: Full PWA support with a custom, edge-to-edge "FlickVault" icon designed specifically for iOS and Android home screens.
- **Improved Analytics**: Now includes dedicated total watch time calculation (hours and minutes) and enhanced visual genre bars.
- **Refined Directory Structure**: Project now uses a standard `public/` directory for better asset management and security.

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- TMDB API Key (free) - [Get one here](https://www.themoviedb.org/settings/api)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/CyberBigfoot/flickvault.git
cd flickvault
```

2. **Configure API Keys**

Edit `docker-compose.yml` and add your API keys:
```yaml
environment:
  - TMDB_API_KEY=your_tmdb_api_key_here
```

3. **Build and Run**
```bash
docker-compose up -d --build
```

4. **Access the Application**

Open your browser to `http://localhost:10800`

## 📱 Mobile Installation (Add to Home Screen)

FlickVault is built as a Progressive Web App (PWA).

**On iOS (iPhone/iPad):**
1. Open the app in **Safari**.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add** in the top right corner.

**On Android:**
1. Open the app in **Chrome**.
2. Tap the **Menu** icon (three dots) in the top right.
3. Tap **"Install app"** or **"Add to Home screen"**.

## 📁 Project Structure

```
flickvault/
├── server.js              # Express backend server
├── Dockerfile              # Docker container configuration
├── docker-compose.yml      # Docker Compose setup
├── package.json           # Node.js dependencies
└── public/                # Static frontend assets
    ├── index.html         # Main HTML file
    ├── style.css          # Styling (Optimized Grids)
    ├── app.js             # Frontend Logic
    ├── manifest.json      # PWA Configuration
    └── apple-touch-icon.png # Optimized Mobile Icon
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TMDB_API_KEY` | TMDB API key for browse/recommendations | Yes |
| `PORT` | Server port (default: 10800) | No |

## 🛠️ API Endpoints

### Authentication
```
POST /api/auth/login
Body: { username, password }
```

### Vault Management
```
GET  /api/vault/:username
POST /api/vault/:username
POST /api/vault/:username/import
```

### Search & Details
```
GET /api/tmdb/search/multi?query={query}
GET /api/tmdb/details/:id?type={movie|tv}
```

### TMDB Integration
```
GET  /api/tmdb/browse/:genre?page={page}
GET  /api/tmdb/recommendations?page={page}
POST /api/tmdb/custom-recommendations
```

## 🧰 Technology Stack

**Backend**
- Node.js 18 (Alpine)
- Express.js
- File-based persistence

**Frontend**
- Vanilla JavaScript (ES6+)
- CSS3 (Flexbox/Grid)
- PWA Web Manifest

**APIs**
- [TMDB API](https://www.themoviedb.org/) - The primary data source

**Deployment**
- Docker & Docker Compose

## 🔒 Security Notes

⚠️ **Important for Production Use:**

This application is designed as a personal project. For production deployment:
1. **Use a Real Database** - Replace file-based storage with PostgreSQL/MongoDB.
2. **Implement Proper Auth** - Add bcrypt hashing and JWT tokens.
3. **Add HTTPS** - Use SSL/TLS encryption.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [TMDB](https://www.themoviedb.org/) for the incredible movie database.
- Inspired by Netflix's UI/UX.

---

Made with ❤️ by [CyberBigfoot]

⭐ If you find this project helpful, please consider giving it a star!
