require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const authRoutes = require('./routes/auth');
const botRoutes = require('./routes/bots');
const fileRoutes = require('./routes/files');
const { authenticateSocket } = require('./middleware/auth');
const { ensureDefaultUser } = require('./config/defaultUser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
  console.log('MongoDB connected');
  await ensureDefaultUser();
})
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', mongodb: mongoose.connection.readyState === 1 });
});
app.use('/api/auth', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/files', fileRoutes);

// Socket.IO for real-time console logs
io.use(authenticateSocket);
io.on('connection', (socket) => {
  console.log('Client connected:', socket.user.username);
  
  socket.on('subscribe-logs', (botId) => {
    socket.join(`bot-${botId}`);
  });
  
  socket.on('unsubscribe-logs', (botId) => {
    socket.leave(`bot-${botId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Make io accessible to routes
app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
