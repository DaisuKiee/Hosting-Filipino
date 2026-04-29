const express = require('express');
const { body, validationResult } = require('express-validator');
const Bot = require('../models/Bot');
const { authenticate } = require('../middleware/auth');
const dockerService = require('../services/dockerService');
const pm2Service = require('../services/pm2Service');

const router = express.Router();

// Determine which service to use
function getBotService() {
  return dockerService.isDockerAvailable() ? dockerService : pm2Service;
}

// Get all bots for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const bots = await Bot.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(bots);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single bot
router.get('/:id', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json(bot);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new bot
router.post('/', authenticate, [
  body('name').trim().notEmpty(),
  body('mainFile').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, description, mainFile } = req.body;
    
    const bot = new Bot({
      name,
      description,
      mainFile: mainFile || 'index.js',
      owner: req.user._id
    });
    
    await bot.save();
    const service = getBotService();
    await service.createBotContainer(bot);
    
    res.status(201).json(bot);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start bot
router.post('/:id/start', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const service = getBotService();
    await service.startBot(bot, req.app.get('io'));
    res.json({ message: 'Bot started', bot });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Stop bot
router.post('/:id/stop', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const service = getBotService();
    await service.stopBot(bot);
    res.json({ message: 'Bot stopped', bot });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Restart bot
router.post('/:id/restart', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const service = getBotService();
    await service.restartBot(bot, req.app.get('io'));
    res.json({ message: 'Bot restarted', bot });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Delete bot
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const service = getBotService();
    await service.deleteBot(bot);
    await Bot.deleteOne({ _id: bot._id });
    
    res.json({ message: 'Bot deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Update bot settings
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const { name, description, mainFile, env } = req.body;
    
    if (name) bot.name = name;
    if (description !== undefined) bot.description = description;
    if (mainFile) bot.mainFile = mainFile;
    if (env) bot.env = env;
    
    await bot.save();
    res.json(bot);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
