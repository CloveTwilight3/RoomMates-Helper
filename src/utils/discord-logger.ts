// discord-logger.ts - Utility to send logs to Discord thread
import { Client, TextChannel, ChannelType, EmbedBuilder } from 'discord.js';

interface LogMessage {
  level: 'info' | 'warn' | 'error' | 'debug' | 'success';
  message: string;
  timestamp?: Date;
  source?: string;
  details?: any;
}

class DiscordLogger {
  private client: Client | null = null;
  private threadId: string;
  private enabled: boolean = false;
  private messageQueue: LogMessage[] = [];
  private isProcessingQueue: boolean = false;

  constructor(threadId: string) {
    this.threadId = threadId;
  }

  /**
   * Initialize the Discord logger with a bot client
   */
  initialize(client: Client): void {
    this.client = client;
    this.enabled = true;
    console.log(`🔗 Discord Logger initialized for thread: ${this.threadId}`);
    
    // Process any queued messages
    this.processMessageQueue();
  }

  /**
   * Log an info message
   */
  info(message: string, source?: string, details?: any): void {
    this.log({ level: 'info', message, source, details });
  }

  /**
   * Log a warning message
   */
  warn(message: string, source?: string, details?: any): void {
    this.log({ level: 'warn', message, source, details });
  }

  /**
   * Log an error message
   */
  error(message: string, source?: string, details?: any): void {
    this.log({ level: 'error', message, source, details });
  }

  /**
   * Log a debug message
   */
  debug(message: string, source?: string, details?: any): void {
    this.log({ level: 'debug', message, source, details });
  }

  /**
   * Log a success message
   */
  success(message: string, source?: string, details?: any): void {
    this.log({ level: 'success', message, source, details });
  }

  /**
   * Log a raw Docker log line
   */
  dockerLog(logLine: string): void {
    // Parse Docker log format
    const timestamp = new Date().toISOString();
    let level: LogMessage['level'] = 'info';
    let cleanMessage = logLine;

    // Detect log level from message content
    if (logLine.toLowerCase().includes('error')) {
      level = 'error';
    } else if (logLine.toLowerCase().includes('warn')) {
      level = 'warn';
    } else if (logLine.toLowerCase().includes('debug')) {
      level = 'debug';
    } else if (logLine.toLowerCase().includes('success') || logLine.toLowerCase().includes('ready')) {
      level = 'success';
    }

    // Clean up Docker log formatting
    cleanMessage = logLine.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\s*/, '');
    cleanMessage = cleanMessage.replace(/^roommates-helper\s*\|\s*/, '');

    this.log({
      level,
      message: cleanMessage,
      source: 'Docker',
      timestamp: new Date(timestamp)
    });
  }

  /**
   * Main logging function
   */
  private log(logData: LogMessage): void {
    // Add timestamp if not provided
    if (!logData.timestamp) {
      logData.timestamp = new Date();
    }

    // Always log to console
    this.logToConsole(logData);

    // Queue for Discord if enabled
    if (this.enabled) {
      this.messageQueue.push(logData);
      this.processMessageQueue();
    }
  }

  /**
   * Log to console with colors
   */
  private logToConsole(logData: LogMessage): void {
    const timestamp = logData.timestamp?.toISOString() || new Date().toISOString();
    const source = logData.source ? `[${logData.source}]` : '';
    
    let prefix = '';
    switch (logData.level) {
      case 'error':
        prefix = '❌';
        break;
      case 'warn':
        prefix = '⚠️';
        break;
      case 'success':
        prefix = '✅';
        break;
      case 'debug':
        prefix = '🔍';
        break;
      default:
        prefix = 'ℹ️';
    }

    console.log(`${prefix} ${timestamp} ${source} ${logData.message}`);
    
    if (logData.details) {
      console.log('   Details:', logData.details);
    }
  }

  /**
   * Process the message queue and send to Discord
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue || this.messageQueue.length === 0 || !this.client) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Get the thread
      const thread = await this.client.channels.fetch(this.threadId);
      
      if (!thread || !thread.isThread()) {
        console.error(`❌ Thread ${this.threadId} not found or is not a thread`);
        this.enabled = false;
        return;
      }

      // Process messages in batches to avoid rate limits
      const batchSize = 5;
      const messagesToProcess = this.messageQueue.splice(0, batchSize);

      for (const logData of messagesToProcess) {
        await this.sendToDiscord(thread, logData);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error('❌ Error processing Discord log queue:', error);
    } finally {
      this.isProcessingQueue = false;
      
      // Process remaining messages if any
      if (this.messageQueue.length > 0) {
        setTimeout(() => this.processMessageQueue(), 1000);
      }
    }
  }

  /**
   * Send a single log message to Discord
   */
  private async sendToDiscord(thread: any, logData: LogMessage): Promise<void> {
    try {
      // Determine embed color based on log level
      let color = 0x5865F2; // Default Discord blue
      let emoji = 'ℹ️';

      switch (logData.level) {
        case 'error':
          color = 0xFF0000; // Red
          emoji = '❌';
          break;
        case 'warn':
          color = 0xFF9900; // Orange
          emoji = '⚠️';
          break;
        case 'success':
          color = 0x00FF00; // Green
          emoji = '✅';
          break;
        case 'debug':
          color = 0x888888; // Gray
          emoji = '🔍';
          break;
      }

      // Create embed for important messages
      if (logData.level === 'error' || logData.level === 'success' || logData.details) {
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(`${emoji} ${logData.level.toUpperCase()}`)
          .setDescription(logData.message.length > 2048 ? 
            logData.message.substring(0, 2045) + '...' : 
            logData.message)
          .setTimestamp(logData.timestamp);

        if (logData.source) {
          embed.setAuthor({ name: logData.source });
        }

        if (logData.details) {
          const detailsStr = typeof logData.details === 'string' ? 
            logData.details : 
            JSON.stringify(logData.details, null, 2);
          
          embed.addFields({
            name: 'Details',
            value: detailsStr.length > 1024 ? 
              detailsStr.substring(0, 1021) + '...' : 
              detailsStr
          });
        }

        await thread.send({ embeds: [embed] });
      } else {
        // Simple text message for info/debug logs
        const timestamp = logData.timestamp?.toLocaleTimeString() || '';
        const source = logData.source ? `[${logData.source}]` : '';
        const message = `${emoji} \`${timestamp}\` ${source} ${logData.message}`;
        
        // Discord has a 2000 character limit
        const truncatedMessage = message.length > 2000 ? 
          message.substring(0, 1997) + '...' : 
          message;
        
        await thread.send(truncatedMessage);
      }

    } catch (error) {
      console.error('❌ Error sending message to Discord thread:', error);
    }
  }

  /**
   * Send a startup message to Discord
   */
  async sendStartupMessage(): Promise<void> {
    if (!this.enabled || !this.client) return;

    try {
      const thread = await this.client.channels.fetch(this.threadId);
      if (!thread || !thread.isThread()) return;

      const embed = new EmbedBuilder()
        .setTitle('🚀 Bot Started')
        .setDescription('The Roommates Helper bot has started successfully!')
        .setColor(0x00FF00)
        .addFields(
          { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>` },
          { name: 'Environment', value: process.env.NODE_ENV || 'development' }
        )
        .setTimestamp();

      await thread.send({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Error sending startup message:', error);
    }
  }

  /**
   * Send a shutdown message to Discord
   */
  async sendShutdownMessage(): Promise<void> {
    if (!this.enabled || !this.client) return;

    try {
      const thread = await this.client.channels.fetch(this.threadId);
      if (!thread || !thread.isThread()) return;

      const embed = new EmbedBuilder()
        .setTitle('🛑 Bot Stopping')
        .setDescription('The Roommates Helper bot is shutting down.')
        .setColor(0xFF9900)
        .setTimestamp();

      await thread.send({ embeds: [embed] });
      
      // Wait a moment for the message to send
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('❌ Error sending shutdown message:', error);
    }
  }
}

// Create and export the logger instance
export const discordLogger = new DiscordLogger('1376289945932660776');

// Export the class for other instances if needed
export { DiscordLogger, LogMessage };