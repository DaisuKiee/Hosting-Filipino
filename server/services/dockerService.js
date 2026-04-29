const Docker = require('dockerode');
const path = require('path');
const fs = require('fs').promises;

let docker;
let dockerAvailable = false;

// Function to strip ANSI escape codes
function stripAnsiCodes(str) {
  // Remove ANSI escape sequences
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Check if Docker is available
try {
  docker = new Docker();
  docker.ping().then(() => {
    dockerAvailable = true;
    console.log('Docker is available');
  }).catch(() => {
    console.warn('Docker is not available. Please start Docker Desktop to manage bots.');
    dockerAvailable = false;
  });
} catch (error) {
  console.warn('Docker is not available. Please start Docker Desktop to manage bots.');
  dockerAvailable = false;
}

class DockerService {
  isDockerAvailable() {
    return dockerAvailable;
  }

  checkDockerAvailable() {
    if (!dockerAvailable) {
      throw new Error('Docker is not running. Please start Docker Desktop first.');
    }
  }

  async createBotContainer(bot) {
    this.checkDockerAvailable();
    try {
      const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
      await fs.mkdir(botDir, { recursive: true });
      
      // Create default package.json
      const defaultPackage = {
        name: bot.name.toLowerCase().replace(/\s+/g, '-'),
        version: '1.0.0',
        main: bot.mainFile,
        scripts: {
          start: `node ${bot.mainFile}`
        },
        dependencies: {
          'discord.js': '^14.14.1'
        }
      };
      
      await fs.writeFile(
        path.join(botDir, 'package.json'),
        JSON.stringify(defaultPackage, null, 2)
      );
      
      // Create default bot file
      const defaultBot = `const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on('ready', () => {
  console.log(\`Logged in as \${client.user.tag}!\`);
});

client.on('messageCreate', (message) => {
  if (message.content === '!ping') {
    message.reply('Pong!');
  }
});

client.login(process.env.DISCORD_TOKEN);
`;
      
      await fs.writeFile(path.join(botDir, bot.mainFile), defaultBot);
      
      // Create .env file
      await fs.writeFile(
        path.join(botDir, '.env'),
        'DISCORD_TOKEN=your_token_here\n'
      );
      
      bot.status = 'stopped';
      await bot.save();
      
      return bot;
    } catch (error) {
      console.error('Error creating bot container:', error);
      throw error;
    }
  }

  async startBot(bot, io) {
    this.checkDockerAvailable();
    try {
      const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
      
      // Check if container exists
      let container;
      if (bot.containerId) {
        try {
          container = docker.getContainer(bot.containerId);
          await container.inspect();
        } catch (error) {
          container = null;
          bot.containerId = null;
        }
      }
      
      // Create new container if doesn't exist
      if (!container) {
        // Send installation start message
        io.to(`bot-${bot._id}`).emit('log', {
          botId: bot._id.toString(),
          message: '📦 Creating container and installing dependencies...',
          timestamp: new Date()
        });
        
        container = await docker.createContainer({
          Image: 'node:21-alpine',
          name: `bot-${bot._id}`,
          Cmd: ['sh', '-c', 'echo "📦 Installing dependencies..." && npm install && echo "✅ Dependencies installed successfully" && echo "🚀 Starting bot..." && npm start'],
          WorkingDir: '/app',
          Env: this.getEnvArray(bot.env),
          HostConfig: {
            Binds: [`${botDir}:/app`],
            RestartPolicy: {
              Name: 'unless-stopped',
              MaximumRetryCount: 0
            },
            AutoRemove: false
          },
          Tty: true
        });
        
        bot.containerId = container.id;
      } else {
        // If container exists, send restart message
        io.to(`bot-${bot._id}`).emit('log', {
          botId: bot._id.toString(),
          message: '🔄 Restarting container...',
          timestamp: new Date()
        });
      }
      
      await container.start();
      
      bot.status = 'running';
      bot.lastStarted = new Date();
      await bot.save();
      
      // Stream logs
      this.streamLogs(container, bot._id.toString(), io);
      
      return bot;
    } catch (error) {
      bot.status = 'error';
      await bot.save();
      throw error;
    }
  }

  async stopBot(bot) {
    this.checkDockerAvailable();
    try {
      if (!bot.containerId) {
        bot.status = 'stopped';
        await bot.save();
        return bot;
      }
      
      const container = docker.getContainer(bot.containerId);
      await container.stop();
      
      bot.status = 'stopped';
      await bot.save();
      
      return bot;
    } catch (error) {
      if (error.statusCode === 304) {
        bot.status = 'stopped';
        await bot.save();
        return bot;
      }
      throw error;
    }
  }

  async restartBot(bot, io) {
    await this.stopBot(bot);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.startBot(bot, io);
  }

  async deleteBot(bot) {
    this.checkDockerAvailable();
    try {
      if (bot.containerId) {
        const container = docker.getContainer(bot.containerId);
        try {
          await container.stop();
        } catch (error) {
          // Container might already be stopped
        }
        await container.remove();
      }
      
      const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
      await fs.rm(botDir, { recursive: true, force: true });
      
      return true;
    } catch (error) {
      console.error('Error deleting bot:', error);
      throw error;
    }
  }

  async streamLogs(container, botId, io) {
    try {
      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        timestamps: true
      });
      
      stream.on('data', (chunk) => {
        const log = stripAnsiCodes(chunk.toString('utf8'));
        io.to(`bot-${botId}`).emit('log', {
          botId,
          message: log,
          timestamp: new Date()
        });
      });
      
      stream.on('end', () => {
        console.log(`Log stream ended for bot ${botId}`);
      });
      
      // Monitor container status
      container.wait((err, data) => {
        if (err) {
          console.error(`Container wait error for bot ${botId}:`, err);
          return;
        }
        
        console.log(`Container exited for bot ${botId}, exit code:`, data.StatusCode);
        
        // Update bot status based on exit code
        const Bot = require('../models/Bot');
        Bot.findById(botId).then(bot => {
          if (bot) {
            bot.status = data.StatusCode === 0 ? 'stopped' : 'error';
            bot.save().then(() => {
              const exitMessage = data.StatusCode === 0 
                ? `Container exited cleanly (code: ${data.StatusCode})`
                : `Container crashed (code: ${data.StatusCode})`;
                
              io.to(`bot-${botId}`).emit('log', {
                botId,
                message: `🔴 ${exitMessage}`,
                timestamp: new Date()
              });
              
              io.to(`bot-${botId}`).emit('bot-status-changed', {
                botId,
                status: bot.status,
                message: exitMessage
              });
            });
          }
        }).catch(error => {
          console.error('Error updating bot status on container exit:', error);
        });
      });
      
    } catch (error) {
      console.error('Error streaming logs:', error);
    }
  }

  getEnvArray(envMap) {
    const envArray = [];
    if (envMap) {
      for (const [key, value] of Object.entries(envMap)) {
        envArray.push(`${key}=${value}`);
      }
    }
    return envArray;
  }
}

module.exports = new DockerService();
