#!/bin/bash

# Discord Bot Panel - Setup Script
# This script helps set up the project for first-time users

echo "🤖 Discord Bot Panel - Setup Script"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

echo "✅ npm version: $(npm -v)"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created"
    echo "⚠️  Please edit .env file with your MongoDB URI and other settings"
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Create bot-data directory if it doesn't exist
if [ ! -d bot-data ]; then
    echo "📁 Creating bot-data directory..."
    mkdir bot-data
    echo "✅ bot-data directory created"
    echo ""
else
    echo "✅ bot-data directory already exists"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
echo "This may take a few minutes..."
echo ""

# Install server dependencies
echo "Installing server dependencies..."
npm install

# Install client dependencies
echo "Installing client dependencies..."
cd client
npm install
cd ..

echo ""
echo "✅ All dependencies installed!"
echo ""

# Check if MongoDB URI is set
if grep -q "your_mongodb_connection_string" .env; then
    echo "⚠️  WARNING: MongoDB URI not configured!"
    echo "Please edit .env file and set your MONGODB_URI"
    echo ""
fi

# Check if JWT_SECRET is set
if grep -q "your_super_secret_jwt_key_here" .env; then
    echo "⚠️  WARNING: JWT_SECRET not configured!"
    echo "Please edit .env file and set a secure JWT_SECRET"
    echo ""
fi

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Run 'npm run dev' to start the application"
echo "3. Open http://localhost:3000 in your browser"
echo "4. Login with default credentials:"
echo "   Email: admin@panel.local"
echo "   Password: admin123"
echo ""
echo "⚠️  Remember to change the default password after first login!"
echo ""
