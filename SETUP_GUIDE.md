# Quick Setup Guide

This guide will help you get the Discord Bot Panel running on your machine in just a few minutes.

## Step 1: Prerequisites

Make sure you have these installed:

- **Node.js** (v18+): https://nodejs.org/
- **Git**: https://git-scm.com/

## Step 2: Clone the Repository

```bash
git clone <repository-url>
cd discord-bot-panel
```

## Step 3: Run Setup Script

### Windows:
```bash
setup.bat
```

### Linux/Mac:
```bash
chmod +x setup.sh
./setup.sh
```

Or manually:
```bash
npm run install-all
```

## Step 4: Configure MongoDB

### Option A: MongoDB Atlas (Easiest - Free)

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for free
3. Create a new cluster (M0 Free tier)
4. Click "Connect" → "Connect your application"
5. Copy the connection string
6. Open `.env` file and paste it:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/botpanel?retryWrites=true&w=majority
   ```

### Option B: Local MongoDB

1. Install MongoDB: https://www.mongodb.com/try/download/community
2. Start MongoDB service
3. In `.env` file:
   ```
   MONGODB_URI=mongodb://localhost:27017/discord-bot-panel
   ```

## Step 5: Configure Environment

Edit the `.env` file:

```env
# Required: Set your MongoDB URI
MONGODB_URI=your_mongodb_connection_string_here

# Required: Generate a secure JWT secret
# Run this command to generate one:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_generated_secret_here

# Optional: Change admin credentials (recommended)
ADMIN_EMAIL=admin@panel.local
ADMIN_PASSWORD=admin123
```

## Step 6: Start the Application

```bash
npm run dev
```

This will start:
- Backend server on http://localhost:5000
- Frontend client on http://localhost:3000

## Step 7: Login

1. Open http://localhost:3000
2. Login with:
   - Email: `admin@panel.local`
   - Password: `admin123`

**⚠️ IMPORTANT:** Change the password after first login!

## Common Issues

### "Cannot connect to MongoDB"
- Check your `MONGODB_URI` in `.env`
- Verify MongoDB is running (if local)
- Check network access in MongoDB Atlas settings

### "Port 5000 already in use"
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

### "PM2 Error: Script not found"
```bash
pm2 kill
npm run dev
```

### Dependencies installation fails
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules client/node_modules
npm run install-all
```

## What's Next?

1. **Create a Bot**: Click "Create Bot" button
2. **Upload Files**: Use the file manager to upload your bot code
3. **Start Bot**: Click "Start" to run your bot
4. **View Logs**: Check the Console tab for real-time logs

## Project Structure

```
discord-bot-panel/
├── client/          # React frontend (port 3000)
├── server/          # Express backend (port 5000)
├── bot-data/        # Bot files (auto-created)
├── .env             # Your configuration
└── package.json     # Dependencies
```

## Need Help?

- Check the main README.md for detailed documentation
- Review the troubleshooting section
- Open an issue on GitHub

---

Happy bot hosting! 🤖
