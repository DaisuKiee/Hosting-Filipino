const mongoose = require('mongoose');

const botSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  containerId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['stopped', 'running', 'error', 'building'],
    default: 'stopped'
  },
  mainFile: {
    type: String,
    default: 'index.js'
  },
  nodeVersion: {
    type: String,
    default: '21'
  },
  port: {
    type: Number,
    default: null
  },
  env: {
    type: Map,
    of: String,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastStarted: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('Bot', botSchema);
