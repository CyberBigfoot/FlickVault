# 🎬 FlickVault

A modern, Netflix-inspired personal movie and TV show collection manager with user authentication, ratings, recommendations, and analytics.

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Donate](https://img.shields.io/badge/Donate-orange.svg)](https://buymeacoffee.com/onlycyber)
## ✨ Features

- 🔐 **User Authentication** - Secure personal vaults with file-based storage
- 🔍 **Smart Search** - Search movies and TV shows using OMDb and TMDB APIs
- ⭐ **Rating System** - Rate content from 1-5 stars
- 📊 **Analytics Dashboard** - Detailed insights into your collection
  - Genre preferences and trends
  - Watch completion rates
  - Rating distributions
  - Decade/year analysis
- 🎭 **Browse by Genre** - Explore popular content by genre with infinite scroll
- 🎯 **Smart Recommendations** - AI-powered suggestions based on:
  - Your vault's genre preferences
  - Custom two-title matching
- 📺 **Separate Lists** - Dedicated sections for Movies and TV Shows
- ✅ **Watch Tracking** - Mark content as watched/unwatched
- 📥 **Import/Export** - Backup and restore your vault via CSV
- 🎨 **Modern UI** - Dark theme with smooth animations and responsive design
- 📱 **Mobile Friendly** - Fully responsive interface

## 📸 Screenshots

<img width="1433" height="905" alt="Screenshot 2025-12-24 134341" src="https://github.com/user-attachments/assets/f216df82-01b0-4fb7-94aa-a42d12222dfc" />


## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- OMDb API Key (free) - [Get one here](http://www.omdbapi.com/apikey.aspx)
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
  - OMDB_API_KEY=your_omdb_api_key_here
  - TMDB_API_KEY=your_tmdb_api_key_here
```

3. **Build and Run**
```bash
docker-compose up -d
```

4. **Access the Application**

Open your browser to `http://localhost:10800`

## 📁 Project Structure

```
flickvault/
├── Dockerfile              # Docker container configuration
├── docker-compose.yml      # Docker Compose setup
├── package.json           # Node.js dependencies
├── server.js              # Express backend server
└── public/
    ├── index.html         # Main HTML file
    ├── style.css          # Styling
    └── app.js             # Frontend JavaScript
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OMDB_API_KEY` | OMDb API key for movie/TV data | Yes |
| `TMDB_API_KEY` | TMDB API key for browse/recommendations | Yes |
| `PORT` | Server port (default: 10800) | No |

### Data Persistence

User data is stored in Docker volume `flickvault_data` at `/data` inside the container. Each user gets a separate JSON file for their vault.

## 📖 Usage Guide

### Getting Started

1. **Register/Login** - Create an account or login with existing credentials
2. **Search Content** - Use the search bar to find movies or TV shows
3. **Add to Vault** - Click "Add to Vault" on any item
4. **Rate & Track** - Click stars to rate, use buttons to mark as watched

### Features

#### Browse Popular Content
- Click "Browse" in the header
- Filter by genre (Action, Comedy, Drama, etc.)
- Infinite scroll for continuous discovery
- Click any item for detailed information

#### Get Recommendations
- **My Vault**: AI recommendations based on your collection's genres
- **Custom Match**: Enter two titles you love for personalized suggestions

#### Analytics Dashboard
View comprehensive statistics:
- Collection overview (total items, watch rates, runtime)
- Top genres with visual bars
- Rating distributions for movies and TV shows separately
- Most common years and decades
- Average ratings and 5-star counts

#### Import/Export
- **Export**: Download your vault as CSV for backup
- **Import**: Restore from CSV file
- **Clear**: Reset your vault completely

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
GET /api/search?query={query}&type={movie|series}
GET /api/details/:imdbID
```

### TMDB Integration
```
GET  /api/tmdb/browse/:genre?page={page}
GET  /api/tmdb/details/:id?type={movie|tv}
GET  /api/tmdb/recommendations?page={page}
POST /api/tmdb/custom-recommendations
Body: { title1, title2 }
```

### Health Check
```
GET /health
```

## 🧰 Technology Stack

**Backend**
- Node.js 18
- Express.js
- node-fetch

**Frontend**
- Vanilla JavaScript (ES6+)
- CSS3 with animations
- Responsive design

**APIs**
- [OMDb API](http://www.omdbapi.com/) - Movie & TV data
- [TMDB API](https://www.themoviedb.org/) - Browse & recommendations

**Deployment**
- Docker
- Docker Compose

## 🐳 Docker Commands

```bash
# Start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down

# Rebuild after code changes
docker-compose up -d --build

# Remove everything including volumes
docker-compose down -v
```

## 🔒 Security Notes

⚠️ **Important for Production Use:**

This application is designed as a personal project. For production deployment:

1. **Use a Real Database** - Replace file-based storage with PostgreSQL/MongoDB
2. **Implement Proper Auth** - Add password hashing (bcrypt), JWT tokens
3. **Add HTTPS** - Use SSL/TLS encryption
4. **Environment Variables** - Use `.env` files, never commit secrets
5. **Rate Limiting** - Implement API rate limiting
6. **Input Validation** - Add comprehensive validation and sanitization
7. **Error Handling** - Implement proper error logging and handling

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OMDb API](http://www.omdbapi.com/) for movie and TV show data
- [TMDB](https://www.themoviedb.org/) for additional content and images
- Inspired by Netflix's UI/UX design

## 📧 Support

If you encounter any issues or have questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section below

## 🐛 Troubleshooting

**Container won't start?**
```bash
# Check if port 10800 is available
lsof -i :10800

# View detailed logs
docker-compose logs -f
```

**Search not working?**
- Verify API keys are correctly set in `docker-compose.yml`
- Check you haven't exceeded API rate limits
- OMDb free tier: 1,000 requests/day
- TMDB free tier: Check your account dashboard

**Can't login?**
```bash
# Restart the container
docker-compose restart

# Clear browser data (if needed)
# In browser console: localStorage.clear()
```

**Data not persisting?**
```bash
# Check volume exists
docker volume ls | grep flickvault

# Inspect volume
docker volume inspect flickvault_data
```

---

Made with ❤️ by [Grant]

⭐ If you find this project helpful, please consider giving it a star!
