# Discord Bot Hosting Panel

A modern, self-hosted Discord bot management panel with a beautiful dark theme UI. Manage multiple Discord bots with real-time console logs, file management, and more.

## Features

- 🎨 Modern dark theme UI with glassmorphism design
- 🤖 Manage multiple Discord bots from one panel
- � VS Code-like file manager with drag-and-drop
- 📦 Archive support (ZIP, TAR, RAR, 7Z)
- � Real-time console logs via WebSocket
- � Auto npm install on bot start
- 🐳 Docker + PM2 hybrid bot execution
- 🔐 JWT authentication
- � MongoDB database
- 📝 Monaco Editor (VS Code editor)
- 🎯 Toast notifications
- � Responsive design

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB** - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier) or local installation
- **Docker** (optional) - For Docker-based bot execution
- **Git** - For cloning the repository

## Installation

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd discord-bot-panel
```

### 2. Install Dependencies

Install both server and client dependencies:

```bash
npm run install-all
```

Or manually:

```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=your_mongodb_connection_string

# JWT Secret (generate a random string)
JWT_SECRET=your_super_secret_jwt_key_here

# Admin Account (will be auto-created on first run)
ADMIN_EMAIL=admin@panel.local
ADMIN_PASSWORD=admin123
```

**Important:** Change the `JWT_SECRET` and `ADMIN_PASSWORD` to secure values!

### 4. MongoDB Setup

#### Option A: MongoDB Atlas (Recommended for beginners)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster (free tier)
4. Click "Connect" → "Connect your application"
5. Copy the connection string
6. Replace `<password>` with your database password
7. Paste it in your `.env` file as `MONGODB_URI`

#### Option B: Local MongoDB

```bash
# Install MongoDB locally
# Then use:
MONGODB_URI=mongodb://localhost:27017/discord-bot-panel
```

### 5. Create Required Directories

The `bot-data` folder will be created automatically, but you can create it manually:

```bash
mkdir bot-data
```

## Running the Application

### Development Mode (Recommended for development)

Runs both server and client with hot-reload:

```bash
npm run dev
```

- Server: http://localhost:5000
- Client: http://localhost:3000

### Production Mode

Build the client and run the server:

```bash
# Build client
npm run build

# Start server
npm start
```

## Default Login Credentials

On first run, an admin account is automatically created:

- **Email:** admin@panel.local
- **Password:** admin123

**⚠️ IMPORTANT:** Change these credentials after first login!

## Project Structure

```
discord-bot-panel/
├── client/                 # React frontend
│   ├── public/
│   └── src/
│       ├── components/     # Reusable components
│       ├── context/        # React context (Auth)
│       ├── pages/          # Page components
│       └── App.js
├── server/                 # Express backend
│   ├── config/            # Configuration files
│   ├── middleware/        # Express middleware
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   ├── services/          # Bot execution services
│   └── index.js           # Server entry point
├── bot-data/              # Bot files (gitignored)
├── .env                   # Environment variables (gitignored)
├── .env.example           # Environment template
├── package.json           # Server dependencies
└── README.md              # This file
```

## Usage Guide

### Creating a Bot

1. Click "Create Bot" button
2. Enter bot name, description, and main file (default: index.js)
3. Click "Create"

### Managing Bot Files

1. Click "Manage" on any bot card
2. Use the file manager to:
   - Create files/folders
   - Upload files (including archives)
   - Edit files with Monaco Editor (auto-save enabled)
   - Extract archives (ZIP, TAR, etc.)
   - Drag and drop files (hold 500ms to drag)
   - Bulk select and archive/delete

### Starting a Bot

1. The system automatically runs `npm install` before starting
2. Click "Start" button
3. View real-time logs in the Console tab
4. Bot status updates automatically

### File Editor

- Auto-save after 1 second of inactivity
- Syntax highlighting for multiple languages
- VS Code-like experience
- Supports: JS, TS, JSON, Python, HTML, CSS, YAML, .env, etc.

## Troubleshooting

### PM2 Error: "Script not found"

This error occurs when PM2 tries to run without proper configuration. To fix:

```bash
# Stop all PM2 processes
pm2 kill

# Start the application normally
npm run dev
```

### MongoDB Connection Error

- Check your `MONGODB_URI` in `.env`
- Ensure MongoDB is running (if local)
- Check network access in MongoDB Atlas
- Verify database user permissions

### Port Already in Use

If port 5000 or 3000 is already in use:

```bash
# Find and kill the process
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:5000 | xargs kill -9
```

### Docker Not Available

The system automatically falls back to PM2 if Docker is not available. No action needed.

### Bot Won't Start

1. Check the Console tab for error messages
2. Verify `package.json` exists in bot directory
3. Ensure main file path is correct
4. Check bot logs for specific errors

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Bots
- `GET /api/bots` - Get all bots
- `GET /api/bots/:id` - Get bot by ID
- `POST /api/bots` - Create bot
- `PATCH /api/bots/:id` - Update bot
- `DELETE /api/bots/:id` - Delete bot
- `POST /api/bots/:id/start` - Start bot
- `POST /api/bots/:id/stop` - Stop bot
- `POST /api/bots/:id/restart` - Restart bot

### Files
- `GET /api/files/:botId/tree` - Get file tree
- `GET /api/files/:botId/file` - Read file
- `POST /api/files/:botId/file` - Write file
- `POST /api/files/:botId/create` - Create file/folder
- `POST /api/files/:botId/upload` - Upload files
- `POST /api/files/:botId/extract` - Extract archive
- `POST /api/files/:botId/archive` - Create archive
- `POST /api/files/:botId/move` - Move file/folder
- `DELETE /api/files/:botId/file` - Delete file/folder

## Technologies Used

### Frontend
- React 19
- React Router
- Axios
- Socket.IO Client
- Monaco Editor
- React Icons
- Font Awesome

### Backend
- Node.js
- Express
- MongoDB + Mongoose
- Socket.IO
- JWT Authentication
- PM2
- Docker (optional)
- Multer (file uploads)
- AdmZip, tar, node-7z (archives)

## Security Notes

- Change default admin credentials immediately
- Use strong JWT_SECRET
- Keep .env file secure (never commit to git)
- Use HTTPS in production
- Regularly update dependencies
- Implement rate limiting for production
- Use environment-specific configurations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section

## Roadmap

- [ ] Multi-user support with roles
- [ ] Bot templates
- [ ] Scheduled bot restarts
- [ ] Resource monitoring (CPU, RAM)
- [ ] Bot logs export
- [ ] Webhook integrations
- [ ] Custom themes
- [ ] Mobile app

---

Made with ❤️ for Discord bot developers
