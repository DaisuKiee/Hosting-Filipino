const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Function to strip ANSI escape codes
function stripAnsiCodes(str) {
  // Remove ANSI escape sequences
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

class PM2Service {
  constructor() {
    this.processes = new Map(); // botId -> process
  }

  async createBotContainer(bot) {
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
      console.error('Error creating bot:', error);
      throw error;
    }
  }

  async startBot(bot, io) {
    try {
      const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
      
      // Always install/update dependencies before starting
      console.log(`Installing dependencies for bot ${bot.name}...`);
      io.to(`bot-${bot._id}`).emit('log', {
        botId: bot._id.toString(),
        message: '📦 Installing dependencies...',
        timestamp: new Date()
      });
      
      await this.installDependencies(botDir, bot._id.toString(), io);
      
      io.to(`bot-${bot._id}`).emit('log', {
        botId: bot._id.toString(),
        message: '✅ Dependencies installed successfully',
        timestamp: new Date()
      });
      
      // Start the bot process
      const botProcess = spawn('node', [bot.mainFile], {
        cwd: botDir,
        env: { ...process.env, ...Object.fromEntries(bot.env || new Map()) }
      });
      
      this.processes.set(bot._id.toString(), botProcess);
      
      // Stream stdout
      botProcess.stdout.on('data', (data) => {
        const log = stripAnsiCodes(data.toString());
        console.log(`[Bot ${bot.name}]:`, log);
        io.to(`bot-${bot._id}`).emit('log', {
          botId: bot._id.toString(),
          message: log,
          timestamp: new Date()
        });
      });
      
      // Stream stderr
      botProcess.stderr.on('data', (data) => {
        const log = stripAnsiCodes(data.toString());
        console.error(`[Bot ${bot.name}]:`, log);
        io.to(`bot-${bot._id}`).emit('log', {
          botId: bot._id.toString(),
          message: `ERROR: ${log}`,
          timestamp: new Date()
        });
      });
      
      // Handle process exit
      botProcess.on('exit', async (code, signal) => {
        console.log(`Bot ${bot.name} exited with code ${code}, signal: ${signal}`);
        this.processes.delete(bot._id.toString());
        
        // Update bot status in database
        try {
          bot.status = code === 0 ? 'stopped' : 'error';
          await bot.save();
          
          // Send exit notification to frontend
          const exitMessage = code === 0 
            ? `Process exited cleanly (code: ${code})`
            : `Process crashed (code: ${code}${signal ? `, signal: ${signal}` : ''})`;
            
          io.to(`bot-${bot._id}`).emit('log', {
            botId: bot._id.toString(),
            message: `🔴 ${exitMessage}`,
            timestamp: new Date()
          });
          
          // Emit status change to update UI
          io.to(`bot-${bot._id}`).emit('bot-status-changed', {
            botId: bot._id.toString(),
            status: bot.status,
            message: exitMessage
          });
          
        } catch (error) {
          console.error('Error updating bot status on exit:', error);
        }
      });
      
      // Handle process errors
      botProcess.on('error', async (error) => {
        console.error(`Bot ${bot.name} process error:`, error);
        this.processes.delete(bot._id.toString());
        
        try {
          bot.status = 'error';
          await bot.save();
          
          io.to(`bot-${bot._id}`).emit('log', {
            botId: bot._id.toString(),
            message: `🔴 Process error: ${error.message}`,
            timestamp: new Date()
          });
          
          io.to(`bot-${bot._id}`).emit('bot-status-changed', {
            botId: bot._id.toString(),
            status: 'error',
            message: `Process error: ${error.message}`
          });
          
        } catch (dbError) {
          console.error('Error updating bot status on error:', dbError);
        }
      });
      
      bot.status = 'running';
      bot.lastStarted = new Date();
      await bot.save();
      
      return bot;
    } catch (error) {
      bot.status = 'error';
      await bot.save();
      throw error;
    }
  }

  async installDependencies(botDir, botId, io) {
    return new Promise((resolve, reject) => {
      const npmInstall = spawn('npm', ['install'], {
        cwd: botDir,
        shell: true
      });
      
      npmInstall.stdout.on('data', (data) => {
        const log = stripAnsiCodes(data.toString());
        console.log(`[Bot ${botId} Install]:`, log);
        io.to(`bot-${botId}`).emit('log', {
          botId,
          message: log,
          timestamp: new Date()
        });
      });
      
      npmInstall.stderr.on('data', (data) => {
        const log = stripAnsiCodes(data.toString());
        console.error(`[Bot ${botId} Install]:`, log);
        io.to(`bot-${botId}`).emit('log', {
          botId,
          message: log,
          timestamp: new Date()
        });
      });
      
      npmInstall.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }

  async stopBot(bot) {
    try {
      const botProcess = this.processes.get(bot._id.toString());
      
      if (botProcess) {
        botProcess.kill('SIGTERM');
        this.processes.delete(bot._id.toString());
      }
      
      bot.status = 'stopped';
      await bot.save();
      
      return bot;
    } catch (error) {
      throw error;
    }
  }

  async restartBot(bot, io) {
    await this.stopBot(bot);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.startBot(bot, io);
  }

  async deleteBot(bot) {
    try {
      // Stop the bot if running
      const botProcess = this.processes.get(bot._id.toString());
      if (botProcess) {
        botProcess.kill('SIGTERM');
        this.processes.delete(bot._id.toString());
      }
      
      // Delete bot files
      const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
      await fs.rm(botDir, { recursive: true, force: true });
      
      return true;
    } catch (error) {
      console.error('Error deleting bot:', error);
      throw error;
    }
  }
}

module.exports = new PM2Service();
